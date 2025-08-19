import type { CommentAnalysis, AutoResponseDecision } from "../types/mr-feedback.js";

export interface ResponseExecutionResult {
  success: boolean;
  noteId?: string;
  error?: string;
  responseContent: string;
  discussionId: string;
}

export interface AutoResponseConfig {
  enabled: boolean;
  requireApprovalForDisagreements: boolean;
  requireApprovalForAnswers: boolean;
  dryRun: boolean; // If true, don't actually post responses
  maxResponsesPerSession: number;
}

export interface GitLabResponseClient {
  createMergeRequestNote: (
    projectId: string,
    mergeRequestIid: number | string,
    discussionId: string,
    body: string
  ) => Promise<any>;
}

export class AutoResponseService {
  private config: AutoResponseConfig;
  private gitlabClient: GitLabResponseClient;
  private responsesPostedThisSession: number = 0;

  constructor(config: AutoResponseConfig, gitlabClient: GitLabResponseClient) {
    this.config = config;
    this.gitlabClient = gitlabClient;
  }

  /**
   * Process all comment analyses and determine which ones should get automatic responses
   */
  async processCommentAnalyses(
    analyses: CommentAnalysis[],
    projectId: string,
    mergeRequestIid: number | string
  ): Promise<{
    plannedResponses: CommentAnalysis[];
    executedResponses: ResponseExecutionResult[];
    skippedResponses: { analysis: CommentAnalysis; reason: string }[];
  }> {
    const plannedResponses: CommentAnalysis[] = [];
    const executedResponses: ResponseExecutionResult[] = [];
    const skippedResponses: { analysis: CommentAnalysis; reason: string }[] = [];

    if (!this.config.enabled) {
      console.log('🤖 Auto-response is disabled');
      return { plannedResponses, executedResponses, skippedResponses };
    }

    console.log('🤖 Processing analyses for automatic responses...');
    console.log(`📊 Session limits: ${this.responsesPostedThisSession}/${this.config.maxResponsesPerSession} responses used`);
    console.log(`⚙️  Config: approval_disagreements=${this.config.requireApprovalForDisagreements}, approval_answers=${this.config.requireApprovalForAnswers}`);

    // Filter analyses that should get responses
    let candidateCount = 0;
    for (const analysis of analyses) {
      const decision = analysis.autoResponseDecision;
      
      if (!decision || !decision.shouldRespond) {
        continue;
      }
      
      candidateCount++;
      console.log(`🔍 [${candidateCount}] Evaluating response for comment ${analysis.id} (${decision.responseType}, confidence: ${Math.round(decision.confidence * 100)}%)`);

      // Check if we've hit our session limit
      if (this.responsesPostedThisSession >= this.config.maxResponsesPerSession) {
        console.log(`⚠️  [${candidateCount}] SKIPPED - Session limit reached (${this.responsesPostedThisSession}/${this.config.maxResponsesPerSession})`);
        skippedResponses.push({
          analysis,
          reason: `Session limit reached (${this.config.maxResponsesPerSession} responses)`
        });
        continue;
      }

      // Check if resolved threads should be skipped
      if (analysis.threadMetadata.isResolved) {
        console.log(`⚠️  [${candidateCount}] SKIPPED - Thread is resolved`);
        skippedResponses.push({
          analysis,
          reason: 'Thread is resolved'
        });
        continue;
      }

      // Check approval requirements
      if (this.shouldRequireApproval(decision)) {
        console.log(`⚠️  [${candidateCount}] SKIPPED - Requires human approval (type: ${decision.responseType}, confidence: ${Math.round(decision.confidence * 100)}%)`);
        skippedResponses.push({
          analysis,
          reason: 'Requires human approval'
        });
        continue;
      }

      console.log(`✅ [${candidateCount}] APPROVED - Will attempt to post response`);
      plannedResponses.push(analysis);

      // Execute the response if not in dry-run mode
      if (!this.config.dryRun) {
        console.log(`📤 [${candidateCount}] POSTING - Making GitLab API call...`);
        try {
          const result = await this.executeResponse(
            analysis,
            projectId,
            mergeRequestIid
          );
          executedResponses.push(result);
          this.responsesPostedThisSession++;
          console.log(`🎉 [${candidateCount}] SUCCESS - Response posted with note ID: ${result.noteId}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`❌ [${candidateCount}] FAILED - Error posting response: ${errorMessage}`);
          executedResponses.push({
            success: false,
            error: errorMessage,
            responseContent: decision.responseContent,
            discussionId: analysis.threadMetadata.discussionId
          });
        }
      }
    }

    return { plannedResponses, executedResponses, skippedResponses };
  }

  /**
   * Execute a single response
   */
  private async executeResponse(
    analysis: CommentAnalysis,
    projectId: string,
    mergeRequestIid: number | string
  ): Promise<ResponseExecutionResult> {
    const decision = analysis.autoResponseDecision!;
    const discussionId = analysis.threadMetadata.discussionId;

    // Validate discussion ID before attempting to create note
    if (!discussionId || discussionId === 'unknown' || discussionId === 'fallback-analysis' || discussionId === 'claude-api-fallback') {
      console.warn(`⚠️  Skipping response due to invalid discussion ID: ${discussionId}`);
      return {
        success: false,
        noteId: undefined,
        responseContent: decision.responseContent,
        discussionId,
        error: `Invalid or placeholder discussion ID: ${discussionId}`
      };
    }

    console.log(`📝 Posting ${decision.responseType} response to discussion ${discussionId}`);

    try {
      const noteResponse = await this.gitlabClient.createMergeRequestNote(
        projectId,
        mergeRequestIid,
        discussionId,
        decision.responseContent
      );

      return {
        success: true,
        noteId: noteResponse.id?.toString(),
        responseContent: decision.responseContent,
        discussionId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to post response to discussion ${discussionId}:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        responseContent: decision.responseContent,
        discussionId
      };
    }
  }

  /**
   * Determine if a response requires human approval
   */
  private shouldRequireApproval(decision: AutoResponseDecision): boolean {
    // Always require approval if explicitly marked
    if (decision.requiresApproval) {
      return true;
    }

    // Check configuration-based approval requirements
    if (decision.responseType === 'disagreement' && this.config.requireApprovalForDisagreements) {
      return true;
    }

    if (decision.responseType === 'answer_question' && this.config.requireApprovalForAnswers) {
      return true;
    }

    // Low confidence responses should require approval
    if (decision.confidence < 0.7) {
      return true;
    }

    return false;
  }

  /**
   * Get summary statistics for this session
   */
  getSessionSummary(): {
    responsesPosted: number;
    remainingResponses: number;
    sessionLimit: number;
  } {
    return {
      responsesPosted: this.responsesPostedThisSession,
      remainingResponses: Math.max(0, this.config.maxResponsesPerSession - this.responsesPostedThisSession),
      sessionLimit: this.config.maxResponsesPerSession
    };
  }

  /**
   * Reset session counters (useful for testing)
   */
  resetSession(): void {
    this.responsesPostedThisSession = 0;
  }

  /**
   * Get display-friendly description of a response type
   */
  static getResponseTypeDescription(responseType: AutoResponseDecision['responseType']): string {
    switch (responseType) {
      case 'disagreement':
        return 'Disagreement/Correction';
      case 'clarification_request':
        return 'Clarification Request';
      case 'answer_question':
        return 'Answer Question';
      case 'none':
      default:
        return 'No Response';
    }
  }

  /**
   * Validate response content for safety
   */
  static validateResponseContent(content: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (!content.trim()) {
      issues.push('Response content is empty');
    }
    
    if (content.length > 2000) {
      issues.push('Response content is too long (>2000 characters)');
    }
    
    // Check for potentially problematic content
    const problematicPatterns = [
      /you're wrong/i,
      /that's stupid/i,
      /bad idea/i,
      /terrible/i,
      /awful/i
    ];
    
    for (const pattern of problematicPatterns) {
      if (pattern.test(content)) {
        issues.push('Response contains potentially hostile language');
        break;
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}