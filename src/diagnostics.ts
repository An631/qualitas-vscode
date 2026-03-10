import * as vscode from 'vscode';
import type { ClassQualityReport, FileQualityReport, FunctionQualityReport } from 'qualitas';

const DIAGNOSTIC_SOURCE = 'qualitas';

interface DiagnosticsOptions {
  scoreThreshold?: number;
  document?: vscode.TextDocument;
}

export function createDiagnosticCollection(): vscode.DiagnosticCollection {
  return vscode.languages.createDiagnosticCollection(DIAGNOSTIC_SOURCE);
}

export function updateDiagnostics(
  collection: vscode.DiagnosticCollection,
  uri: vscode.Uri,
  report: FileQualityReport,
  options: DiagnosticsOptions = {},
): void {
  const mergedOptions: DiagnosticsOptions = { scoreThreshold: 65, ...options };
  const diagnostics: vscode.Diagnostic[] = [];

  addFileScopeDiagnostic(diagnostics, report, mergedOptions);
  addFunctionDiagnostics(diagnostics, report, mergedOptions);
  addClassDiagnostics(diagnostics, report, mergedOptions);

  collection.set(uri, diagnostics);
}

function addFileScopeDiagnostic(
  diagnostics: vscode.Diagnostic[],
  report: FileQualityReport,
  options: DiagnosticsOptions,
): void {
  if (!report.fileScope) return;
  const fn = report.fileScope;
  const scoreThreshold = options.scoreThreshold ?? 65;
  const hasFlags = fn.flags.length > 0;
  const belowThreshold = fn.score < scoreThreshold;
  if (!hasFlags && !belowThreshold) return;

  const range = buildFileScopeRange(options.document);
  const lines = buildFileScopeDiagnosticLines(fn, scoreThreshold, hasFlags, belowThreshold);
  const severity = determineFileScopeSeverity(fn);

  const diag = new vscode.Diagnostic(range, lines.join('\n'), severity);
  diag.source = DIAGNOSTIC_SOURCE;
  diagnostics.push(diag);
}

function buildFileScopeRange(document?: vscode.TextDocument): vscode.Range {
  // Place before the first character so the squiggle sits left of the code
  return new vscode.Range(
    new vscode.Position(0, 0),
    new vscode.Position(0, 1),
  );
}

function buildFileScopeDiagnosticLines(
  fn: FunctionQualityReport,
  scoreThreshold: number,
  hasFlags: boolean,
  belowThreshold: boolean,
): string[] {
  const lines: string[] = [];
  lines.push(`File scope (code outside functions and classes) scored ${fn.grade} (${fn.score.toFixed(1)}/100)`);

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

  return lines;
}

function determineFileScopeSeverity(fn: FunctionQualityReport): vscode.DiagnosticSeverity {
  const hasErrorFlag = fn.flags.some((f) => f.severity === 'error');
  return hasErrorFlag ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
}

function addFunctionDiagnostics(
  diagnostics: vscode.Diagnostic[],
  report: FileQualityReport,
  options: DiagnosticsOptions,
): void {
  for (const fn of report.functions) {
    const d = buildFunctionDiagnostic(fn, options);
    if (d) diagnostics.push(d);
  }
}

function addClassDiagnostics(
  diagnostics: vscode.Diagnostic[],
  report: FileQualityReport,
  options: DiagnosticsOptions,
): void {
  for (const cls of report.classes) {
    const d = buildClassDiagnostic(cls, options);
    if (d) diagnostics.push(d);
    addMethodDiagnostics(diagnostics, cls, options);
  }
}

function addMethodDiagnostics(
  diagnostics: vscode.Diagnostic[],
  cls: ClassQualityReport,
  options: DiagnosticsOptions,
): void {
  for (const method of cls.methods) {
    const md = buildFunctionDiagnostic(method, options);
    if (md) diagnostics.push(md);
  }
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
  options: DiagnosticsOptions,
): vscode.Diagnostic | null {
  const scoreThreshold = options.scoreThreshold ?? 65;
  const hasFlags = fn.flags.length > 0;
  const belowThreshold = fn.score < scoreThreshold;
  if (!hasFlags && !belowThreshold) return null;

  const line = fn.location.startLine - 1;
  const range = nameRange(fn.name, line, options.document);
  const lines = buildFunctionDiagnosticLines(fn, scoreThreshold, hasFlags);
  const severity = determineFunctionSeverity(fn);

  const diag = new vscode.Diagnostic(range, lines.join('\n'), severity);
  diag.source = DIAGNOSTIC_SOURCE;
  return diag;
}

