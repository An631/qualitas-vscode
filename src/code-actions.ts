import * as vscode from 'vscode';

export class QualitasCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diag of context.diagnostics) {
      if (diag.source !== 'qualitas') continue;

      // Extract suggestion from the flag — stored in the diagnostic's relatedInformation
      // or we can look it up from the cached report
      const action = new vscode.CodeAction(
        `Qualitas: ${diag.message}`,
        vscode.CodeActionKind.QuickFix,
      );
      action.diagnostics = [diag];
      action.isPreferred = false;
      actions.push(action);
    }

    return actions;
  }
}
