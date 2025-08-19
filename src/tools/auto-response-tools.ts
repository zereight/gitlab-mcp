import { z } from 'zod';

/**
 * Schema for configuring automatic response behavior
 */
export const AutoResponseConfigSchema = z.object({
  enabled: z.boolean().optional().default(false)
    .describe("Enable automatic responses to MR comments"),
  
  dryRun: z.boolean().optional().default(true)
    .describe("If true, show planned responses but don't actually post them"),
  
  maxResponsesPerSession: z.number().min(0).max(50).optional().default(5)
    .describe("Maximum number of automatic responses to post in a single session"),
  
  requireApprovalForDisagreements: z.boolean().optional().default(true)
    .describe("Require human approval before posting disagreement responses"),
  
  requireApprovalForAnswers: z.boolean().optional().default(false)
    .describe("Require human approval before posting question answers"),
  
  confidenceThreshold: z.number().min(0).max(1).optional().default(0.7)
    .describe("Minimum confidence threshold for automatic responses (0-1 scale)")
});

/**
 * Schema for configuring automatic code fix behavior
 */
export const AutoFixConfigSchema = z.object({
  enabled: z.boolean().optional().default(false)
    .describe("Enable automatic code fixes for MR comments"),
  
  dryRun: z.boolean().optional().default(true)
    .describe("If true, plan fixes but don't actually apply them"),
  
  maxFixesPerSession: z.number().min(0).max(20).optional().default(5)
    .describe("Maximum number of automatic fixes to apply in a single session"),
  
  riskThreshold: z.enum(["very_low", "low", "medium"]).optional().default("low")
    .describe("Maximum risk level to auto-apply fixes"),
  
  confidenceThreshold: z.number().min(0).max(1).optional().default(0.8)
    .describe("Minimum confidence threshold for automatic fixes (0-1 scale)"),
  
  allowedFileTypes: z.array(z.string()).optional().default([".ts", ".js", ".tsx", ".jsx", ".py", ".java", ".cpp", ".c", ".h"])
    .describe("File extensions that can be auto-fixed"),
  
  excludedPaths: z.array(z.string()).optional().default(["node_modules", ".git", "dist", "build"])
    .describe("Paths to exclude from auto-fixing"),
  
  requireApprovalForRefactors: z.boolean().optional().default(true)
    .describe("Require human approval before applying refactoring fixes"),
  
  requireApprovalForBugFixes: z.boolean().optional().default(true)
    .describe("Require human approval before applying bug fixes"),
  
  workingDirectory: z.string().optional()
    .describe("Working directory for git and file operations")
});

/**
 * Schema for the analyze_mr_feedback_with_responses tool
 */
export const AnalyzeMrFeedbackWithResponsesSchema = z.object({
  projectId: z.string().optional()
    .describe("GitLab project ID (uses default from environment if not provided)"),
  
  mergeRequestIid: z.string().optional()
    .describe("Merge request IID (internal ID)"),
  
  branchName: z.string().optional()
    .describe("Git branch name to find associated MR"),
  
  workingDirectory: z.string().optional()
    .describe("Working directory for git operations"),
  
  autoResponseConfig: AutoResponseConfigSchema.optional()
    .describe("Configuration for automatic response behavior"),
  
  autoFixConfig: AutoFixConfigSchema.optional()
    .describe("Configuration for automatic code fix behavior"),
  
  // Response management options to handle large MRs
  maxComments: z.number().min(1).max(100).optional().default(20)
    .describe("Maximum number of comments to analyze (pagination)"),
  
  offset: z.number().min(0).optional().default(0)
    .describe("Starting offset for pagination (skip first N comments)"),
  
  categoryFilter: z.array(z.enum(["security", "critical", "functional", "style", "question", "minor"])).optional()
    .describe("Only analyze comments in these categories"),
  
  minSeverity: z.number().min(1).max(10).optional()
    .describe("Only include comments with severity >= this value"),
  
  riskThreshold: z.enum(["very_low", "low", "medium", "high", "very_high"]).optional()
    .describe("Only include comments with risk level <= this threshold"),
  
  summaryOnly: z.boolean().optional().default(false)
    .describe("Return condensed summary instead of full analysis details"),
  
  includeResolved: z.boolean().optional().default(false)
    .describe("Include resolved/closed comment threads in analysis")
});

/**
 * Schema for the enhanced analyze_mr_feedback_with_fixes tool
 */
export const AnalyzeMrFeedbackWithFixesSchema = z.object({
  projectId: z.string().optional()
    .describe("GitLab project ID (uses default from environment if not provided)"),
  
  mergeRequestIid: z.string().optional()
    .describe("Merge request IID (internal ID)"),
  
  branchName: z.string().optional()
    .describe("Git branch name to find associated MR"),
  
  workingDirectory: z.string().optional()
    .describe("Working directory for git and file operations"),
  
  autoResponseConfig: AutoResponseConfigSchema.optional()
    .describe("Configuration for automatic response behavior"),
  
  autoFixConfig: AutoFixConfigSchema.optional()
    .describe("Configuration for automatic code fix behavior")
});

export type AutoResponseConfigType = z.infer<typeof AutoResponseConfigSchema>;
export type AutoFixConfigType = z.infer<typeof AutoFixConfigSchema>;
export type AnalyzeMrFeedbackWithResponsesType = z.infer<typeof AnalyzeMrFeedbackWithResponsesSchema>;
export type AnalyzeMrFeedbackWithFixesType = z.infer<typeof AnalyzeMrFeedbackWithFixesSchema>;