#!/usr/bin/env python3
"""
Scan all Claude Code conversation JSONL files for GitLab MCP tool failures.

Produces a report of:
- Error frequency by tool name and error type
- Parameter mismatches (wrong param names, missing required params, type errors)
- 404/permission errors
- Patterns that indicate bugs in the MCP server vs user/config issues
"""

import json
import os
import sys
import re
from collections import Counter, defaultdict
from pathlib import Path
from datetime import datetime


CLAUDE_PROJECTS_DIR = os.path.expanduser("~/.claude/projects")

# Only analyze GitLab MCP tool calls (both server instances)
GITLAB_MCP_PREFIX = "mcp__"
GITLAB_MCP_SUFFIXES = [
    "Sense-AItion-GitLab__",
    "TH-Wildau-GitLab__",
]


def is_gitlab_mcp_tool(name: str) -> bool:
    if not name.startswith(GITLAB_MCP_PREFIX):
        return False
    for suffix in GITLAB_MCP_SUFFIXES:
        if suffix in name:
            return True
    return False


def extract_tool_name(full_name: str) -> str:
    """Strip MCP server prefix to get the bare tool name."""
    for suffix in GITLAB_MCP_SUFFIXES:
        key = GITLAB_MCP_PREFIX + suffix
        if full_name.startswith(key):
            return full_name[len(key):]
    return full_name


def classify_error(content: str, tool_name: str, tool_input: dict) -> dict:
    """Classify an error into a category with details."""
    result = {
        "category": "unknown",
        "subcategory": "",
        "detail": "",
        "fixable_in_mcp": False,
    }

    content_lower = content.lower()

    # Invalid arguments / parameter issues
    if "invalid arguments" in content_lower:
        result["category"] = "invalid_arguments"
        result["fixable_in_mcp"] = True

        # Extract the specific field
        match = re.search(r"Invalid arguments:\s*(\w+):\s*(.+?)(?:\n|$)", content)
        if match:
            field = match.group(1)
            reason = match.group(2).strip()
            result["subcategory"] = field
            result["detail"] = reason

            if "Required" in reason:
                # Check what params were sent to detect aliases
                sent_params = list(tool_input.keys()) if isinstance(tool_input, dict) else []
                result["detail"] = f"Required (sent params: {sent_params})"
            elif "Expected" in reason:
                result["detail"] = reason

    # 404 Not Found
    elif "404" in content and "not found" in content_lower:
        result["category"] = "not_found_404"
        if "project not found" in content_lower:
            result["subcategory"] = "project"
            pid = tool_input.get("project_id", "?")
            result["detail"] = f"project_id={pid}"
            # Check if project_id looks wrong
            if pid in ("undefined", "null", "", None):
                result["fixable_in_mcp"] = True
                result["detail"] += " (likely missing default)"
        elif "work item" in content_lower or "issue" in content_lower:
            result["subcategory"] = "work_item"

    # Permission errors
    elif "permission" in content_lower or "forbidden" in content_lower or "403" in content:
        result["category"] = "permission_denied"
        result["subcategory"] = "insufficient_permissions"

    # Rate limiting
    elif "rate limit" in content_lower or "429" in content:
        result["category"] = "rate_limited"

    # Network / connection errors
    elif any(x in content_lower for x in ["econnrefused", "enotfound", "timeout", "network"]):
        result["category"] = "network_error"

    # GraphQL errors
    elif "graphql" in content_lower or "query error" in content_lower:
        result["category"] = "graphql_error"
        result["fixable_in_mcp"] = True

    # Generic MCP errors
    elif "mcp error" in content_lower:
        result["category"] = "mcp_error"
        result["detail"] = content[:200]

    return result


def detect_param_mismatch(tool_name: str, tool_input: dict) -> list[dict]:
    """Detect common parameter name mismatches LLMs make."""
    issues = []
    if not isinstance(tool_input, dict):
        return issues

    known_aliases = {
        "search_repositories": {"query": "search"},
        "update_work_item": {"work_item_iid": "iid", "work_item_id": "iid"},
        "get_work_item": {"work_item_iid": "iid", "work_item_id": "iid"},
        "create_work_item": {"work_item_type": "type"},
        "list_merge_requests": {"project": "project_id"},
        "get_merge_request": {"merge_request_iid": "iid"},
    }

    aliases = known_aliases.get(tool_name, {})
    for sent_param, correct_param in aliases.items():
        if sent_param in tool_input and correct_param not in tool_input:
            issues.append({
                "type": "param_alias",
                "tool": tool_name,
                "sent": sent_param,
                "expected": correct_param,
                "value": str(tool_input[sent_param])[:100],
            })

    # Detect missing project_id in nested objects
    for field in ("children_to_add", "children_to_remove", "linked_items_to_add", "linked_items_to_remove"):
        items = tool_input.get(field, [])
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict) and "project_id" not in item:
                    issues.append({
                        "type": "missing_nested_project_id",
                        "tool": tool_name,
                        "field": field,
                        "child_keys": list(item.keys()),
                    })

    return issues


