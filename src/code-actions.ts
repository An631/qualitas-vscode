import * as vscode from 'vscode';

export class QualitasCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    _document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diag of context.diagnostics) {
      if (diag.source !== 'qualitas') continue;

      const action = new vscode.CodeAction(
        'Fix with AI',
        vscode.CodeActionKind.QuickFix,
      );
      action.diagnostics = [diag];
      action.command = {
        title: 'Fix with AI',
        command: 'qualitas.fixWithAI',
        arguments: [diag],
      };
      actions.push(action);
    }

    return actions;
  }
}

export function registerFixWithAICommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('qualitas.fixWithAI', async (diag: vscode.Diagnostic) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      // Select the flagged range so the AI has context
      editor.selection = new vscode.Selection(diag.range.start, diag.range.end);

      const prompt = `Refactor this code to fix the following quality issue:\n\n${diag.message}`;

      // Try VS Code's built-in inline chat (works with Copilot and other AI providers)
      try {
        await vscode.commands.executeCommand('inlineChat.start', {
          message: prompt,
          autoSend: true,
        });
      } catch {
        // Fallback: try opening the chat panel with the prompt
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
    }),
  );
}
