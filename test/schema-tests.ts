#!/usr/bin/env ts-node

import {
  GetFileContentsSchema,
  GitLabFileContentSchema,
  GitLabRepositorySchema,
  CreatePipelineSchema,
  CreateIssueNoteSchema,
  CreateMergeRequestEmojiReactionSchema,
  CreateIssueEmojiReactionSchema,
  DeleteMergeRequestEmojiReactionSchema,
  DeleteIssueEmojiReactionSchema,
  CreateMergeRequestNoteEmojiReactionSchema,
  DeleteMergeRequestNoteEmojiReactionSchema,
  CreateIssueNoteEmojiReactionSchema,
  DeleteIssueNoteEmojiReactionSchema,
  CreateWorkItemEmojiReactionSchema,
  DeleteWorkItemEmojiReactionSchema,
  CreateWorkItemNoteEmojiReactionSchema,
  DeleteWorkItemNoteEmojiReactionSchema,
  CreateIssueSchema,
  ListIssuesSchema,
  ListMergeRequestsSchema,
  GitLabTreeItemSchema,
  GetMergeRequestSchema
} from '../schemas.js';

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

interface CreateIssueNoteSchemaTestCase {
  name: string;
  input: Record<string, any>;
  expected?: Record<string, any>;
  shouldFail?: boolean;
}

