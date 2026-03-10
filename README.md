# Qualitas for VS Code

Real-time code quality scores, refactoring flags, and improvement suggestions inline -- powered by [qualitas](https://github.com/An631/qualitas).

[![CI](https://github.com/An631/qualitas-vscode/actions/workflows/ci.yml/badge.svg)](https://github.com/An631/qualitas-vscode/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Features

- **Quality scores** above every function, class, and file via CodeLens (`Score A: 92.3`)
- **Squiggly underlines** on functions and classes that fail quality thresholds
- **Hover diagnostics** with score breakdown, flagged metrics, and refactoring suggestions
- **Status bar** showing the current file's overall quality grade
- **Fix with AI** quick-fix action that sends quality issues to your AI assistant (Copilot, etc.)
- **Fix All with AI** command to address every flagged function in one go using your AI assistant.
- **Workspace analysis** command to generate a full project code quality summary report
- **Configurable thresholds**, analysis profiles, metric weights, and flag overrides
- **Language-agnostic** -- automatically supports any language qualitas supports (TypeScript, JavaScript, Rust)

## Installation

Download the `.vsix` from [GitHub Releases](https://github.com/An631/qualitas-vscode/releases).

To install a `.vsix` manually:

```shell
code --install-extension qualitas-vscode-x.x.x.vsix
```

## How It Works

Qualitas analyzes your code using 5 quality pillars:

| Pillar | What it measures |
| -------- | ----------------- |
| **Cognitive Flow (CFC)** | Branching complexity, nesting depth, async patterns |
| **Data Complexity (DCI)** | Halstead difficulty, volume, and effort |
| **Identifier Reference (IRC)** | Variable scope span and reference frequency |
| **Dependency Coupling (DC)** | Import count, external ratio, API surface |
| **Structural (SM)** | Lines of code, parameter count, nesting depth |

Each function receives a composite score (0-100) and a grade (A-F). Functions scoring below the threshold or with flagged metrics get squiggly underlines with detailed hover information.

## Commands

Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search for:

| Command | Description |
| --------- | ------------- |
| `Qualitas: Analyze Current File` | Run analysis on the active file |
| `Qualitas: Analyze Workspace` | Analyze all files in the workspace |
| `Qualitas: Show Report` | Show detailed report in the output panel |
| `Qualitas: Fix All Issues with AI` | Send all flagged functions to your AI assistant |

## Configuration

All settings are under `qualitas.*` in VS Code settings:

| Setting | Default | Description |
| --------- | --------- | ------------- |
| `qualitas.enable` | `true` | Enable or disable analysis |
| `qualitas.analyzeOnSave` | `true` | Analyze when a file is saved |
| `qualitas.analyzeOnChange` | `true` | Analyze as you type (debounced) |
| `qualitas.changeDelay` | `1000` | Debounce delay in ms for on-change analysis |
| `qualitas.showInlineScores` | `true` | Show CodeLens score annotations |
| `qualitas.showStatusBar` | `true` | Show file score in the status bar |
| `qualitas.scoreThreshold` | `65` | Minimum acceptable quality score (0-100) |
| `qualitas.profile` | `"default"` | Analysis profile: `default`, `cc-focused`, `data-focused`, `strict` |
| `qualitas.includeTests` | `false` | Include test files in workspace analysis |
| `qualitas.weights` | `{}` | Custom weights for the 5 quality pillars |
| `qualitas.flagOverrides` | `{}` | Override flag thresholds per metric |

### Example: Custom Configuration

```jsonc
{
  "qualitas.profile": "strict",
  "qualitas.scoreThreshold": 80,
  "qualitas.flagOverrides": {
    "EXCESSIVE_RETURNS": false,
    "TOO_MANY_PARAMS": { "warn": 4, "error": 6 }
  },
  "qualitas.weights": {
    "cognitiveFlow": 0.35,
    "dataComplexity": 0.2,
    "identifierReference": 0.15,
    "dependencyCoupling": 0.15,
    "structural": 0.15
  }
}
```

### Available Flag Keys

`HIGH_COGNITIVE_FLOW`, `HIGH_DATA_COMPLEXITY`, `HIGH_IDENTIFIER_CHURN`, `TOO_MANY_PARAMS`, `TOO_LONG`, `DEEP_NESTING`, `HIGH_COUPLING`, `EXCESSIVE_RETURNS`, `HIGH_HALSTEAD_EFFORT`

## Development

```bash
# Install dependencies
npm install

# Watch mode (auto-rebuild on changes)
npm run watch

# Run in VS Code Extension Host (F5 in VS Code)
# Or press Ctrl+Shift+P > "Debug: Start Debugging"

# Run tests
npm test

# Full verification (lint + test + quality)
npm run verify

# Build VSIX
npm run package
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, and pull request guidelines.

## License

[MIT](LICENSE)
