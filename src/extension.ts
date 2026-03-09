import * as vscode from 'vscode';
import { analyzeDocument, analyzeWorkspace } from './analyzer';
import { getConfig } from './config';
import { debounce } from './debounce';
import { clearDecorations, disposeDecorations, updateDecorations } from './decorations';
import { createDiagnosticCollection, updateDiagnostics } from './diagnostics';
import { clearStatusBar, createStatusBarItem, disposeStatusBar, updateStatusBar } from './status-bar';
import type { FileQualityReport, ProjectQualityReport } from 'qualitas';

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
  try {
    activateInternal(context);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Qualitas failed to activate: ${msg}`);
    throw err;
  }
}

function activateInternal(context: vscode.ExtensionContext): void {
  diagnosticCollection = createDiagnosticCollection();
  outputChannel = vscode.window.createOutputChannel('Qualitas');
  outputChannel.appendLine('[qualitas] Extension activating...');
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
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        vscode.window.showInformationMessage('Qualitas: No workspace folder open.');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Qualitas: Analyzing workspace...',
          cancellable: false,
        },
        async () => {
          try {
            const report = await analyzeWorkspace(folders[0].uri.fsPath);
            showProjectReport(report);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Qualitas: Workspace analysis failed -${msg}`);
          }
        },
      );
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
  outputChannel.appendLine(`[qualitas] Activated. Active editor: ${activeEditor?.document.fileName ?? 'none'}, language: ${activeEditor?.document.languageId ?? 'n/a'}`);
  if (activeEditor && isSupported(activeEditor.document)) {
    outputChannel.appendLine(`[qualitas] Running initial analysis on ${activeEditor.document.fileName}`);
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
    outputChannel.appendLine(`[qualitas] Analyzing: ${doc.fileName} (${doc.languageId})`);
    const report = analyzeDocument(doc.getText(), doc.fileName);
    outputChannel.appendLine(`[qualitas] Result: score=${report.score.toFixed(1)} grade=${report.grade} functions=${report.functionCount} flags=${report.flaggedFunctionCount}`);
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
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    outputChannel.appendLine(`[error] ${doc.fileName}: ${msg}`);
    outputChannel.show();
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
      `  ${fn.name} -${fn.grade} ${fn.score.toFixed(1)} (L${fn.location.startLine}-${fn.location.endLine})`,
    );
    for (const flag of fn.flags) {
      outputChannel.appendLine(`    [${flag.severity}] ${flag.message}`);
      outputChannel.appendLine(`    -> ${flag.suggestion}`);
    }
  }

  for (const cls of report.classes) {
    outputChannel.appendLine(`  class ${cls.name} -${cls.grade} ${cls.score.toFixed(1)}`);
    for (const method of cls.methods) {
      outputChannel.appendLine(
        `    ${method.name} -${method.grade} ${method.score.toFixed(1)} (L${method.location.startLine}-${method.location.endLine})`,
      );
      for (const flag of method.flags) {
        outputChannel.appendLine(`      [${flag.severity}] ${flag.message}`);
        outputChannel.appendLine(`      -> ${flag.suggestion}`);
      }
    }
  }

  outputChannel.show();
}

function showProjectReport(report: ProjectQualityReport): void {
  outputChannel.clear();
  const s = report.summary;

  outputChannel.appendLine('===========================================');
  outputChannel.appendLine(`  Qualitas Workspace Report`);
  outputChannel.appendLine('===========================================');
  outputChannel.appendLine('');
  outputChannel.appendLine(`  Score:   ${report.score.toFixed(1)} (${report.grade})`);
  outputChannel.appendLine(`  Files:   ${s.totalFiles}`);
  outputChannel.appendLine(`  Functions: ${s.totalFunctions} | Classes: ${s.totalClasses}`);
  outputChannel.appendLine(`  Flagged: ${s.flaggedFiles} files, ${s.flaggedFunctions} functions`);
  outputChannel.appendLine('');
  outputChannel.appendLine('  Grade Distribution');
  outputChannel.appendLine(`    A: ${s.gradeDistribution.a}  B: ${s.gradeDistribution.b}  C: ${s.gradeDistribution.c}  D: ${s.gradeDistribution.d}  F: ${s.gradeDistribution.f}`);
  outputChannel.appendLine('');

  if (report.worstFunctions.length > 0) {
    outputChannel.appendLine('  Worst Functions');
    outputChannel.appendLine('  ---------------');
    for (const fn of report.worstFunctions) {
      const file = fn.location.file || '';
      outputChannel.appendLine(`    ${fn.grade} ${fn.score.toFixed(1).padStart(5)}  ${fn.name}  (${file}:${fn.location.startLine})`);
      for (const flag of fn.flags) {
        outputChannel.appendLine(`            [${flag.severity}] ${flag.message}`);
      }
    }
  }

  outputChannel.appendLine('');
  outputChannel.appendLine('===========================================');
  outputChannel.show();
}
