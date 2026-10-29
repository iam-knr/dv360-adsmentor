#!/usr/bin/env bash
# Vercel ignored build step: exit 0 skips the build, exit 1 builds.
# Compare against the last deployed commit of this branch, not only HEAD^, so a push whose
# last commit is docs-only (every session ends with "docs: status") still builds its code.
# Build when the base is unknown or not in Vercel's shallow clone.
base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$base" ] || ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  exit 1
fi
git diff --quiet "$base" HEAD -- . ':!docs' ':!*.md'