def scan_file(filepath: str) -> dict:
    """Scan a single JSONL file for GitLab MCP errors."""
    results = {
        "file": filepath,
        "total_mcp_calls": 0,
        "total_mcp_errors": 0,
        "errors": [],
        "param_mismatches": [],
        "tool_call_counts": Counter(),
        "session_id": None,
        "timestamp": None,
        "project_dir": None,
    }

    entries = []
    try:
        with open(filepath, "r", errors="replace") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    except (IOError, OSError):
        return results

    # Extract session metadata
    for entry in entries:
        if entry.get("type") == "permission-mode":
            results["session_id"] = entry.get("sessionId")
        if entry.get("type") == "user" and entry.get("timestamp"):
            results["timestamp"] = entry.get("timestamp")
            results["project_dir"] = entry.get("cwd")
            break

    # Build a map of tool_use_id -> tool call info
    tool_calls_by_id = {}

    for entry in entries:
        msg = entry.get("message", {})
        content = msg.get("content", "")
        if not isinstance(content, list):
            continue

        for block in content:
            if not isinstance(block, dict):
                continue

            if block.get("type") == "tool_use":
                name = block.get("name", "")
                if is_gitlab_mcp_tool(name):
                    bare_name = extract_tool_name(name)
                    tool_id = block.get("id", "")
                    tool_input = block.get("input", {})
                    results["total_mcp_calls"] += 1
                    results["tool_call_counts"][bare_name] += 1
                    tool_calls_by_id[tool_id] = {
                        "name": bare_name,
                        "full_name": name,
                        "input": tool_input,
                    }

                    # Check for param mismatches even on successful calls
                    mismatches = detect_param_mismatch(bare_name, tool_input)
                    results["param_mismatches"].extend(mismatches)

            elif block.get("type") == "tool_result":
                tool_id = block.get("tool_use_id", "")
                is_error = block.get("is_error", False)
                content_val = str(block.get("content", ""))

                if tool_id not in tool_calls_by_id:
                    continue

                call_info = tool_calls_by_id[tool_id]

                # Check for errors (explicit flag or error patterns in content)
                has_error = is_error
                if not has_error and content_val:
                    # Some errors come back without is_error flag
                    error_patterns = [
                        "MCP error",
                        "GitLab API error",
                        "Failed to",
                        "Invalid arguments",
                    ]
                    has_error = any(p in content_val for p in error_patterns)

                if has_error:
                    results["total_mcp_errors"] += 1
                    classification = classify_error(content_val, call_info["name"], call_info["input"])
                    results["errors"].append({
                        "tool": call_info["name"],
                        "input": call_info["input"],
                        "is_error_flag": is_error,
                        "content": content_val[:500],
                        "classification": classification,
                    })

    return results


