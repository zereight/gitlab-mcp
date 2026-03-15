#!/usr/bin/env ts-node

import { GetFileContentsSchema, GitLabFileContentSchema } from '../schemas.js';

interface TestResult {
  name: string;
  status: 'passed' | 'failed';
  error?: string;
}

interface GetFileContentsSchemaTestCase {
  name: string;
  input: Record<string, any>;
  expected?: {
    project_id?: string;
    file_path?: string;
    ref?: string;
  };
  shouldFail?: boolean;
}

interface GitLabFileContentSchemaTestCase {
  name: string;
  input: Record<string, any>;
  expected?: {
    file_name?: string;
    file_path?: string;
    size?: number;
    encoding?: string;
    content?: string;
    ref?: string;
  };
  shouldFail?: boolean;
}

function runGetFileContentsSchemaTests(): { passed: number; failed: number } {
  console.log('🧪 Testing GetFileContentsSchema...');
  
  const cases: GetFileContentsSchemaTestCase[] = [
    {
      name: 'schema:get_file_contents:path-only',
      input: { path: 'package.json' },
      expected: { file_path: 'package.json', project_id: undefined, ref: undefined }
    },
    {
      name: 'schema:get_file_contents:file-path-precedence',
      input: { file_path: ' README.md ', path: 'package.json' },
      expected: { file_path: 'README.md', project_id: undefined, ref: undefined }
    },
    {
      name: 'schema:get_file_contents:project-id-trim',
      input: { project_id: ' 123 ', file_path: 'a.txt' },
      expected: { project_id: '123', file_path: 'a.txt', ref: undefined }
    },
    {
      name: 'schema:get_file_contents:ref-trim-to-undefined',
      input: { file_path: 'a.txt', ref: '   ' },
      expected: { file_path: 'a.txt', project_id: undefined, ref: undefined }
    },
    {
      name: 'schema:get_file_contents:file-path-empty-fallback-to-path',
      input: { file_path: '   ', path: ' src/index.ts ' },
      expected: { file_path: 'src/index.ts', project_id: undefined, ref: undefined }
    },
    {
      name: 'schema:get_file_contents:project-id-omitted-remains-undefined',
      input: { file_path: 'README.md' },
      expected: { file_path: 'README.md', project_id: undefined, ref: undefined }
    },
    {
      name: 'schema:get_file_contents:reject-empty-path',
      input: { path: '   ' },
      shouldFail: true
    },
    {
      name: 'schema:get_file_contents:reject-both-empty-after-trim',
      input: { file_path: '   ', path: '   ' },
      shouldFail: true
    }
  ];

  let passed = 0;
  let failed = 0;

  cases.forEach(testCase => {
    const result: TestResult = {
      name: testCase.name,
      status: 'failed'
    };

    const parsed = GetFileContentsSchema.safeParse(testCase.input);

    if (testCase.shouldFail) {
      if (parsed.success) {
        result.error = 'Expected schema validation to fail';
      } else {
        result.status = 'passed';
      }
    } else if (parsed.success) {
      const { project_id, file_path, ref } = parsed.data;
      const expected = testCase.expected || {};
      const matches = project_id === expected.project_id && file_path === expected.file_path && ref === expected.ref;
      if (matches) {
        result.status = 'passed';
      } else {
        result.error = `Unexpected parsed result: ${JSON.stringify(parsed.data)}`;
      }
    } else {
      result.error = parsed.error?.message || 'Schema validation failed';
    }

    if (result.status === 'passed') {
      passed++;
      console.log(`✅ ${result.name}`);
    } else {
      failed++;
      console.log(`❌ ${result.name}: ${result.error}`);
    }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  return { passed, failed };
}

function runGitLabFileContentSchemaTests(): { passed: number; failed: number } {
  console.log('\n🧪 Testing GitLabFileContentSchema...');

  const cases: GitLabFileContentSchemaTestCase[] = [
    {
      name: 'schema:gitlab_file_content:minimal-required-fields',
      input: {
        file_path: 'README.md',
        encoding: 'base64',
        content: 'IyBSRUFETUU='
      },
      expected: {
        file_path: 'README.md',
        encoding: 'base64',
        content: 'IyBSRUFETUU='
      }
    },
    {
      name: 'schema:gitlab_file_content:optional-size-coerces-to-number',
      input: {
        file_name: 'README.md',
        file_path: 'README.md',
        size: '42',
        encoding: 'base64',
        content: 'IyBSRUFETUU=',
        ref: 'main'
      },
      expected: {
        file_name: 'README.md',
        file_path: 'README.md',
        size: 42,
        encoding: 'base64',
        content: 'IyBSRUFETUU=',
        ref: 'main'
      }
    },
    {
      name: 'schema:gitlab_file_content:reject-missing-content',
      input: {
        file_path: 'README.md',
        encoding: 'base64'
      },
      shouldFail: true
    },
    {
      name: 'schema:gitlab_file_content:reject-missing-encoding',
      input: {
        file_path: 'README.md',
        content: 'IyBSRUFETUU='
      },
      shouldFail: true
    },
    {
      name: 'schema:gitlab_file_content:reject-missing-file-path',
      input: {
        encoding: 'base64',
        content: 'IyBSRUFETUU='
      },
      shouldFail: true
    }
  ];

  let passed = 0;
  let failed = 0;

  cases.forEach(testCase => {
    const result: TestResult = {
      name: testCase.name,
      status: 'failed'
    };

    const parsed = GitLabFileContentSchema.safeParse(testCase.input);

    if (testCase.shouldFail) {
      if (parsed.success) {
        result.error = 'Expected schema validation to fail';
      } else {
        result.status = 'passed';
      }
    } else if (parsed.success) {
      const expected = testCase.expected || {};
      const matches = Object.entries(expected).every(([key, value]) => {
        return (parsed.data as Record<string, unknown>)[key] === value;
      });
      if (matches) {
        result.status = 'passed';
      } else {
        result.error = `Unexpected parsed result: ${JSON.stringify(parsed.data)}`;
      }
    } else {
      result.error = parsed.error?.message || 'Schema validation failed';
    }

    if (result.status === 'passed') {
      passed++;
      console.log(`✅ ${result.name}`);
    } else {
      failed++;
      console.log(`❌ ${result.name}: ${result.error}`);
    }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  return { passed, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const getFileContentsResult = runGetFileContentsSchemaTests();
  const fileContentResult = runGitLabFileContentSchemaTests();

  const totalPassed = getFileContentsResult.passed + fileContentResult.passed;
  const totalFailed = getFileContentsResult.failed + fileContentResult.failed;

  console.log(`\nTotal Results: ${totalPassed} passed, ${totalFailed} failed`);

  if (totalFailed > 0) {
    process.exit(1);
  }
}
