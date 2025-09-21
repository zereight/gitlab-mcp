/**
 * Unit Test for GITLAB_COMMIT_FILES_PER_PAGE environment variable parsing
 */

describe('Environment Variable: GITLAB_COMMIT_FILES_PER_PAGE', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test to ensure isolation
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment variables after all tests
    process.env = originalEnv;
  });

  it('should default to 20 when the environment variable is not set', () => {
    delete process.env.GITLAB_COMMIT_FILES_PER_PAGE;
    const value = process.env.GITLAB_COMMIT_FILES_PER_PAGE ? parseInt(process.env.GITLAB_COMMIT_FILES_PER_PAGE) : 20;
    expect(value).toBe(20);
  });

  it('should parse a valid integer string correctly', () => {
    process.env.GITLAB_COMMIT_FILES_PER_PAGE = '50';
    const value = process.env.GITLAB_COMMIT_FILES_PER_PAGE ? parseInt(process.env.GITLAB_COMMIT_FILES_PER_PAGE) : 20;
    expect(value).toBe(50);
  });

  it('should result in NaN for an invalid string, reflecting parseInt behavior', () => {
    process.env.GITLAB_COMMIT_FILES_PER_PAGE = 'invalid';
    const value = process.env.GITLAB_COMMIT_FILES_PER_PAGE ? parseInt(process.env.GITLAB_COMMIT_FILES_PER_PAGE) : 20;
    expect(isNaN(value)).toBe(true);
  });

  it('should handle the string "0" as the integer 0', () => {
    process.env.GITLAB_COMMIT_FILES_PER_PAGE = '0';
    const value = process.env.GITLAB_COMMIT_FILES_PER_PAGE ? parseInt(process.env.GITLAB_COMMIT_FILES_PER_PAGE) : 20;
    expect(value).toBe(0);
  });

  it('should parse negative integer strings correctly', () => {
    process.env.GITLAB_COMMIT_FILES_PER_PAGE = '-10';
    const value = process.env.GITLAB_COMMIT_FILES_PER_PAGE ? parseInt(process.env.GITLAB_COMMIT_FILES_PER_PAGE) : 20;
    expect(value).toBe(-10);
  });

  it('should handle very large numbers', () => {
    process.env.GITLAB_COMMIT_FILES_PER_PAGE = '99999999';
    const value = process.env.GITLAB_COMMIT_FILES_PER_PAGE ? parseInt(process.env.GITLAB_COMMIT_FILES_PER_PAGE) : 20;
    expect(value).toBe(99999999);
  });

  it('should truncate decimal numbers, following parseInt behavior', () => {
    process.env.GITLAB_COMMIT_FILES_PER_PAGE = '25.7';
    const value = process.env.GITLAB_COMMIT_FILES_PER_PAGE ? parseInt(process.env.GITLAB_COMMIT_FILES_PER_PAGE) : 20;
    expect(value).toBe(25);
  });
});
