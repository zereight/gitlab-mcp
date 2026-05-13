#!/usr/bin/env ts-node

import {
  GetFileContentsSchema,
  GitLabFileContentSchema,
  GitLabRepositorySchema,
  CreatePipelineSchema,
  CreateCommitStatusSchema,
  ListCommitStatusesSchema,
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
  ListLabelsSchema,
  GitLabMergeRequestSchema,
  GitLabTreeItemSchema,
  GetMergeRequestSchema,
  ListMergeRequestPipelinesSchema,
  GetRepositoryTreeSchema,
  GitLabUserFullSchema,
  GitLabMarkdownUploadSchema,
  GitLabDependencyProxySchema,
  GitLabDependencyProxyBlobSchema,
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

function runCommitStatusSchemaTests(): { passed: number; failed: number } {
  console.log('\n🧪 Testing Commit Status Schemas...');

  const cases = [
    {
      name: 'schema:create_commit_status:minimal-required-fields',
      schema: CreateCommitStatusSchema,
      input: { project_id: 'my/project', sha: 'abc123', state: 'success' },
      expected: { project_id: 'my/project', sha: 'abc123', state: 'success' }
    },
    {
      name: 'schema:create_commit_status:with-optional-fields',
      schema: CreateCommitStatusSchema,
      input: {
        project_id: 'my/project',
        sha: 'abc123',
        state: 'failed',
        name: 'external/check',
        target_url: 'https://ci.example.com/build/1',
        description: 'External check failed',
        coverage: '87.5',
        pipeline_id: '42'
      },
      expected: {
        project_id: 'my/project',
        sha: 'abc123',
        state: 'failed',
        name: 'external/check',
        target_url: 'https://ci.example.com/build/1',
        description: 'External check failed',
        coverage: 87.5,
        pipeline_id: 42
      }
    },
    {
      name: 'schema:create_commit_status:context-alias',
      schema: CreateCommitStatusSchema,
      input: { project_id: 123, sha: 'abc123', state: 'pending', context: 'external/check' },
      expected: { project_id: '123', sha: 'abc123', state: 'pending', context: 'external/check' }
    },
    {
      name: 'schema:create_commit_status:reject-invalid-state',
      schema: CreateCommitStatusSchema,
      input: { project_id: 'my/project', sha: 'abc123', state: 'passing' },
      shouldFail: true
    },
    {
      name: 'schema:create_commit_status:reject-missing-state',
      schema: CreateCommitStatusSchema,
      input: { project_id: 'my/project', sha: 'abc123' },
      shouldFail: true
    },
    {
      name: 'schema:list_commit_statuses:filters',
      schema: ListCommitStatusesSchema,
      input: {
        project_id: 'my/project',
        sha: 'abc123',
        ref: 'main',
        name: 'external/check',
        pipeline_id: '42',
        order_by: 'pipeline_id',
        sort: 'desc',
        all: 'true',
        page: '2',
        per_page: '50'
      },
      expected: {
        project_id: 'my/project',
        sha: 'abc123',
        ref: 'main',
        name: 'external/check',
        pipeline_id: 42,
        order_by: 'pipeline_id',
        sort: 'desc',
        all: true,
        page: 2,
        per_page: 50
      }
    },
    {
      name: 'schema:list_commit_statuses:all-false-string',
      schema: ListCommitStatusesSchema,
      input: { project_id: 'my/project', sha: 'abc123', all: 'false' },
      expected: { project_id: 'my/project', sha: 'abc123', all: false }
    },
    {
      name: 'schema:list_commit_statuses:reject-invalid-all-string',
      schema: ListCommitStatusesSchema,
      input: { project_id: 'my/project', sha: 'abc123', all: 'yes' },
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
      name: 'schema:get_merge_request:coerced-project-id',
      input: { project_id: 123, merge_request_iid: '42' },
      expected: { project_id: '123', merge_request_iid: '42' },
    },
    {
      name: 'schema:get_merge_request:coerced-source-branch',
      input: { project_id: 'my/project', source_branch: 'feature' },
      expected: { project_id: 'my/project', source_branch: 'feature' },
    },
    {
      name: 'schema:get_merge_request:reject-missing-project-id-with-merge-request-iid',
      input: { merge_request_iid: '42' },
      shouldFail: true,
    },
    {
      name: 'schema:get_merge_request:reject-missing-project-id-with-source-branch',
      input: { source_branch: 'feature' },
      shouldFail: true,
    },
    {
      name: 'schema:get_merge_request:allow-empty-project-id-for-default-project',
      input: { project_id: '', merge_request_iid: '42' },
      expected: { project_id: '', merge_request_iid: '42' },
    },
    {
      name: 'schema:get_merge_request:reject-whitespace-project-id',
      input: { project_id: '   ', merge_request_iid: '42' },
      shouldFail: true,
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

function runListMergeRequestPipelinesSchemaTests(): { passed: number; failed: number } {
  console.log('\n🧪 Testing ListMergeRequestPipelinesSchema...');

  const cases: { name: string; input: Record<string, any>; expected?: Record<string, any>; shouldFail?: boolean }[] = [
    {
      name: 'schema:list_merge_request_pipelines:minimal-required-fields',
      input: { project_id: 'my/project', merge_request_iid: '42' },
      expected: { project_id: 'my/project', merge_request_iid: '42' },
    },
    {
      name: 'schema:list_merge_request_pipelines:coerces-pagination',
      input: { project_id: 123, merge_request_iid: 42, page: '2', per_page: '10' },
      expected: { project_id: '123', merge_request_iid: '42', page: 2, per_page: 10 },
    },
    {
      name: 'schema:list_merge_request_pipelines:reject-missing-merge-request-iid',
      input: { project_id: 'my/project' },
      shouldFail: true,
    },
  ];

  let passed = 0;
  let failed = 0;

  cases.forEach(testCase => {
    const result: TestResult = { name: testCase.name, status: 'failed' };
    const parsed = ListMergeRequestPipelinesSchema.safeParse(testCase.input);

    if (testCase.shouldFail) {
      result.status = parsed.success ? 'failed' : 'passed';
      if (parsed.success) result.error = 'Expected schema validation to fail';
    } else if (parsed.success) {
      const expected = testCase.expected || {};
      const matches = Object.entries(expected).every(([key, value]) => {
        const actual = (parsed.data as Record<string, unknown>)[key];
        return actual === value;
      });
      result.status = matches ? 'passed' : 'failed';
      if (!matches) result.error = `Unexpected parsed result: ${JSON.stringify(parsed.data)}`;
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

function runGitLabMergeRequestSchemaTests(): { passed: number; failed: number } {
  console.log('\n🧪 Testing GitLabMergeRequestSchema...');

  const baseMergeRequest = {
    id: '1001',
    iid: '42',
    project_id: '123',
    title: 'Add milestone exposure',
    description: 'Expose MR milestone',
    state: 'opened',
    author: {
      id: '1',
      username: 'octocat',
      name: 'Octo Cat',
      avatar_url: null,
      web_url: 'https://gitlab.example.com/octocat',
    },
    assignees: [],
    reviewers: [],
    source_branch: 'feature/milestone',
    target_branch: 'main',
    web_url: 'https://gitlab.example.com/group/project/-/merge_requests/42',
    created_at: '2026-05-07T00:00:00.000Z',
    updated_at: '2026-05-07T00:00:00.000Z',
    merged_at: null,
    closed_at: null,
    merge_commit_sha: null,
  };

  const cases = [
    {
      name: 'schema:gitlab_merge_request:preserves-milestone',
      input: {
        ...baseMergeRequest,
        milestone: {
          id: '5',
          iid: '2',
          title: 'v1.0',
          description: 'Version 1.0',
          state: 'active',
          web_url: 'https://gitlab.example.com/group/project/-/milestones/2',
        },
      },
      validate: (data: Record<string, any>) =>
        data.milestone?.title === 'v1.0' &&
        data.milestone?.id === '5' &&
        data.milestone?.iid === '2',
    },
    {
      name: 'schema:gitlab_merge_request:allows-null-milestone',
      input: {
        ...baseMergeRequest,
        milestone: null,
      },
      validate: (data: Record<string, any>) => data.milestone === null,
    },
    {
      name: 'schema:gitlab_merge_request:allows-omitted-milestone',
      input: {
        ...baseMergeRequest,
      },
      validate: (data: Record<string, any>) => data.milestone === undefined,
    },
    {
      name: 'schema:gitlab_merge_request:labels-string-array',
      input: {
        ...baseMergeRequest,
        labels: ['bug', 'enhancement'],
      },
      validate: (data: Record<string, any>) =>
        Array.isArray(data.labels) &&
        data.labels.length === 2 &&
        data.labels[0] === 'bug' &&
        data.labels[1] === 'enhancement',
    },
    {
      name: 'schema:gitlab_merge_request:labels-object-array',
      input: {
        ...baseMergeRequest,
        labels: [
          {
            id: 1,
            name: 'bug',
            color: '#ff0000',
            text_color: '#ffffff',
            description: null,
            description_html: null,
          },
          {
            id: 2,
            name: 'enhancement',
            color: '#00ff00',
            text_color: '#000000',
            description: 'Improvements',
            description_html: '<p>Improvements</p>',
          },
        ],
      },
      validate: (data: Record<string, any>) =>
        Array.isArray(data.labels) &&
        data.labels.length === 2 &&
        data.labels[0].name === 'bug' &&
        data.labels[0].id === '1' &&
        data.labels[1].name === 'enhancement' &&
        data.labels[1].id === '2',
    },
    {
      name: 'schema:gitlab_merge_request:labels-omitted',
      input: {
        ...baseMergeRequest,
      },
      validate: (data: Record<string, any>) => data.labels === undefined,
    },
  ];

  let passed = 0;
  let failed = 0;

  cases.forEach(testCase => {
    const result: TestResult = { name: testCase.name, status: 'failed' };
    const parsed = GitLabMergeRequestSchema.safeParse(testCase.input);

    if (parsed.success && testCase.validate(parsed.data)) {
      result.status = 'passed';
    } else if (parsed.success) {
      result.error = `Unexpected parsed result: ${JSON.stringify(parsed.data)}`;
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

function runApprovedByUsernamesSchemaTests(): { passed: number; failed: number } {
  console.log('\n=== ListMergeRequestsSchema approved_by_usernames Tests ===');

  const cases: {
    name: string;
    input: Record<string, any>;
    expected?: string[];
    shouldFail?: boolean;
  }[] = [
    {
      name: 'schema:list_merge_requests:approved_by_usernames-native-array',
      input: { approved_by_usernames: ['alice', 'bob'] },
      expected: ['alice', 'bob'],
    },
    {
      name: 'schema:list_merge_requests:approved_by_usernames-stringified-array',
      input: { approved_by_usernames: '["alice","bob"]' },
      expected: ['alice', 'bob'],
    },
    {
      name: 'schema:list_merge_requests:approved_by_usernames-omitted',
      input: {},
      expected: undefined,
    },
  ];

  let passed = 0;
  let failed = 0;

  cases.forEach(testCase => {
    const result: TestResult = { name: testCase.name, status: 'failed' };
    const parsed = ListMergeRequestsSchema.safeParse(testCase.input);

    if (testCase.shouldFail) {
      if (parsed.success) {
        result.error = 'Expected schema validation to fail';
      } else {
        result.status = 'passed';
      }
    } else if (!parsed.success) {
      result.error = parsed.error?.message || 'Schema validation failed';
    } else {
      const actual = (parsed.data as Record<string, unknown>)['approved_by_usernames'];
      if (testCase.expected === undefined) {
        result.status = actual === undefined ? 'passed' : 'failed';
        if (actual !== undefined) {
          result.error = `Expected approved_by_usernames to be undefined, got ${JSON.stringify(actual)}`;
        }
      } else {
        const match =
          Array.isArray(actual) &&
          actual.length === testCase.expected.length &&
          testCase.expected.every((v, i) => (actual as string[])[i] === v);
        result.status = match ? 'passed' : 'failed';
        if (!match) {
          result.error = `Expected ${JSON.stringify(testCase.expected)}, got ${JSON.stringify(actual)}`;
        }
      }
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

function runListLabelsSchemaTests(): { passed: number; failed: number } {
  console.log('\n=== List Labels Schema Tests ===');

  const cases = [
    {
      name: 'schema:list_labels:pagination-coercion',
      input: { project_id: 'my/project', page: '2', per_page: '100' },
      expected: { project_id: 'my/project', page: 2, per_page: 100 },
    },
    {
      name: 'schema:list_labels:filters-with-pagination',
      input: { project_id: 'my/project', search: 'backend', with_counts: 'true', page: 3, per_page: 50 },
      expected: { project_id: 'my/project', search: 'backend', with_counts: true, page: 3, per_page: 50 },
    },
  ];

  let passed = 0;
  let failed = 0;

  cases.forEach(testCase => {
    const result: TestResult = { name: testCase.name, status: 'failed' };
    const parsed = ListLabelsSchema.safeParse(testCase.input);

    if (!parsed.success) {
      result.error = parsed.error?.message || 'Schema validation failed';
    } else {
      const matches = Object.entries(testCase.expected).every(([key, value]) => {
        const actual = (parsed.data as Record<string, unknown>)[key];
        return actual === value;
      });
      if (matches) {
        result.status = 'passed';
      } else {
        result.error = `Unexpected parsed result: ${JSON.stringify(parsed.data)}`;
      }
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

function runGetRepositoryTreeSchemaTests(): { passed: number; failed: number } {
  console.log('\n=== GetRepositoryTree Schema Tests ===');

  const cases: { name: string; input: Record<string, unknown>; expected?: Record<string, unknown>; shouldFail?: boolean }[] = [
    {
      name: 'schema:get_repository_tree:minimal-project-id',
      input: { project_id: 'my/project' },
      expected: { project_id: 'my/project', path: undefined, ref: undefined, recursive: undefined, per_page: undefined, page_token: undefined, pagination: undefined },
    },
    {
      name: 'schema:get_repository_tree:with-keyset-pagination',
      input: { project_id: 'my/project', pagination: 'keyset', per_page: 100 },
      expected: { project_id: 'my/project', pagination: 'keyset', per_page: 100 },
    },
    {
      name: 'schema:get_repository_tree:page-token-for-next-page',
      input: { project_id: 'my/project', pagination: 'keyset', per_page: 100, page_token: 'eyJpZCI6IjEyMyJ9' },
      expected: { project_id: 'my/project', pagination: 'keyset', per_page: 100, page_token: 'eyJpZCI6IjEyMyJ9' },
    },
    {
      name: 'schema:get_repository_tree:per-page-coerces-from-string',
      input: { project_id: 'my/project', per_page: '50' },
      expected: { project_id: 'my/project', per_page: 50 },
    },
    {
      name: 'schema:get_repository_tree:recursive-coerces-from-string',
      input: { project_id: 'my/project', recursive: 'true' },
      expected: { project_id: 'my/project', recursive: true },
    },
    {
      name: 'schema:get_repository_tree:with-path-and-ref',
      input: { project_id: 'my/project', path: 'src/', ref: 'main' },
      expected: { project_id: 'my/project', path: 'src/', ref: 'main' },
    },
  ];

  let passed = 0;
  let failed = 0;

  cases.forEach(testCase => {
    const result: TestResult = { name: testCase.name, status: 'failed' };
    const parsed = GetRepositoryTreeSchema.safeParse(testCase.input);

    if (testCase.shouldFail) {
      result.status = parsed.success ? 'failed' : 'passed';
      if (parsed.success) result.error = 'Expected schema validation to fail';
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

function runGitLabMarkdownUploadSchemaTests(): { passed: number; failed: number } {
  console.log('\n=== GitLabMarkdownUpload Schema Tests ===');

  const idlessUpload = {
    alt: 'report.md',
    url: '/uploads/c617e74a47dfb1a6dd59d419619b725d/report.md',
    full_path: '/group/project/uploads/c617e74a47dfb1a6dd59d419619b725d/report.md',
    markdown: '[report.md](/uploads/c617e74a47dfb1a6dd59d419619b725d/report.md)',
  };

  const cases: {
    name: string;
    input: Record<string, unknown>;
    expectedId?: number | 'absent';
    shouldFail?: boolean;
  }[] = [
    {
      name: 'schema:markdown_upload:accepts-idless-response',
      input: idlessUpload,
      expectedId: 'absent',
    },
    {
      name: 'schema:markdown_upload:accepts-numeric-id',
      input: { ...idlessUpload, id: 42 },
      expectedId: 42,
    },
    {
      name: 'schema:markdown_upload:coerces-string-id',
      input: { ...idlessUpload, id: '99' },
      expectedId: 99,
    },
    {
      name: 'schema:markdown_upload:treats-null-id-as-absent',
      input: { ...idlessUpload, id: null },
      expectedId: 'absent',
    },
    {
      name: 'schema:markdown_upload:rejects-invalid-id',
      input: { ...idlessUpload, id: 'not-a-number' },
      shouldFail: true,
    },
  ];

  let passed = 0;
  let failed = 0;

  cases.forEach(testCase => {
    const result: TestResult = { name: testCase.name, status: 'failed' };
    const parsed = GitLabMarkdownUploadSchema.safeParse(testCase.input);

    if (testCase.shouldFail) {
      result.status = parsed.success ? 'failed' : 'passed';
      if (parsed.success) result.error = 'Expected schema validation to fail';
    } else if (!parsed.success) {
      result.error = parsed.error?.message || 'Schema validation failed';
    } else if (testCase.expectedId === 'absent' && parsed.data.id !== undefined) {
      result.error = `Expected id undefined, got ${parsed.data.id}`;
    } else if (typeof testCase.expectedId === 'number' && parsed.data.id !== testCase.expectedId) {
      result.error = `Expected id ${testCase.expectedId}, got ${parsed.data.id}`;
    } else {
      result.status = 'passed';
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

function runGitLabUserFullSchemaTests(): { passed: number; failed: number } {
  console.log('🧪 Testing GitLabUserFullSchema...');

  const adminResponse = {
    id: 1,
    username: 'root',
    name: 'Administrator',
    state: 'active',
    avatar_url: 'https://gitlab.example.com/uploads/-/system/user/avatar/1/avatar.png',
    web_url: 'https://gitlab.example.com/root',
    created_at: '2012-09-22T16:50:56.000Z',
    bio: null,
    location: null,
    public_email: '',
    website_url: '',
    organization: null,
    job_title: null,
    pronouns: null,
    work_information: null,
    followers: 0,
    following: 0,
    is_followed: false,
    local_time: null,
    last_sign_in_at: null,
    confirmed_at: '2012-09-22T16:50:56.000Z',
    last_activity_on: '2026-05-12',
    email: 'admin@example.com',
    theme_id: 1,
    color_scheme_id: 1,
    projects_limit: 100000,
    current_sign_in_at: '2026-05-12T08:14:22.885Z',
    identities: [],
    can_create_group: true,
    can_create_project: true,
    two_factor_enabled: false,
    external: false,
    private_profile: false,
    is_admin: true,
  };

  const cases = [
    {
      name: 'schema:user_full:admin-response-no-bot',
      input: { ...adminResponse },
      shouldFail: false,
    },
    {
      name: 'schema:user_full:admin-response-with-bot',
      input: { ...adminResponse, bot: false },
      shouldFail: false,
    },
  ];

  let passed = 0;
  let failed = 0;

  cases.forEach(testCase => {
    const result: TestResult = { name: testCase.name, status: 'failed' };
    const parsed = GitLabUserFullSchema.safeParse(testCase.input);

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

function runGitLabDependencyProxySchemaTests(): { passed: number; failed: number } {
  console.log('🧪 Testing GitLabDependencyProxySchema...');

  const cases = [
    {
      name: 'schema:dependency_proxy:minimal',
      input: { enabled: true, blob_count: 0, total_size: '0' },
      shouldFail: false,
    },
    {
      name: 'schema:dependency_proxy:full',
      input: {
        enabled: true,
        blob_count: 42,
        total_size: '1234567890',
        image_prefix: 'gitlab.example.com:5050/my-group/dependency_proxy/containers',
        ttl_policy: { enabled: true, ttl: 90 },
      },
      shouldFail: false,
    },
    {
      name: 'schema:dependency_proxy:nulls-allowed',
      input: { enabled: false, blob_count: null, total_size: null, image_prefix: null, ttl_policy: null },
      shouldFail: false,
    },
  ];

  let passed = 0;
  let failed = 0;
  cases.forEach(testCase => {
    const result: TestResult = { name: testCase.name, status: 'failed' };
    const parsed = GitLabDependencyProxySchema.safeParse(testCase.input);
    if (testCase.shouldFail) {
      result.status = parsed.success ? 'failed' : 'passed';
      if (parsed.success) result.error = 'Expected schema validation to fail';
    } else if (parsed.success) {
      result.status = 'passed';
    } else {
      result.error = parsed.error?.message || 'Schema validation failed';
    }
    if (result.status === 'passed') { passed++; console.log(`✅ ${result.name}`); }
    else { failed++; console.log(`❌ ${result.name}: ${result.error}`); }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

function runGitLabDependencyProxyBlobSchemaTests(): { passed: number; failed: number } {
  console.log('🧪 Testing GitLabDependencyProxyBlobSchema...');

  const cases = [
    {
      name: 'schema:dependency_proxy_blob:basic',
      input: { file_name: 'sha256:abc123', size: '2.5 MiB', created_at: '2026-01-01T00:00:00Z' },
      shouldFail: false,
    },
    {
      name: 'schema:dependency_proxy_blob:no-created-at',
      input: { file_name: 'sha256:def456', size: '512 KiB' },
      shouldFail: false,
    },
    {
      name: 'schema:dependency_proxy_blob:size-must-be-string',
      input: { file_name: 'sha256:ghi789', size: 12345 },
      shouldFail: true,
    },
  ];

  let passed = 0;
  let failed = 0;
  cases.forEach(testCase => {
    const result: TestResult = { name: testCase.name, status: 'failed' };
    const parsed = GitLabDependencyProxyBlobSchema.safeParse(testCase.input);
    if (testCase.shouldFail) {
      result.status = parsed.success ? 'failed' : 'passed';
      if (parsed.success) result.error = 'Expected schema validation to fail';
    } else if (parsed.success) {
      result.status = 'passed';
    } else {
      result.error = parsed.error?.message || 'Schema validation failed';
    }
    if (result.status === 'passed') { passed++; console.log(`✅ ${result.name}`); }
    else { failed++; console.log(`❌ ${result.name}: ${result.error}`); }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const getFileContentsResult = runGetFileContentsSchemaTests();
  const fileContentResult = runGitLabFileContentSchemaTests();
  const createPipelineResult = runCreatePipelineSchemaTests();
  const commitStatusResult = runCommitStatusSchemaTests();
  const createIssueNoteResult = runCreateIssueNoteSchemaTests();
  const getMergeRequestResult = runGetMergeRequestSchemaTests();
  const listMergeRequestPipelinesResult = runListMergeRequestPipelinesSchemaTests();
  const gitLabMergeRequestResult = runGitLabMergeRequestSchemaTests();
  const emojiReactionResult = runEmojiReactionSchemaTests();
  const repositorySchemaResult = runGitLabRepositorySchemaTests();
  const labelsCoercionResult = runLabelsCoercionSchemaTests();
  const approvedByUsernamesResult = runApprovedByUsernamesSchemaTests();
  const listLabelsResult = runListLabelsSchemaTests();
  const treeItemResult = runGitLabTreeItemSchemaTests();
  const repositoryTreeResult = runGetRepositoryTreeSchemaTests();
  const gitLabUserFullResult = runGitLabUserFullSchemaTests();
  const gitLabMarkdownUploadResult = runGitLabMarkdownUploadSchemaTests();
  const dependencyProxyResult = runGitLabDependencyProxySchemaTests();
  const dependencyProxyBlobResult = runGitLabDependencyProxyBlobSchemaTests();

  const totalPassed = getFileContentsResult.passed + fileContentResult.passed + createPipelineResult.passed + commitStatusResult.passed + createIssueNoteResult.passed + getMergeRequestResult.passed + listMergeRequestPipelinesResult.passed + gitLabMergeRequestResult.passed + emojiReactionResult.passed + repositorySchemaResult.passed + labelsCoercionResult.passed + approvedByUsernamesResult.passed + listLabelsResult.passed + treeItemResult.passed + repositoryTreeResult.passed + gitLabUserFullResult.passed + gitLabMarkdownUploadResult.passed + dependencyProxyResult.passed + dependencyProxyBlobResult.passed;
  const totalFailed = getFileContentsResult.failed + fileContentResult.failed + createPipelineResult.failed + commitStatusResult.failed + createIssueNoteResult.failed + getMergeRequestResult.failed + listMergeRequestPipelinesResult.failed + gitLabMergeRequestResult.failed + emojiReactionResult.failed + repositorySchemaResult.failed + labelsCoercionResult.failed + approvedByUsernamesResult.failed + listLabelsResult.failed + treeItemResult.failed + repositoryTreeResult.failed + gitLabUserFullResult.failed + gitLabMarkdownUploadResult.failed + dependencyProxyResult.failed + dependencyProxyBlobResult.failed;

  console.log(`\nTotal Results: ${totalPassed} passed, ${totalFailed} failed`);

  if (totalFailed > 0) {
    process.exit(1);
  }
}
