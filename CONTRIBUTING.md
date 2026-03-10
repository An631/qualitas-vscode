# Contributing to Qualitas for VS Code

Thank you for your interest in contributing! Here's how to get started.

## Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/An631/qualitas-vscode.git
   cd qualitas-vscode
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Open in VS Code:

   ```bash
   code .
   ```

4. Press `F5` to launch the Extension Development Host.

## Project Structure

```text
src/
  extension.ts      # Activation, lifecycle, event wiring
  analyzer.ts       # Wraps qualitas API
  diagnostics.ts    # Maps qualitas flags to VS Code diagnostics
  decorations.ts    # CodeLens score annotations
  code-actions.ts   # Quick fix actions (Fix with AI)
  status-bar.ts     # Status bar score display
  config.ts         # Extension settings
  debounce.ts       # Debounce utility
test/
  *.test.ts         # Unit tests (Jest)
  __mocks__/        # VS Code API mock
```

## Scripts

| Command | Description |
| --------- | ------------- |
| `npm run watch` | Start esbuild in watch mode |
| `npm test` | Run unit tests |
| `npm run lint` | Type-check + ESLint |
| `npm run verify` | Full verification (lint + test + quality) |
| `npm run quality` | Run qualitas on the codebase |
| `npm run package` | Build `.vsix` package |

## Making Changes

1. Create a branch from `main`.
2. Make your changes.
3. Run `npm run verify` to ensure everything passes.
4. Add a changeset: `npx changeset`
5. Open a pull request.

## Changesets

This project uses [changesets](https://github.com/changesets/changesets) for version management. Every PR that changes behavior needs a changeset file:

```bash
npx changeset
```

Choose `patch` for bug fixes, `minor` for new features, `major` for breaking changes.

For changes that don't affect the published extension (CI, docs, tests), use an empty changeset:

```bash
npx changeset add --empty
```

## Code Style

- TypeScript with strict mode
- ESLint with `@typescript-eslint` rules
- Qualitas is used to analyze code quality in this repo.

## Testing

Tests use Jest with a mock of the `vscode` module. Run with:

```bash
npm test
```

When adding new features, add corresponding tests in the `test/` directory.
