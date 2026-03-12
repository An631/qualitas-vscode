import * as vscode from "vscode";
import type {
  ClassQualityReport,
  FileQualityReport,
  FunctionQualityReport,
} from "qualitas";

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
    lenses.push(this.createFileScoreLens(report));
    this.addFunctionLenses(lenses, report.functions);
    this.addClassLenses(lenses, report.classes);

    return lenses;
  }

  private createFileScoreLens(report: FileQualityReport): vscode.CodeLens {
    return new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
      title: `Score ${report.grade}: ${report.score.toFixed(1)}`,
      command: "qualitas.showReport",
      tooltip: buildFileTooltip(report),
    });
  }

  private addFunctionLenses(
    lenses: vscode.CodeLens[],
    functions: FunctionQualityReport[],
  ): void {
    for (const fn of functions) {
      lenses.push(this.createFunctionScoreLens(fn));
    }
  }

  private createFunctionScoreLens(fn: FunctionQualityReport): vscode.CodeLens {
    const line = fn.location.startLine - 1;
    return new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
      title: `Score ${fn.grade}: ${fn.score.toFixed(1)}`,
      command: "qualitas.showReport",
      tooltip: buildFunctionTooltip(fn),
    });
  }

  private addClassLenses(
    lenses: vscode.CodeLens[],
    classes: ClassQualityReport[],
  ): void {
    for (const cls of classes) {
      lenses.push(this.createClassScoreLens(cls));
      this.addFunctionLenses(lenses, cls.methods);
    }
  }

  private createClassScoreLens(cls: ClassQualityReport): vscode.CodeLens {
    const clsLine = cls.location.startLine - 1;
    return new vscode.CodeLens(new vscode.Range(clsLine, 0, clsLine, 0), {
      title: `Score ${cls.grade}: ${cls.score.toFixed(1)}`,
      command: "qualitas.showReport",
      tooltip: `Class ${cls.name} - quality score ${cls.grade} ${cls.score.toFixed(1)}`,
    });
  }
}

function buildFileTooltip(report: FileQualityReport): string {
  const lines = [
    `File scored ${report.grade} (${report.score.toFixed(1)}/100)`,
    "",
    `Functions: ${report.functionCount}  |  Classes: ${report.classCount}  |  Flagged: ${report.flaggedFunctionCount}`,
  ];
  return lines.join("\n");
}

function buildFunctionTooltip(fn: FunctionQualityReport): string {
  const lines = [`${fn.name} scored ${fn.grade} (${fn.score.toFixed(1)}/100)`];

  // Metric summary with score impact
  const m = fn.metrics;
  const b = fn.scoreBreakdown;
  if (m && b) {
    const impact = (penalty: number) =>
      penalty > 0 ? `(-${penalty.toFixed(1)} pts)` : "";

    lines.push("");
    lines.push("Results:");
    lines.push(
      `  Cognitive Flow: ${m.cognitiveFlow.score} ${impact(b.cfcPenalty)}`,
    );
    lines.push(
      `  Data Complexity: ${m.dataComplexity.difficulty.toFixed(1)} ${impact(b.dciPenalty)}`,
    );
    lines.push(
      `  Identifier Reference: ${m.identifierReference.totalIrc.toFixed(1)} ${impact(b.ircPenalty)}`,
    );
    lines.push(
      `  Dependency Coupling: ${m.dependencyCoupling.rawScore.toFixed(1)} ${impact(b.dcPenalty)}`,
    );
    lines.push(`  Structural: ${impact(b.smPenalty)}`);
    lines.push(`    - Parameters: ${m.structural.parameterCount}`);
    lines.push(`    - Lines of Code: ${m.structural.loc}`);
    lines.push(`    - Max Nesting Depth: ${m.structural.maxNestingDepth}`);
    lines.push(`    - Return Statements: ${m.structural.returnCount}`);
    lines.push("");
    lines.push(
      `Total: ${fn.score.toFixed(1)}/100 (${b.totalPenalty.toFixed(1)} pts deducted)`,
    );
  }

  // Flags
  if (fn.flags.length > 0) {
    lines.push("");
    lines.push("Flags:");
    for (const flag of fn.flags) {
      lines.push(`  - ${flag.message}`);
      lines.push(`    ${flag.suggestion}`);
    }
  }

  return lines.join("\n");
}

// ── Public API ───────────────────────────────────────────────────────────────

export function registerCodeLensProvider(
  context: vscode.ExtensionContext,
): void {
  const provider = new QualitasCodeLensProvider();
  codeLensProvider = vscode.languages.registerCodeLensProvider(
    { scheme: "file" },
    provider,
  );
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
