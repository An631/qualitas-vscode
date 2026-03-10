#!/usr/bin/env bash
# Called by changesets/action during the version step.
# 1. Bump package version via changesets
# 2. Update package-lock.json to match

npx changeset version

npm install --package-lock-only
