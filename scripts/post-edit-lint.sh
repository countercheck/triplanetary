#!/usr/bin/env bash
# Claude Code PostToolUse hook — lint the edited file
# Receives JSON payload on stdin; exits 0 always (lint output is informational)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

FILE=$(node -e "
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try {
      const payload = JSON.parse(d);
      const input = payload.tool_input || {};
      // Edit and Write both use file_path; MultiEdit uses edits[].file_path
      const f = input.file_path ||
        (Array.isArray(input.edits) && input.edits[0]?.file_path) || '';
      process.stdout.write(f);
    } catch (e) {}
  });
")

if [[ -z "$FILE" ]]; then
  exit 0
fi

if [[ "$FILE" =~ \.(ts|tsx)$ ]]; then
  cd "$ROOT" && pnpm exec eslint "$FILE" --max-warnings=0
fi