def main():
    projects_dir = CLAUDE_PROJECTS_DIR
    if len(sys.argv) > 1:
        projects_dir = sys.argv[1]

    if not os.path.isdir(projects_dir):
        print(f"Directory not found: {projects_dir}")
        sys.exit(1)

    # Find all JSONL files
    jsonl_files = []
    for root, dirs, files in os.walk(projects_dir):
        for f in files:
            if f.endswith(".jsonl"):
                jsonl_files.append(os.path.join(root, f))

    print(f"Scanning {len(jsonl_files)} conversation files in {projects_dir}...")
    print()

    # Aggregate stats
    total_calls = 0
    total_errors = 0
    total_files_with_mcp = 0
    global_tool_counts = Counter()
    global_error_counts = Counter()  # by tool name
    global_error_categories = Counter()
    global_param_mismatches = Counter()  # by (tool, sent, expected)
    global_missing_nested_pid = Counter()  # by (tool, field)
    error_details = []  # all individual errors for detailed output
    errors_by_tool = defaultdict(list)
    fixable_errors = 0
    sessions_with_errors = []

    for filepath in jsonl_files:
        result = scan_file(filepath)
        if result["total_mcp_calls"] == 0:
            continue

        total_files_with_mcp += 1
        total_calls += result["total_mcp_calls"]
        total_errors += result["total_mcp_errors"]
        global_tool_counts += result["tool_call_counts"]

        for err in result["errors"]:
            tool = err["tool"]
            cat = err["classification"]["category"]
            subcat = err["classification"]["subcategory"]
            global_error_counts[tool] += 1
            global_error_categories[f"{cat}:{subcat}" if subcat else cat] += 1
            errors_by_tool[tool].append(err)
            error_details.append({
                **err,
                "file": os.path.basename(filepath),
                "project": result["project_dir"],
                "timestamp": result["timestamp"],
            })
            if err["classification"]["fixable_in_mcp"]:
                fixable_errors += 1

        for pm in result["param_mismatches"]:
            if pm["type"] == "param_alias":
                global_param_mismatches[(pm["tool"], pm["sent"], pm["expected"])] += 1
            elif pm["type"] == "missing_nested_project_id":
                global_missing_nested_pid[(pm["tool"], pm["field"])] += 1

        if result["total_mcp_errors"] > 0:
            sessions_with_errors.append({
                "file": os.path.basename(filepath),
                "project": result["project_dir"],
                "timestamp": result["timestamp"],
                "calls": result["total_mcp_calls"],
                "errors": result["total_mcp_errors"],
                "error_rate": result["total_mcp_errors"] / result["total_mcp_calls"] * 100,
            })

    # Print report
    print("=" * 70)
    print("  GITLAB MCP ERROR REPORT")
    print("=" * 70)
    print()
    print(f"  Conversations scanned:       {len(jsonl_files)}")
    print(f"  Conversations with MCP calls: {total_files_with_mcp}")
    print(f"  Conversations with errors:    {len(sessions_with_errors)}")
    print(f"  Total MCP tool calls:         {total_calls}")
    print(f"  Total MCP errors:             {total_errors}")
    print(f"  Overall error rate:           {total_errors/total_calls*100:.1f}%" if total_calls else "  N/A")
    print(f"  Fixable in MCP server:        {fixable_errors}")
    print()

    # Tool call frequency
    print("-" * 70)
    print("  TOOL CALL FREQUENCY (top 25)")
    print("-" * 70)
    for tool, count in global_tool_counts.most_common(25):
        err_count = global_error_counts.get(tool, 0)
        err_rate = f" ({err_count} errors, {err_count/count*100:.0f}%)" if err_count else ""
        print(f"  {tool:45s} {count:5d}{err_rate}")
    print()

    # Error frequency by tool
    if global_error_counts:
        print("-" * 70)
        print("  ERRORS BY TOOL")
        print("-" * 70)
        for tool, count in global_error_counts.most_common():
            total_for_tool = global_tool_counts[tool]
            print(f"  {tool:45s} {count:4d} / {total_for_tool:4d} ({count/total_for_tool*100:.0f}%)")
        print()

    # Error categories
    if global_error_categories:
        print("-" * 70)
        print("  ERROR CATEGORIES")
        print("-" * 70)
        for cat, count in global_error_categories.most_common():
            print(f"  {cat:50s} {count:4d}")
        print()

    # Parameter mismatches (the LLM sending wrong param names)
    if global_param_mismatches:
        print("-" * 70)
        print("  PARAMETER NAME MISMATCHES (LLM sent wrong name)")
        print("-" * 70)
        for (tool, sent, expected), count in global_param_mismatches.most_common():
            print(f"  {tool}.{sent} -> should be .{expected}  ({count}x)")
        print()

    # Missing nested project_id
    if global_missing_nested_pid:
        print("-" * 70)
        print("  MISSING project_id IN NESTED OBJECTS")
        print("-" * 70)
        for (tool, field), count in global_missing_nested_pid.most_common():
            print(f"  {tool}.{field}[].project_id omitted  ({count}x)")
        print()

    # Detailed error samples grouped by tool + category
    if errors_by_tool:
        print("-" * 70)
        print("  ERROR SAMPLES (deduplicated by tool + category)")
        print("-" * 70)
        seen = set()
        for tool in sorted(errors_by_tool.keys()):
            for err in errors_by_tool[tool]:
                cat = err["classification"]["category"]
                subcat = err["classification"]["subcategory"]
                key = (tool, cat, subcat)
                if key in seen:
                    continue
                seen.add(key)
                print()
                print(f"  Tool:     {tool}")
                print(f"  Category: {cat}" + (f" / {subcat}" if subcat else ""))
                print(f"  Detail:   {err['classification']['detail'][:120]}")
                print(f"  Fixable:  {'YES' if err['classification']['fixable_in_mcp'] else 'no'}")
                inp = err.get("input", {})
                if isinstance(inp, dict):
                    # Show relevant input keys
                    short_input = {k: (str(v)[:80] if len(str(v)) > 80 else v) for k, v in inp.items()}
                    print(f"  Input:    {json.dumps(short_input, default=str)[:200]}")
                print(f"  Response: {err['content'][:200]}")
        print()

    # Worst sessions
    if sessions_with_errors:
        print("-" * 70)
        print("  SESSIONS WITH HIGHEST ERROR RATES (top 10)")
        print("-" * 70)
        sessions_with_errors.sort(key=lambda s: s["errors"], reverse=True)
        for s in sessions_with_errors[:10]:
            proj = (s["project"] or "?").split("/")[-1]
            ts = (s["timestamp"] or "?")[:10]
            print(f"  {ts}  {proj:30s}  {s['errors']:3d}/{s['calls']:3d} calls failed ({s['error_rate']:.0f}%)")
        print()

    # Actionable summary
    print("=" * 70)
    print("  ACTIONABLE BUGS (fixable in MCP server)")
    print("=" * 70)
    actionable = defaultdict(int)
    for err in error_details:
        if err["classification"]["fixable_in_mcp"]:
            cat = err["classification"]["category"]
            subcat = err["classification"]["subcategory"]
            tool = err["tool"]
            actionable[(tool, cat, subcat)] += 1
    if actionable:
        for (tool, cat, subcat), count in sorted(actionable.items(), key=lambda x: -x[1]):
            label = f"{tool} -> {cat}" + (f" ({subcat})" if subcat else "")
            print(f"  [{count:3d}x] {label}")
    else:
        print("  None found.")
    print()


if __name__ == "__main__":
    main()
