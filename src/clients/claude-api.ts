import Anthropic from '@anthropic-ai/sdk';
import type { CommentAnalysis } from '../types/mr-feedback.js';

export interface ClaudeConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export class ClaudeAnalysisClient {
  private anthropic: Anthropic;
  private config: ClaudeConfig;

  constructor(config: ClaudeConfig) {
    this.config = {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 1000,
      temperature: 0.1,
      ...config
    };

    this.anthropic = new Anthropic({
      apiKey: this.config.apiKey
    });
  }

  async analyzeComment(
    comment: {
      id: string;
      body: string;
      author?: { username?: string };
    },
    mergeRequestContext?: {
      title?: string;
      description?: string;
      source_branch?: string;
      target_branch?: string;
      diffs?: any; // Code diffs for context
      threadContext?: string; // Thread conversation context
    }
  ): Promise<CommentAnalysis> {
    const prompt = this.buildAnalysisPrompt(comment, mergeRequestContext);

    try {
      const response = await this.anthropic.messages.create({
        model: this.config.model!,
        max_tokens: this.config.maxTokens!,
        temperature: this.config.temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const analysisText = response.content[0].type === 'text' ? response.content[0].text : '';
      return this.parseAnalysisResponse(analysisText, comment);
    } catch (error) {
      // Fallback to basic analysis if Claude API fails
      console.warn(`Claude API analysis failed, falling back to heuristics:`, error);
      return this.fallbackAnalysis(comment);
    }
  }

  private buildAnalysisPrompt(
    comment: { id: string; body: string; author?: { username?: string } },
    mrContext?: {
      title?: string;
      description?: string;
      source_branch?: string;
      target_branch?: string;
      diffs?: any;
      threadContext?: string;
    }
  ): string {
    // Extract key diff information for context
    const diffSummary = this.extractDiffSummary(mrContext?.diffs);
    
    return `You are a senior software engineer and code review expert. Your task is to analyze a merge request comment and provide comprehensive assessment including your professional opinion on suggestions, risk analysis, and your ability to answer questions.

MERGE REQUEST CONTEXT:
${mrContext ? `
- Title: ${mrContext.title || 'N/A'}
- Description: ${mrContext.description || 'N/A'}  
- Source Branch: ${mrContext.source_branch || 'N/A'}
- Target Branch: ${mrContext.target_branch || 'N/A'}
${diffSummary ? `- Code Changes Summary: ${diffSummary}` : ''}
` : 'No context provided'}

${mrContext?.threadContext ? `
THREAD CONVERSATION CONTEXT:
${mrContext.threadContext}

IMPORTANT: This comment is part of a threaded conversation. Consider the context from previous messages in the thread when analyzing this comment. Look for clarifications, follow-up questions, and how the conversation has evolved to better understand the intent and severity of this specific comment.

` : ''}COMMENT TO ANALYZE:
Author: ${comment.author?.username || 'Unknown'}
Content: ${comment.body}

Please provide a comprehensive analysis as a JSON object with the following structure:

{
  "category": "one of: critical, functional, security, style, minor, question",
  "severity": "number from 1-10 where 10 is most critical",
  "confidence": "number from 0-1 indicating your confidence in the analysis",
  "isValid": "boolean - whether this is a valid, actionable comment",
  "reasoning": "brief explanation of your categorization",
  "suggestedResponse": "a professional response the author could use to address this comment",
  
  "agreementAssessment": {
    "agreesWithSuggestion": "boolean - do you agree with the comment/suggestion based on your analysis",
    "agreementConfidence": "number from 0-1 indicating confidence in your agreement assessment",
    "agreementReasoning": "detailed explanation of why you agree or disagree with the suggestion",
    "alternativeApproach": "optional: if you disagree, suggest a better approach",
    "additionalConsiderations": ["array of additional factors to consider"]
  },
  
  "riskAssessment": {
    "impactScope": "one of: local, module, system, global - scope of impact if suggestion is implemented",
    "changeComplexity": "one of: trivial, simple, moderate, complex, extensive - complexity of implementing the suggestion",
    "testCoverage": "one of: none, minimal, partial, good, comprehensive - assess test coverage for affected areas",
    "riskScore": "number from 1-10 indicating overall risk of implementing the suggestion",
    "riskFactors": ["array of specific risk factors identified"],
    "mitigationStrategies": ["array of strategies to reduce risks during implementation"]
  },
  
  "questionAssessment": {
    "isQuestion": "boolean - whether this comment contains a question seeking clarification or information",
    "canAnswerQuestion": "boolean - whether you believe you can provide a helpful answer based on available context",
    "answerConfidence": "number from 0-1 indicating your confidence in being able to answer accurately",
    "questionType": "one of: clarification, implementation, architecture, behavior, general - type of question asked",
    "suggestedAnswer": "optional string - your attempt to answer the question if answerConfidence > 0.6",
    "requiresCodeAnalysis": "boolean - whether answering requires deep understanding of the specific codebase"
  },
  
  "autoResponseDecision": {
    "shouldRespond": "boolean - whether you recommend posting an automatic response to this comment",
    "responseType": "one of: disagreement, clarification_request, answer_question, none - type of response to post",
    "responseReason": "string - explanation of why you want to respond and what value it provides",
    "responseContent": "string - the actual response text to post (professional, concise, helpful)",
    "confidence": "number from 0-1 indicating confidence in your response being helpful and accurate",
    "requiresApproval": "boolean - whether this response should require human approval before posting"
  },
  
  "autoFixDecision": {
    "shouldFix": "boolean - whether this comment suggests changes that could be automatically applied to the code",
    "fixType": "one of: style, simple_refactor, bug_fix, optimization, none - type of fix that could be applied",
    "fixReason": "string - explanation of what would be fixed and why it's safe to automate",
    "confidence": "number from 0-1 indicating confidence that the fix is correct and safe",
    "estimatedRisk": "one of: very_low, low, medium, high, very_high - risk level of applying this fix automatically",
    "affectedFiles": ["array of file paths that would need to be modified"],
    "codeChanges": [
      {
        "filePath": "string - relative path to file",
        "changeType": "one of: replace, insert, delete - type of change",
        "startLine": "number - starting line number (1-indexed)",
        "endLine": "number - ending line number for replace/delete operations",
        "originalCode": "string - current code that would be replaced (optional for validation)",
        "newCode": "string - new code to insert or replacement code",
        "description": "string - brief description of this specific change"
      }
    ],
    "requiresApproval": "boolean - whether this fix should require human approval before applying",
    "prerequisites": ["array of requirements that must be met before applying (e.g., tests passing, backup created)"]
  }
}

ANALYSIS GUIDELINES:

**CATEGORIZATION:**
- "security": Authentication, vulnerabilities, security flaws, data exposure (severity 9-10)
- "critical": Bugs, errors, crashes, breaking changes (severity 7-9)
- "functional": Performance issues, logic problems, feature improvements (severity 5-7)
- "style": Code formatting, linting, naming conventions (severity 1-3)
- "question": Requests for clarification, explanatory comments (severity 3-5)
- "minor": General feedback, suggestions, non-urgent improvements (severity 1-4)

**QUESTION ASSESSMENT (for "question" category comments):**
When a comment is categorized as "question", assess your ability to provide a helpful answer:

- **Question Types:**
  - "clarification": Asking to explain existing code behavior or decisions
  - "implementation": How to implement a specific feature or fix
  - "architecture": About system design, patterns, or structural decisions
  - "behavior": What happens in specific scenarios or edge cases
  - "general": General programming or technical questions

- **Answer Confidence Guidelines:**
  - 0.8-1.0: High confidence - clear question with sufficient context to provide accurate answer
  - 0.6-0.8: Medium confidence - can provide helpful guidance but may need additional context
  - 0.4-0.6: Low confidence - can offer general advice but specific answer requires more information
  - 0.0-0.4: Very low confidence - insufficient context or too specific to the codebase to answer reliably

- **Provide suggestedAnswer if answerConfidence > 0.6 AND you believe your answer would be helpful**
- Consider whether the question requires understanding specific implementation details not visible in the provided context
- Be honest about limitations - it's better to acknowledge uncertainty than provide potentially incorrect information

**AUTOMATIC RESPONSE DECISION:**
You should recommend posting an automatic response in these specific scenarios:

1. **DISAGREEMENT Response (responseType: "disagreement")**:
   - When agreementAssessment.agreesWithSuggestion is false AND agreementConfidence > 0.7
   - When the comment suggests changes that could introduce bugs, security issues, or violate best practices
   - When you have strong technical reasoning for why the suggestion is problematic
   - responseContent should: Explain your reasoning professionally, acknowledge the reviewer's perspective, suggest alternatives if applicable
   - requiresApproval: true (disagreement responses always need approval)

2. **CLARIFICATION_REQUEST Response (responseType: "clarification_request")**:
   - When the comment is unclear, ambiguous, or lacks sufficient detail to implement
   - When you need more context to properly evaluate or implement the suggestion
   - When multiple interpretations of the comment are possible
   - responseContent should: Ask specific questions, explain why clarification is needed, suggest what additional information would help
   - requiresApproval: false (clarification requests are generally safe)

3. **ANSWER_QUESTION Response (responseType: "answer_question")**:
   - When questionAssessment.isQuestion is true AND questionAssessment.canAnswerQuestion is true AND questionAssessment.answerConfidence > 0.7
   - When you can provide clear, helpful, accurate information based on available context
   - When the answer adds significant value to the code review discussion
   - responseContent should: Use the suggestedAnswer from questionAssessment, be clear and concise, acknowledge any limitations
   - requiresApproval: false if answerConfidence > 0.8, true if answerConfidence <= 0.8

**Response Quality Guidelines:**
- Keep responses professional, concise (under 200 words), and constructive
- Always acknowledge the reviewer's input positively before disagreeing or asking for clarification
- Use "I" statements ("I think", "I believe") to show these are your perspectives, not absolute truths
- Provide concrete reasoning and examples when possible
- Avoid responses that could be seen as argumentative or dismissive
- Only respond when your input genuinely adds value to the discussion

**When NOT to respond:**
- Don't respond to style/formatting comments unless technically incorrect
- Don't respond if your confidence is low (< 0.7)
- Don't respond to comments that are already clear and reasonable, even if you disagree mildly
- Don't respond if the comment thread is already resolved
- Don't respond if someone else has already addressed the comment adequately

**AUTO-FIX DECISION:**
Determine if the comment suggests changes that could be safely applied automatically to the codebase:

**When to suggest auto-fixes:**
- Style/formatting issues with clear solutions
- Simple refactoring with obvious improvements
- Clear bug fixes with minimal risk
- Only when you strongly agree with the suggestion (agreementAssessment.agreesWithSuggestion = true)
- Only when confidence > 0.8 and estimatedRisk is "very_low" or "low"

**When NOT to suggest auto-fixes:**
- Changes affecting business logic or algorithms
- Security-related modifications
- Complex refactoring across multiple files
- Comments that lack specific implementation details

**AGREEMENT ASSESSMENT:**
- Consider the technical merit of the suggestion
- Evaluate whether the suggestion aligns with best practices
- Assess if the suggestion addresses the right problem
- Consider maintainability, performance, and architectural implications
- Factor in the merge request context and apparent developer intentions

**RISK ASSESSMENT FACTORS:**
- **Impact Scope**: How much of the codebase would be affected?
  - local: Single function/method
  - module: Single file/class
  - system: Multiple related modules
  - global: Application-wide changes

- **Change Complexity**: How difficult would the implementation be?
  - trivial: Simple one-line changes
  - simple: Minor logic changes
  - moderate: Refactoring within module
  - complex: Cross-module refactoring
  - extensive: Architectural changes

- **Test Coverage**: Based on typical patterns, assess test coverage:
  - none: No apparent tests
  - minimal: Basic unit tests only
  - partial: Some integration tests
  - good: Comprehensive unit and integration tests
  - comprehensive: Full test coverage including edge cases

**RISK FACTORS TO CONSIDER:**
- Breaking changes to public APIs
- Performance implications
- Backwards compatibility
- Third-party dependencies
- Database schema changes
- Configuration changes
- Cross-team coordination needs
- Production deployment complexity

Provide thoughtful, professional analysis based on your expertise. Respond only with the JSON object, no other text.`;
  }

  private extractDiffSummary(diffs?: any): string {
    if (!diffs || !Array.isArray(diffs)) return '';
    
    try {
      const summary = diffs.slice(0, 3).map((diff: any) => {
        const fileName = diff.new_path || diff.old_path || 'unknown';
        const additions = diff.additions || 0;
        const deletions = diff.deletions || 0;
        return `${fileName} (+${additions}/-${deletions})`;
      }).join(', ');
      
      return summary + (diffs.length > 3 ? ` and ${diffs.length - 3} more files` : '');
    } catch (error) {
      return 'Unable to parse diff information';
    }
  }

  private parseAnalysisResponse(
    analysisText: string,
    comment: { id: string; body: string; author?: { username?: string } }
  ): CommentAnalysis {
    try {
      // Extract JSON from the response (in case Claude adds extra text)
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : analysisText;
      const analysis = JSON.parse(jsonStr);

      // Validate and construct the result
      return {
        id: comment.id,
        body: comment.body,
        author: comment.author?.username || 'unknown',
        category: this.validateCategory(analysis.category),
        severity: Math.max(1, Math.min(10, parseInt(analysis.severity) || 5)),
        confidence: Math.max(0, Math.min(1, parseFloat(analysis.confidence) || 0.7)),
        isValid: Boolean(analysis.isValid !== false), // Default to true unless explicitly false
        reasoning: analysis.reasoning || 'AI analysis completed',
        suggestedResponse: analysis.suggestedResponse || this.generateDefaultResponse(analysis.category),
        // Enhanced analysis fields
        agreementAssessment: analysis.agreementAssessment ? {
          agreesWithSuggestion: Boolean(analysis.agreementAssessment.agreesWithSuggestion),
          agreementConfidence: Math.max(0, Math.min(1, parseFloat(analysis.agreementAssessment.agreementConfidence) || 0.5)),
          agreementReasoning: analysis.agreementAssessment.agreementReasoning || 'No reasoning provided',
          alternativeApproach: analysis.agreementAssessment.alternativeApproach,
          additionalConsiderations: Array.isArray(analysis.agreementAssessment.additionalConsiderations) 
            ? analysis.agreementAssessment.additionalConsiderations : []
        } : undefined,
        riskAssessment: analysis.riskAssessment ? {
          impactScope: this.validateImpactScope(analysis.riskAssessment.impactScope),
          changeComplexity: this.validateChangeComplexity(analysis.riskAssessment.changeComplexity),
          testCoverage: this.validateTestCoverage(analysis.riskAssessment.testCoverage),
          riskScore: Math.max(1, Math.min(10, parseInt(analysis.riskAssessment.riskScore) || 5)),
          riskFactors: Array.isArray(analysis.riskAssessment.riskFactors) 
            ? analysis.riskAssessment.riskFactors : [],
          mitigationStrategies: Array.isArray(analysis.riskAssessment.mitigationStrategies) 
            ? analysis.riskAssessment.mitigationStrategies : []
        } : undefined,
        questionAssessment: analysis.questionAssessment ? {
          isQuestion: Boolean(analysis.questionAssessment.isQuestion),
          canAnswerQuestion: Boolean(analysis.questionAssessment.canAnswerQuestion),
          answerConfidence: Math.max(0, Math.min(1, parseFloat(analysis.questionAssessment.answerConfidence) || 0)),
          questionType: this.validateQuestionType(analysis.questionAssessment.questionType),
          suggestedAnswer: analysis.questionAssessment.suggestedAnswer || undefined,
          requiresCodeAnalysis: Boolean(analysis.questionAssessment.requiresCodeAnalysis)
        } : undefined,
        threadMetadata: {
          discussionId: 'claude-api-fallback',
          isResolved: false,
          totalNotes: 1,
          userNotes: 1,
          isIndividualNote: true,
          threadPosition: 0,
          conversationFlow: [{
            noteId: comment.id,
            author: comment.author?.username || 'unknown',
            body: comment.body,
            isSystemNote: false,
            notePosition: 0,
            conversationRole: 'initiator'
          }]
        },
        autoResponseDecision: analysis.autoResponseDecision ? {
          shouldRespond: Boolean(analysis.autoResponseDecision.shouldRespond),
          responseType: this.validateResponseType(analysis.autoResponseDecision.responseType),
          responseReason: analysis.autoResponseDecision.responseReason || 'No reason provided',
          responseContent: analysis.autoResponseDecision.responseContent || '',
          confidence: Math.max(0, Math.min(1, parseFloat(analysis.autoResponseDecision.confidence) || 0)),
          requiresApproval: Boolean(analysis.autoResponseDecision.requiresApproval)
        } : undefined,
        autoFixDecision: analysis.autoFixDecision ? {
          shouldFix: Boolean(analysis.autoFixDecision.shouldFix),
          fixType: this.validateFixType(analysis.autoFixDecision.fixType),
          fixReason: analysis.autoFixDecision.fixReason || 'No reason provided',
          confidence: Math.max(0, Math.min(1, parseFloat(analysis.autoFixDecision.confidence) || 0)),
          estimatedRisk: this.validateRiskLevel(analysis.autoFixDecision.estimatedRisk),
          affectedFiles: Array.isArray(analysis.autoFixDecision.affectedFiles) ? analysis.autoFixDecision.affectedFiles : [],
          codeChanges: Array.isArray(analysis.autoFixDecision.codeChanges) ? analysis.autoFixDecision.codeChanges.map((change: any) => ({
            filePath: change.filePath || '',
            changeType: this.validateChangeType(change.changeType),
            startLine: parseInt(change.startLine) || undefined,
            endLine: parseInt(change.endLine) || undefined,
            originalCode: change.originalCode || undefined,
            newCode: change.newCode || '',
            description: change.description || 'No description'
          })) : [],
          requiresApproval: Boolean(analysis.autoFixDecision.requiresApproval),
          prerequisites: Array.isArray(analysis.autoFixDecision.prerequisites) ? analysis.autoFixDecision.prerequisites : []
        } : undefined
      };
    } catch (error) {
      console.warn('Failed to parse Claude analysis response:', error);
      return this.fallbackAnalysis(comment);
    }
  }

  private validateCategory(category: string): CommentAnalysis['category'] {
    const validCategories: CommentAnalysis['category'][] = [
      'critical', 'functional', 'security', 'style', 'minor', 'question'
    ];
    return validCategories.includes(category as any) ? category as CommentAnalysis['category'] : 'minor';
  }

  private validateImpactScope(scope: string): 'local' | 'module' | 'system' | 'global' {
    const validScopes = ['local', 'module', 'system', 'global'];
    return validScopes.includes(scope) ? scope as any : 'local';
  }

  private validateChangeComplexity(complexity: string): 'trivial' | 'simple' | 'moderate' | 'complex' | 'extensive' {
    const validComplexities = ['trivial', 'simple', 'moderate', 'complex', 'extensive'];
    return validComplexities.includes(complexity) ? complexity as any : 'simple';
  }

  private validateTestCoverage(coverage: string): 'none' | 'minimal' | 'partial' | 'good' | 'comprehensive' {
    const validCoverages = ['none', 'minimal', 'partial', 'good', 'comprehensive'];
    return validCoverages.includes(coverage) ? coverage as any : 'minimal';
  }

  private validateQuestionType(questionType: string): 'clarification' | 'implementation' | 'architecture' | 'behavior' | 'general' {
    const validTypes = ['clarification', 'implementation', 'architecture', 'behavior', 'general'];
    return validTypes.includes(questionType) ? questionType as any : 'general';
  }

  private validateResponseType(responseType: string): 'disagreement' | 'clarification_request' | 'answer_question' | 'none' {
    const validTypes = ['disagreement', 'clarification_request', 'answer_question', 'none'];
    return validTypes.includes(responseType) ? responseType as any : 'none';
  }

  private generateDefaultResponse(category: CommentAnalysis['category']): string {
    switch (category) {
      case 'security':
        return "Thanks for identifying this security concern. I'll address this immediately and ensure proper security measures are in place.";
      case 'critical':
        return "You're absolutely right. This is a critical issue and I'll fix it right away. Thanks for the detailed feedback.";
      case 'functional':
        return "Good point about the functionality. I'll implement the improvement you suggested.";
      case 'style':
        return "Thanks for the style feedback. I'll update the formatting to match our coding standards.";
      case 'question':
        return "Good question! Let me clarify the approach I took here...";
      default:
        return "Thanks for the feedback. I'll address this in the next iteration.";
    }
  }

  private fallbackAnalysis(
    comment: { id: string; body: string; author?: { username?: string } }
  ): CommentAnalysis {
    // Simple heuristic-based fallback analysis
    const body = comment.body.toLowerCase();
    let category: CommentAnalysis['category'] = 'minor';
    let severity = 3;
    let confidence = 0.5;
    const reasoning = 'Fallback heuristic analysis (Claude API unavailable)';

    // Security-related keywords
    if (body.includes('security') || body.includes('vulnerable') || body.includes('exploit')) {
      category = 'security';
      severity = 9;
    }
    // Critical issues
    else if (body.includes('bug') || body.includes('error') || body.includes('crash')) {
      category = 'critical';
      severity = 8;
    }
    // Questions
    else if (body.includes('?') || body.includes('why') || body.includes('how')) {
      category = 'question';
      severity = 4;
    }
    // Style
    else if (body.includes('style') || body.includes('format') || body.includes('lint')) {
      category = 'style';
      severity = 2;
    }

    return {
      id: comment.id,
      body: comment.body,
      author: comment.author?.username || 'unknown',
      category,
      severity,
      confidence,
      isValid: true,
      reasoning,
      suggestedResponse: this.generateDefaultResponse(category),
      // Provide enhanced analysis even in fallback mode
      agreementAssessment: {
        agreesWithSuggestion: true,
        agreementConfidence: 0.6,
        agreementReasoning: 'Fallback heuristic analysis - unable to provide detailed assessment without Claude API',
        additionalConsiderations: ['Consult with domain experts', 'Review similar patterns in codebase']
      },
      riskAssessment: {
        impactScope: category === 'security' ? 'system' : category === 'critical' ? 'module' : 'local',
        changeComplexity: category === 'security' || category === 'critical' ? 'moderate' : 'simple',
        testCoverage: 'partial',
        riskScore: Math.min(severity, 8),
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
        canAnswerQuestion: false, // Conservative fallback - assume we can't answer without Claude API
        answerConfidence: 0.2,
        questionType: 'general',
        requiresCodeAnalysis: true
      } : undefined,
      threadMetadata: {
        discussionId: 'fallback-analysis',
        isResolved: false,
        totalNotes: 1,
        userNotes: 1,
        isIndividualNote: true,
        threadPosition: 0,
        conversationFlow: [{
          noteId: comment.id,
          author: comment.author?.username || 'unknown',
          body: comment.body,
          isSystemNote: false,
          notePosition: 0,
          conversationRole: 'initiator'
        }]
      },
      autoResponseDecision: {
        shouldRespond: false,
        responseType: 'none',
        responseReason: 'Fallback analysis - unable to make response decisions without Claude API',
        responseContent: '',
        confidence: 0.0,
        requiresApproval: true
      },
      autoFixDecision: {
        shouldFix: false,
        fixType: 'none',
        fixReason: 'Fallback analysis - unable to make fix decisions without Claude API',
        confidence: 0.0,
        estimatedRisk: 'very_high',
        affectedFiles: [],
        codeChanges: [],
        requiresApproval: true,
        prerequisites: []
      }
    };
  }

  private validateFixType(fixType: string): "style" | "simple_refactor" | "bug_fix" | "optimization" | "none" {
    const validTypes = ['style', 'simple_refactor', 'bug_fix', 'optimization', 'none'];
    return validTypes.includes(fixType) ? fixType as any : 'none';
  }

  private validateRiskLevel(riskLevel: string): "very_low" | "low" | "medium" | "high" | "very_high" {
    const validLevels = ['very_low', 'low', 'medium', 'high', 'very_high'];
    return validLevels.includes(riskLevel) ? riskLevel as any : 'medium';
  }

  private validateChangeType(changeType: string): "replace" | "insert" | "delete" | "move" {
    const validTypes = ['replace', 'insert', 'delete', 'move'];
    return validTypes.includes(changeType) ? changeType as any : 'replace';
  }
}