function buildFunctionDiagnosticLines(
  fn: FunctionQualityReport,
  scoreThreshold: number,
  hasFlags: boolean,
): string[] {
  const lines: string[] = [];
  lines.push(`${fn.name} scored ${fn.grade} (${fn.score.toFixed(1)}/100)`);

  if (fn.score < scoreThreshold) {
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

  return lines;
}

function determineFunctionSeverity(fn: FunctionQualityReport): vscode.DiagnosticSeverity {
  const hasErrorFlag = fn.flags.some((f) => f.severity === 'error');
  return hasErrorFlag ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
}

function buildClassDiagnostic(
  cls: ClassQualityReport,
  options: DiagnosticsOptions,
): vscode.Diagnostic | null {
  const scoreThreshold = options.scoreThreshold ?? 65;
  const flaggedMethods = cls.methods.filter(
    (m) => m.flags.length > 0 || m.score < scoreThreshold,
  );
  
  if (!shouldCreateClassDiagnostic(cls, scoreThreshold, flaggedMethods)) {
    return null;
  }

  const line = cls.location.startLine - 1;
  const range = nameRange(cls.name, line, options.document);
  const lines = buildClassDiagnosticLines(cls, scoreThreshold, cls.flags.length > 0, flaggedMethods);
  const severity = determineClassSeverity(cls);

  const diag = new vscode.Diagnostic(range, lines.join('\n'), severity);
  diag.source = DIAGNOSTIC_SOURCE;
  return diag;
}

function shouldCreateClassDiagnostic(
  cls: ClassQualityReport,
  scoreThreshold: number,
  flaggedMethods: ClassQualityReport['methods'],
): boolean {
  return cls.flags.length > 0 || cls.score < scoreThreshold || flaggedMethods.length > 0;
}

function buildClassDiagnosticLines(
  cls: ClassQualityReport,
  scoreThreshold: number,
  hasClassFlags: boolean,
  flaggedMethods: ClassQualityReport['methods'],
): string[] {
  const lines: string[] = [];
  addClassHeaderLine(lines, cls);
  addScoreWarning(lines, cls, scoreThreshold);
  addClassFlags(lines, cls);
  addMethodSummary(lines, flaggedMethods);
  return lines;
}

function addClassHeaderLine(lines: string[], cls: ClassQualityReport): void {
  lines.push(`class ${cls.name} scored ${cls.grade} (${cls.score.toFixed(1)}/100)`);
}

function addScoreWarning(lines: string[], cls: ClassQualityReport, scoreThreshold: number): void {
  if (cls.score < scoreThreshold) {
    lines.push('');
    lines.push(`Score is below the threshold of ${scoreThreshold}.`);
  }
}

function addClassFlags(lines: string[], cls: ClassQualityReport): void {
  if (cls.flags.length > 0) {
    lines.push('');
    for (const flag of cls.flags) {
      lines.push(`- ${flag.message}`);
      lines.push(`  ${flag.suggestion}`);
    }
  }
}

function addMethodSummary(lines: string[], flaggedMethods: ClassQualityReport['methods']): void {
  if (flaggedMethods.length > 0) {
    lines.push('');
    lines.push(`${flaggedMethods.length} method(s) need attention:`);
    for (const m of flaggedMethods) {
      lines.push(`  ${m.name} scored ${m.grade} (${m.score.toFixed(1)}/100)`);
    }
  }
}

function determineClassSeverity(cls: ClassQualityReport): vscode.DiagnosticSeverity {
  const allFlags = [...cls.flags, ...cls.methods.flatMap((m) => m.flags)];
  const hasErrorFlag = allFlags.some((f) => f.severity === 'error');
  return hasErrorFlag ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
}
