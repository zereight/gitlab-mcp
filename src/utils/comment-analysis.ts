import type { CommentAnalysis, AnalysisSummary } from "../types/mr-feedback.js";
import { ClaudeAnalysisClient, type ClaudeConfig } from "../clients/claude-api.js";

// Global Claude client instance
let claudeClient: ClaudeAnalysisClient | null = null;

/**
 * Initialize Claude API client
 */
export function initializeClaudeClient(config: ClaudeConfig): void {
  claudeClient = new ClaudeAnalysisClient(config);
}

/**
 * Analyze a single comment using Claude API or fallback to heuristics
 */
export async function analyzeComment(note: any, mergeRequestContext: any, diffs?: any): Promise<CommentAnalysis> {
  // Try Claude API if available
  if (claudeClient) {
    try {
      // Use the enhanced context if provided, otherwise build basic context
      const analysisContext = mergeRequestContext.threadContext ? mergeRequestContext : {
        title: mergeRequestContext?.title,
        description: mergeRequestContext?.description,
        source_branch: mergeRequestContext?.source_branch,
        target_branch: mergeRequestContext?.target_branch,
        diffs: diffs || mergeRequestContext?.diffs
      };

      return await claudeClient.analyzeComment(
        {
          id: note.id?.toString() || 'unknown',
          body: note.body || '',
          author: note.author
        },
        analysisContext
      );
    } catch (error) {
      console.warn('Claude API analysis failed, falling back to heuristics:', error);
    }
  }

  // Fallback to heuristic analysis
  return analyzeCommentHeuristic(note, mergeRequestContext);
}

/**
 * Heuristic-based comment analysis (fallback)
 */
export async function analyzeCommentHeuristic(note: any, mergeRequest: any): Promise<CommentAnalysis> {
  const body = note.body || "";
  const author = note.author?.username || "unknown";
  
  let category: CommentAnalysis['category'] = "minor";
  let severity = 3;
  let confidence = 0.7;
  let isValid = true;
  let reasoning = "";
  
  // Security-related keywords
  const securityKeywords = ["security", "vulnerable", "exploit", "xss", "sql injection", "csrf", "authentication", "authorization"];
  if (securityKeywords.some(keyword => body.toLowerCase().includes(keyword))) {
    category = "security";
    severity = 9;
    confidence = 0.9;
    reasoning = "Contains security-related keywords";
  }
  // Critical/functional issues
  else if (body.toLowerCase().includes("bug") || body.toLowerCase().includes("error") || body.toLowerCase().includes("crash")) {
    category = "critical";
    severity = 8;
    confidence = 0.8;
    reasoning = "Mentions bugs, errors, or crashes";
  }
  // Functional improvements
  else if (body.toLowerCase().includes("performance") || body.toLowerCase().includes("optimization")) {
    category = "functional"; 
    severity = 6;
    confidence = 0.7;
    reasoning = "Performance or optimization related";
  }
  // Style/formatting
  else if (body.toLowerCase().includes("style") || body.toLowerCase().includes("format") || body.toLowerCase().includes("lint")) {
    category = "style";
    severity = 2;
    confidence = 0.9;
    reasoning = "Style or formatting related";
  }
  // Questions
  else if (body.includes("?") || body.toLowerCase().startsWith("why") || body.toLowerCase().startsWith("how")) {
    category = "question";
    severity = 4;
    confidence = 0.8;
    reasoning = "Appears to be a question";
  }

  return {
    id: note.id?.toString() || 'unknown',
    body,
    author,
    category,
    severity,
    confidence,
    isValid,
    reasoning,
    suggestedResponse: generateSuggestedResponse(category, body),
    // Provide basic enhanced analysis even in fallback mode
    agreementAssessment: {
      agreesWithSuggestion: true, // Conservative default for heuristic analysis
      agreementConfidence: 0.6,
      agreementReasoning: 'Heuristic analysis - unable to provide detailed agreement assessment without Claude API',
      additionalConsiderations: ['Consider consulting with domain experts', 'Review similar patterns in codebase']
    },
    riskAssessment: {
      impactScope: category === 'security' ? 'system' : category === 'critical' ? 'module' : 'local',
      changeComplexity: category === 'security' || category === 'critical' ? 'moderate' : 'simple',
      testCoverage: 'partial', // Conservative assumption
      riskScore: Math.min(severity, 8), // Risk score based on severity but capped
      riskFactors: category === 'security' ? ['Security implications', 'Potential breaking changes'] 
                  : category === 'critical' ? ['Functional impact', 'Regression risk']
                  : ['Low impact change'],
      mitigationStrategies: [
        'Thorough testing before deployment',
        'Code review by domain expert',
        'Gradual rollout if applicable'
      ]
    },
    questionAssessment: category === 'question' ? {
      isQuestion: true,
      canAnswerQuestion: false, // Conservative heuristic - assume we can't answer without Claude API
      answerConfidence: 0.2,
      questionType: 'general', // Default to general without deeper analysis
      requiresCodeAnalysis: true
    } : undefined,
    threadMetadata: {
      discussionId: 'unknown',
      isResolved: false,
      totalNotes: 1,
      userNotes: 1,
      isIndividualNote: true,
      threadPosition: 0,
      conversationFlow: [{
        noteId: note.id?.toString() || 'unknown',
        author: author,
        body: body,
        isSystemNote: false,
        notePosition: 0,
        conversationRole: 'initiator'
      }]
    },
    autoResponseDecision: {
      shouldRespond: false,
      responseType: 'none',
      responseReason: 'Heuristic analysis - unable to make response decisions without Claude API',
      responseContent: '',
      confidence: 0.0,
      requiresApproval: true
    }
  };
}

/**
 * Generate a suggested response based on comment category and content
 */
export function generateSuggestedResponse(category: CommentAnalysis['category'], body: string): string {
  switch (category) {
    case "security":
      return "Thanks for catching this security concern. I'll address this immediately and ensure proper security measures are in place.";
    case "critical":
      return "You're absolutely right. This is a critical issue and I'll fix it right away. Thanks for the detailed feedback.";
    case "functional":
      return "Good point about the performance impact. I'll implement the optimization you suggested.";
    case "style":
      return "Thanks for the style feedback. I'll update the formatting to match our coding standards.";
    case "question":
      return "Good question! Let me clarify the approach I took here...";
    default:
      return "Thanks for the feedback. I'll address this in the next iteration.";
  }
}

/**
 * Create analysis summary from individual comment analyses
 */
export function createAnalysisSummary(analyses: CommentAnalysis[]): AnalysisSummary {
  const totalComments = analyses.length;
  const categoryCounts = analyses.reduce((acc, analysis) => {
    acc[analysis.category] = (acc[analysis.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const averageSeverity = totalComments > 0 
    ? analyses.reduce((sum, a) => sum + a.severity, 0) / totalComments 
    : 0;

  const highPriorityComments = analyses.filter(a => a.severity >= 7).length;
  const validComments = analyses.filter(a => a.isValid).length;

  return {
    totalComments,
    categoryCounts,
    averageSeverity: Math.round(averageSeverity * 10) / 10,
    highPriorityComments,
    validComments,
    validityRate: totalComments > 0 ? Math.round((validComments / totalComments) * 100) / 100 : 0
  };
}