#!/usr/bin/env node
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const GROUP_NAMES = [
  "Added",
  "Changed",
  "Deprecated",
  "Removed",
  "Fixed",
  "Security",
  "Breaking changes",
];

const GROUP_HEADING_RE = new RegExp(
  `^(#{2,6})\\s+(${GROUP_NAMES.map(escapeRegExp).join("|")})\\s*$`,
  "i"
);
const PLACEHOLDER_RE = /\b(TODO|FIXME|XXX|TBD)\b/;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeGroupName(name) {
  const lower = name.toLowerCase();
  for (const group of GROUP_NAMES) {
    if (group.toLowerCase() === lower) {
      return group;
    }
  }
  return null;
}

export function parseFragment(markdown, filename) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const groups = new Map();
  let currentGroup = null;
  let currentItem = null;
  const errors = [];

  function flushItem() {
    if (currentItem === null) {
      return;
    }
    const text = currentItem.replace(/[ \t]+$/gm, "").replace(/\n+$/, "");
    currentItem = null;
    if (!text) {
      return;
    }
    if (!currentGroup) {
      errors.push(`${filename}: list item is not under a known changelog group`);
      return;
    }
    const items = groups.get(currentGroup) ?? [];
    items.push(text);
    groups.set(currentGroup, items);
  }

  for (const line of lines) {
    const heading = GROUP_HEADING_RE.exec(line);
    if (heading) {
      flushItem();
      currentGroup = normalizeGroupName(heading[2]);
      continue;
    }

    if (/^#{1,6}\s+\S/.test(line)) {
      flushItem();
      currentGroup = null;
      errors.push(`${filename}: unknown heading "${line.trim()}"`);
      continue;
    }

    if (/^- \S/.test(line) || /^- $/.test(line)) {
      flushItem();
      currentItem = line;
      continue;
    }

    if (currentItem !== null && (/^[ \t]+\S/.test(line) || line.trim() === "")) {
      currentItem += `\n${line}`;
      continue;
    }

    if (line.trim() === "") {
      continue;
    }

    errors.push(`${filename}: text outside a list item: "${line.trim()}"`);
  }

  flushItem();

  let itemCount = 0;
  for (const items of groups.values()) {
    itemCount += items.length;
    for (const item of items) {
      if (PLACEHOLDER_RE.test(item)) {
        errors.push(`${filename}: placeholder in "${item.split("\n")[0]}"`);
      }
    }
  }

  if (itemCount === 0) {
    errors.push(`${filename}: add at least one list item under a known group`);
  }

  return { groups, errors };
}

export function listFragmentFiles(fragmentsDir) {
  const dir = path.resolve(fragmentsDir);
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const files = [];
  for (const name of entries) {
    if (name === "README.md" || name.startsWith(".")) {
      continue;
    }
    if (!name.endsWith(".md")) {
      continue;
    }
    if (name !== path.basename(name)) {
      continue;
    }

    const resolved = path.resolve(dir, name);
    const relative = path.relative(dir, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      continue;
    }

    const stat = statSync(resolved);
    if (!stat.isFile()) {
      continue;
    }
    files.push(resolved);
  }

  files.sort();
  return files;
}

export function collectGroups(fragments) {
  const merged = new Map();
  const errors = [];

  for (const fragment of fragments) {
    errors.push(...fragment.errors);
    for (const [group, items] of fragment.groups) {
      const list = merged.get(group) ?? [];
      for (const item of items) {
        if (!list.includes(item)) {
          list.push(item);
        }
      }
      merged.set(group, list);
    }
  }

  return { groups: merged, errors };
}

