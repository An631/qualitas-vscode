import * as vscode from 'vscode';
import type { ClassQualityReport, FileQualityReport, FunctionQualityReport } from 'qualitas';

const DIAGNOSTIC_SOURCE = 'qualitas';

export function createDiagnosticCollection(): vscode.DiagnosticCollection {
  return vscode.languages.createDiagnosticCollection(DIAGNOSTIC_SOURCE);
}

export function updateDiagnostics(
  collection: vscode.DiagnosticCollection,
  uri: vscode.Uri,
  report: FileQualityReport,
  document?: vscode.TextDocument,
  scoreThreshold = 65,
): void {
  const diagnostics: vscode.Diagnostic[] = [];

  if (report.fileScope) {
    const d = buildFunctionDiagnostic(report.fileScope, scoreThreshold, document);
    if (d) diagnostics.push(d);
  }

  for (const fn of report.functions) {
    const d = buildFunctionDiagnostic(fn, scoreThreshold, document);
    if (d) diagnostics.push(d);
  }

  for (const cls of report.classes) {
    const d = buildClassDiagnostic(cls, scoreThreshold, document);
    if (d) diagnostics.push(d);
    for (const method of cls.methods) {
      const md = buildFunctionDiagnostic(method, scoreThreshold, document);
      if (md) diagnostics.push(md);
    }
  }

  collection.set(uri, diagnostics);
}

function nameRange(
  name: string,
  line: number,
  document?: vscode.TextDocument,
): vscode.Range {
  if (document && line < document.lineCount) {
    const lineText = document.lineAt(line).text;
    const nameIdx = lineText.indexOf(name);
    if (nameIdx >= 0) {
      return new vscode.Range(
        new vscode.Position(line, nameIdx),
        new vscode.Position(line, nameIdx + name.length),
      );
    }
  }
  return new vscode.Range(
    new vscode.Position(line, 0),
    new vscode.Position(line, Number.MAX_SAFE_INTEGER),
  );
}

function buildFunctionDiagnostic(
  fn: FunctionQualityReport,
  scoreThreshold: number,
  document?: vscode.TextDocument,
): vscode.Diagnostic | null {
  const hasFlags = fn.flags.length > 0;
  const belowThreshold = fn.score < scoreThreshold;
  if (!hasFlags && !belowThreshold) return null;

  const line = fn.location.startLine - 1;
  const range = nameRange(fn.name, line, document);

  const lines: string[] = [];
  lines.push(`${fn.name} scored ${fn.grade} (${fn.score.toFixed(1)}/100)`);

  if (belowThreshold) {
    lines.push('');
    lines.push(`Score is below the threshold of ${scoreThreshold}.`);
  }

  if (hasFlags) {
    lines.push('');
    for (const flag of fn.flags) {
      lines.push(`- ${flag.message}`);
      lines.push(`  ${flag.suggestion}`);
    }
  }

  const severity = hasFlags && fn.flags.some((f) => f.severity === 'error')
    ? vscode.DiagnosticSeverity.Warning
    : vscode.DiagnosticSeverity.Information;

  const diag = new vscode.Diagnostic(range, lines.join('\n'), severity);
  diag.source = DIAGNOSTIC_SOURCE;
  return diag;
}

function buildClassDiagnostic(
  cls: ClassQualityReport,
  scoreThreshold: number,
  document?: vscode.TextDocument,
): vscode.Diagnostic | null {
  const hasClassFlags = cls.flags.length > 0;
  const belowThreshold = cls.score < scoreThreshold;
  const flaggedMethods = cls.methods.filter(
    (m) => m.flags.length > 0 || m.score < scoreThreshold,
  );
  if (!hasClassFlags && !belowThreshold && flaggedMethods.length === 0) return null;

  const line = cls.location.startLine - 1;
  const range = nameRange(cls.name, line, document);

  const lines: string[] = [];
  lines.push(`class ${cls.name} scored ${cls.grade} (${cls.score.toFixed(1)}/100)`);

  if (belowThreshold) {
    lines.push('');
    lines.push(`Score is below the threshold of ${scoreThreshold}.`);
  }

  if (hasClassFlags) {
    lines.push('');
    for (const flag of cls.flags) {
      lines.push(`- ${flag.message}`);
      lines.push(`  ${flag.suggestion}`);
    }
  }

  if (flaggedMethods.length > 0) {
    lines.push('');
    lines.push(`${flaggedMethods.length} method(s) need attention:`);
    for (const m of flaggedMethods) {
      lines.push(`  ${m.name} scored ${m.grade} (${m.score.toFixed(1)}/100)`);
    }
  }

  const allFlags = [...cls.flags, ...cls.methods.flatMap((m) => m.flags)];
  const severity = allFlags.some((f) => f.severity === 'error')
    ? vscode.DiagnosticSeverity.Warning
    : vscode.DiagnosticSeverity.Information;

  const diag = new vscode.Diagnostic(range, lines.join('\n'), severity);
  diag.source = DIAGNOSTIC_SOURCE;
  return diag;
}
