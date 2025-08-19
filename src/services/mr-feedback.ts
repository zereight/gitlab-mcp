import type { 
  CommentAnalysis, 
  MrFeedbackAnalysis, 
  MrWithAnalysis,
  AnalysisSummary 
} from "../types/mr-feedback.js";
import { detectCurrentBranch } from "../utils/git.js";
import { analyzeComment, createAnalysisSummary } from "../utils/comment-analysis.js";
import { analyzeDiscussionThread, buildThreadContext, shouldAnalyzeForAction, getThreadSummary } from "../utils/thread-analysis.js";
import { AutoResponseService, type AutoResponseConfig, type ResponseExecutionResult } from "./auto-response.js";
import { AutoFixService, type AutoFixConfig } from "./auto-fix.js";

// Re-export these types/functions that the service layer needs
// These would normally be imported from a separate GitLab client module
// For now, we'll define the interfaces we need and let the calling code provide implementations

interface GitLabApiClient {
  getMergeRequest: (projectId: string, mergeRequestIid?: number | string, branchName?: string) => Promise<any>;
  getMergeRequestDiffs: (projectId: string, mergeRequestIid: number | string) => Promise<any>;
  listMergeRequestDiscussions: (projectId: string, mergeRequestIid: number | string, options?: any) => Promise<any>;
  getEffectiveProjectId: (projectId: string) => string;
  createMergeRequestNote?: (projectId: string, mergeRequestIid: number | string, discussionId: string, body: string) => Promise<any>;
}

interface MrFeedbackServiceConfig {
  gitlabProjectId?: string;
  gitlabApiClient: GitLabApiClient;
  autoResponseConfig?: AutoResponseConfig;
  autoFixConfig?: AutoFixConfig;
}

export class MrFeedbackService {
  private config: MrFeedbackServiceConfig;

  constructor(config: MrFeedbackServiceConfig) {
    this.config = config;
  }

  /**
   * Find the merge request associated with a git branch
   */
  async findMergeRequestForBranch(args: {
    projectId?: string;
    branchName?: string;
    workingDirectory?: string;
  }): Promise<any> {
    // Determine project ID and branch name
    const projectId = this.config.gitlabApiClient.getEffectiveProjectId(args.projectId || this.config.gitlabProjectId || '');
    if (!projectId) {
      throw new Error("Project ID is required. Provide it via argument or GITLAB_PROJECT_ID environment variable.");
    }

    const branchName = args.branchName || await detectCurrentBranch(args.workingDirectory);
    
    // Use existing getMergeRequest function with branchName
    try {
      const mergeRequest = await this.config.gitlabApiClient.getMergeRequest(projectId, undefined, branchName);
      return mergeRequest;
    } catch (error) {
      throw new Error(`Failed to find merge request for branch '${branchName}': ${error}`);
    }
  }

