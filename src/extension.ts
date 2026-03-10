import * as vscode from 'vscode';
import { analyzeDocument, analyzeWorkspace } from './analyzer';
import { getConfig } from './config';
import { debounce } from './debounce';
import { QualitasCodeActionProvider, registerAICommands } from './code-actions';
import { clearDecorations, disposeDecorations, registerCodeLensProvider, updateDecorations } from './decorations';
import { createDiagnosticCollection, updateDiagnostics } from './diagnostics';
import { clearStatusBar, createStatusBarItem, disposeStatusBar, updateStatusBar } from './status-bar';
import type { FileQualityReport, ProjectQualityReport } from 'qualitas';
import { extname } from 'path';

// Cache extensions that qualitas doesn't support, so we don't retry them
const unsupportedExtensions = new Set<string>();

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
  registerCodeLensProvider(context);
  registerAICommands(context, {
    getReport: (uri) => reportCache.get(uri),
    getThreshold: () => getConfig().scoreThreshold,
  });

  // Register code action provider for all file types
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider({ scheme: 'file' }, new QualitasCodeActionProvider(), {
      providedCodeActionKinds: QualitasCodeActionProvider.providedCodeActionKinds,
    }),
  );

  const config = getConfig();

  // Debounced analysis for on-change events
  let debouncedAnalyze = createDebouncedAnalyze(config.changeDelay);

  registerEventHandlers(context, debouncedAnalyze);
  registerCommands(context);
  
  context.subscriptions.push(diagnosticCollection, outputChannel, statusBar);

  // Analyze the currently active editor on activation
  const activeEditor = vscode.window.activeTextEditor;
  outputChannel.appendLine(`[qualitas] Activated. Active editor: ${activeEditor?.document.fileName ?? 'none'}, language: ${activeEditor?.document.languageId ?? 'n/a'}`);
  if (activeEditor && isSupported(activeEditor.document)) {
    outputChannel.appendLine(`[qualitas] Running initial analysis on ${activeEditor.document.fileName}`);
    runAnalysis(activeEditor);
  }
}

function registerEventHandlers(context: vscode.ExtensionContext, debouncedAnalyze: ReturnType<typeof createDebouncedAnalyze>): void {
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      handleActiveEditorChange(editor);
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      handleDocumentSave(doc);
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      handleDocumentChange(e, debouncedAnalyze);
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      handleConfigChange(e, context, debouncedAnalyze);
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnosticCollection.delete(doc.uri);
      reportCache.delete(doc.uri.toString());
    }),
  );
}

function handleActiveEditorChange(editor: vscode.TextEditor | undefined): void {
  if (!editor) return;
  if (isSupported(editor.document)) {
    runAnalysis(editor);
  } else {
    clearStatusBar();
  }
}

function handleDocumentSave(doc: vscode.TextDocument): void {
  const cfg = getConfig();
  if (!cfg.enable || !cfg.analyzeOnSave) return;
  const editor = vscode.window.visibleTextEditors.find((e) => e.document === doc);
  if (editor && isSupported(doc)) {
    runAnalysis(editor);
  }
}

function handleDocumentChange(
  e: vscode.TextDocumentChangeEvent,
  debouncedAnalyze: ReturnType<typeof createDebouncedAnalyze>,
): void {
  const cfg = getConfig();
  if (!cfg.enable || !cfg.analyzeOnChange) return;
  const editor = vscode.window.visibleTextEditors.find((ed) => ed.document === e.document);
  if (editor && isSupported(e.document)) {
    debouncedAnalyze(editor);
  }
}

function handleConfigChange(
  e: vscode.ConfigurationChangeEvent,
  context: vscode.ExtensionContext,
  debouncedAnalyze: ReturnType<typeof createDebouncedAnalyze>,
): void {
  if (!e.affectsConfiguration('qualitas')) return;
  const cfg = getConfig();
  debouncedAnalyze.cancel();
  debouncedAnalyze = createDebouncedAnalyze(cfg.changeDelay);
  if (!cfg.showStatusBar) clearStatusBar();
  const editor = vscode.window.activeTextEditor;
  if (editor && isSupported(editor.document)) {
    runAnalysis(editor);
  }
}

