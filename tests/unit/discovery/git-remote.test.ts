/**
 * Tests for git remote URL parsing
 */

import * as fs from "fs/promises";
import * as path from "path";
import {
  parseRemoteUrl,
  parseGitConfig,
  selectBestRemote,
  parseGitRemote,
  listGitRemotes,
} from "../../../src/discovery/git-remote";

// Mock fs/promises
jest.mock("fs/promises");
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock logger
jest.mock("../../../src/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("parseRemoteUrl", () => {
  describe("SSH format (git@host:path)", () => {
    it("should parse standard SSH URL", () => {
      const result = parseRemoteUrl("git@gitlab.company.com:myteam/backend.git");

      expect(result).toEqual({
        host: "gitlab.company.com",
        projectPath: "myteam/backend",
        protocol: "ssh",
        url: "git@gitlab.company.com:myteam/backend.git",
      });
    });

    it("should parse SSH URL without .git suffix", () => {
      const result = parseRemoteUrl("git@gitlab.company.com:myteam/backend");

      expect(result).toEqual({
        host: "gitlab.company.com",
        projectPath: "myteam/backend",
        protocol: "ssh",
        url: "git@gitlab.company.com:myteam/backend",
      });
    });

    it("should parse SSH URL with nested groups", () => {
      const result = parseRemoteUrl("git@gitlab.com:org/team/subteam/project.git");

      expect(result).toEqual({
        host: "gitlab.com",
        projectPath: "org/team/subteam/project",
        protocol: "ssh",
        url: "git@gitlab.com:org/team/subteam/project.git",
      });
    });

    it("should handle URL with extra whitespace", () => {
      const result = parseRemoteUrl("  git@gitlab.com:myteam/project.git  ");

      expect(result).toEqual({
        host: "gitlab.com",
        projectPath: "myteam/project",
        protocol: "ssh",
        url: "git@gitlab.com:myteam/project.git",
      });
    });
  });

  describe("SSH with explicit protocol (ssh://)", () => {
    it("should parse ssh:// URL", () => {
      const result = parseRemoteUrl("ssh://git@gitlab.company.com/myteam/backend.git");

      expect(result).toEqual({
        host: "gitlab.company.com",
        projectPath: "myteam/backend",
        protocol: "ssh",
        url: "ssh://git@gitlab.company.com/myteam/backend.git",
      });
    });

    it("should parse ssh:// URL with port", () => {
      const result = parseRemoteUrl("ssh://git@gitlab.company.com:2222/myteam/backend.git");

      expect(result).toEqual({
        host: "gitlab.company.com:2222",
        projectPath: "myteam/backend",
        protocol: "ssh",
        url: "ssh://git@gitlab.company.com:2222/myteam/backend.git",
      });
    });
  });

  describe("HTTPS format", () => {
    it("should parse HTTPS URL", () => {
      const result = parseRemoteUrl("https://gitlab.company.com/myteam/backend.git");

      expect(result).toEqual({
        host: "gitlab.company.com",
        projectPath: "myteam/backend",
        protocol: "https",
        url: "https://gitlab.company.com/myteam/backend.git",
      });
    });

    it("should parse HTTPS URL without .git suffix", () => {
      const result = parseRemoteUrl("https://gitlab.company.com/myteam/backend");

      expect(result).toEqual({
        host: "gitlab.company.com",
        projectPath: "myteam/backend",
        protocol: "https",
        url: "https://gitlab.company.com/myteam/backend",
      });
    });

    it("should parse HTTPS URL with port", () => {
      const result = parseRemoteUrl("https://gitlab.company.com:8443/myteam/backend.git");

      expect(result).toEqual({
        host: "gitlab.company.com:8443",
        projectPath: "myteam/backend",
        protocol: "https",
        url: "https://gitlab.company.com:8443/myteam/backend.git",
      });
    });

    it("should parse HTTP URL (not recommended but supported)", () => {
      const result = parseRemoteUrl("http://gitlab.local/myteam/backend.git");

      expect(result).toEqual({
        host: "gitlab.local",
        projectPath: "myteam/backend",
        protocol: "https", // Protocol normalized to https
        url: "http://gitlab.local/myteam/backend.git",
      });
    });

    it("should parse HTTPS URL with nested groups", () => {
      const result = parseRemoteUrl("https://gitlab.com/org/team/subteam/project.git");

      expect(result).toEqual({
        host: "gitlab.com",
        projectPath: "org/team/subteam/project",
        protocol: "https",
        url: "https://gitlab.com/org/team/subteam/project.git",
      });
    });
  });

  describe("invalid URLs", () => {
    it("should return null for empty string", () => {
      expect(parseRemoteUrl("")).toBeNull();
    });

    it("should return null for invalid format", () => {
      expect(parseRemoteUrl("not-a-valid-url")).toBeNull();
    });

    it("should return null for file:// URLs", () => {
      expect(parseRemoteUrl("file:///path/to/repo")).toBeNull();
    });
  });
});

