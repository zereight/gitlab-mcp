#!/usr/bin/env ts-node

import { GetFileContentsSchema, GitLabFileContentSchema, CreatePipelineSchema } from '../schemas.js';

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

interface CreatePipelineSchemaTestCase {
  name: string;
  input: Record<string, any>;
  expected?: {
    project_id?: string;
    ref?: string;
    variables?: Array<{ key: string; value: string }>;
    inputs?: Record<string, string>;
  };
  shouldFail?: boolean;
}

function runCreatePipelineSchemaTests(): { passed: number; failed: number } {
  console.log('\n🧪 Testing CreatePipelineSchema...');

  const cases: CreatePipelineSchemaTestCase[] = [
    {
      name: 'schema:create_pipeline:minimal-required-fields',
      input: { project_id: 'my/project', ref: 'main' },
      expected: { project_id: 'my/project', ref: 'main' }
    },
    {
      name: 'schema:create_pipeline:with-variables-only',
      input: {
        project_id: 'my/project',
        ref: 'main',
        variables: [{ key: 'ENV', value: 'production' }]
      },
      expected: {
        project_id: 'my/project',
        ref: 'main',
        variables: [{ key: 'ENV', value: 'production' }]
      }
    },
    {
      name: 'schema:create_pipeline:with-inputs-only',
      input: {
        project_id: 'my/project',
        ref: 'main',
        inputs: { deploy_target: 'staging', version: '1.0.0' }
      },
      expected: {
        project_id: 'my/project',
        ref: 'main',
        inputs: { deploy_target: 'staging', version: '1.0.0' }
      }
    },
    {
      name: 'schema:create_pipeline:with-variables-and-inputs',
      input: {
        project_id: 'my/project',
        ref: 'develop',
        variables: [{ key: 'CI', value: 'true' }],
        inputs: { env: 'test' }
      },
      expected: {
        project_id: 'my/project',
        ref: 'develop',
        variables: [{ key: 'CI', value: 'true' }],
        inputs: { env: 'test' }
      }
    },
    {
      name: 'schema:create_pipeline:project-id-coercion',
      input: { project_id: 123, ref: 'main' },
      expected: { project_id: '123', ref: 'main' }
    },
    {
      name: 'schema:create_pipeline:reject-missing-ref',
      input: { project_id: 'my/project' },
      shouldFail: true
    },
    {
      name: 'schema:create_pipeline:reject-invalid-inputs-type',
      input: { project_id: 'my/project', ref: 'main', inputs: 'not-an-object' },
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

    const parsed = CreatePipelineSchema.safeParse(testCase.input);

    if (testCase.shouldFail) {
      if (parsed.success) {
        result.error = 'Expected schema validation to fail';
      } else {
        result.status = 'passed';
      }
    } else if (parsed.success) {
      const expected = testCase.expected || {};
      const matches = Object.entries(expected).every(([key, value]) => {
        const actual = (parsed.data as Record<string, unknown>)[key];
        return JSON.stringify(actual) === JSON.stringify(value);
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
  const createPipelineResult = runCreatePipelineSchemaTests();

  const totalPassed = getFileContentsResult.passed + fileContentResult.passed + createPipelineResult.passed;
  const totalFailed = getFileContentsResult.failed + fileContentResult.failed + createPipelineResult.failed;

  console.log(`\nTotal Results: ${totalPassed} passed, ${totalFailed} failed`);

  if (totalFailed > 0) {
    process.exit(1);
  }
}