function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('qualitas.analyzeFile', () => {
      handleAnalyzeFileCommand();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('qualitas.analyzeWorkspace', async () => {
      await handleAnalyzeWorkspaceCommand();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('qualitas.showReport', () => {
      handleShowReportCommand();
    }),
  );

}

function handleAnalyzeFileCommand(): void {
  const editor = vscode.window.activeTextEditor;
  if (editor && isSupported(editor.document)) {
    runAnalysis(editor);
  } else {
    vscode.window.showInformationMessage('Qualitas: Open a supported source file to analyze.');
  }
}

async function handleAnalyzeWorkspaceCommand(): Promise<void> {
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
        const cfg = getConfig();
        const report = await analyzeWorkspace(folders[0].uri.fsPath, cfg.analysisOptions);
        showProjectReport(report);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Qualitas: Workspace analysis failed -${msg}`);
      }
    },
  );
}

function handleShowReportCommand(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const report = reportCache.get(editor.document.uri.toString());
  if (!report) {
    vscode.window.showInformationMessage('Qualitas: No report available. Analyze the file first.');
    return;
  }
  showReport(report);
}

export function deactivate(): void {
  disposeDecorations();
  disposeStatusBar();
  reportCache.clear();
}

function isSupported(doc: vscode.TextDocument): boolean {
  const ext = extname(doc.fileName).toLowerCase();
  if (!ext || unsupportedExtensions.has(ext)) return false;
  // Skip untitled/virtual documents with no real file extension
  if (doc.uri.scheme !== 'file') return false;
  return true;
}

function createDebouncedAnalyze(delay: number) {
  return debounce((editor: vscode.TextEditor) => runAnalysis(editor), delay);
}

function runAnalysis(editor: vscode.TextEditor): void {
  const cfg = getConfig();
  if (!cfg.enable) return;

  const doc = editor.document;
  try {
    const report = analyzeAndLogDocument(doc, cfg);
    reportCache.set(doc.uri.toString(), report);

    updateEditorState(editor, report, cfg);
  } catch (err) {
    handleAnalysisError(doc, editor, err);
  }
}

function analyzeAndLogDocument(doc: vscode.TextDocument, cfg: ReturnType<typeof getConfig>): FileQualityReport {
  outputChannel.appendLine(`[qualitas] Analyzing: ${doc.fileName} (${doc.languageId})`);
  const report = analyzeDocument(doc.getText(), doc.fileName, cfg.analysisOptions);
  outputChannel.appendLine(
    `[qualitas] Result: score=${report.score.toFixed(1)} grade=${report.grade} functions=${report.functionCount}` +
      ` flags=${report.flaggedFunctionCount + (report.fileScope?.flags.length ?? 0)}` +
      (report.fileScope ? ` fileScope=${report.fileScope.score.toFixed(1)}(${report.fileScope.grade})` : ''),
  );
  return report;
}

function updateEditorState(editor: vscode.TextEditor, report: FileQualityReport, cfg: ReturnType<typeof getConfig>): void {
  const options = {document: editor.document, scoreThreshold: cfg.scoreThreshold};
  updateDiagnostics(diagnosticCollection, editor.document.uri, report, options);

  if (cfg.showInlineScores) {
    updateDecorations(editor, report);
  } else {
    clearDecorations(editor);
  }

  if (cfg.showStatusBar) {
    updateStatusBar(report);
  }
}

function handleAnalysisError(doc: vscode.TextDocument, editor: vscode.TextEditor, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('Unsupported file type')) {
    const ext = extname(doc.fileName).toLowerCase();
    unsupportedExtensions.add(ext);
    clearDecorations(editor);
    clearStatusBar();
    return;
  }
  outputChannel.appendLine(`[error] ${doc.fileName}: ${msg}`);
}

function showReport(report: FileQualityReport): void {
  outputChannel.clear();
  outputChannel.appendLine(`Qualitas Report: ${report.filePath}`);
  outputChannel.appendLine(`Score: ${report.score.toFixed(1)} (${report.grade})`);
  outputChannel.appendLine(`Functions: ${report.functionCount} | Classes: ${report.classCount}`);
  outputChannel.appendLine(`Flagged functions: ${report.flaggedFunctionCount}`);
  outputChannel.appendLine('');

  showReportFunctions(report);
  showReportClasses(report);

  outputChannel.show();
}

function showReportFunctions(report: FileQualityReport): void {
  for (const fn of report.functions) {
    outputChannel.appendLine(
      `  ${fn.name} -${fn.grade} ${fn.score.toFixed(1)} (L${fn.location.startLine}-${fn.location.endLine})`,
    );
    for (const flag of fn.flags) {
      outputChannel.appendLine(`    [${flag.severity}] ${flag.message}`);
      outputChannel.appendLine(`    -> ${flag.suggestion}`);
    }
  }
}

function showReportClasses(report: FileQualityReport): void {
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
}

function showProjectReport(report: ProjectQualityReport): void {
  outputChannel.clear();
  const s = report.summary;

  showProjectReportHeader(report, s);
  showGradeDistribution(s);
  showWorstFunctions(report);
  showProjectReportFooter();

  outputChannel.show();
}

function showProjectReportHeader(report: ProjectQualityReport, s: ProjectQualityReport['summary']): void {
  outputChannel.appendLine('===========================================');
  outputChannel.appendLine(`  Qualitas Workspace Report`);
  outputChannel.appendLine('===========================================');
  outputChannel.appendLine('');
  outputChannel.appendLine(`  Score:   ${report.score.toFixed(1)} (${report.grade})`);
  outputChannel.appendLine(`  Files:   ${s.totalFiles}`);
  outputChannel.appendLine(`  Functions: ${s.totalFunctions} | Classes: ${s.totalClasses}`);
  outputChannel.appendLine(`  Flagged: ${s.flaggedFiles} files, ${s.flaggedFunctions} functions`);
  outputChannel.appendLine('');
}

function showGradeDistribution(s: ProjectQualityReport['summary']): void {
  outputChannel.appendLine('  Grade Distribution');
  outputChannel.appendLine(`    A: ${s.gradeDistribution.a}  B: ${s.gradeDistribution.b}  C: ${s.gradeDistribution.c}  D: ${s.gradeDistribution.d}  F: ${s.gradeDistribution.f}`);
  outputChannel.appendLine('');
}

function showWorstFunctions(report: ProjectQualityReport): void {
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
}

function showProjectReportFooter(): void {
  outputChannel.appendLine('===========================================');
}
