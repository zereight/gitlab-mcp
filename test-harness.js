#!/usr/bin/env node

import { spawn } from 'child_process';
import { URL } from 'url';

/**
 * Simplified MR Feedback Test Harness with Better Debugging
 */

class SimpleMRTestHarness {
  constructor() {
    this.timeout = 300000; // 5 minutes
  }

  /**
   * Parse GitLab MR URL to extract project info, MR IID, and optional thread info
   */
  parseMRUrl(urlString) {
    try {
      const url = new URL(urlString);
      const pathParts = url.pathname.split('/').filter(part => part);
      const mrIndex = pathParts.indexOf('merge_requests');
      
      if (mrIndex === -1) {
        throw new Error('URL must contain /merge_requests/');
      }

      const mrIid = pathParts[mrIndex + 1];
      const projectPath = pathParts.slice(0, pathParts.indexOf('-')).join('/');
      
      // Extract discussion or note ID from hash fragment
      let discussionId = null;
      let noteId = null;
      
      if (url.hash) {
        const hashValue = url.hash.substring(1); // Remove #
        if (hashValue.startsWith('note_')) {
          noteId = hashValue.substring(5); // Remove 'note_' prefix
        } else if (hashValue.startsWith('discussion_')) {
          discussionId = hashValue.substring(11); // Remove 'discussion_' prefix
        }
      }
      
      return {
        projectPath,
        projectId: encodeURIComponent(projectPath),
        mrIid,
        discussionId,
        noteId,
        originalUrl: urlString,
        isThreadSpecific: !!(discussionId || noteId)
      };
    } catch (error) {
      throw new Error(`Failed to parse GitLab MR URL: ${error.message}`);
    }
  }

  /**
   * SIMPLIFIED JSON PARSING - No over-engineering
   */
  parseJsonResponse(stdout) {
    console.log('\n🔍 DEBUGGING JSON PARSING:');
    console.log(`📋 Total stdout length: ${stdout.length.toLocaleString()} characters`);
    
    // Show samples from different parts
    console.log(`📋 First 200 chars: ${stdout.slice(0, 200)}`);
    console.log(`📋 Last 500 chars: ${stdout.slice(-500)}`);
    
    // Simple approach: Find the last complete JSON-RPC response
    const jsonStart = stdout.lastIndexOf('{"result":');
    const altJsonStart = stdout.lastIndexOf('{"jsonrpc":');
    const startPos = Math.max(jsonStart, altJsonStart);
    
    console.log(`🔍 JSON start search results: {"result": ${jsonStart}, {"jsonrpc": ${altJsonStart}`);
    console.log(`🎯 Using start position: ${startPos}`);
    
    if (startPos === -1) {
      throw new Error('No JSON-RPC response found in output');
    }
    
    // Find the end by looking for the closing pattern
    const endPattern = '},"jsonrpc":"2.0","id":1}';
    let endPos = stdout.indexOf(endPattern, startPos);
    
    if (endPos === -1) {
      // Try alternative ending patterns
      const altEndPattern = ',"jsonrpc":"2.0","id":1}';
      endPos = stdout.indexOf(altEndPattern, startPos);
      if (endPos !== -1) {
        endPos += altEndPattern.length;
      }
    } else {
      endPos += endPattern.length;
    }
    
    console.log(`🔍 JSON end position: ${endPos}`);
    
    if (endPos === -1 || endPos <= startPos) {
      throw new Error('Could not find complete JSON-RPC response');
    }
    
    const jsonStr = stdout.substring(startPos, endPos);
    console.log(`📋 Extracted JSON: ${jsonStr.length} characters`);
    console.log(`📋 JSON preview: ${jsonStr.slice(0, 200)}...${jsonStr.slice(-200)}`);
    
    try {
      const jsonResponse = JSON.parse(jsonStr);
      console.log('✅ JSON parsing successful!');
      return jsonResponse;
    } catch (parseError) {
      console.log(`❌ JSON parsing failed: ${parseError.message}`);
      
      // Additional debugging
      if (parseError.message.includes('position')) {
        const errorPos = parseInt(parseError.message.match(/\d+/)?.[0] || '0');
        const errorContext = jsonStr.slice(Math.max(0, errorPos - 50), errorPos + 50);
        console.log(`📋 Error context around position ${errorPos}: "${errorContext}"`);
      }
      
      // Try to clean the JSON
      const cleanJson = jsonStr.trim().replace(/\n\s*/g, '');
      console.log(`🔧 Trying cleaned JSON (${cleanJson.length} chars)...`);
      
      try {
        const cleanedResponse = JSON.parse(cleanJson);
        console.log('✅ Cleaned JSON parsing successful!');
        return cleanedResponse;
      } catch (cleanError) {
        console.log(`❌ Cleaned JSON also failed: ${cleanError.message}`);
        throw new Error(`JSON parsing failed: ${parseError.message}`);
      }
    }
  }

