import * as vscode from 'vscode';
import type { FileQualityReport, FunctionQualityReport, RefactoringFlag } from 'qualitas';

const DIAGNOSTIC_SOURCE = 'qualitas';

export function createDiagnosticCollection(): vscode.DiagnosticCollection {
  return vscode.languages.createDiagnosticCollection(DIAGNOSTIC_SOURCE);
}

export function updateDiagnostics(
  collection: vscode.DiagnosticCollection,
  uri: vscode.Uri,
  report: FileQualityReport,
): void {
  const diagnostics: vscode.Diagnostic[] = [];

  // File-scope flags
  if (report.fileScope) {
    addFunctionDiagnostics(diagnostics, report.fileScope);
  }

  // Function-level flags
  for (const fn of report.functions) {
    addFunctionDiagnostics(diagnostics, fn);
  }

  // Class method flags
  for (const cls of report.classes) {
    for (const method of cls.methods) {
      addFunctionDiagnostics(diagnostics, method);
    }
  }

  collection.set(uri, diagnostics);
}

function addFunctionDiagnostics(
  diagnostics: vscode.Diagnostic[],
  fn: FunctionQualityReport,
): void {
  for (const flag of fn.flags) {
    const range = new vscode.Range(
      new vscode.Position(fn.location.startLine - 1, 0),
      new vscode.Position(fn.location.endLine - 1, Number.MAX_SAFE_INTEGER),
    );
    const diag = new vscode.Diagnostic(range, formatFlagMessage(fn.name, flag), mapSeverity(flag));
    diag.source = DIAGNOSTIC_SOURCE;
    diag.code = flag.flagType;
    diagnostics.push(diag);
  }
}

function mapSeverity(flag: RefactoringFlag): vscode.DiagnosticSeverity {
  switch (flag.severity) {
    case 'error':
      return vscode.DiagnosticSeverity.Warning;
    case 'warning':
      return vscode.DiagnosticSeverity.Information;
    case 'info':
      return vscode.DiagnosticSeverity.Hint;
  }
}

function formatFlagMessage(fnName: string, flag: RefactoringFlag): string {
  const metric = `${flag.observedValue} (threshold: ${flag.threshold})`;
  return `${fnName}: ${flag.message}\nMetric: ${metric}\nSuggestion: ${flag.suggestion}`;
}
