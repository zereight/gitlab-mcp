#!/usr/bin/env ts-node

/**
 * 읽기 전용 GitLab MCP 도구 테스트 스크립트 (TypeScript)
 * 읽기 전용 GitLab MCP 도구들을 자동으로 테스트합니다.
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

// 환경 변수 설정
const GITLAB_API_URL = process.env.GITLAB_API_URL || "https://gitlab.com/api/v4";
const GITLAB_TOKEN = process.env.GITLAB_PERSONAL_ACCESS_TOKEN || process.env.GITLAB_TOKEN;
const TEST_PROJECT_ID = process.env.GITLAB_PROJECT_ID || process.env.TEST_PROJECT_ID;

// 타입 정의
interface TestResult {
  name: string;
  category: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  response?: any;
}

interface TestResults {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  details: TestResult[];
}

interface MCPTool {
  name: string;
  category: string;
  required: boolean;
}

interface MCPResponse {
  result?: any;
  error?: any;
  id?: number;
}

// 테스트 결과 저장
const testResults: TestResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  total: 0,
  details: []
};

// 테스트 도구 목록 (GitLab MCP에서 제공하는 모든 도구들)
const mcpTools: MCPTool[] = [
  // 프로젝트 관련
  { name: 'list_projects', category: 'project', required: false },
  { name: 'search_repositories', category: 'project', required: false },
  { name: 'get_project', category: 'project', required: true },
  { name: 'list_project_members', category: 'project', required: true },
  { name: 'list_group_projects', category: 'project', required: false },
  
  // 이슈 관련
  { name: 'list_issues', category: 'issue', required: true },
  { name: 'my_issues', category: 'issue', required: false },
  { name: 'get_issue', category: 'issue', required: true },
  { name: 'list_issue_discussions', category: 'issue', required: true },
  { name: 'list_issue_links', category: 'issue', required: true },
  
  // 머지 리퀘스트 관련
  { name: 'list_merge_requests', category: 'merge_request', required: true },
  { name: 'get_merge_request', category: 'merge_request', required: true },
  { name: 'get_merge_request_diffs', category: 'merge_request', required: true },
  { name: 'list_merge_request_diffs', category: 'merge_request', required: true },
  { name: 'get_branch_diffs', category: 'merge_request', required: true },
  { name: 'mr_discussions', category: 'merge_request', required: true },
  
  // 파이프라인 관련
  { name: 'list_pipelines', category: 'pipeline', required: true },
  { name: 'get_pipeline', category: 'pipeline', required: true },
  { name: 'list_pipeline_jobs', category: 'pipeline', required: true },
  { name: 'list_pipeline_trigger_jobs', category: 'pipeline', required: true },
  { name: 'get_pipeline_job', category: 'pipeline', required: true },
  { name: 'get_pipeline_job_output', category: 'pipeline', required: true },
  
  // 파일 관리
  { name: 'get_file_contents', category: 'file', required: true },
  { name: 'get_repository_tree', category: 'file', required: true },
  
  // 커밋 관련
  { name: 'list_commits', category: 'commit', required: true },
  { name: 'get_commit', category: 'commit', required: true },
  { name: 'get_commit_diff', category: 'commit', required: true },
  
  // 라벨 관련
  { name: 'list_labels', category: 'label', required: true },
  { name: 'get_label', category: 'label', required: true },
  
  // 네임스페이스 관련
  { name: 'list_namespaces', category: 'namespace', required: false },
  { name: 'get_namespace', category: 'namespace', required: false },
  { name: 'verify_namespace', category: 'namespace', required: false },
  
  // 사용자 관련
  { name: 'get_users', category: 'user', required: false },
  
  // 이벤트 관련
  { name: 'list_events', category: 'event', required: false },
  { name: 'get_project_events', category: 'event', required: true },
  
  // 마일스톤 관련 (선택적)
  { name: 'list_milestones', category: 'milestone', required: true },
  { name: 'get_milestone', category: 'milestone', required: true },
  
  // 위키 관련 (선택적)
  { name: 'list_wiki_pages', category: 'wiki', required: true },
  { name: 'get_wiki_page', category: 'wiki', required: true },
  
  // 그룹 이터레이션 관련
  { name: 'list_group_iterations', category: 'iteration', required: false }
];

// MCP 응답 파싱 함수
function parseMCPResponse(output: string): any {
  const lines = output.trim().split('\n');
  for (const line of lines) {
    if (line.startsWith('{')) {
      try {
        const result: MCPResponse = JSON.parse(line);
        if (result.result !== undefined) {
          return result.result;
        }
      } catch (e) {
        // JSON 파싱 실패 시 계속 시도
      }
    }
  }
  return { success: true, raw: output };
}

// MCP 서버와 통신하는 함수
async function callMCPTool(toolName: string, parameters: Record<string, any> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const mcpProcess: ChildProcess = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN,
        GITLAB_API_URL: GITLAB_API_URL,
        GITLAB_PROJECT_ID: TEST_PROJECT_ID
      }
    });

    let output = '';
    let errorOutput = '';

    mcpProcess.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    mcpProcess.stderr?.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });

    mcpProcess.on('close', (code: number | null) => {
      if (code === 0) {
        try {
          const result = parseMCPResponse(output);
          resolve(result);
        } catch (e) {
          reject(new Error(`MCP 응답 파싱 실패: ${(e as Error).message}`));
        }
      } else {
        reject(new Error(`MCP 프로세스 종료 코드 ${code}: ${errorOutput}`));
      }
    });

    // MCP 요청 전송
    const request = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: parameters
      }
    };

    mcpProcess.stdin?.write(JSON.stringify(request) + '\n');
    mcpProcess.stdin?.end();
  });
}

// 도구별 파라미터 설정 함수
async function setupToolParameters(tool: MCPTool): Promise<Record<string, any>> {
  let parameters: Record<string, any> = {};
  
  if (tool.required && TEST_PROJECT_ID) {
    parameters.project_id = TEST_PROJECT_ID;
  }

  // 특정 도구들의 추가 파라미터 설정
  switch (tool.name) {
    case 'get_issue':
      if (TEST_PROJECT_ID) {
        const listResult = await callMCPTool('list_issues', parameters);
        if (Array.isArray(listResult) && listResult.length > 0) {
          parameters.issue_iid = listResult[0].iid;
        } else {
          throw new Error('No issues found to test with');
        }
      }
      break;
    case 'get_merge_request':
      if (TEST_PROJECT_ID) {
        const listResult = await callMCPTool('list_merge_requests', parameters);
        if (Array.isArray(listResult) && listResult.length > 0) {
          parameters.merge_request_iid = listResult[0].iid;
        } else {
          throw new Error('No merge requests found to test with');
        }
      }
      break;
    case 'get_pipeline':
      if (TEST_PROJECT_ID) {
        const pipelinesResult = await callMCPTool('list_pipelines', parameters);
        if (Array.isArray(pipelinesResult) && pipelinesResult.length > 0) {
          parameters.pipeline_id = pipelinesResult[0].id;
        } else {
          throw new Error('No pipelines found to test with');
        }
      }
      break;
    case 'get_pipeline_job':
      if (TEST_PROJECT_ID) {
        const pipelinesResult = await callMCPTool('list_pipelines', parameters);
        if (Array.isArray(pipelinesResult) && pipelinesResult.length > 0) {
          parameters.pipeline_id = pipelinesResult[0].id;
          const jobsResult = await callMCPTool('list_pipeline_jobs', parameters);
          if (Array.isArray(jobsResult) && jobsResult.length > 0) {
            parameters.job_id = jobsResult[0].id;
          }
        } else {
          throw new Error('No pipelines found to test with');
        }
      }
      break;
    case 'get_commit':
      if (TEST_PROJECT_ID) {
        const commitsResult = await callMCPTool('list_commits', parameters);
        if (Array.isArray(commitsResult) && commitsResult.length > 0) {
          parameters.sha = commitsResult[0].id;
        } else {
          throw new Error('No commits found to test with');
        }
      }
      break;
    case 'get_label':
      if (TEST_PROJECT_ID) {
        const labelsResult = await callMCPTool('list_labels', parameters);
        if (Array.isArray(labelsResult) && labelsResult.length > 0) {
          parameters.label_id = labelsResult[0].id;
        } else {
          throw new Error('No labels found to test with');
        }
      }
      break;
    case 'get_wiki_page':
      if (TEST_PROJECT_ID) {
        const wikiResult = await callMCPTool('list_wiki_pages', parameters);
        if (Array.isArray(wikiResult) && wikiResult.length > 0) {
          parameters.slug = wikiResult[0].slug;
        } else {
          throw new Error('No wiki pages found to test with');
        }
      }
      break;
    case 'get_milestone':
      if (TEST_PROJECT_ID) {
        const milestonesResult = await callMCPTool('list_milestones', parameters);
        if (Array.isArray(milestonesResult) && milestonesResult.length > 0) {
          parameters.milestone_id = milestonesResult[0].id;
        } else {
          throw new Error('No milestones found to test with');
        }
      }
      break;
    case 'search_repositories':
      parameters.search = 'test';
      break;
    case 'get_users':
      parameters.usernames = ['root'];
      break;
    case 'verify_namespace':
      parameters.path = 'root';
      break;
  }

  return parameters;
}

// 개별 도구 테스트 함수
async function testTool(tool: MCPTool): Promise<TestResult> {
  const startTime = Date.now();
  let result: TestResult = {
    name: tool.name,
    category: tool.category,
    status: 'skipped',
    duration: 0,
    response: null
  };

  try {
    console.log(`🧪 Testing ${tool.name}...`);
    
    const parameters = await setupToolParameters(tool);
    const response = await callMCPTool(tool.name, parameters);
    
    result.response = response;
    result.status = 'passed';
    result.duration = Date.now() - startTime;
    
    console.log(`✅ ${tool.name} - PASSED (${result.duration}ms)`);
    
  } catch (error) {
    result.status = 'failed';
    result.error = (error as Error).message;
    result.duration = Date.now() - startTime;
    
    console.log(`❌ ${tool.name} - FAILED (${result.duration}ms)`);
    console.log(`   Error: ${(error as Error).message}`);
  }

  return result;
}

// 메인 테스트 실행 함수
async function runReadOnlyTests(): Promise<boolean> {
  console.log('🚀 GitLab MCP 읽기 전용 도구 테스트 시작\n');
  console.log(`📊 총 ${mcpTools.length}개의 읽기 전용 도구를 테스트합니다.\n`);

  // 환경 변수 확인
  if (!GITLAB_TOKEN) {
    console.error('❌ GITLAB_PERSONAL_ACCESS_TOKEN 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  if (!TEST_PROJECT_ID) {
    console.warn('⚠️  GITLAB_PROJECT_ID가 설정되지 않았습니다. 일부 테스트가 건너뛰어질 수 있습니다.');
  }

  // MCP 서버 빌드 확인
  if (!fs.existsSync('build/index.js')) {
    console.log('🔨 MCP 서버를 빌드합니다...');
    const buildProcess = spawn('npm', ['run', 'build'], { stdio: 'inherit' });
    await new Promise<void>((resolve, reject) => {
      buildProcess.on('close', (code: number | null) => {
        if (code === 0) resolve();
        else reject(new Error(`Build failed with code ${code}`));
      });
    });
  }

  // 각 도구 테스트 실행
  for (const tool of mcpTools) {
    const result = await testTool(tool);
    testResults.details.push(result);
    testResults.total++;
    
    if (result.status === 'passed') {
      testResults.passed++;
    } else if (result.status === 'failed') {
      testResults.failed++;
    } else {
      testResults.skipped++;
    }

    // 요청 간 간격 (API 제한 방지)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // 결과 출력
  console.log('\n📊 테스트 결과 요약');
  console.log('='.repeat(50));
  console.log(`총 테스트: ${testResults.total}`);
  console.log(`✅ 성공: ${testResults.passed}`);
  console.log(`❌ 실패: ${testResults.failed}`);
  console.log(`⏭️  건너뜀: ${testResults.skipped}`);
  console.log(`성공률: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

  // 카테고리별 결과
  const categoryResults: Record<string, { passed: number; failed: number; total: number }> = {};
  testResults.details.forEach(result => {
    if (!categoryResults[result.category]) {
      categoryResults[result.category] = { passed: 0, failed: 0, total: 0 };
    }
    categoryResults[result.category].total++;
    if (result.status === 'passed') {
      categoryResults[result.category].passed++;
    } else if (result.status === 'failed') {
      categoryResults[result.category].failed++;
    }
  });

  console.log('\n📈 카테고리별 결과');
  console.log('-'.repeat(30));
  Object.entries(categoryResults).forEach(([category, stats]) => {
    const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
    console.log(`${category.padEnd(15)}: ${stats.passed}/${stats.total} (${successRate}%)`);
  });

  // 실패한 테스트 상세 정보
  const failedTests = testResults.details.filter(r => r.status === 'failed');
  if (failedTests.length > 0) {
    console.log('\n❌ 실패한 테스트 상세 정보');
    console.log('-'.repeat(40));
    failedTests.forEach(test => {
      console.log(`${test.name}: ${test.error}`);
    });
  }

  // 결과를 JSON 파일로 저장
  const reportPath = 'test-results-readonly.json';
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\n📄 상세 결과가 ${reportPath}에 저장되었습니다.`);

  return testResults.failed === 0;
}

// 테스트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  runReadOnlyTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('테스트 실행 중 오류 발생:', error);
      process.exit(1);
    });
}

export { runReadOnlyTests, mcpTools, testResults };
