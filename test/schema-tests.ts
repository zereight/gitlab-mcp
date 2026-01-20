#!/usr/bin/env ts-node

import { GetFileContentsSchema } from '../schemas.js';

interface TestResult {
  name: string;
  status: 'passed' | 'failed';
  error?: string;
}

interface SchemaTestCase {
  name: string;
  input: Record<string, any>;
  expected?: {
    project_id?: string;
    file_path?: string;
    ref?: string;
  };
  shouldFail?: boolean;
}

function runGetFileContentsSchemaTests() {
  console.log('🧪 Testing GetFileContentsSchema...');
  
  const cases: SchemaTestCase[] = [
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
      name: 'schema:get_file_contents:reject-empty-path',
      input: { path: '   ' },
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
      if (!parsed.success) {
        result.status = 'passed';
      } else {
        result.error = 'Expected schema validation to fail';
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
  
  if (failed > 0) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runGetFileContentsSchemaTests();
}
