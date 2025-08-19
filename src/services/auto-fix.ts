import type { 
  CommentAnalysis, 
  AutoFixDecision, 
  CodeChange, 
  FixExecutionResult,
  AutoFixResults
} from "../types/mr-feedback.js";
import { detectCurrentBranch, hasUncommittedChanges } from "../utils/git.js";
import * as fs from 'fs';
import * as path from 'path';

export interface AutoFixConfig {
  enabled: boolean;
  dryRun: boolean; // If true, plan fixes but don't actually apply them
  maxFixesPerSession: number;
  riskThreshold: "very_low" | "low" | "medium"; // Maximum risk level to auto-apply
  confidenceThreshold: number; // Minimum confidence (0-1) to auto-apply
  allowedFileTypes: string[]; // File extensions that can be auto-fixed
  excludedPaths: string[]; // Paths to exclude from auto-fixing
  requireApprovalForRefactors: boolean;
  requireApprovalForBugFixes: boolean;
  workingDirectory?: string;
}

export class AutoFixService {
  private config: AutoFixConfig;
  private fixesAppliedThisSession: number = 0;

  constructor(config: AutoFixConfig) {
    this.config = config;
  }

  /**
   * Process all comment analyses and apply automatic fixes
   */
  async processCommentAnalyses(
    analyses: CommentAnalysis[],
    mergeRequest: any,
    workingDirectory?: string
  ): Promise<AutoFixResults> {
    const plannedFixes: CommentAnalysis[] = [];
    const appliedFixes: FixExecutionResult[] = [];
    const skippedFixes: { analysis: CommentAnalysis; reason: string }[] = [];

    if (!this.config.enabled) {
      console.log('🔧 Auto-fix is disabled');
      return { 
        plannedFixes, 
        appliedFixes, 
        skippedFixes, 
        gitStatus: await this.getGitStatus(mergeRequest, workingDirectory) 
      };
    }

    console.log('🔧 Processing analyses for automatic fixes...');
    console.log(`📊 Session limits: ${this.fixesAppliedThisSession}/${this.config.maxFixesPerSession} fixes applied`);
    console.log(`⚙️  Config: risk_threshold=${this.config.riskThreshold}, confidence_threshold=${this.config.confidenceThreshold}`);

    // Check git status first
    const gitStatus = await this.getGitStatus(mergeRequest, workingDirectory);
    if (!gitStatus.isOnCorrectBranch) {
      console.log(`⚠️  Not on correct branch (expected: ${gitStatus.expectedBranch}, current: ${gitStatus.currentBranch})`);
      console.log('🔧 Auto-fix disabled - must be on the MR branch');
      return { plannedFixes, appliedFixes, skippedFixes, gitStatus };
    }

    if (gitStatus.hasUncommittedChanges) {
      console.log('⚠️  Uncommitted changes detected - proceeding with caution');
    }

    let candidateCount = 0;
    for (const analysis of analyses) {
      const decision = analysis.autoFixDecision;
      
      if (!decision || !decision.shouldFix) {
        continue;
      }
      
      candidateCount++;
      console.log(`🔍 [${candidateCount}] Evaluating fix for comment ${analysis.id} (${decision.fixType}, confidence: ${Math.round(decision.confidence * 100)}%)`);

      // Check session limit
      if (this.fixesAppliedThisSession >= this.config.maxFixesPerSession) {
        console.log(`⚠️  [${candidateCount}] SKIPPED - Session limit reached (${this.fixesAppliedThisSession}/${this.config.maxFixesPerSession})`);
        skippedFixes.push({
          analysis,
          reason: `Session limit reached (${this.config.maxFixesPerSession} fixes)`
        });
        continue;
      }

      // Check if resolved threads should be skipped
      if (analysis.threadMetadata.isResolved) {
        console.log(`⚠️  [${candidateCount}] SKIPPED - Thread is resolved`);
        skippedFixes.push({
          analysis,
          reason: 'Thread is resolved'
        });
        continue;
      }

      // Check risk threshold
      if (!this.isRiskAcceptable(decision.estimatedRisk)) {
        console.log(`⚠️  [${candidateCount}] SKIPPED - Risk too high (${decision.estimatedRisk} > ${this.config.riskThreshold})`);
        skippedFixes.push({
          analysis,
          reason: `Risk too high (${decision.estimatedRisk})`
        });
        continue;
      }

      // Check confidence threshold
      if (decision.confidence < this.config.confidenceThreshold) {
        console.log(`⚠️  [${candidateCount}] SKIPPED - Confidence too low (${Math.round(decision.confidence * 100)}% < ${Math.round(this.config.confidenceThreshold * 100)}%)`);
        skippedFixes.push({
          analysis,
          reason: `Confidence too low (${Math.round(decision.confidence * 100)}%)`
        });
        continue;
      }

      // Check file type restrictions
      const hasRestrictedFiles = decision.affectedFiles.some(file => 
        !this.isFileTypeAllowed(file) || this.isPathExcluded(file)
      );
      if (hasRestrictedFiles) {
        console.log(`⚠️  [${candidateCount}] SKIPPED - Restricted file types or paths`);
        skippedFixes.push({
          analysis,
          reason: 'Restricted file types or excluded paths'
        });
        continue;
      }

      // Check approval requirements
      if (this.shouldRequireApproval(decision)) {
        console.log(`⚠️  [${candidateCount}] SKIPPED - Requires human approval (type: ${decision.fixType})`);
        skippedFixes.push({
          analysis,
          reason: 'Requires human approval'
        });
        continue;
      }

      console.log(`✅ [${candidateCount}] APPROVED - Will attempt to apply fix`);
      plannedFixes.push(analysis);

      // Apply the fix if not in dry-run mode
      if (!this.config.dryRun) {
        console.log(`🔧 [${candidateCount}] APPLYING - Making file system changes...`);
        try {
          const result = await this.applyFix(analysis, workingDirectory);
          appliedFixes.push(result);
          this.fixesAppliedThisSession++;
          console.log(`🎉 [${candidateCount}] SUCCESS - Fix applied to ${result.filePath}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`❌ [${candidateCount}] FAILED - Error applying fix: ${errorMessage}`);
          appliedFixes.push({
            success: false,
            commentId: analysis.id,
            filePath: decision.affectedFiles[0] || 'unknown',
            changeDescription: decision.fixReason,
            error: errorMessage,
            appliedChanges: []
          });
        }
      } else {
        console.log(`🧪 [${candidateCount}] DRY-RUN - Fix would be applied to: ${decision.affectedFiles.join(', ')}`);
      }
    }

    return { plannedFixes, appliedFixes, skippedFixes, gitStatus };
  }

  /**
   * Apply a single fix to the codebase
   */
  private async applyFix(
    analysis: CommentAnalysis,
    workingDirectory?: string
  ): Promise<FixExecutionResult> {
    const decision = analysis.autoFixDecision!;
    const appliedChanges: CodeChange[] = [];

    console.log(`🔧 Applying ${decision.fixType} fix: ${decision.fixReason}`);

    for (const change of decision.codeChanges) {
      try {
        await this.applyCodeChange(change, workingDirectory);
        appliedChanges.push(change);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to apply change to ${change.filePath}: ${errorMessage}`);
      }
    }

    return {
      success: true,
      commentId: analysis.id,
      filePath: decision.affectedFiles[0],
      changeDescription: decision.fixReason,
      appliedChanges
    };
  }

  /**
   * Apply a single code change to a file
   */
  private async applyCodeChange(change: CodeChange, workingDirectory?: string): Promise<void> {
    const fullPath = workingDirectory ? path.join(workingDirectory, change.filePath) : change.filePath;
    
    // Verify file exists
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File does not exist: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    switch (change.changeType) {
      case 'replace':
        if (change.startLine && change.endLine && change.newCode !== undefined) {
          // Replace lines (1-indexed)
          const startIdx = change.startLine - 1;
          const endIdx = change.endLine - 1;
          
          // Verify the original code matches (if provided)
          if (change.originalCode) {
            const actualCode = lines.slice(startIdx, endIdx + 1).join('\n');
            if (actualCode.trim() !== change.originalCode.trim()) {
              throw new Error(`Original code mismatch in ${change.filePath}:${change.startLine}-${change.endLine}`);
            }
          }

          // Replace the lines
          const newLines = change.newCode.split('\n');
          lines.splice(startIdx, endIdx - startIdx + 1, ...newLines);
        } else {
          throw new Error('Replace operation requires startLine, endLine, and newCode');
        }
        break;

      case 'insert':
        if (change.startLine && change.newCode !== undefined) {
          const insertIdx = change.startLine - 1;
          const newLines = change.newCode.split('\n');
          lines.splice(insertIdx, 0, ...newLines);
        } else {
          throw new Error('Insert operation requires startLine and newCode');
        }
        break;

      case 'delete':
        if (change.startLine && change.endLine) {
          const startIdx = change.startLine - 1;
          const endIdx = change.endLine - 1;
          lines.splice(startIdx, endIdx - startIdx + 1);
        } else {
          throw new Error('Delete operation requires startLine and endLine');
        }
        break;

      default:
        throw new Error(`Unsupported change type: ${change.changeType}`);
    }

    // Write the modified content back to the file
    const modifiedContent = lines.join('\n');
    fs.writeFileSync(fullPath, modifiedContent, 'utf8');
    
    console.log(`📝 Applied ${change.changeType} to ${change.filePath}:${change.startLine || '?'}`);
  }

  /**
   * Get git status information
   */
  private async getGitStatus(mergeRequest: any, workingDirectory?: string) {
    try {
      const currentBranch = await detectCurrentBranch(workingDirectory);
      const expectedBranch = mergeRequest.source_branch;
      
      // Check for uncommitted changes
      const hasChanges = await hasUncommittedChanges(workingDirectory);
      
      return {
        isOnCorrectBranch: currentBranch === expectedBranch,
        currentBranch,
        expectedBranch,
        hasUncommittedChanges: hasChanges
      };
    } catch (error) {
      return {
        isOnCorrectBranch: false,
        currentBranch: 'unknown',
        expectedBranch: mergeRequest.source_branch || 'unknown',
        hasUncommittedChanges: false
      };
    }
  }

  /**
   * Check if the estimated risk is acceptable
   */
  private isRiskAcceptable(risk: string): boolean {
    const riskLevels = ["very_low", "low", "medium", "high", "very_high"];
    const maxRiskIndex = riskLevels.indexOf(this.config.riskThreshold);
    const currentRiskIndex = riskLevels.indexOf(risk);
    
    return currentRiskIndex <= maxRiskIndex;
  }

  /**
   * Check if a file type is allowed for auto-fixing
   */
  private isFileTypeAllowed(filePath: string): boolean {
    if (this.config.allowedFileTypes.length === 0) {
      return true; // Allow all if no restrictions
    }
    
    const extension = path.extname(filePath).toLowerCase();
    return this.config.allowedFileTypes.includes(extension);
  }

  /**
   * Check if a path is excluded from auto-fixing
   */
  private isPathExcluded(filePath: string): boolean {
    return this.config.excludedPaths.some(excluded => 
      filePath.startsWith(excluded) || path.resolve(filePath).includes(path.resolve(excluded))
    );
  }

  /**
   * Determine if a fix requires human approval
   */
  private shouldRequireApproval(decision: AutoFixDecision): boolean {
    if (decision.requiresApproval) {
      return true;
    }

    if (decision.fixType === 'simple_refactor' && this.config.requireApprovalForRefactors) {
      return true;
    }

    if (decision.fixType === 'bug_fix' && this.config.requireApprovalForBugFixes) {
      return true;
    }

    return false;
  }

  /**
   * Get summary statistics for this session
   */
  getSessionSummary(): {
    fixesApplied: number;
    remainingFixes: number;
  } {
    return {
      fixesApplied: this.fixesAppliedThisSession,
      remainingFixes: Math.max(0, this.config.maxFixesPerSession - this.fixesAppliedThisSession)
    };
  }
}