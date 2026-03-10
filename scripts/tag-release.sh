#!/usr/bin/env bash
# Called by changesets/action as the "publish" step.
# Creates a git tag for the current version so the build workflow can trigger.
# changesets/action treats a successful exit as "published".

VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"

echo "Tagging release: ${TAG}"
git tag "${TAG}"
git push origin "${TAG}"

# Output in the format changesets/action expects to detect a publication
echo "New tag published: ${TAG}"
