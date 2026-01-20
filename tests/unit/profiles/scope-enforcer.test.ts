/**
 * Tests for scope enforcer
 */

import {
  ScopeEnforcer,
  ScopeViolationError,
  extractProjectsFromArgs,
  enforceArgsScope,
} from "../../../src/profiles/scope-enforcer";
import { ProjectPreset } from "../../../src/profiles/types";

describe("ScopeEnforcer", () => {
  describe("single project scope", () => {
    it("should allow exact project match", () => {
      const enforcer = new ScopeEnforcer({ project: "myteam/backend" });

      expect(enforcer.isAllowed("myteam/backend")).toBe(true);
    });

    it("should allow case-insensitive match", () => {
      const enforcer = new ScopeEnforcer({ project: "MyTeam/Backend" });

      expect(enforcer.isAllowed("myteam/backend")).toBe(true);
      expect(enforcer.isAllowed("MYTEAM/BACKEND")).toBe(true);
    });

    it("should deny different project", () => {
      const enforcer = new ScopeEnforcer({ project: "myteam/backend" });

      expect(enforcer.isAllowed("myteam/frontend")).toBe(false);
      expect(enforcer.isAllowed("other/project")).toBe(false);
    });

    it("should handle leading/trailing slashes", () => {
      const enforcer = new ScopeEnforcer({ project: "myteam/backend" });

      expect(enforcer.isAllowed("/myteam/backend/")).toBe(true);
      expect(enforcer.isAllowed("  myteam/backend  ")).toBe(true);
    });
  });

  describe("namespace scope", () => {
    it("should allow projects in namespace", () => {
      const enforcer = new ScopeEnforcer({ namespace: "myteam" });

      expect(enforcer.isAllowed("myteam/backend")).toBe(true);
      expect(enforcer.isAllowed("myteam/frontend")).toBe(true);
      expect(enforcer.isAllowed("myteam/shared-libs")).toBe(true);
    });

    it("should allow projects in nested subgroups", () => {
      const enforcer = new ScopeEnforcer({ namespace: "myteam" });

      expect(enforcer.isAllowed("myteam/subgroup/project")).toBe(true);
      expect(enforcer.isAllowed("myteam/deep/nested/project")).toBe(true);
    });

    it("should allow subgroup namespace scope", () => {
      const enforcer = new ScopeEnforcer({ namespace: "myteam/subgroup" });

      expect(enforcer.isAllowed("myteam/subgroup/project")).toBe(true);
      expect(enforcer.isAllowed("myteam/subgroup/other")).toBe(true);
      // Should NOT allow sibling subgroup
      expect(enforcer.isAllowed("myteam/other-subgroup/project")).toBe(false);
    });

    it("should deny projects outside namespace", () => {
      const enforcer = new ScopeEnforcer({ namespace: "myteam" });

      expect(enforcer.isAllowed("other-team/project")).toBe(false);
      expect(enforcer.isAllowed("my/team/project")).toBe(false);
    });

    it("should deny partial namespace match", () => {
      const enforcer = new ScopeEnforcer({ namespace: "team" });

      // "myteam" should NOT match namespace "team"
      expect(enforcer.isAllowed("myteam/project")).toBe(false);
    });
  });

  describe("projects list scope", () => {
    it("should allow projects in list", () => {
      const enforcer = new ScopeEnforcer({
        projects: ["team/project1", "team/project2", "other/project3"],
      });

      expect(enforcer.isAllowed("team/project1")).toBe(true);
      expect(enforcer.isAllowed("team/project2")).toBe(true);
      expect(enforcer.isAllowed("other/project3")).toBe(true);
    });

    it("should deny projects not in list", () => {
      const enforcer = new ScopeEnforcer({
        projects: ["team/project1", "team/project2"],
      });

      expect(enforcer.isAllowed("team/project3")).toBe(false);
      expect(enforcer.isAllowed("other/project")).toBe(false);
    });
  });

  describe("combined scope", () => {
    it("should allow project from single project OR namespace", () => {
      const enforcer = new ScopeEnforcer({
        project: "special/project",
        namespace: "myteam",
      });

      expect(enforcer.isAllowed("special/project")).toBe(true);
      expect(enforcer.isAllowed("myteam/any-project")).toBe(true);
      expect(enforcer.isAllowed("other/project")).toBe(false);
    });
  });

  describe("numeric IDs", () => {
    it("should deny numeric IDs not in explicit list", () => {
      const enforcer = new ScopeEnforcer({ project: "myteam/backend" });

      // Can't verify numeric ID without API call, so deny by default
      expect(enforcer.isAllowed("12345")).toBe(false);
    });

    it("should allow numeric IDs in explicit projects list", () => {
      const enforcer = new ScopeEnforcer({
        projects: ["myteam/backend", "12345"],
      });

      expect(enforcer.isAllowed("12345")).toBe(true);
    });
  });

  describe("enforce()", () => {
    it("should not throw for allowed project", () => {
      const enforcer = new ScopeEnforcer({ project: "myteam/backend" });

      expect(() => enforcer.enforce("myteam/backend")).not.toThrow();
    });

    it("should throw ScopeViolationError for denied project", () => {
      const enforcer = new ScopeEnforcer({ project: "myteam/backend" });

      expect(() => enforcer.enforce("other/project")).toThrow(ScopeViolationError);
    });

    it("should include scope info in error", () => {
      const enforcer = new ScopeEnforcer({ project: "myteam/backend" });

      let thrownError: ScopeViolationError | undefined;
      try {
        enforcer.enforce("other/project");
      } catch (error) {
        thrownError = error as ScopeViolationError;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError).toBeInstanceOf(ScopeViolationError);
      expect(thrownError!.attemptedTarget).toBe("other/project");
      expect(thrownError!.allowedScope.project).toBe("myteam/backend");
      expect(thrownError!.message).toContain("other/project");
      expect(thrownError!.message).toContain("myteam/backend");
    });
  });

  describe("fromPreset()", () => {
    it("should create enforcer from preset with scope", () => {
      const preset: ProjectPreset = {
        scope: { project: "myteam/backend" },
      };

      const enforcer = ScopeEnforcer.fromPreset(preset);

      expect(enforcer).not.toBeNull();
      expect(enforcer?.isAllowed("myteam/backend")).toBe(true);
    });

    it("should return null for preset without scope", () => {
      const preset: ProjectPreset = {
        read_only: true,
      };

      const enforcer = ScopeEnforcer.fromPreset(preset);

      expect(enforcer).toBeNull();
    });
  });

  describe("hasRestrictions()", () => {
    it("should return true when project is set", () => {
      const enforcer = new ScopeEnforcer({ project: "test" });
      expect(enforcer.hasRestrictions()).toBe(true);
    });

    it("should return true when namespace is set", () => {
      const enforcer = new ScopeEnforcer({ namespace: "test" });
      expect(enforcer.hasRestrictions()).toBe(true);
    });

    it("should return true when projects list is set", () => {
      const enforcer = new ScopeEnforcer({ projects: ["test"] });
      expect(enforcer.hasRestrictions()).toBe(true);
    });

    it("should return false for empty scope", () => {
      const enforcer = new ScopeEnforcer({});
      expect(enforcer.hasRestrictions()).toBe(false);
    });

    it("should return false for empty projects array", () => {
      const enforcer = new ScopeEnforcer({ projects: [] });
      expect(enforcer.hasRestrictions()).toBe(false);
    });
  });

  describe("getScope()", () => {
    it("should return the scope configuration", () => {
      const scope = { project: "myteam/backend", namespace: "myteam" };
      const enforcer = new ScopeEnforcer(scope);

      expect(enforcer.getScope()).toEqual(scope);
    });
  });

  describe("getScopeDescription()", () => {
    it("should describe project scope", () => {
      const enforcer = new ScopeEnforcer({ project: "myteam/backend" });
      expect(enforcer.getScopeDescription()).toBe("project: myteam/backend");
    });

    it("should describe namespace scope", () => {
      const enforcer = new ScopeEnforcer({ namespace: "myteam" });
      expect(enforcer.getScopeDescription()).toBe("namespace: myteam/*");
    });

    it("should describe short projects list", () => {
      const enforcer = new ScopeEnforcer({
        projects: ["p1", "p2", "p3"],
      });
      expect(enforcer.getScopeDescription()).toBe("projects: p1, p2, p3");
    });

    it("should describe long projects list with count", () => {
      const enforcer = new ScopeEnforcer({
        projects: ["p1", "p2", "p3", "p4", "p5"],
      });
      expect(enforcer.getScopeDescription()).toBe("5 allowed projects");
    });
  });
});

