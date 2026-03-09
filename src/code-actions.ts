import * as vscode from 'vscode';
import type { FileQualityReport, FunctionQualityReport } from 'qualitas';

export class QualitasCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    _document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const qualitasDiags = this.filterQualitasDiagnostics(context);
    const actions = this.createFixActions(qualitasDiags);
    
    if (qualitasDiags.length > 0) {
      actions.push(this.createFixAllAction());
    }

    return actions;
  }

  private filterQualitasDiagnostics({diagnostics}: vscode.CodeActionContext): vscode.Diagnostic[] {
    return diagnostics.filter(diag => diag.source === 'qualitas');
  }

  private createFixActions(diagnostics: vscode.Diagnostic[]): vscode.CodeAction[] {
    return diagnostics.map(diag => {
      const action = new vscode.CodeAction(
        'Qualitas: Fix with AI',
        vscode.CodeActionKind.QuickFix,
      );
      action.diagnostics = [diag];
      action.command = {
        title: 'Qualitas: Fix with AI',
        command: 'qualitas.fixWithAI',
        arguments: [diag],
      };
      return action;
    });
  }

  private createFixAllAction(): vscode.CodeAction {
    const fixAll = new vscode.CodeAction(
      'Qualitas: Fix all issues with AI',
      vscode.CodeActionKind.QuickFix,
    );
    fixAll.command = {
      title: 'Qualitas: Fix all issues with AI',
      command: 'qualitas.fixAllWithAI',
    };
    return fixAll;
  }
}

export interface AICommandDeps {
  getReport: (uri: string) => FileQualityReport | undefined;
  getThreshold: () => number;
}

export function registerAICommands(context: vscode.ExtensionContext, deps: AICommandDeps): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('qualitas.fixWithAI', async (diag: vscode.Diagnostic) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      editor.selection = new vscode.Selection(diag.range.start, diag.range.end);

      const prompt = `Refactor this code to fix the following quality issue:\n\n${diag.message}`;

      await openAIChat(prompt);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('qualitas.fixAllWithAI', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('Qualitas: Open a file first.');
        return;
      }

      const report = deps.getReport(editor.document.uri.toString());
      if (!report) {
        vscode.window.showInformationMessage(
          'Qualitas: No analysis results. Run "Qualitas: Analyze Current File" first.',
        );
        return;
      }

      const scoreThreshold = deps.getThreshold();
      const prompt = buildFixAllPrompt(report, scoreThreshold);

      if (!prompt) {
        vscode.window.showInformationMessage('Qualitas: No issues found in this file.');
        return;
      }

      selectEntireFile(editor);
      await openAIChat(prompt);
    }),
  );
}

function selectEntireFile(editor: vscode.TextEditor): void {
  const lastLine = editor.document.lineCount - 1;
  editor.selection = new vscode.Selection(0, 0, lastLine, editor.document.lineAt(lastLine).text.length);
}

async function openAIChat(prompt: string): Promise<void> {
  try {
    await vscode.commands.executeCommand('inlineChat.start', {
      message: prompt,
      autoSend: true,
    });
  } catch {
    try {
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        query: prompt,
      });
    } catch {
      vscode.window.showInformationMessage(
        'Qualitas: No AI assistant found. Install GitHub Copilot or another AI extension to use this feature.',
      );
    }
  }
}

function buildFixAllPrompt(report: FileQualityReport, threshold: number): string | null {
  const issues: string[] = [];

  if (report.fileScope) {
    collectFunctionIssues(report.fileScope, issues, threshold);
  }
  
  for (const fn of report.functions) {
    collectFunctionIssues(fn, issues, threshold);
  }
  
  for (const cls of report.classes) {
    collectClassIssues(cls, issues, threshold);
    for (const method of cls.methods) {
      collectFunctionIssues(method, issues, threshold);
    }
  }

  if (issues.length === 0) return null;

  return buildPromptMessage(issues, threshold);
}

function collectFunctionIssues(fn: FunctionQualityReport, issues: string[], threshold: number): void {
  const hasFlags = fn.flags.length > 0;
  const belowThreshold = fn.score < threshold;
  
  if (!hasFlags && !belowThreshold) return;

  const parts = [`${fn.name} scored ${fn.grade} (${fn.score.toFixed(1)}/100)`];
  
  if (belowThreshold) {
    parts.push(`  Score is below the threshold of ${threshold}.`);
  }
  
  for (const flag of fn.flags) {
    parts.push(`  - ${flag.message}`);
    parts.push(`    ${flag.suggestion}`);
  }
  
  issues.push(parts.join('\n'));
}

function collectClassIssues(cls: { name: string; score: number; grade: string; flags: Array<{ message: string; suggestion: string }> }, issues: string[], threshold: number): void {
  const hasClassFlags = cls.flags.length > 0;
  const classBelowThreshold = cls.score < threshold;
  
  if (!hasClassFlags && !classBelowThreshold) return;

  const parts = [`class ${cls.name} scored ${cls.grade} (${cls.score.toFixed(1)}/100)`];
  
  if (classBelowThreshold) {
    parts.push(`  Score is below the threshold of ${threshold}.`);
  }
  
  for (const flag of cls.flags) {
    parts.push(`  - ${flag.message}`);
    parts.push(`    ${flag.suggestion}`);
  }
  
  issues.push(parts.join('\n'));
}

function buildPromptMessage(issues: string[], threshold: number): string {
  const lines = [
    `Refactor this file to fix ${issues.length} quality issue(s).`,
    `The minimum acceptable quality score is ${threshold}/100.`,
    '',
    'Issues to fix:',
    '',
    ...issues,
    '',
    'Requirements:',
    '- Refactor each flagged function and class to address the specific issues listed above.',
    '- After refactoring, ensure every function scores above the threshold.',
    '- If splitting a function creates new functions, ensure those also meet the threshold.',
    '- Preserve the existing behavior and public API.',
  ];

  return lines.join('\n');
}