export function formatUtcDate(date = new Date()) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function renderVersionSection({ version, previousTag, repoUrl, groups, date }) {
  const heading =
    previousTag && repoUrl
      ? `#### [v${version}](${repoUrl.replace(/\/$/, "")}/compare/${previousTag}...v${version})`
      : `#### [v${version}]`;
  const lines = [heading, "", `> ${date}`, ""];

  for (const group of GROUP_NAMES) {
    const items = groups.get(group);
    if (!items || items.length === 0) {
      continue;
    }
    lines.push(`##### ${group}`, "");
    lines.push(...items);
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function insertVersionSection(changelog, section) {
  const normalized = changelog.replace(/\r\n/g, "\n");
  const unreleased = /^#### Unreleased\s*$/m.exec(normalized);
  if (!unreleased) {
    throw new Error("CHANGELOG.md has no #### Unreleased heading");
  }

  const restStart = normalized.indexOf("\n#### ", unreleased.index + 1);
  if (restStart === -1) {
    return `${normalized.replace(/\s*$/, "\n\n")}${section}`;
  }

  return `${normalized.slice(0, restStart + 1)}\n${section}${normalized.slice(restStart + 1)}`;
}

export function appendToUnreleased(changelog, groups) {
  const normalized = changelog.replace(/\r\n/g, "\n");
  const unreleased = /^#### Unreleased\s*$/m.exec(normalized);
  if (!unreleased) {
    throw new Error("CHANGELOG.md has no #### Unreleased heading");
  }

  const sectionStart = unreleased.index + unreleased[0].length;
  const restStart = normalized.indexOf("\n#### ", unreleased.index + 1);
  const sectionEnd = restStart === -1 ? normalized.length : restStart;
  let section = normalized.slice(sectionStart, sectionEnd);

  for (const group of GROUP_NAMES) {
    const items = groups.get(group);
    if (!items || items.length === 0) {
      continue;
    }

    const headingRe = new RegExp(`^##### ${escapeRegExp(group)}\\s*$`, "m");
    const heading = headingRe.exec(section);
    if (!heading) {
      section = `${section.replace(/\s*$/, "\n\n")}##### ${group}\n\n${items.join("\n")}\n`;
      continue;
    }

    const afterHeading = heading.index + heading[0].length;
    const nextHeading = section.indexOf("\n##### ", afterHeading);
    const groupEnd = nextHeading === -1 ? section.length : nextHeading;
    const existing = section.slice(afterHeading, groupEnd);
    const missing = items.filter(item => !existing.includes(item));
    if (missing.length === 0) {
      continue;
    }

    const insertion = `${existing.replace(/\s*$/, "\n")}${missing.join("\n")}\n`;
    section = `${section.slice(0, afterHeading)}${insertion}${section.slice(groupEnd)}`;
  }

  return `${normalized.slice(0, sectionStart)}${section}${normalized.slice(sectionEnd)}`;
}

function readFragments(fragmentsDir) {
  const files = listFragmentFiles(fragmentsDir);
  return files.map(filePath => {
    const parsed = parseFragment(readFileSync(filePath, "utf8"), path.basename(filePath));
    return { filePath, ...parsed };
  });
}

export function mergeChangelogFragments({
  changelogPath,
  fragmentsDir,
  version,
  previousTag,
  repoUrl,
  date,
  check,
}) {
  const fragments = readFragments(fragmentsDir);
  const { groups, errors } = collectGroups(fragments);

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  if (check) {
    return { changed: false, files: fragments.map(fragment => fragment.filePath) };
  }

  if (fragments.length === 0) {
    return { changed: false, files: [] };
  }

  const changelog = readFileSync(changelogPath, "utf8");
  const nextChangelog = version
    ? insertVersionSection(
        changelog,
        renderVersionSection({
          version,
          previousTag,
          repoUrl,
          groups,
          date: date ?? formatUtcDate(),
        })
      )
    : appendToUnreleased(changelog, groups);

  writeFileSync(changelogPath, nextChangelog);

  for (const fragment of fragments) {
    rmSync(fragment.filePath);
  }

  return { changed: true, files: fragments.map(fragment => fragment.filePath) };
}

function parseArgs(argv) {
  const options = {
    check: false,
    version: "",
    previousTag: "",
    repoUrl: "https://github.com/zereight/gitlab-mcp",
    changelogPath: "CHANGELOG.md",
    fragmentsDir: "changelog.d",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      options.check = true;
      continue;
    }
    if (arg === "--version") {
      options.version = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--previous-tag") {
      options.previousTag = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--repo-url") {
      options.repoUrl = argv[index + 1] ?? options.repoUrl;
      index += 1;
      continue;
    }
    if (arg === "--changelog") {
      options.changelogPath = argv[index + 1] ?? options.changelogPath;
      index += 1;
      continue;
    }
    if (arg === "--fragments-dir") {
      options.fragmentsDir = argv[index + 1] ?? options.fragmentsDir;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = mergeChangelogFragments(options);
  if (options.check) {
    const count = result.files.length;
    console.log(
      count === 0
        ? "No changelog fragments to check."
        : `Checked ${count} changelog fragment${count === 1 ? "" : "s"}.`
    );
    return;
  }
  if (!result.changed) {
    console.log("No changelog fragments to merge.");
    return;
  }
  console.log(`Merged ${result.files.length} changelog fragment(s) into CHANGELOG.md.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
