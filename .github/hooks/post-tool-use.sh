#!/bin/bash
# OMG Post-Tool-Use Hook
# Runs after tool execution in VS Code Copilot Agent Mode
#
# Environment variables available:
#   TOOL_NAME    - Name of the tool that was invoked
#   TOOL_INPUT   - JSON string of tool input parameters
#   TOOL_OUTPUT  - JSON string of tool output/result
#   WORKSPACE    - Workspace root path
#
# Use for: logging, state updates, completion checks

TOOL_NAME="${TOOL_NAME:-}"
TOOL_INPUT="${TOOL_INPUT:-}"
TOOL_OUTPUT="${TOOL_OUTPUT:-}"
WORKSPACE="${WORKSPACE:-$(pwd)}"

OMC_STATE_DIR="$WORKSPACE/.omc/state"

# Ensure state directory exists
mkdir -p "$OMC_STATE_DIR" 2>/dev/null

# Log tool usage for debugging (optional, enable by setting OMG_DEBUG=1)
if [ "${OMG_DEBUG:-0}" = "1" ]; then
  LOG_FILE="$OMC_STATE_DIR/tool-usage.log"
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $TOOL_NAME" >> "$LOG_FILE"
fi

# Track file modifications for autopilot phase tracking
if [ "$TOOL_NAME" = "editFiles" ] || [ "$TOOL_NAME" = "createFile" ]; then
  MODIFIED_FILES="$OMC_STATE_DIR/modified-files.txt"
  # Extract file path from tool input and append to tracking file
  FILE_PATH=$(echo "$TOOL_INPUT" | grep -oE '"filePath"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"filePath"\s*:\s*"//;s/".*//')
  if [ -n "$FILE_PATH" ]; then
    echo "$FILE_PATH" >> "$MODIFIED_FILES" 2>/dev/null
    # Deduplicate
    if [ -f "$MODIFIED_FILES" ]; then
      sort -u "$MODIFIED_FILES" -o "$MODIFIED_FILES" 2>/dev/null
    fi
  fi
fi

# Check for test failures after terminal commands
if [ "$TOOL_NAME" = "runInTerminal" ]; then
  # If a test command was run, check for failures
  if echo "$TOOL_INPUT" | grep -qE '(npm test|jest|vitest|pytest|cargo test|go test)'; then
    if echo "$TOOL_OUTPUT" | grep -qiE '(FAIL|ERROR|failed|error)'; then
      # Write failure marker for ultraqa/autopilot to detect
      echo '{"last_test_run": "failed", "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}' \
        > "$OMC_STATE_DIR/last-test-result.json" 2>/dev/null
    else
      echo '{"last_test_run": "passed", "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}' \
        > "$OMC_STATE_DIR/last-test-result.json" 2>/dev/null
    fi
  fi
fi

# --- Plankton: Opt-in type check + lint after file edits ---
# Enable by setting OMG_LINT_ON_EDIT=1 in your environment (opt-in, advisory only)
if [ "${OMG_LINT_ON_EDIT:-0}" = "1" ]; then
  if [ "$TOOL_NAME" = "editFiles" ] || [ "$TOOL_NAME" = "createFile" ]; then
    FILE_PATH=$(echo "$TOOL_INPUT" | grep -oE '"filePath"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"filePath"\s*:\s*"//;s/".*//')

    QUALITY_REPORT="$OMC_STATE_DIR/quality-gate.json"
    QUALITY_STATUS="ok"
    QUALITY_DETAILS=""

    if [ -n "$FILE_PATH" ]; then
      # TypeScript type check (non-blocking, advisory)
      if [ -f "$WORKSPACE/tsconfig.json" ] && echo "$FILE_PATH" | grep -qE '\.(ts|tsx)$'; then
        TS_OUTPUT=$(cd "$WORKSPACE" && npx tsc --noEmit 2>&1 | head -20)
        if echo "$TS_OUTPUT" | grep -qE 'error TS'; then
          QUALITY_STATUS="type-errors"
          QUALITY_DETAILS="$TS_OUTPUT"
        fi
      fi

      # ESLint check (non-blocking, advisory)
      if ls "$WORKSPACE"/.eslintrc* "$WORKSPACE"/eslint.config.* 2>/dev/null | grep -q '.'; then
        if echo "$FILE_PATH" | grep -qE '\.(ts|tsx|js|jsx)$'; then
          # Sanitize FILE_PATH: reject paths containing shell metacharacters or traversal sequences
          if [[ "$FILE_PATH" =~ [\'\"\;\&\|\`\$\(\)\{\}\<\>] ]] || [[ "$FILE_PATH" =~ \.\./ ]]; then
            QUALITY_STATUS="invalid-path"
            QUALITY_DETAILS="FILE_PATH failed sanitization check"
          else
          LINT_OUTPUT=$(cd "$WORKSPACE" && npx eslint "$FILE_PATH" --max-warnings=0 2>&1 | head -20)
          if echo "$LINT_OUTPUT" | grep -qE 'error|warning'; then
            QUALITY_STATUS="${QUALITY_STATUS}+lint-warnings"
            QUALITY_DETAILS="${QUALITY_DETAILS}\n${LINT_OUTPUT}"
          fi
          fi  # end sanitization check
        fi
      fi

      # Write quality gate result (advisory — does NOT block tool execution)
      echo "{\"status\": \"$QUALITY_STATUS\", \"file\": \"$FILE_PATH\", \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\", \"details\": \"$(echo "$QUALITY_DETAILS" | tr '"' "'" | tr '\n' ' ')\"}" \
        > "$QUALITY_REPORT" 2>/dev/null
    fi
  fi
fi

exit 0
