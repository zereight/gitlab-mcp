export interface RiskAssessment {
  impactScope: "local" | "module" | "system" | "global";
  changeComplexity: "trivial" | "simple" | "moderate" | "complex" | "extensive";
  testCoverage: "none" | "minimal" | "partial" | "good" | "comprehensive";
  riskScore: number; // 1-10 scale
  riskFactors: string[];
  mitigationStrategies: string[];
}

export interface AgreementAssessment {
  agreesWithSuggestion: boolean;
  agreementConfidence: number; // 0-1 scale
  agreementReasoning: string;
  alternativeApproach?: string;
  additionalConsiderations: string[];
}

export interface QuestionAssessment {
  isQuestion: boolean;
  canAnswerQuestion: boolean; // Whether Claude believes it can provide a helpful answer
  answerConfidence: number; // 0-1 scale of confidence in being able to answer
  questionType: "clarification" | "implementation" | "architecture" | "behavior" | "general";
  suggestedAnswer?: string; // Claude's attempt to answer the question if confident enough
  requiresCodeAnalysis: boolean; // Whether answering requires deep code understanding
}

export interface ThreadMetadata {
  discussionId: string;
  isResolved: boolean; // Whether the entire thread is resolved
  totalNotes: number; // Total notes in the thread
  userNotes: number; // Non-system notes in the thread
  isIndividualNote: boolean; // Whether this is a standalone note or part of a thread
  threadPosition: number; // Position of this note within the thread (0 = first/root note)
  conversationFlow: ThreadConversationFlow[];
}

export interface ThreadConversationFlow {
  noteId: string;
  author: string;
  body: string;
  isSystemNote: boolean;
  notePosition: number; // Position in the conversation
  isResolved?: boolean;
  conversationRole: "initiator" | "responder" | "clarifier" | "resolver";
}

export interface AutoResponseDecision {
  shouldRespond: boolean;
  responseType: "disagreement" | "clarification_request" | "answer_question" | "none";
  responseReason: string;
  responseContent: string;
  confidence: number; // 0-1 scale for confidence in the response
  requiresApproval: boolean; // Whether this response needs human approval
}

export interface AutoFixDecision {
  shouldFix: boolean;
  fixType: "style" | "simple_refactor" | "bug_fix" | "optimization" | "none";
  fixReason: string;
  confidence: number; // 0-1 scale of confidence in the fix
  estimatedRisk: "very_low" | "low" | "medium" | "high" | "very_high";
  affectedFiles: string[];
  codeChanges: CodeChange[];
  requiresApproval: boolean;
  prerequisites: string[]; // Any requirements before applying the fix
}

export interface CodeChange {
  filePath: string;
  changeType: "replace" | "insert" | "delete" | "move";
  startLine?: number;
  endLine?: number;
  originalCode?: string;
  newCode?: string;
  description: string;
}

export interface FixExecutionResult {
  success: boolean;
  commentId: string | number;
  filePath: string;
  changeDescription: string;
  error?: string;
  appliedChanges: CodeChange[];
}

export interface AutoFixResults {
  plannedFixes: CommentAnalysis[];
  appliedFixes: FixExecutionResult[];
  skippedFixes: { analysis: CommentAnalysis; reason: string }[];
  gitStatus: {
    isOnCorrectBranch: boolean;
    currentBranch: string;
    expectedBranch: string;
    hasUncommittedChanges: boolean;
  };
}

export interface CommentAnalysis {
  id: string;
  body: string;
  author: string;
  category: "critical" | "functional" | "security" | "style" | "minor" | "question";
  severity: number;
  confidence: number;
  isValid: boolean;
  reasoning: string;
  suggestedResponse?: string;
  // Enhanced analysis fields
  agreementAssessment?: AgreementAssessment;
  riskAssessment?: RiskAssessment;
  questionAssessment?: QuestionAssessment;
  threadMetadata: ThreadMetadata; // Thread context and resolution status
  autoResponseDecision?: AutoResponseDecision; // Automatic response recommendation
  autoFixDecision?: AutoFixDecision; // Automatic code fix recommendation
}

export interface AnalysisSummary {
  totalComments: number;
  categoryCounts: Record<string, number>;
  averageSeverity: number;
  highPriorityComments: number;
  validComments: number;
  validityRate: number;
  // Enhanced fields for pagination and filtering
  totalOriginalComments?: number;
  totalFilteredComments?: number;
  paginationInfo?: {
    offset: number;
    maxComments: number;
    hasMore: boolean;
    totalAvailable?: number;
  };
  appliedFilters?: {
    categoryFilter?: string[];
    minSeverity?: number;
    riskThreshold?: string;
    includeResolved?: boolean;
  };
}

export interface MrFeedbackAnalysis {
  mergeRequest: any;
  commentAnalysis: CommentAnalysis[];
  summary: AnalysisSummary;
  autoResponseResults?: {
    plannedResponses: CommentAnalysis[];
    executedResponses: any[];
    skippedResponses: { analysis: CommentAnalysis; reason: string }[];
  };
  autoFixResults?: AutoFixResults;
}

export interface MrWithAnalysis extends MrFeedbackAnalysis {
  diffs: any;
}