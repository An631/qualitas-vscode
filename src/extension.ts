import * as vscode from 'vscode';
import { analyzeDocument } from './analyzer';
import { getConfig } from './config';
import { debounce } from './debounce';
import { clearDecorations, disposeDecorations, updateDecorations } from './decorations';
import { createDiagnosticCollection, updateDiagnostics } from './diagnostics';
import { clearStatusBar, createStatusBarItem, disposeStatusBar, updateStatusBar } from './status-bar';
import type { FileQualityReport } from 'qualitas';

const SUPPORTED_LANGUAGES = new Set([
  'typescript',
  'javascript',
  'typescriptreact',
  'javascriptreact',
]);

let diagnosticCollection: vscode.DiagnosticCollection;
let outputChannel: vscode.OutputChannel;

// Cache reports per URI for the report command
const reportCache = new Map<string, FileQualityReport>();

export function activate(context: vscode.ExtensionContext): void {
  diagnosticCollection = createDiagnosticCollection();
  outputChannel = vscode.window.createOutputChannel('Qualitas');
  const statusBar = createStatusBarItem();

  const config = getConfig();

  // Debounced analysis for on-change events
  let debouncedAnalyze = createDebouncedAnalyze(config.changeDelay);

  // Analyze on file open
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && isSupported(editor.document)) {
        runAnalysis(editor);
      } else if (editor) {
        clearStatusBar();
      }
    }),
  );

  // Analyze on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const cfg = getConfig();
      if (!cfg.enable || !cfg.analyzeOnSave) return;
      const editor = vscode.window.visibleTextEditors.find((e) => e.document === doc);
      if (editor && isSupported(doc)) {
        runAnalysis(editor);
      }
    }),
  );

  // Analyze on change (debounced)
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const cfg = getConfig();
      if (!cfg.enable || !cfg.analyzeOnChange) return;
      const editor = vscode.window.visibleTextEditors.find(
        (ed) => ed.document === e.document,
      );
      if (editor && isSupported(e.document)) {
        debouncedAnalyze(editor);
      }
    }),
  );

  // React to config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration('qualitas')) return;
      const cfg = getConfig();

      // Recreate debounce with new delay
      debouncedAnalyze.cancel();
      debouncedAnalyze = createDebouncedAnalyze(cfg.changeDelay);

      if (!cfg.showStatusBar) clearStatusBar();

      // Re-analyze active editor
      const editor = vscode.window.activeTextEditor;
      if (editor && isSupported(editor.document)) {
        runAnalysis(editor);
      }
    }),
  );

  // Clean up diagnostics when a file is closed
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnosticCollection.delete(doc.uri);
      reportCache.delete(doc.uri.toString());
    }),
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('qualitas.analyzeFile', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && isSupported(editor.document)) {
        runAnalysis(editor);
      } else {
        vscode.window.showInformationMessage('Qualitas: Open a TypeScript or JavaScript file to analyze.');
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('qualitas.analyzeWorkspace', async () => {
      const editors = vscode.window.visibleTextEditors.filter((e) => isSupported(e.document));
      for (const editor of editors) {
        runAnalysis(editor);
      }
      vscode.window.showInformationMessage(`Qualitas: Analyzed ${editors.length} open file(s).`);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('qualitas.showReport', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const report = reportCache.get(editor.document.uri.toString());
      if (!report) {
        vscode.window.showInformationMessage('Qualitas: No report available. Analyze the file first.');
        return;
      }
      showReport(report);
    }),
  );

  context.subscriptions.push(diagnosticCollection, outputChannel, statusBar);

  // Analyze the currently active editor on activation
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && isSupported(activeEditor.document)) {
    runAnalysis(activeEditor);
  }
}

export function deactivate(): void {
  disposeDecorations();
  disposeStatusBar();
  reportCache.clear();
}

function isSupported(doc: vscode.TextDocument): boolean {
  return SUPPORTED_LANGUAGES.has(doc.languageId);
}

function createDebouncedAnalyze(delay: number) {
  return debounce((editor: vscode.TextEditor) => runAnalysis(editor), delay);
}

function runAnalysis(editor: vscode.TextEditor): void {
  const cfg = getConfig();
  if (!cfg.enable) return;

  const doc = editor.document;
  try {
    const report = analyzeDocument(doc.getText(), doc.fileName);
    reportCache.set(doc.uri.toString(), report);

    updateDiagnostics(diagnosticCollection, doc.uri, report);

    if (cfg.showInlineScores) {
      updateDecorations(editor, report);
    } else {
      clearDecorations(editor);
    }

    if (cfg.showStatusBar) {
      updateStatusBar(report);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[error] ${doc.fileName}: ${msg}`);
  }
}

function showReport(report: FileQualityReport): void {
  outputChannel.clear();
  outputChannel.appendLine(`Qualitas Report: ${report.filePath}`);
  outputChannel.appendLine(`Score: ${report.score.toFixed(1)} (${report.grade})`);
  outputChannel.appendLine(`Functions: ${report.functionCount} | Classes: ${report.classCount}`);
  outputChannel.appendLine(`Flagged functions: ${report.flaggedFunctionCount}`);
  outputChannel.appendLine('');

  for (const fn of report.functions) {
    outputChannel.appendLine(
      `  ${fn.name} — ${fn.grade} ${fn.score.toFixed(1)} (L${fn.location.startLine}–${fn.location.endLine})`,
    );
    for (const flag of fn.flags) {
      outputChannel.appendLine(`    [${flag.severity}] ${flag.message}`);
      outputChannel.appendLine(`    → ${flag.suggestion}`);
    }
  }

  for (const cls of report.classes) {
    outputChannel.appendLine(`  class ${cls.name} — ${cls.grade} ${cls.score.toFixed(1)}`);
    for (const method of cls.methods) {
      outputChannel.appendLine(
        `    ${method.name} — ${method.grade} ${method.score.toFixed(1)} (L${method.location.startLine}–${method.location.endLine})`,
      );
      for (const flag of method.flags) {
        outputChannel.appendLine(`      [${flag.severity}] ${flag.message}`);
        outputChannel.appendLine(`      → ${flag.suggestion}`);
      }
    }
  }

  outputChannel.show();
}