  /**
   * Analyze merge request feedback/comments with pagination and filtering
   */
  async analyzeMrFeedback(args: {
    projectId?: string;
    mergeRequestIid?: string;
    branchName?: string;
    workingDirectory?: string;
    maxComments?: number;
    offset?: number;
    categoryFilter?: string[];
    minSeverity?: number;
    riskThreshold?: string;
    summaryOnly?: boolean;
    includeResolved?: boolean;
  }): Promise<MrFeedbackAnalysis> {
    // Get the merge request - either by ID or by branch
    let mergeRequest: any;
    const projectId = this.config.gitlabApiClient.getEffectiveProjectId(args.projectId || this.config.gitlabProjectId || '');
    if (!projectId) {
      throw new Error("Project ID is required.");
    }
    
    if (args.mergeRequestIid) {
      // Get MR directly by IID
      mergeRequest = await this.config.gitlabApiClient.getMergeRequest(projectId, args.mergeRequestIid);
    } else {
      // Get MR by branch
      mergeRequest = await this.findMergeRequestForBranch({
        projectId: args.projectId,
        branchName: args.branchName || await detectCurrentBranch(args.workingDirectory),
        workingDirectory: args.workingDirectory
      });
    }

    // Get merge request discussions/comments with proper pagination to ensure we get ALL discussions
    console.log(`🔍 Fetching discussions for MR ${mergeRequest.iid}...`);
    const discussions = await this.config.gitlabApiClient.listMergeRequestDiscussions(projectId, mergeRequest.iid.toString(), { per_page: 100 });
    console.log(`📋 Retrieved ${discussions.items?.length || 0} discussions from GitLab API`);
    
    // Get diffs for enhanced analysis context
    let diffs: any;
    try {
      diffs = await this.config.gitlabApiClient.getMergeRequestDiffs(projectId, mergeRequest.iid.toString());
    } catch (error) {
      console.warn('Failed to fetch MR diffs for enhanced analysis:', error);
      diffs = null;
    }
    
    // Analyze all discussions to understand thread structures and resolution status
    console.log('🧵 Analyzing discussion threads...');
    const discussionAnalyses = new Map<string, any>();
    
    for (const discussion of discussions.items) {
      const threadMetadataArray = analyzeDiscussionThread(discussion);
      discussionAnalyses.set(discussion.id, {
        discussion,
        threadMetadataArray,
        isResolved: threadMetadataArray[0]?.isResolved || false
      });
    }
    
    // Collect notes for analysis, separating actionable from context-only
    const actionableNotes: Array<{ note: any, discussion: any, threadMetadata: any }> = [];
    const contextOnlyNotes: Array<{ note: any, discussion: any, threadMetadata: any }> = [];
    let totalNotes = 0;
    let systemNotes = 0;
    let resolvedThreads = 0;
    
    for (const discussion of discussions.items) {
      const analysisData = discussionAnalyses.get(discussion.id);
      
      // Skip resolved threads if not requested
      if (analysisData?.isResolved) {
        resolvedThreads++;
        if (!args.includeResolved) {
          continue;
        }
      }
      
      for (let noteIndex = 0; noteIndex < discussion.notes.length; noteIndex++) {
        const note = discussion.notes[noteIndex];
        const threadMetadata = analysisData?.threadMetadataArray[noteIndex];
        
        totalNotes++;
        if (note.system) {
          systemNotes++;
          continue; // Skip system notes
        }
        
        const noteData = { note, discussion, threadMetadata };
        
        if (shouldAnalyzeForAction(threadMetadata)) {
          actionableNotes.push(noteData);
        } else {
          contextOnlyNotes.push(noteData);
        }
      }
    }
    
    // Apply pagination and filtering
    const maxComments = args.maxComments || 20;
    const offset = args.offset || 0;
    
    console.log(`📊 Pagination: ${actionableNotes.length} total notes, showing ${maxComments} starting from ${offset}`);
    
    // Apply offset and limit
    let filteredNotes = actionableNotes.slice(offset, offset + maxComments);
    
    console.log(`📊 Found ${totalNotes} total notes (${systemNotes} system, ${actionableNotes.length} actionable, ${contextOnlyNotes.length} context-only)`);
    console.log(`🧵 Thread summary: ${discussions.items.length} discussions (${resolvedThreads} resolved)`);
    console.log(`📋 Processing ${filteredNotes.length} notes after pagination`);
    
    // Analyze filtered actionable comments in batches
    const commentAnalysis: CommentAnalysis[] = [];
    const batchSize = 10; // Process 10 comments at a time
    const batches = [];
    
    // Split filtered notes into batches
    for (let i = 0; i < filteredNotes.length; i += batchSize) {
      batches.push(filteredNotes.slice(i, i + batchSize));
    }
    
    console.log(`🔄 Processing ${filteredNotes.length} filtered actionable comments in ${batches.length} batches of ${batchSize}`);
    if (contextOnlyNotes.length > 0) {
      console.log(`📚 Found ${contextOnlyNotes.length} resolved/context-only comments that will inform analysis but not generate action items`);
    }
    if (offset > 0) {
      console.log(`⏭️  Skipped first ${offset} comments due to pagination`);
    }
    
    // Process each batch with a delay between batches
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchNumber = batchIndex + 1;
      
      console.log(`📦 Processing batch ${batchNumber}/${batches.length} (${batch.length} comments)...`);
      
      // Process comments in this batch in parallel
      const batchPromises = batch.map(async ({ note, discussion, threadMetadata }) => {
        try {
          // Build thread context for enhanced analysis
          const threadContext = buildThreadContext(
            threadMetadata.discussionId,
            threadMetadata.threadPosition,
            threadMetadata.conversationFlow
          );
          
          // Enhance merge request context with thread information
          const enhancedMergeRequestContext = {
            title: mergeRequest?.title,
            description: mergeRequest?.description,
            source_branch: mergeRequest?.source_branch,
            target_branch: mergeRequest?.target_branch,
            diffs: diffs,
            threadContext: threadContext
          };
          
          const analysis = await analyzeComment(note, enhancedMergeRequestContext, diffs);
          
          // Add thread metadata to the analysis
          return {
            ...analysis,
            threadMetadata
          } as CommentAnalysis;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`⚠️  Failed to analyze comment by ${note.author?.username}: ${errorMessage}`);
          // Return a basic analysis for failed comments with thread metadata
          return {
            id: note.id,
            body: note.body,
            author: note.author?.username || 'unknown',
            category: 'minor',
            severity: 1,
            confidence: 0.1,
            isValid: false,
            reasoning: 'Analysis failed due to error',
            suggestedResponse: 'Analysis failed - manual review required',
            threadMetadata
          } as CommentAnalysis;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      commentAnalysis.push(...batchResults);
      
      console.log(`✅ Completed batch ${batchNumber}/${batches.length} (${batchResults.length} analyses)`);
      
      // Add delay between batches (except for the last batch)
      if (batchIndex < batches.length - 1) {
        console.log(`⏳ Waiting 1 second before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Apply post-analysis filtering
    let filteredAnalysis = commentAnalysis;
    
    // Filter by category if specified
    if (args.categoryFilter && args.categoryFilter.length > 0) {
      const beforeCount = filteredAnalysis.length;
      filteredAnalysis = filteredAnalysis.filter(analysis => 
        args.categoryFilter!.includes(analysis.category)
      );
      console.log(`🗓️  Category filter: ${beforeCount} → ${filteredAnalysis.length} comments`);
    }
    
    // Filter by minimum severity if specified
    if (args.minSeverity && args.minSeverity > 1) {
      const beforeCount = filteredAnalysis.length;
      filteredAnalysis = filteredAnalysis.filter(analysis => 
        analysis.severity >= args.minSeverity!
      );
      console.log(`⚠️  Severity filter (>=${args.minSeverity}): ${beforeCount} → ${filteredAnalysis.length} comments`);
    }

    // Filter by risk threshold if specified
    if (args.riskThreshold) {
      const beforeCount = filteredAnalysis.length;
      const riskLevels = ["very_low", "low", "medium", "high", "very_high"];
      const maxRiskIndex = riskLevels.indexOf(args.riskThreshold);
      
      if (maxRiskIndex === -1) {
        console.warn(`⚠️  Invalid risk threshold: ${args.riskThreshold}`);
      } else {
        filteredAnalysis = filteredAnalysis.filter(analysis => {
          // Only filter if the analysis has risk assessment
          if (!analysis.riskAssessment?.riskScore) {
            return true; // Include comments without risk assessment
          }
          
          // Convert numeric risk score (1-10) to risk level
          const riskScore = analysis.riskAssessment.riskScore;
          let commentRiskLevel: string;
          if (riskScore <= 2) commentRiskLevel = "very_low";
          else if (riskScore <= 4) commentRiskLevel = "low";
          else if (riskScore <= 6) commentRiskLevel = "medium";
          else if (riskScore <= 8) commentRiskLevel = "high";
          else commentRiskLevel = "very_high";
          
          const commentRiskIndex = riskLevels.indexOf(commentRiskLevel);
          return commentRiskIndex <= maxRiskIndex;
        });
        console.log(`🎲 Risk threshold filter (<=${args.riskThreshold}): ${beforeCount} → ${filteredAnalysis.length} comments`);
      }
    }

    // Create summary
    const summary = createAnalysisSummary(filteredAnalysis);

    // If summary-only mode, return condensed data
    if (args.summaryOnly) {
      console.log('📊 Summary-only mode: returning condensed analysis');
      return {
        mergeRequest: {
          title: mergeRequest.title,
          iid: mergeRequest.iid,
          web_url: mergeRequest.web_url,
          source_branch: mergeRequest.source_branch,
          target_branch: mergeRequest.target_branch,
          author: mergeRequest.author
        },
        commentAnalysis: filteredAnalysis.map(analysis => ({
          id: analysis.id,
          author: analysis.author,
          category: analysis.category,
          severity: analysis.severity,
          confidence: analysis.confidence,
          isValid: analysis.isValid,
          reasoning: analysis.reasoning.slice(0, 200), // Truncate reasoning
          body: analysis.body.slice(0, 100), // Truncate comment body
          threadMetadata: analysis.threadMetadata, // Include required field
          autoResponseDecision: analysis.autoResponseDecision ? {
            shouldRespond: analysis.autoResponseDecision.shouldRespond,
            responseType: analysis.autoResponseDecision.responseType,
            responseReason: analysis.autoResponseDecision.responseReason.slice(0, 100),
            responseContent: analysis.autoResponseDecision.responseContent.slice(0, 200),
            confidence: analysis.autoResponseDecision.confidence,
            requiresApproval: analysis.autoResponseDecision.requiresApproval
          } : undefined,
          autoFixDecision: analysis.autoFixDecision ? {
            shouldFix: analysis.autoFixDecision.shouldFix,
            fixType: analysis.autoFixDecision.fixType,
            fixReason: analysis.autoFixDecision.fixReason.slice(0, 100),
            confidence: analysis.autoFixDecision.confidence,
            estimatedRisk: analysis.autoFixDecision.estimatedRisk,
            affectedFiles: analysis.autoFixDecision.affectedFiles,
            codeChanges: analysis.autoFixDecision.codeChanges.slice(0, 3), // Limit to first 3 changes
            requiresApproval: analysis.autoFixDecision.requiresApproval,
            prerequisites: analysis.autoFixDecision.prerequisites.slice(0, 3) // Limit prerequisites
          } : undefined
        })),
        summary: {
          ...summary,
          totalOriginalComments: actionableNotes.length,
          totalFilteredComments: filteredAnalysis.length,
          paginationInfo: {
            offset: args.offset || 0,
            maxComments: args.maxComments || 20,
            hasMore: (args.offset || 0) + filteredAnalysis.length < actionableNotes.length
          },
          appliedFilters: {
            categoryFilter: args.categoryFilter,
            minSeverity: args.minSeverity,
            riskThreshold: args.riskThreshold,
            includeResolved: args.includeResolved
          }
        }
      };
    }

    // Process automatic responses if configured (full mode only)
    let autoResponseResults;
    if (this.config.autoResponseConfig && this.config.gitlabApiClient.createMergeRequestNote) {
      const autoResponseService = new AutoResponseService(
        this.config.autoResponseConfig,
        {
          createMergeRequestNote: this.config.gitlabApiClient.createMergeRequestNote
        }
      );

      try {
        autoResponseResults = await autoResponseService.processCommentAnalyses(
          filteredAnalysis,
          projectId,
          mergeRequest.iid
        );

        console.log(`🤖 Auto-response summary: ${autoResponseResults.executedResponses.length} posted, ${autoResponseResults.skippedResponses.length} skipped`);
      } catch (error) {
        console.warn('⚠️  Auto-response processing failed:', error);
      }
    }

    // Process automatic fixes if configured (full mode only)
    let autoFixResults;
    if (this.config.autoFixConfig) {
      const autoFixService = new AutoFixService(this.config.autoFixConfig);

      try {
        autoFixResults = await autoFixService.processCommentAnalyses(
          filteredAnalysis,
          mergeRequest,
          args.workingDirectory
        );

        console.log(`🔧 Auto-fix summary: ${autoFixResults.appliedFixes.length} applied, ${autoFixResults.skippedFixes.length} skipped`);
        if (autoFixResults.gitStatus.isOnCorrectBranch) {
          console.log(`✅ Git status: On correct branch (${autoFixResults.gitStatus.currentBranch})`);
        } else {
          console.log(`⚠️  Git status: Wrong branch (expected: ${autoFixResults.gitStatus.expectedBranch}, current: ${autoFixResults.gitStatus.currentBranch})`);
        }
      } catch (error) {
        console.warn('⚠️  Auto-fix processing failed:', error);
      }
    }

    // Add pagination metadata to summary
    const enhancedSummary = {
      ...summary,
      totalOriginalComments: actionableNotes.length,
      totalFilteredComments: filteredAnalysis.length,
      paginationInfo: {
        offset: args.offset || 0,
        maxComments: args.maxComments || 20,
        hasMore: (args.offset || 0) + (args.maxComments || 20) < actionableNotes.length,
        totalAvailable: actionableNotes.length
      },
      appliedFilters: {
        categoryFilter: args.categoryFilter,
        minSeverity: args.minSeverity,
        riskThreshold: args.riskThreshold,
        includeResolved: args.includeResolved
      }
    };

    return {
      mergeRequest,
      commentAnalysis: filteredAnalysis,
      summary: enhancedSummary,
      autoResponseResults,
      autoFixResults
    };
  }

  /**
   * Get complete merge request context with analysis
   */
  async getMrWithAnalysis(args: {
    projectId?: string;
    mergeRequestIid?: string;
    branchName?: string;
    workingDirectory?: string;
  }): Promise<MrWithAnalysis> {
    const analysis = await this.analyzeMrFeedback(args);
    
    // Get additional context like diffs
    const projectId = this.config.gitlabApiClient.getEffectiveProjectId(args.projectId || this.config.gitlabProjectId || '');
    if (!projectId) {
      throw new Error("Project ID is required.");
    }

    const diffs = await this.config.gitlabApiClient.getMergeRequestDiffs(projectId, analysis.mergeRequest.iid.toString());

    return {
      ...analysis,
      diffs
    };
  }
}

// Standalone functions for backward compatibility
export async function findMergeRequestForBranch(
  args: {
    projectId?: string;
    branchName?: string;
    workingDirectory?: string;
  },
  apiClient: GitLabApiClient,
  defaultProjectId?: string
): Promise<any> {
  const service = new MrFeedbackService({ 
    gitlabProjectId: defaultProjectId, 
    gitlabApiClient: apiClient 
  });
  return service.findMergeRequestForBranch(args);
}

export async function analyzeMrFeedback(
  args: {
    projectId?: string;
    mergeRequestIid?: string;
    branchName?: string;
    workingDirectory?: string;
    autoResponseConfig?: AutoResponseConfig;
    autoFixConfig?: AutoFixConfig;
  },
  apiClient: GitLabApiClient,
  defaultProjectId?: string
): Promise<MrFeedbackAnalysis> {
  const service = new MrFeedbackService({ 
    gitlabProjectId: defaultProjectId, 
    gitlabApiClient: apiClient,
    autoResponseConfig: args.autoResponseConfig,
    autoFixConfig: args.autoFixConfig
  });
  return service.analyzeMrFeedback(args);
}

export async function getMrWithAnalysis(
  args: {
    projectId?: string;
    mergeRequestIid?: string;
    branchName?: string;
    workingDirectory?: string;
  },
  apiClient: GitLabApiClient,
  defaultProjectId?: string
): Promise<MrWithAnalysis> {
  const service = new MrFeedbackService({ 
    gitlabProjectId: defaultProjectId, 
    gitlabApiClient: apiClient 
  });
  return service.getMrWithAnalysis(args);
}