  /**
   * Run the analysis with optional auto-response support
   */
  async runAnalysis(projectId, mrIid, dryRun = true) {
    return new Promise((resolve, reject) => {
      console.log('🚀 Starting MR feedback analysis...');
      
      const child = spawn('node', ['build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer
      });

      const request = JSON.stringify({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
          "name": "analyze_mr_feedback_with_responses",
          "arguments": {
            "projectId": projectId,
            "mergeRequestIid": mrIid,
            "autoResponseConfig": {
              "enabled": true,
              "dryRun": dryRun,
              "maxResponsesPerSession": 20,
              "requireApprovalForDisagreements": false,
              "requireApprovalForAnswers": false,
              "confidenceThreshold": 0.5
            },
            "autoFixConfig": {
              "enabled": true,
              "dryRun": dryRun,
              "maxFixesPerSession": 10,
              "riskThreshold": "low",
              "confidenceThreshold": 0.8,
              "allowedFileTypes": [".ts", ".js", ".tsx", ".jsx", ".py", ".java", ".cpp", ".c", ".h"],
              "excludedPaths": ["node_modules", ".git", "dist", "build", "target"],
              "requireApprovalForRefactors": false,
              "requireApprovalForBugFixes": false,
              "workingDirectory": process.cwd()
            }
          }
        }
      });

      child.stdin.write(request + '\n');
      child.stdin.end();

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutHandle = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Analysis timed out after 5 minutes'));
      }, this.timeout);