describe("extractProjectsFromArgs", () => {
  it("should extract project_id", () => {
    const args = { project_id: "myteam/backend" };
    const projects = extractProjectsFromArgs(args);
    expect(projects).toContain("myteam/backend");
  });

  it("should extract projectId", () => {
    const args = { projectId: "myteam/backend" };
    const projects = extractProjectsFromArgs(args);
    expect(projects).toContain("myteam/backend");
  });

  it("should extract namespace", () => {
    const args = { namespace: "myteam/backend" };
    const projects = extractProjectsFromArgs(args);
    expect(projects).toContain("myteam/backend");
  });

  it("should extract multiple project fields", () => {
    const args = {
      project_id: "project1",
      namespace: "project2",
    };
    const projects = extractProjectsFromArgs(args);
    expect(projects).toContain("project1");
    expect(projects).toContain("project2");
  });

  it("should ignore non-string values", () => {
    const args = {
      project_id: 12345,
      namespace: null,
      fullPath: undefined,
    };
    const projects = extractProjectsFromArgs(args);
    expect(projects).toHaveLength(0);
  });

  it("should ignore empty strings", () => {
    const args = {
      project_id: "",
      namespace: "  ",
    };
    const projects = extractProjectsFromArgs(args);
    expect(projects).toHaveLength(0);
  });
});

describe("enforceArgsScope", () => {
  it("should allow valid args", () => {
    const enforcer = new ScopeEnforcer({ project: "myteam/backend" });
    const args = { project_id: "myteam/backend", action: "list" };

    expect(() => enforceArgsScope(enforcer, args)).not.toThrow();
  });

  it("should throw on invalid project", () => {
    const enforcer = new ScopeEnforcer({ project: "myteam/backend" });
    const args = { project_id: "other/project", action: "list" };

    expect(() => enforceArgsScope(enforcer, args)).toThrow(ScopeViolationError);
  });

  it("should check all project fields", () => {
    const enforcer = new ScopeEnforcer({ project: "allowed/project" });
    const args = {
      project_id: "allowed/project",
      namespace: "other/project", // This should trigger violation
    };

    expect(() => enforceArgsScope(enforcer, args)).toThrow(ScopeViolationError);
  });

  it("should pass when no project fields in args", () => {
    const enforcer = new ScopeEnforcer({ project: "myteam/backend" });
    const args = { action: "list", page: 1 };

    expect(() => enforceArgsScope(enforcer, args)).not.toThrow();
  });
});