describe("parseGitConfig", () => {
  it("should parse single remote", () => {
    const config = `
[core]
  repositoryformatversion = 0
[remote "origin"]
  url = git@gitlab.com:myteam/project.git
  fetch = +refs/heads/*:refs/remotes/origin/*
`;

    const remotes = parseGitConfig(config);

    expect(remotes.size).toBe(1);
    expect(remotes.get("origin")).toBe("git@gitlab.com:myteam/project.git");
  });

  it("should parse multiple remotes", () => {
    const config = `
[remote "origin"]
  url = git@gitlab.com:fork/project.git
  fetch = +refs/heads/*:refs/remotes/origin/*
[remote "upstream"]
  url = git@gitlab.com:original/project.git
  fetch = +refs/heads/*:refs/remotes/upstream/*
`;

    const remotes = parseGitConfig(config);

    expect(remotes.size).toBe(2);
    expect(remotes.get("origin")).toBe("git@gitlab.com:fork/project.git");
    expect(remotes.get("upstream")).toBe("git@gitlab.com:original/project.git");
  });

  it("should handle config with no remotes", () => {
    const config = `
[core]
  repositoryformatversion = 0
`;

    const remotes = parseGitConfig(config);

    expect(remotes.size).toBe(0);
  });

  it("should handle HTTPS URLs in config", () => {
    const config = `
[remote "origin"]
  url = https://gitlab.com/myteam/project.git
`;

    const remotes = parseGitConfig(config);

    expect(remotes.get("origin")).toBe("https://gitlab.com/myteam/project.git");
  });

  it("should handle multiline config with url not immediately after remote header", () => {
    const config = `
[remote "origin"]
  fetch = +refs/heads/*:refs/remotes/origin/*
  prune = true
  url = git@gitlab.com:myteam/project.git
[branch "main"]
  remote = origin
  merge = refs/heads/main
`;

    const remotes = parseGitConfig(config);

    expect(remotes.size).toBe(1);
    expect(remotes.get("origin")).toBe("git@gitlab.com:myteam/project.git");
  });

  it("should handle config with multiple entries between remote header and url", () => {
    const config = `
[core]
  repositoryformatversion = 0
[remote "origin"]
  fetch = +refs/heads/*:refs/remotes/origin/*
  pushurl = git@gitlab.com:myteam/project.git
  prune = true
  url = git@gitlab.com:myteam/project.git
[remote "upstream"]
  prune = false
  url = https://gitlab.com/original/project.git
  fetch = +refs/heads/*:refs/remotes/upstream/*
`;

    const remotes = parseGitConfig(config);

    expect(remotes.size).toBe(2);
    expect(remotes.get("origin")).toBe("git@gitlab.com:myteam/project.git");
    expect(remotes.get("upstream")).toBe("https://gitlab.com/original/project.git");
  });
});

describe("selectBestRemote", () => {
  it("should return null for empty map", () => {
    const remotes = new Map<string, string>();

    expect(selectBestRemote(remotes)).toBeNull();
  });

  it("should prefer specified remote", () => {
    const remotes = new Map([
      ["origin", "git@gitlab.com:fork/project.git"],
      ["upstream", "git@gitlab.com:original/project.git"],
    ]);

    const result = selectBestRemote(remotes, "upstream");

    expect(result).toEqual({
      name: "upstream",
      url: "git@gitlab.com:original/project.git",
    });
  });

  it("should prefer origin when no remote specified", () => {
    const remotes = new Map([
      ["upstream", "git@gitlab.com:original/project.git"],
      ["origin", "git@gitlab.com:fork/project.git"],
    ]);

    const result = selectBestRemote(remotes);

    expect(result).toEqual({
      name: "origin",
      url: "git@gitlab.com:fork/project.git",
    });
  });

  it("should fall back to first remote when no origin", () => {
    const remotes = new Map([["upstream", "git@gitlab.com:original/project.git"]]);

    const result = selectBestRemote(remotes);

    expect(result).toEqual({
      name: "upstream",
      url: "git@gitlab.com:original/project.git",
    });
  });

  it("should fall back to origin when preferred remote not found", () => {
    const remotes = new Map([["origin", "git@gitlab.com:fork/project.git"]]);

    const result = selectBestRemote(remotes, "nonexistent");

    expect(result).toEqual({
      name: "origin",
      url: "git@gitlab.com:fork/project.git",
    });
  });
});

