/**
 * Tests for profile matching by host
 */

import { matchProfileByHost, findProfileByHost } from "../../../src/discovery/profile-matcher";
import { ProfileInfo, ProfileLoader } from "../../../src/profiles";

// Mock ProfileLoader
jest.mock("../../../src/profiles/loader", () => ({
  ProfileLoader: jest.fn().mockImplementation(() => ({
    listProfiles: jest.fn(),
  })),
}));

// Mock logger
jest.mock("../../../src/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("matchProfileByHost", () => {
  const createProfile = (name: string, host?: string, isPreset = false): ProfileInfo => ({
    name,
    host,
    authType: host ? "pat" : undefined,
    readOnly: false,
    isBuiltIn: isPreset,
    isPreset,
  });

  describe("exact host matching", () => {
    it("should match exact host", () => {
      const profiles: ProfileInfo[] = [
        createProfile("work", "gitlab.company.com"),
        createProfile("personal", "gitlab.com"),
      ];

      const result = matchProfileByHost("gitlab.company.com", profiles);

      expect(result).not.toBeNull();
      expect(result?.profileName).toBe("work");
      expect(result?.matchType).toBe("exact");
    });

    it("should be case-insensitive", () => {
      const profiles: ProfileInfo[] = [createProfile("work", "GitLab.Company.COM")];

      const result = matchProfileByHost("gitlab.company.com", profiles);

      expect(result).not.toBeNull();
      expect(result?.profileName).toBe("work");
    });

    it("should prefer exact match over subdomain match", () => {
      const profiles: ProfileInfo[] = [
        createProfile("parent", "company.com"),
        createProfile("exact", "gitlab.company.com"),
      ];

      const result = matchProfileByHost("gitlab.company.com", profiles);

      expect(result?.profileName).toBe("exact");
      expect(result?.matchType).toBe("exact");
    });
  });

  describe("subdomain matching", () => {
    it("should match subdomain", () => {
      const profiles: ProfileInfo[] = [createProfile("company", "company.com")];

      const result = matchProfileByHost("gitlab.company.com", profiles);

      expect(result).not.toBeNull();
      expect(result?.profileName).toBe("company");
      expect(result?.matchType).toBe("subdomain");
    });

    it("should match deep subdomain", () => {
      const profiles: ProfileInfo[] = [createProfile("company", "company.com")];

      const result = matchProfileByHost("dev.gitlab.company.com", profiles);

      expect(result).not.toBeNull();
      expect(result?.profileName).toBe("company");
      expect(result?.matchType).toBe("subdomain");
    });

    it("should not match partial domain name", () => {
      // "mycompany.com" should NOT match profile with host "company.com"
      const profiles: ProfileInfo[] = [createProfile("company", "company.com")];

      const result = matchProfileByHost("mycompany.com", profiles);

      expect(result).toBeNull();
    });
  });

  describe("filtering profiles", () => {
    it("should ignore presets (no host)", () => {
      const profiles: ProfileInfo[] = [
        createProfile("readonly", undefined, true), // preset
        createProfile("work", "gitlab.company.com"),
      ];

      const result = matchProfileByHost("gitlab.company.com", profiles);

      expect(result?.profileName).toBe("work");
    });

    it("should ignore profiles without host", () => {
      const profiles: ProfileInfo[] = [
        createProfile("broken", undefined), // no host
        createProfile("work", "gitlab.company.com"),
      ];

      const result = matchProfileByHost("gitlab.company.com", profiles);

      expect(result?.profileName).toBe("work");
    });

    it("should return null when no profiles have host", () => {
      const profiles: ProfileInfo[] = [
        createProfile("preset1", undefined, true),
        createProfile("preset2", undefined, true),
      ];

      const result = matchProfileByHost("gitlab.company.com", profiles);

      expect(result).toBeNull();
    });
  });

  describe("no match scenarios", () => {
    it("should return null when no profiles match", () => {
      const profiles: ProfileInfo[] = [
        createProfile("work", "gitlab.work.com"),
        createProfile("personal", "gitlab.com"),
      ];

      const result = matchProfileByHost("gitlab.other.com", profiles);

      expect(result).toBeNull();
    });

    it("should return null for empty profiles list", () => {
      const result = matchProfileByHost("gitlab.com", []);

      expect(result).toBeNull();
    });
  });

  describe("profile info preservation", () => {
    it("should include full profile info in result", () => {
      const profiles: ProfileInfo[] = [
        {
          name: "work",
          host: "gitlab.company.com",
          authType: "oauth",
          readOnly: true,
          isBuiltIn: false,
          isPreset: false,
          description: "Work GitLab",
        },
      ];

      const result = matchProfileByHost("gitlab.company.com", profiles);

      expect(result?.profile).toEqual(profiles[0]);
      expect(result?.profile.authType).toBe("oauth");
      expect(result?.profile.readOnly).toBe(true);
    });
  });
});

describe("findProfileByHost", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should use ProfileLoader to get profiles", async () => {
    const mockListProfiles = jest.fn().mockResolvedValue([
      {
        name: "work",
        host: "gitlab.company.com",
        authType: "pat",
        readOnly: false,
        isBuiltIn: false,
        isPreset: false,
      },
    ]);

    const mockLoader = {
      listProfiles: mockListProfiles,
    } as unknown as ProfileLoader;

    const result = await findProfileByHost("gitlab.company.com", mockLoader);

    expect(mockListProfiles).toHaveBeenCalled();
    expect(result?.profileName).toBe("work");
  });

  it("should create default loader when not provided", async () => {
    // This test verifies the function doesn't throw when no loader provided
    // The actual ProfileLoader will be mocked
    const MockedProfileLoader = ProfileLoader as jest.MockedClass<typeof ProfileLoader>;
    MockedProfileLoader.mockImplementation(
      () =>
        ({
          listProfiles: jest.fn().mockResolvedValue([]),
        }) as unknown as ProfileLoader
    );

    const result = await findProfileByHost("gitlab.com");

    expect(result).toBeNull();
    expect(MockedProfileLoader).toHaveBeenCalled();
  });
});
