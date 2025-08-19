# MR Feedback Processor - GitLab MCP Server

## Overview
Enhanced GitLab MCP server that extends the original gitlab-mcp with intelligent merge request feedback analysis capabilities. This server helps engineers understand, analyze, and respond to code review feedback on GitLab merge requests.

## Key Features

### Original GitLab MCP Features
- Complete GitLab API integration (83 tools)
- Project, issue, and merge request management
- File operations, wiki management, pipeline control
- Discussion threads, labels, milestones
- Comprehensive read and write operations

### New MR Feedback Analysis Features
- **detect_current_branch** - Automatically detect the current git branch
- **find_merge_request_for_branch** - Find the MR associated with current/specified branch
- **analyze_mr_feedback** - AI-powered analysis of MR comments with:
  - Category classification (critical, functional, security, style, minor, question)
  - Severity scoring (1-10 scale)  
  - Confidence assessment (0-1 scale)
  - Validity determination
  - Context-aware suggested responses
  - **🤖 Agreement Assessment**: Claude evaluates whether it agrees with suggestions based on:
    - Technical merit and best practices alignment
    - Code context and developer intentions
    - Maintainability and architectural implications
    - Alternative approaches when disagreeing
  - **⚠️ Risk Analysis**: Comprehensive risk assessment including:
    - Impact scope (local, module, system, global)
    - Implementation complexity (trivial to extensive)
    - Test coverage assessment 
    - Risk score calculation (1-10 scale)
    - Specific risk factors identification
    - Mitigation strategy recommendations
  - **Claude AI Integration**: Uses Claude API for sophisticated natural language understanding of comments
  - **Fallback Support**: Automatically falls back to heuristic analysis if Claude API is unavailable
- **get_mr_with_analysis** - Complete MR context with code diffs and intelligent comment analysis

## Comment Analysis Categories
- **Security** (severity 9): Authentication, vulnerabilities, security issues
- **Critical** (severity 8): Bugs, errors, crashes, functional problems
- **Functional** (severity 6): Performance optimizations, feature improvements
- **Style** (severity 2): Code formatting, linting, style guidelines
- **Question** (severity 4): Clarification requests, explanatory comments
- **Minor** (severity 3): General feedback, minor suggestions

## Environment Variables

### GitLab Configuration (Required)
- `GITLAB_PERSONAL_ACCESS_TOKEN` - Your GitLab personal access token (required)
- `GITLAB_API_URL` - GitLab API URL (default: https://gitlab.com/api/v4)
- `GITLAB_PROJECT_ID` - Default project ID for operations
- `GITLAB_ALLOWED_PROJECT_IDS` - Comma-separated list of allowed project IDs

### Claude API Configuration (Optional - Enhanced Analysis)
- `CLAUDE_API_KEY` or `ANTHROPIC_API_KEY` - Your Anthropic Claude API key (for AI-powered comment analysis)
- `CLAUDE_MODEL` - Claude model to use (default: claude-sonnet-4-20250514)
- `CLAUDE_MAX_TOKENS` - Maximum tokens for Claude responses (default: 1000)
- `CLAUDE_TEMPERATURE` - Claude temperature setting (default: 0.1)

**Note**: If Claude API key is not provided, the system will fall back to heuristic-based comment analysis.

## Installation & Usage

### With Claude Code CLI
```bash
# Install dependencies
npm install

# Build the server
npm run build

# Add to Claude Code
claude mcp add mr-feedback-processor ./build/index.js
```

### Example Usage
```javascript
// In your Claude Code session:

// Analyze current branch MR (with Claude AI if configured)
analyze_mr_feedback()

// Get complete analysis with diffs  
get_mr_with_analysis()

// Find MR for specific branch
find_merge_request_for_branch({"branchName": "feature/new-api"})

// Detect current git branch
detect_current_branch()
```

### Setting up Claude API (Optional)
To enable AI-powered comment analysis, set up your Claude API key:

```bash
# Set your Claude API key
export CLAUDE_API_KEY="your-anthropic-api-key-here"

# Optional: Customize Claude settings
export CLAUDE_MODEL="claude-sonnet-4-20250514"  # Default
export CLAUDE_MAX_TOKENS="1000"                   # Default
export CLAUDE_TEMPERATURE="0.1"                   # Default

# Build and run
npm run build
claude mcp add mr-feedback-processor ./build/index.js
```

**Benefits of Claude AI Integration:**
- **Context-aware analysis**: Understanding of merge request context and code implications
- **Sophisticated categorization**: Better distinction between security, functional, and style issues  
- **Nuanced severity scoring**: More accurate assessment of comment urgency and impact
- **Professional agreement assessment**: AI evaluation of suggestion validity and merit
- **Comprehensive risk analysis**: Multi-factor risk assessment for implementation planning
- **Intelligent responses**: Context-appropriate suggested responses for different comment types
- **Graceful fallback**: Automatically uses heuristic analysis if Claude API is unavailable

### Enhanced Analysis Output Structure

With Claude API enabled, each comment analysis includes:

```json
{
  "category": "security",
  "severity": 9,
  "confidence": 0.95,
  "isValid": true,
  "reasoning": "Comment identifies a critical timing attack vulnerability",
  "suggestedResponse": "Thanks for identifying this security concern...",
  
  "agreementAssessment": {
    "agreesWithSuggestion": true,
    "agreementConfidence": 0.9,
    "agreementReasoning": "The suggestion correctly identifies a timing attack vulnerability...",
    "alternativeApproach": null,
    "additionalConsiderations": ["Consider rate limiting", "Add security logging"]
  },
  
  "riskAssessment": {
    "impactScope": "system",
    "changeComplexity": "moderate", 
    "testCoverage": "partial",
    "riskScore": 6,
    "riskFactors": ["Security implications", "Breaking API changes"],
    "mitigationStrategies": ["Comprehensive security testing", "Gradual rollout"]
  }
}
```

**Risk Assessment Scales:**
- **Impact Scope**: `local` → `module` → `system` → `global`
- **Complexity**: `trivial` → `simple` → `moderate` → `complex` → `extensive`  
- **Test Coverage**: `none` → `minimal` → `partial` → `good` → `comprehensive`
- **Risk Score**: 1 (minimal risk) → 10 (maximum risk)

## Typical Workflow
1. **detect_current_branch** - Identify which branch you're working on
2. **find_merge_request_for_branch** - Locate the associated merge request
3. **analyze_mr_feedback** - Get intelligent analysis of all comments
4. **Review analysis results** - Understand comment categories, severity, and suggested responses
5. **Use existing GitLab tools** to respond to feedback (create_merge_request_note, etc.)

## Integration Benefits
- Works seamlessly with existing git workflows
- No need to manually specify MR IDs or project details
- Intelligent comment prioritization helps focus on important feedback
- Suggested responses speed up review conversations
- Complete context (code + analysis) in one call

## Technical Details
- Built on Node.js with TypeScript
- Extends zereight/gitlab-mcp as foundation
- Uses simple-git for local git operations
- Implements heuristic-based comment analysis (can be enhanced with LLM integration)
- Returns structured JSON for easy consumption by Claude

## Development
```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm run dev
```