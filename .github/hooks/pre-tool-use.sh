#!/bin/bash
# OMG Pre-Tool-Use Hook
# Runs before any tool execution in VS Code Copilot Agent Mode
#
# Environment variables available:
#   TOOL_NAME    - Name of the tool being invoked
#   TOOL_INPUT   - JSON string of tool input parameters
#   WORKSPACE    - Workspace root path
#
# Output JSON: {"decision": "approve"} or {"decision": "deny", "reason": "..."}

TOOL_NAME="${TOOL_NAME:-}"
TOOL_INPUT="${TOOL_INPUT:-}"

# Guard: prevent modifications to node_modules
if echo "$TOOL_INPUT" | grep -q "node_modules"; then
  if [ "$TOOL_NAME" = "editFiles" ] || [ "$TOOL_NAME" = "createFile" ]; then
    echo '{"decision": "deny", "reason": "Modifying node_modules is not allowed. Use package.json instead."}'
    exit 0
  fi
fi

# Guard: prevent modifications to .env files with secrets
if echo "$TOOL_INPUT" | grep -qE '\.env(\.local|\.production|\.secret)?'; then
  if [ "$TOOL_NAME" = "editFiles" ] || [ "$TOOL_NAME" = "createFile" ]; then
    echo '{"decision": "deny", "reason": "Direct .env file modification blocked. Review secrets manually."}'
    exit 0
  fi
fi

# Guard: prevent deletion of critical config files
if echo "$TOOL_INPUT" | grep -qE '(package\.json|tsconfig\.json|\.gitignore)'; then
  if [ "$TOOL_NAME" = "deleteFile" ]; then
    echo '{"decision": "deny", "reason": "Cannot delete critical config files."}'
    exit 0
  fi
fi

# Guard: prevent force push
if [ "$TOOL_NAME" = "runInTerminal" ]; then
  if echo "$TOOL_INPUT" | grep -qE 'git\s+push\s+.*--force'; then
    echo '{"decision": "deny", "reason": "Force push is not allowed. Use --force-with-lease if necessary."}'
    exit 0
  fi
fi

# Guard: prevent destructive git operations
if [ "$TOOL_NAME" = "runInTerminal" ]; then
  if echo "$TOOL_INPUT" | grep -qE 'git\s+(reset\s+--hard|clean\s+-fd)'; then
    echo '{"decision": "deny", "reason": "Destructive git operations require manual confirmation."}'
    exit 0
  fi
fi

# Default: approve
echo '{"decision": "approve"}'