describe("parseGitRemote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should parse remote from repository", async () => {
    const gitConfig = `
[remote "origin"]
  url = git@gitlab.company.com:myteam/backend.git
`;

    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(gitConfig);

    const result = await parseGitRemote({ repoPath: "/test/repo" });

    expect(result).toEqual({
      host: "gitlab.company.com",
      projectPath: "myteam/backend",
      protocol: "ssh",
      url: "git@gitlab.company.com:myteam/backend.git",
      remoteName: "origin",
    });

    expect(mockFs.access).toHaveBeenCalledWith(path.join("/test/repo", ".git", "config"));
  });

  it("should return null when .git/config does not exist", async () => {
    mockFs.access.mockRejectedValue(new Error("ENOENT"));

    const result = await parseGitRemote({ repoPath: "/not-a-repo" });

    expect(result).toBeNull();
  });

  it("should return null when no remotes found", async () => {
    const gitConfig = `
[core]
  repositoryformatversion = 0
`;

    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(gitConfig);

    const result = await parseGitRemote({ repoPath: "/test/repo" });

    expect(result).toBeNull();
  });

  it("should use specified remote name", async () => {
    const gitConfig = `
[remote "origin"]
  url = git@gitlab.com:fork/project.git
[remote "upstream"]
  url = git@gitlab.com:original/project.git
`;

    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(gitConfig);

    const result = await parseGitRemote({
      repoPath: "/test/repo",
      remoteName: "upstream",
    });

    expect(result?.remoteName).toBe("upstream");
    expect(result?.projectPath).toBe("original/project");
  });

  it("should use current directory when repoPath not specified", async () => {
    const gitConfig = `
[remote "origin"]
  url = git@gitlab.com:myteam/project.git
`;

    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(gitConfig);

    await parseGitRemote();

    expect(mockFs.access).toHaveBeenCalledWith(path.join(process.cwd(), ".git", "config"));
  });

  it("should return null when reading config fails", async () => {
    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockRejectedValue(new Error("Permission denied"));

    const result = await parseGitRemote({ repoPath: "/test/repo" });

    expect(result).toBeNull();
  });

  it("should return null when remote URL cannot be parsed", async () => {
    const gitConfig = `
[remote "origin"]
  url = /local/path/to/repo
`;

    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(gitConfig);

    const result = await parseGitRemote({ repoPath: "/test/repo" });

    expect(result).toBeNull();
  });
});

describe("listGitRemotes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should list all remotes", async () => {
    const gitConfig = `
[remote "origin"]
  url = git@gitlab.com:fork/project.git
[remote "upstream"]
  url = https://gitlab.com/original/project.git
`;

    mockFs.readFile.mockResolvedValue(gitConfig);

    const result = await listGitRemotes("/test/repo");

    expect(result).toHaveLength(2);
    expect(result[0].remoteName).toBe("origin");
    expect(result[0].protocol).toBe("ssh");
    expect(result[1].remoteName).toBe("upstream");
    expect(result[1].protocol).toBe("https");
  });

  it("should return empty array when config cannot be read", async () => {
    mockFs.readFile.mockRejectedValue(new Error("ENOENT"));

    const result = await listGitRemotes("/not-a-repo");

    expect(result).toEqual([]);
  });

  it("should skip remotes with unparseable URLs", async () => {
    const gitConfig = `
[remote "origin"]
  url = git@gitlab.com:myteam/project.git
[remote "local"]
  url = /path/to/local/repo
`;

    mockFs.readFile.mockResolvedValue(gitConfig);

    const result = await listGitRemotes("/test/repo");

    expect(result).toHaveLength(1);
    expect(result[0].remoteName).toBe("origin");
  });
});
