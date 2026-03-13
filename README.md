# Qualitas for VS Code

Real-time code quality scores, refactoring flags, and improvement suggestions inline -- powered by [qualitas](https://github.com/An631/qualitas).

[![CI](https://github.com/An631/qualitas-vscode/actions/workflows/ci.yml/badge.svg)](https://github.com/An631/qualitas-vscode/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Features

- **Quality scores** above every function, class, and file via CodeLens (`Score A: 92.3`)
- **Squiggly underlines** on function and class names that fail quality thresholds
- **Hover tooltips** with full metric breakdown, score impact per pillar, and refactoring suggestions
- **Status bar** showing the current file's overall quality grade
- **Fix with AI** quick-fix action that opens the chat panel with your AI assistant (Copilot, etc.) and full context
- **Fix All with AI** command to send every flagged function in the file to your AI assistant
- **Folder analysis** command with folder picker to generate a full project quality summary report
- **Project configuration** via `qualitas.config.js` -- analysis rules are shared across the team
- **Language-agnostic** -- automatically supports TypeScript, JavaScript, Python, and Rust

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=QualitasCorp.qualitas-vscode) or download the `.vsix` from [GitHub Releases](https://github.com/An631/qualitas-vscode/releases).

To install a `.vsix` manually:

```shell
code --install-extension qualitas-vscode-x.x.x.vsix
```

## How It Works

Qualitas analyzes your code using 5 quality pillars:

| Pillar                         | What it measures                                          |
| ------------------------------ | --------------------------------------------------------- |
| **Cognitive Flow (CFC)**       | Branching complexity, nesting depth, async patterns       |
| **Data Complexity (DCI)**      | Halstead difficulty, volume, and effort                   |
| **Identifier Reference (IRC)** | Variable scope span and reference frequency               |
| **Dependency Coupling (DC)**   | Import count, external ratio, API surface                 |
| **Structural (SM)**            | Lines of code, parameter count, nesting depth, returns    |

Each function receives a composite score (0-100) and a grade (A-F). Functions scoring below the threshold or with flagged metrics get squiggly underlines on the function name with a detailed hover showing the score breakdown and suggestions.

Hovering over a CodeLens score shows the full metric breakdown with point deductions per pillar, so you can see exactly which metric is costing the most points.

## Commands

Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search for:

| Command                              | Description                                              |
| ------------------------------------ | -------------------------------------------------------- |
| `Qualitas: Analyze Current File`     | Run analysis on the active file                          |
| `Qualitas: Analyze Folder`           | Pick a folder and generate a project quality report      |
| `Qualitas: Show Report`              | Show detailed report for the current file in the output panel |
| `Qualitas: Fix All Issues with AI`   | Send all flagged functions to your AI assistant's chat    |

The **Fix with AI** and **Fix All with AI** options also appear as quick fixes (lightbulb) on any squiggled function.

## Configuration

Configuration is split into two layers following the same pattern as ESLint:

### VS Code Settings (extension behavior)

These control how the extension displays results. They are personal to each developer.

| Setting                    | Default | Description                                            |
| -------------------------- | ------- | ------------------------------------------------------ |
| `qualitas.enable`          | `true`  | Enable or disable analysis                             |
| `qualitas.analyzeOnSave`   | `true`  | Analyze when a file is saved                           |
| `qualitas.analyzeOnChange` | `true`  | Analyze as you type (debounced)                        |
| `qualitas.changeDelay`     | `1000`  | Debounce delay in ms for on-change analysis            |
| `qualitas.showInlineScores`| `true`  | Show CodeLens score annotations above functions        |
| `qualitas.showStatusBar`   | `true`  | Show file score in the status bar                      |
| `qualitas.scoreThreshold`  | `65`    | Minimum score (0-100) for displaying squiggles         |

### Project Configuration (analysis rules)

Analysis rules are configured in a `qualitas.config.js` file at your project root. This file is committed to the repo so the whole team shares the same rules.

```js
// qualitas.config.js
module.exports = {
  profile: "strict",           // "default", "cc-focused", "data-focused", "strict"
  threshold: 80,               // refactoring threshold (0-100)
  includeTests: false,         // include test files in folder analysis
  exclude: ["vendor", "generated"],
  weights: {
    cognitiveFlow: 0.35,
    dataComplexity: 0.2,
    identifierReference: 0.15,
    dependencyCoupling: 0.15,
    structural: 0.15,
  },
  flags: {
    tooManyParams: { warn: 3, error: 5 },
    excessiveReturns: false,   // disable this flag entirely
  },
  languages: {
    typescript: {
      flags: { deepNesting: { warn: 3, error: 5 } },
    },
    python: {
      testPatterns: ["test_", "_test.py"],
    },
  },
};
```

### Available Flag Keys

`highCognitiveFlow`, `highDataComplexity`, `highIdentifierChurn`, `tooManyParams`, `tooLong`, `deepNesting`, `highCoupling`, `excessiveReturns`, `highHalsteadEffort`

Set a flag to `false` to disable it, or `{ warn: N, error: M }` to customize its thresholds. Per-language flag overrides in the `languages` section take precedence over global flags.

## Development

```bash
# Install dependencies
npm install

# Watch mode (auto-rebuild on changes)
npm run watch

# Run in VS Code Extension Host (F5 in VS Code)

# Run tests
npm test

# Full verification (lint + test + format + quality)
npm run verify

# Build VSIX
npm run package
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, and pull request guidelines.

## License

[MIT](LICENSE)
