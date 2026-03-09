import * as vscode from 'vscode';
import type { FileQualityReport, Grade, FunctionQualityReport } from 'qualitas';

// ── CodeLens provider ────────────────────────────────────────────────────────

const reportsByUri = new Map<string, FileQualityReport>();
const onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
let codeLensProvider: vscode.Disposable | null = null;

class QualitasCodeLensProvider implements vscode.CodeLensProvider {
  readonly onDidChangeCodeLenses = onDidChangeCodeLensesEmitter.event;

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const report = reportsByUri.get(document.uri.toString());
    if (!report) return [];

    const lenses: vscode.CodeLens[] = [];

    // File score on line 1
    lenses.push(
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: `Score ${report.grade}: ${report.score.toFixed(1)}`,
        command: 'qualitas.showReport',
        tooltip: buildFileTooltip(report),
      }),
    );

    const addLens = (fn: FunctionQualityReport) => {
      const line = fn.location.startLine - 1;
      lenses.push(
        new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
          title: `Score ${fn.grade}: ${fn.score.toFixed(1)}`,
          command: 'qualitas.showReport',
          tooltip: buildFunctionTooltip(fn),
        }),
      );
    };

    for (const fn of report.functions) addLens(fn);
    for (const cls of report.classes) {
      // Class-level lens
      const clsLine = cls.location.startLine - 1;
      lenses.push(
        new vscode.CodeLens(new vscode.Range(clsLine, 0, clsLine, 0), {
          title: `Score ${cls.grade}: ${cls.score.toFixed(1)}`,
          command: 'qualitas.showReport',
          tooltip: `Class ${cls.name} - quality score ${cls.grade} ${cls.score.toFixed(1)}`,
        }),
      );
      for (const method of cls.methods) addLens(method);
    }

    return lenses;
  }
}

function buildFileTooltip(report: FileQualityReport): string {
  const lines = [
    `File scored ${report.grade} (${report.score.toFixed(1)}/100)`,
    '',
    `Functions: ${report.functionCount}  |  Classes: ${report.classCount}  |  Flagged: ${report.flaggedFunctionCount}`,
  ];
  return lines.join('\n');
}

function buildFunctionTooltip(fn: FunctionQualityReport): string {
  const lines = [
    `${fn.name} scored ${fn.grade} (${fn.score.toFixed(1)}/100)`,
  ];

  if (fn.flags.length === 0) {
    lines.push('', 'No issues found.');
  } else {
    lines.push('');
    for (const flag of fn.flags) {
      lines.push(`- ${flag.message}`);
      lines.push(`  ${flag.suggestion}`);
    }
  }

  return lines.join('\n');
}

// ── Public API ───────────────────────────────────────────────────────────────

export function registerCodeLensProvider(context: vscode.ExtensionContext): void {
  const provider = new QualitasCodeLensProvider();
  codeLensProvider = vscode.languages.registerCodeLensProvider({ scheme: 'file' }, provider);
  context.subscriptions.push(codeLensProvider, onDidChangeCodeLensesEmitter);
}

export function updateDecorations(
  editor: vscode.TextEditor,
  report: FileQualityReport,
): void {
  reportsByUri.set(editor.document.uri.toString(), report);
  onDidChangeCodeLensesEmitter.fire();
}

export function clearDecorations(editor: vscode.TextEditor): void {
  reportsByUri.delete(editor.document.uri.toString());
  onDidChangeCodeLensesEmitter.fire();
}

export function disposeDecorations(): void {
  reportsByUri.clear();
  codeLensProvider?.dispose();
  codeLensProvider = null;
}
