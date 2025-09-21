import { describe, it, afterAll, beforeEach, expect, jest } from '@jest/globals';
import { getCommitDiff } from '../../index.js';

const originalFetch = global.fetch;

describe('get_commit_diff Pagination Logic Test', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('should respect perPageOverride for pagination and aggregate results', async () => {
    const perPage = 10;

    const mockDiffObject = {
      diff: '--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new',
      new_path: 'file.txt',
      old_path: 'file.txt',
      a_mode: '100644',
      b_mode: '100644',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
    };

    const fetchMock = jest.fn(async (input: any) => {
      const urlString = input.toString();
      const pageMatch = urlString.match(/page=(\d+)/);
      const page = pageMatch ? parseInt(pageMatch[1], 10) : 1;

      let diffsToReturn: unknown[] = [];
      if (page === 1) {
        diffsToReturn = Array(perPage).fill(mockDiffObject);
      } else if (page === 2) {
        diffsToReturn = Array(perPage).fill(mockDiffObject);
      } else if (page === 3) {
        diffsToReturn = Array(5).fill(mockDiffObject);
      }

      return Promise.resolve(new Response(JSON.stringify(diffsToReturn), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    }) as jest.MockedFunction<typeof fetch>;

    global.fetch = fetchMock as unknown as typeof fetch;

    const diffs = await getCommitDiff('test-project', 'test-sha', true, perPage);

    expect(diffs.length).toBe(25);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