function runCreateIssueNoteSchemaTests(): { passed: number; failed: number } {
  console.log('\n🧪 Testing CreateIssueNoteSchema...');

  const cases: CreateIssueNoteSchemaTestCase[] = [
    {
      name: 'schema:create_issue_note:top-level-note-without-discussion-id',
      input: { project_id: 'my/project', issue_iid: '42', body: 'A comment' },
      expected: { project_id: 'my/project', issue_iid: '42', body: 'A comment', discussion_id: undefined }
    },
    {
      name: 'schema:create_issue_note:reply-with-discussion-id',
      input: { project_id: 'my/project', issue_iid: '42', discussion_id: 'abc123', body: 'A reply' },
      expected: { project_id: 'my/project', issue_iid: '42', discussion_id: 'abc123', body: 'A reply' }
    },
    {
      name: 'schema:create_issue_note:with-created-at',
      input: { project_id: 'my/project', issue_iid: '7', body: 'Note', created_at: '2025-01-01T00:00:00Z' },
      expected: { project_id: 'my/project', issue_iid: '7', body: 'Note', created_at: '2025-01-01T00:00:00Z' }
    },
    {
      name: 'schema:create_issue_note:numeric-issue-iid-coerced',
      input: { project_id: 'my/project', issue_iid: 99, body: 'Coerced' },
      expected: { project_id: 'my/project', issue_iid: '99', body: 'Coerced' }
    },
    {
      name: 'schema:create_issue_note:reject-missing-body',
      input: { project_id: 'my/project', issue_iid: '1' },
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

    const parsed = CreateIssueNoteSchema.safeParse(testCase.input);

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
        return actual === value;
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

interface GetMergeRequestSchemaTestCase {
  name: string;
  input: Record<string, any>;
  expected?: {
    project_id?: string;
    merge_request_iid?: string;
    source_branch?: string;
  };
  shouldFail?: boolean;
}

function runGetMergeRequestSchemaTests(): { passed: number; failed: number } {
  console.log('\n🧪 Testing GetMergeRequestSchema...');

  const cases: GetMergeRequestSchemaTestCase[] = [
    {
      name: 'schema:get_merge_request:with-project-id-and-merge-request-iid',
      input: { project_id: 'my/project', merge_request_iid: '42' },
      expected: { project_id: 'my/project', merge_request_iid: '42' },
    },
    {
      name: 'schema:get_merge_request:with-project-id-and-source-branch',
      input: { project_id: 'my/project', source_branch: 'feature-branch' },
      expected: { project_id: 'my/project', source_branch: 'feature-branch' },
    },
    {
      name: 'schema:get_merge_request:with-all-params',
      input: { project_id: 'my/project', merge_request_iid: '42', source_branch: 'feature-branch' },
      expected: {
        project_id: 'my/project',
        merge_request_iid: '42',
        source_branch: 'feature-branch',
      },
    },
    {
      name: 'schema:get_merge_request:coerced-merge-request-iid',
      input: { project_id: 'my/project', merge_request_iid: 24 },
      expected: { project_id: 'my/project', merge_request_iid: '24' },
    },
    {
      name: 'schema:get_merge_request:coerced-source-branch',
      input: { project_id: 'my/project', source_branch: 'feature' },
      expected: { project_id: 'my/project', source_branch: 'feature' },
    },
  ];

  let passed = 0;
  let failed = 0;

  cases.forEach(testCase => {
    const result: TestResult = {
      name: testCase.name,
      status: 'failed'
    };

    const parsed = GetMergeRequestSchema.safeParse(testCase.input);

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
        return actual === value;
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

function runEmojiReactionSchemaTests(): { passed: number; failed: number } {
  console.log('\n🧪 Testing Emoji Reaction Schemas...');

  const cases: { name: string; schema: any; input: Record<string, any>; expected?: Record<string, any>; shouldFail?: boolean }[] = [
    { name: 'schema:create_mr_emoji:valid', schema: CreateMergeRequestEmojiReactionSchema, input: { project_id: 'my/project', merge_request_iid: '42', name: 'thumbsup' }, expected: { project_id: 'my/project', merge_request_iid: '42', name: 'thumbsup' } },
    { name: 'schema:create_mr_emoji:numeric-iid-coerced', schema: CreateMergeRequestEmojiReactionSchema, input: { project_id: 'my/project', merge_request_iid: 42, name: 'rocket' }, expected: { merge_request_iid: '42', name: 'rocket' } },
    { name: 'schema:create_mr_emoji:reject-missing-name', schema: CreateMergeRequestEmojiReactionSchema, input: { project_id: 'my/project', merge_request_iid: '42' }, shouldFail: true },
    { name: 'schema:delete_mr_emoji:valid', schema: DeleteMergeRequestEmojiReactionSchema, input: { project_id: 'my/project', merge_request_iid: '42', award_id: '123' }, expected: { merge_request_iid: '42', award_id: '123' } },
    { name: 'schema:create_issue_emoji:valid', schema: CreateIssueEmojiReactionSchema, input: { project_id: 'my/project', issue_iid: '10', name: 'thumbsdown' }, expected: { issue_iid: '10', name: 'thumbsdown' } },
    { name: 'schema:create_issue_emoji:reject-missing-name', schema: CreateIssueEmojiReactionSchema, input: { project_id: 'my/project', issue_iid: '10' }, shouldFail: true },
    { name: 'schema:delete_issue_emoji:valid', schema: DeleteIssueEmojiReactionSchema, input: { project_id: 'my/project', issue_iid: '10', award_id: '99' }, expected: { issue_iid: '10', award_id: '99' } },
    { name: 'schema:create_work_item_emoji:valid', schema: CreateWorkItemEmojiReactionSchema, input: { project_id: 'my/project', iid: 5, name: 'rocket' }, expected: { iid: 5, name: 'rocket' } },
    { name: 'schema:create_work_item_emoji:reject-missing-name', schema: CreateWorkItemEmojiReactionSchema, input: { project_id: 'my/project', iid: 5 }, shouldFail: true },
    { name: 'schema:create_work_item_note_emoji:valid', schema: CreateWorkItemNoteEmojiReactionSchema, input: { project_id: 'my/project', iid: 5, note_id: 'gid://gitlab/Note/123', name: 'thumbsup' }, expected: { iid: 5, note_id: 'gid://gitlab/Note/123', name: 'thumbsup' } },
    { name: 'schema:create_work_item_note_emoji:reject-missing-note-id', schema: CreateWorkItemNoteEmojiReactionSchema, input: { project_id: 'my/project', iid: 5, name: 'thumbsup' }, shouldFail: true },
  ];

  let passed = 0;
  let failed = 0;

  cases.forEach(testCase => {
    const result: TestResult = { name: testCase.name, status: 'failed' };
    const parsed = testCase.schema.safeParse(testCase.input);

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

function runGitLabRepositorySchemaTests(): { passed: number; failed: number } {
  console.log('🧪 Testing GitLabRepositorySchema...');

  const baseProject = {
    id: '42',
    name: 'my-project',
    path_with_namespace: 'group/my-project',
    description: null,
  };

  const cases = [
    {
      name: 'schema:repository:default_branch-null',
      input: { ...baseProject, default_branch: null },
      shouldFail: false,
    },
    {
      name: 'schema:repository:default_branch-string',
      input: { ...baseProject, default_branch: 'main' },
      shouldFail: false,
    },
    {
      name: 'schema:repository:default_branch-omitted',
      input: { ...baseProject },
      shouldFail: false,
    },
  ];

  let passed = 0;
  let failed = 0;

  cases.forEach(testCase => {
    const result: TestResult = { name: testCase.name, status: 'failed' };
    const parsed = GitLabRepositorySchema.safeParse(testCase.input);

    if (testCase.shouldFail) {
      if (parsed.success) {
        result.error = 'Expected schema validation to fail';
      } else {
        result.status = 'passed';
      }
    } else if (parsed.success) {
      result.status = 'passed';
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

function runLabelsCoercionSchemaTests(): { passed: number; failed: number } {
  console.log('\n=== Labels Coercion Schema Tests ===');

  interface LabelTestCase {
    name: string;
    schema: { safeParse: (input: unknown) => { success: boolean; data?: any; error?: any } };
    input: Record<string, any>;
    expectedLabels?: string[];
    shouldFail?: boolean;
  }

  const cases: LabelTestCase[] = [
    {
      name: 'schema:create_issue:labels-native-array',
      schema: CreateIssueSchema,
      input: { project_id: 'my/project', title: 'Test', labels: ['bug', 'enhancement'] },
      expectedLabels: ['bug', 'enhancement'],
    },
    {
      name: 'schema:create_issue:labels-stringified-array',
      schema: CreateIssueSchema,
      input: { project_id: 'my/project', title: 'Test', labels: '["bug","enhancement"]' },
      expectedLabels: ['bug', 'enhancement'],
    },
    {
      name: 'schema:create_issue:labels-omitted',
      schema: CreateIssueSchema,
      input: { project_id: 'my/project', title: 'Test' },
      expectedLabels: undefined,
    },
    {
      name: 'schema:list_issues:labels-native-array',
      schema: ListIssuesSchema,
      input: { project_id: 'my/project', labels: ['bug'] },
      expectedLabels: ['bug'],
    },
    {
      name: 'schema:list_issues:labels-stringified-array',
      schema: ListIssuesSchema,
      input: { project_id: 'my/project', labels: '["bug","enhancement"]' },
      expectedLabels: ['bug', 'enhancement'],
    },
    {
      name: 'schema:list_merge_requests:labels-native-array',
      schema: ListMergeRequestsSchema,
      input: { labels: ['feature'] },
      expectedLabels: ['feature'],
    },
    {
      name: 'schema:list_merge_requests:labels-stringified-array',
      schema: ListMergeRequestsSchema,
      input: { labels: '["feature","bugfix"]' },
      expectedLabels: ['feature', 'bugfix'],
    },
  ];

  let passed = 0;
  let failed = 0;

  function checkLabelResult(
    testCase: LabelTestCase,
    parsed: { success: boolean; data?: any; error?: any }
  ): TestResult {
    const result: TestResult = { name: testCase.name, status: 'failed' };
    if (!parsed.success) {
      result.error = parsed.error?.message || 'Schema validation failed';
      return result;
    }
    const actualLabels = (parsed.data as Record<string, unknown>)['labels'];
    if (testCase.expectedLabels === undefined) {
      result.status = actualLabels === undefined ? 'passed' : 'failed';
      if (actualLabels !== undefined) {
        result.error = `Expected labels to be undefined, got ${JSON.stringify(actualLabels)}`;
      }
      return result;
    }
    const match =
      Array.isArray(actualLabels) &&
      actualLabels.length === testCase.expectedLabels.length &&
      testCase.expectedLabels.every((v, i) => (actualLabels as string[])[i] === v);
    result.status = match ? 'passed' : 'failed';
    if (!match) {
      result.error = `Expected ${JSON.stringify(testCase.expectedLabels)}, got ${JSON.stringify(actualLabels)}`;
    }
    return result;
  }

  cases.forEach(testCase => {
    const parsed = testCase.schema.safeParse(testCase.input);
    let result: TestResult;

    if (testCase.shouldFail) {
      result = { name: testCase.name, status: parsed.success ? 'failed' : 'passed' };
      if (parsed.success) result.error = 'Expected schema validation to fail';
    } else {
      result = checkLabelResult(testCase, parsed);
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

function runGitLabTreeItemSchemaTests(): { passed: number; failed: number } {
  console.log('\n=== GitLabTreeItem Schema Tests ===');

  const cases: { name: string; input: Record<string, unknown>; shouldFail?: boolean }[] = [
    {
      name: 'schema:tree_item:type-blob',
      input: { id: 'abc123', name: 'README.md', type: 'blob', path: 'README.md', mode: '100644' },
    },
    {
      name: 'schema:tree_item:type-tree',
      input: { id: 'def456', name: 'src', type: 'tree', path: 'src', mode: '040000' },
    },
    {
      name: 'schema:tree_item:type-commit-submodule',
      input: { id: 'ghi789', name: 'vendor', type: 'commit', path: 'vendor', mode: '160000' },
    },
    {
      name: 'schema:tree_item:reject-unknown-type',
      input: { id: 'xyz', name: 'foo', type: 'symlink', path: 'foo', mode: '120000' },
      shouldFail: true,
    },
  ];

  let passed = 0;
  let failed = 0;

  cases.forEach(testCase => {
    const result: TestResult = { name: testCase.name, status: 'failed' };
    const parsed = GitLabTreeItemSchema.safeParse(testCase.input);

    if (testCase.shouldFail) {
      result.status = parsed.success ? 'failed' : 'passed';
      if (parsed.success) result.error = 'Expected schema validation to fail';
    } else if (parsed.success) {
      result.status = 'passed';
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
  const createIssueNoteResult = runCreateIssueNoteSchemaTests();
  const getMergeRequestResult = runGetMergeRequestSchemaTests();
  const emojiReactionResult = runEmojiReactionSchemaTests();
  const repositorySchemaResult = runGitLabRepositorySchemaTests();
  const labelsCoercionResult = runLabelsCoercionSchemaTests();
  const treeItemResult = runGitLabTreeItemSchemaTests();

  const totalPassed = getFileContentsResult.passed + fileContentResult.passed + createPipelineResult.passed + createIssueNoteResult.passed + getMergeRequestResult.passed + emojiReactionResult.passed + repositorySchemaResult.passed + labelsCoercionResult.passed + treeItemResult.passed;
  const totalFailed = getFileContentsResult.failed + fileContentResult.failed + createPipelineResult.failed + createIssueNoteResult.failed + getMergeRequestResult.failed + emojiReactionResult.failed + repositorySchemaResult.failed + labelsCoercionResult.failed + treeItemResult.failed;

  console.log(`\nTotal Results: ${totalPassed} passed, ${totalFailed} failed`);

  if (totalFailed > 0) {
    process.exit(1);
  }
}