      child.on('close', (code) => {
        clearTimeout(timeoutHandle);
        
        console.log(`\n📊 MCP Process Results:`);
        console.log(`   • Exit code: ${code}`);
        console.log(`   • Stderr length: ${stderr.length} chars`);
        console.log(`   • Stdout length: ${stdout.length} chars`);
        
        if (stderr.length > 0) {
          console.log(`\n⚠️  Stderr content (last 500 chars):`);
          console.log(`${stderr.slice(-500)}`);
        }
        
        if (code !== 0) {
          console.log(`❌ Process failed with code ${code}`);
          reject(new Error(`Analysis process failed with code ${code}`));
          return;
        }

        try {
          const jsonResponse = this.parseJsonResponse(stdout);
          
          if (jsonResponse?.result?.content?.[0]?.text) {
            console.log('\n🔧 PARSING ANALYSIS CONTENT:');
            let analysisText = jsonResponse.result.content[0].text;
            console.log(`   • Analysis content type: ${typeof analysisText}`);
            console.log(`   • Analysis content length: ${analysisText.length} characters`);
            console.log(`   • Content preview: ${analysisText.slice(0, 200)}...`);
            
            // Check for escaped content
            if (typeof analysisText === 'string' && analysisText.includes('\\"')) {
              console.log('   • Detected escaped JSON, attempting to unescape...');
              try {
                // Standard JSON.parse approach for escaped strings
                analysisText = JSON.parse(`"${analysisText}"`);
                console.log('   ✅ Successfully unescaped content');
              } catch (unescapeError) {
                console.log(`   ⚠️  Unescaping failed: ${unescapeError.message}, using as-is`);
              }
            }
            
            const analysisData = JSON.parse(analysisText);
            console.log('   ✅ Analysis data parsed successfully!');
            console.log(`   • Found ${analysisData.commentAnalysis?.length || 0} analyzed comments`);
            console.log(`   • Has autoResponseResults: ${!!analysisData.autoResponseResults}`);
            if (analysisData.autoResponseResults) {
              const { plannedResponses, executedResponses, skippedResponses } = analysisData.autoResponseResults;
              console.log(`   • Planned responses: ${plannedResponses?.length || 0}`);
              console.log(`   • Executed responses: ${executedResponses?.length || 0}`);
              console.log(`   • Skipped responses: ${skippedResponses?.length || 0}`);
            }
            
            resolve(analysisData);
          } else if (jsonResponse?.error) {
            reject(new Error(`MCP Server Error: ${jsonResponse.error.message}`));
          } else {
            reject(new Error('Invalid response structure - missing analysis content'));
          }
        } catch (error) {
          console.log(`❌ Final parsing error: ${error.message}`);
          reject(error);
        }
      });
    });
  }

  /**
   * Display detailed analysis for a single comment
   */
  displayCommentDetails(analysis, index, total) {
    const categoryEmoji = this.getCategoryEmoji(analysis.category);
    const severityColor = this.getSeverityColor(analysis.severity);
    
    // Thread status display
    const threadStatus = this.getThreadStatusDisplay(analysis.threadMetadata);
    
    console.log(`\n[${index}/${total}] ${categoryEmoji} ${analysis.category.toUpperCase()}`);
    console.log(`├─ ${threadStatus}`);
    console.log(`┌─ Severity: ${severityColor}${analysis.severity}/10${this.resetColor()} | Confidence: ${Math.round(analysis.confidence * 100)}%`);
    
    // Agreement Assessment
    if (analysis.agreementAssessment) {
      const agree = analysis.agreementAssessment.agreesWithSuggestion ? '✅ AGREES' : '❌ DISAGREES';
      const confidence = Math.round(analysis.agreementAssessment.agreementConfidence * 100);
      console.log(`├─ Claude's Opinion: ${agree} (${confidence}% confident)`);
    }
    
    // Risk Assessment
    if (analysis.riskAssessment) {
      const riskColor = this.getRiskColor(analysis.riskAssessment.riskScore);
      console.log(`├─ Risk Score: ${riskColor}${analysis.riskAssessment.riskScore}/10${this.resetColor()}`);
      console.log(`├─ Impact: ${analysis.riskAssessment.impactScope.toUpperCase()} | Complexity: ${analysis.riskAssessment.changeComplexity.toUpperCase()}`);
      console.log(`├─ Test Coverage: ${analysis.riskAssessment.testCoverage.toUpperCase()}`);
      
      if (analysis.riskAssessment.riskFactors.length > 0) {
        console.log(`├─ Risk Factors: ${analysis.riskAssessment.riskFactors.join(', ')}`);
      }
      
      if (analysis.riskAssessment.mitigationStrategies.length > 0) {
        console.log(`├─ Mitigation: ${analysis.riskAssessment.mitigationStrategies.slice(0, 2).join(', ')}`);
      }
    }
    
    // Question Assessment (for question-type comments)
    if (analysis.questionAssessment) {
      const canAnswer = analysis.questionAssessment.canAnswerQuestion ? '✅ CAN ANSWER' : '❓ CANNOT ANSWER';
      const answerConfidence = Math.round(analysis.questionAssessment.answerConfidence * 100);
      console.log(`├─ Question Status: ${canAnswer} (${answerConfidence}% confidence)`);
      console.log(`├─ Question Type: ${analysis.questionAssessment.questionType.toUpperCase()}`);
      console.log(`├─ Requires Code Analysis: ${analysis.questionAssessment.requiresCodeAnalysis ? 'YES' : 'NO'}`);
      
      if (analysis.questionAssessment.suggestedAnswer) {
        console.log(`├─ Claude's Answer: ${this.truncateText(analysis.questionAssessment.suggestedAnswer, 200)}`);
      }
    }
    
    // Auto Response Decision
    if (analysis.autoResponseDecision && analysis.autoResponseDecision.shouldRespond) {
      const responseTypeDisplay = this.getResponseTypeDisplay(analysis.autoResponseDecision.responseType);
      const responseConfidence = Math.round(analysis.autoResponseDecision.confidence * 100);
      const approvalStatus = analysis.autoResponseDecision.requiresApproval ? '⚠️  NEEDS APPROVAL' : '✅ AUTO-APPROVED';
      
      console.log(`├─ 🤖 Auto-Response: ${responseTypeDisplay} (${responseConfidence}% confidence)`);
      console.log(`├─ Approval Status: ${approvalStatus}`);
      console.log(`├─ Response Reason: ${this.truncateText(analysis.autoResponseDecision.responseReason, 150)}`);
      console.log(`├─ Planned Response: ${this.truncateText(analysis.autoResponseDecision.responseContent, 200)}`);
    } else if (analysis.autoResponseDecision) {
      console.log(`├─ 🤖 Auto-Response: NO RESPONSE PLANNED`);
    }
    
    // Comment Details
    console.log(`├─ Author: ${analysis.author}`);
    console.log(`├─ Comment: ${this.truncateText(analysis.body, 150)}`);
    
    // Claude's Analysis
    if (analysis.agreementAssessment?.agreementReasoning) {
      console.log(`├─ Claude Analysis: ${this.truncateText(analysis.agreementAssessment.agreementReasoning, 200)}`);
    }
    
    // Alternative Approach
    if (analysis.agreementAssessment?.alternativeApproach) {
      console.log(`├─ Alternative: ${this.truncateText(analysis.agreementAssessment.alternativeApproach, 150)}`);
    }
    
    console.log(`└─ Suggested Response: ${this.truncateText(analysis.suggestedResponse, 150)}`);
  }

  // Utility methods for formatting
  getCategoryEmoji(category) {
    const emojis = {
      security: '🔐',
      critical: '🚨', 
      functional: '⚡',
      style: '🎨',
      question: '❓',
      minor: '🔧'
    };
    return emojis[category] || '📝';
  }

  getSeverityColor(severity) {
    if (severity >= 8) return '\x1b[91m'; // Bright red
    if (severity >= 6) return '\x1b[93m'; // Yellow  
    if (severity >= 4) return '\x1b[92m'; // Green
    return '\x1b[90m'; // Gray
  }

  getRiskColor(risk) {
    if (risk >= 7) return '\x1b[91m'; // Bright red
    if (risk >= 5) return '\x1b[93m'; // Yellow
    if (risk >= 3) return '\x1b[92m'; // Green
    return '\x1b[90m'; // Gray
  }

  resetColor() {
    return '\x1b[0m';
  }

  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength) + '...';
  }

  getThreadStatusDisplay(threadMetadata) {
    if (!threadMetadata) {
      return '📝 No thread info';
    }
    
    const { isResolved, isIndividualNote, totalNotes, userNotes, threadPosition } = threadMetadata;
    
    if (isIndividualNote) {
      return isResolved ? '📝 Resolved individual note' : '📝 Individual note';
    }
    
    const status = isResolved ? '✅ RESOLVED' : '🔄 ACTIVE';
    const position = threadPosition === 0 ? 'Thread starter' : `Reply ${threadPosition}`;
    const noteInfo = userNotes === totalNotes 
      ? `${totalNotes} notes` 
      : `${userNotes}/${totalNotes} user notes`;
    
    return `${status} thread | ${position} | ${noteInfo}`;
  }

  getResponseTypeDisplay(responseType) {
    const displays = {
      disagreement: '⚠️  DISAGREEMENT',
      clarification_request: '❓ CLARIFICATION REQUEST',
      answer_question: '💬 ANSWER QUESTION',
      none: 'NONE'
    };
    return displays[responseType] || 'UNKNOWN';
  }

  /**
   * Display thread-specific analysis when a comment/discussion URL is provided
   */
  displayThreadSpecificAnalysis(analysisData, urlInfo) {
    console.log('\n' + '='.repeat(100));
    console.log('🎯 THREAD-FOCUSED ANALYSIS');
    console.log('='.repeat(100));
    
    console.log(`🔗 Target URL: ${urlInfo.originalUrl}`);
    console.log(`📍 Project: ${urlInfo.projectPath}`);
    console.log(`📋 MR: ${urlInfo.mrIid}`);
    
    if (urlInfo.discussionId) {
      console.log(`💬 Discussion ID: ${urlInfo.discussionId}`);
    }
    if (urlInfo.noteId) {
      console.log(`📝 Note ID: ${urlInfo.noteId}`);
    }

    // Find the target thread in analysis results
    const targetThreads = this.findTargetThreadAnalysis(analysisData, urlInfo);
    
    if (!targetThreads || targetThreads.length === 0) {
      console.log('\n❌ Thread not found in analysis results');
      console.log('   This could mean:');
      console.log('   • The comment/thread ID is incorrect');
      console.log('   • The comment was not analyzed (system note, resolved thread, etc.)');
      console.log('   • The MR or project ID is incorrect');
      return;
    }

    console.log(`\n📊 Found ${targetThreads.length} comment(s) in target thread:`);
    
    targetThreads.forEach((analysis, index) => {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`[THREAD COMMENT ${index + 1}/${targetThreads.length}]`);
      this.displayCommentDetails(analysis, index + 1, targetThreads.length);
    });

    // Show overall MR context that informed this analysis
    this.displayThreadContext(analysisData, targetThreads);
  }

  /**
   * Find the specific thread analysis based on discussion/note ID
   */
  findTargetThreadAnalysis(analysisData, urlInfo) {
    const { commentAnalysis } = analysisData;
    
    if (!commentAnalysis || commentAnalysis.length === 0) {
      return null;
    }

    // If we have a note ID, find the specific comment
    if (urlInfo.noteId) {
      const target = commentAnalysis.find(analysis => 
        analysis.id === parseInt(urlInfo.noteId) || analysis.id === urlInfo.noteId
      );
      return target ? [target] : null;
    }
    
    // If we have a discussion ID, find comments from that thread
    if (urlInfo.discussionId) {
      const targets = commentAnalysis.filter(analysis => 
        analysis.threadMetadata?.discussionId === urlInfo.discussionId
      );
      return targets.length > 0 ? targets : null;
    }

    return null;
  }

  /**
   * Display context that informed the thread analysis
   */
  displayThreadContext(analysisData, targetThreads) {
    console.log('\n' + '='.repeat(100));
    console.log('📋 MR CONTEXT THAT INFORMED THIS ANALYSIS');
    console.log('='.repeat(100));
    
    const { mergeRequest, summary } = analysisData;
    
    console.log(`📝 MR Title: ${mergeRequest.title}`);
    console.log(`🌿 Source → Target: ${mergeRequest.source_branch} → ${mergeRequest.target_branch}`);
    console.log(`👤 Author: ${mergeRequest.author?.name} (@${mergeRequest.author?.username})`);
    
    if (summary) {
      console.log(`\n📊 Overall MR Analysis:`);
      console.log(`  • Total Comments: ${summary.totalComments}`);
      console.log(`  • Valid Comments: ${summary.validComments}`);
      console.log(`  • High Priority: ${summary.highPriorityComments}`);
    }

    // Show how this thread fits into the bigger picture
    const threadSeverities = targetThreads.map(t => t.severity);
    const threadCategories = [...new Set(targetThreads.map(t => t.category))];
    const avgSeverity = threadSeverities.reduce((a, b) => a + b, 0) / threadSeverities.length;
    
    console.log(`\n🎯 Target Thread Summary:`);
    console.log(`  • Comments in Thread: ${targetThreads.length}`);
    console.log(`  • Categories: ${threadCategories.join(', ')}`);
    console.log(`  • Average Severity: ${avgSeverity.toFixed(1)}/10`);
    console.log(`  • Thread Status: ${this.getOverallThreadStatus(targetThreads)}`);
  }

  /**
   * Get overall status for a thread based on its comments
   */
  getOverallThreadStatus(threadComments) {
    const hasResolved = threadComments.some(c => c.threadMetadata?.isResolved);
    const hasActive = threadComments.some(c => !c.threadMetadata?.isResolved);
    const hasResponses = threadComments.some(c => c.autoResponseDecision?.shouldRespond);
    
    let status = [];
    if (hasResolved) status.push('✅ Contains resolved comments');
    if (hasActive) status.push('🔄 Contains active comments');
    if (hasResponses) status.push('🤖 Has planned auto-responses');
    
    return status.length > 0 ? status.join(' • ') : 'No specific status';
  }

  async run() {
    try {
      const args = process.argv.slice(2);
      const dryRun = !args.includes('--execute');
      
      if (args.length === 0 || (args.length === 1 && args[0] === '--execute')) {
        console.log('Usage: node test-harness.js <gitlab-mr-url> [--execute]');
        console.log('');
        console.log('Supports both full MR analysis and thread-specific analysis:');
        console.log('  • https://gitlab.com/group/project/-/merge_requests/123');
        console.log('  • https://gitlab.com/group/project/-/merge_requests/123#note_456789');
        console.log('  • https://gitlab.com/group/project/-/merge_requests/123#discussion_789012');
        console.log('');
        console.log('Options:');
        console.log('  --execute    Actually post responses (default: dry-run mode)');
        console.log('');
        console.log('When a comment or discussion URL is provided, the tool will:');
        console.log('  • Analyze the entire MR for context');
        console.log('  • Focus output on the specific thread for debugging');
        process.exit(1);
      }

      const mrUrl = args.find(arg => !arg.startsWith('--'));
      console.log(`🔗 Parsing GitLab MR URL: ${mrUrl}`);

      const mrInfo = this.parseMRUrl(mrUrl);
      console.log(`✅ Extracted: Project=${mrInfo.projectPath}, MR IID=${mrInfo.mrIid}`);
      
      if (dryRun) {
        console.log('🧪 Running in DRY-RUN mode (no responses will be posted)');
        console.log('   💡 Responses will be planned but not executed');
        console.log('   💡 Use --execute flag to actually post responses');
      } else {
        console.log('⚡ Running in EXECUTE mode (responses will be posted)');
        console.log('   🚨 This will make actual API calls to GitLab');
        console.log('   🚨 Responses will be posted to the merge request');
      }

      console.log('\n🤖 Running enhanced analysis with auto-response capabilities...');
      console.log(`📡 Making MCP call to analyze_mr_feedback_with_responses...`);
      console.log(`   • Project ID: ${mrInfo.projectId}`);
      console.log(`   • MR IID: ${mrInfo.mrIid}`);
      console.log(`   • Auto-Response Enabled: true`);
      console.log(`   • Dry Run: ${dryRun}`);
      
      const analysisData = await this.runAnalysis(mrInfo.projectId, mrInfo.mrIid, dryRun);
      
      console.log('✅ MCP analysis completed, processing results...');
      
      // Check if this is thread-specific analysis
      if (mrInfo.isThreadSpecific) {
        this.displayThreadSpecificAnalysis(analysisData, mrInfo);
      } else {
        // Detailed results display for each comment
        console.log('\n' + '='.repeat(100));
        console.log('📝 DETAILED COMMENT ANALYSIS');
        console.log('='.repeat(100));
        
        if (analysisData.commentAnalysis && analysisData.commentAnalysis.length > 0) {
          analysisData.commentAnalysis.forEach((analysis, index) => {
            this.displayCommentDetails(analysis, index + 1, analysisData.commentAnalysis.length);
          });
        } else {
          console.log('📭 No comments found for analysis in this merge request.');
        }
      }
      
      // Brief summary at the end
      console.log('\n' + '='.repeat(100));
      console.log('📊 SUMMARY');
      console.log('='.repeat(100));
      console.log(`📋 Total Comments: ${analysisData.summary?.totalComments || 0}`);
      console.log(`✅ Valid Comments: ${analysisData.summary?.validComments || 0}`);
      console.log(`🔥 High Priority: ${analysisData.summary?.highPriorityComments || 0}`);
      console.log(`📈 Average Severity: ${analysisData.summary?.averageSeverity || 0}/10`);
      
      if (analysisData.summary?.categoryCounts) {
        const categories = Object.entries(analysisData.summary.categoryCounts)
          .map(([cat, count]) => `${cat.toUpperCase()}:${count}`)
          .join(', ');
        console.log(`📝 Categories: ${categories}`);
      }
      
      // Auto-response summary
      if (analysisData.autoResponseResults) {
        const { plannedResponses, executedResponses, skippedResponses } = analysisData.autoResponseResults;
        console.log('\n' + '='.repeat(100));
        console.log('🤖 AUTO-RESPONSE SUMMARY');
        console.log('='.repeat(100));
        console.log(`📋 Total Responses Planned: ${plannedResponses.length}`);
        console.log(`✅ Responses Executed: ${executedResponses.length}`);
        console.log(`⏭️  Responses Skipped: ${skippedResponses.length}`);
        
        if (executedResponses.length > 0) {
          const successful = executedResponses.filter(r => r.success).length;
          const failed = executedResponses.length - successful;
          console.log(`   - Successful: ${successful}`);
          if (failed > 0) {
            console.log(`   - Failed: ${failed}`);
          }
        }
        
        if (skippedResponses.length > 0) {
          console.log(`\nSkipped Response Reasons:`);
          const reasonCounts = skippedResponses.reduce((acc, skip) => {
            acc[skip.reason] = (acc[skip.reason] || 0) + 1;
            return acc;
          }, {});
          
          Object.entries(reasonCounts).forEach(([reason, count]) => {
            console.log(`   - ${reason}: ${count}`);
          });
        }
      }
      
      console.log('✅ Analysis completed successfully!');

    } catch (error) {
      console.error('\n❌ Test Harness Failed:');
      console.error(`   ${error.message}`);
      process.exit(1);
    }
  }
}

// Run the simplified test harness
const testHarness = new SimpleMRTestHarness();
testHarness.run().catch(console.error);