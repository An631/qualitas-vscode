import * as vscode from "vscode";
import type { FileQualityReport, FunctionQualityReport } from "qualitas";

export class QualitasCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

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

  private filterQualitasDiagnostics({
    diagnostics,
  }: vscode.CodeActionContext): vscode.Diagnostic[] {
    return diagnostics.filter((diag) => diag.source === "qualitas");
  }

  private createFixActions(
    diagnostics: vscode.Diagnostic[],
  ): vscode.CodeAction[] {
    return diagnostics.map((diag) => {
      const action = new vscode.CodeAction(
        "Qualitas: Fix with AI",
        vscode.CodeActionKind.QuickFix,
      );
      action.diagnostics = [diag];
      action.command = {
        title: "Qualitas: Fix with AI",
        command: "qualitas.fixWithAI",
        arguments: [diag],
      };
      return action;
    });
  }

  private createFixAllAction(): vscode.CodeAction {
    const fixAll = new vscode.CodeAction(
      "Qualitas: Fix all issues with AI",
      vscode.CodeActionKind.QuickFix,
    );
    fixAll.command = {
      title: "Qualitas: Fix all issues with AI",
      command: "qualitas.fixAllWithAI",
    };
    return fixAll;
  }
}

export interface AICommandDeps {
  getReport: (uri: string) => FileQualityReport | undefined;
  getThreshold: () => number;
}

export function registerAICommands(
  context: vscode.ExtensionContext,
  deps: AICommandDeps,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "qualitas.fixWithAI",
      async (diag: vscode.Diagnostic) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        editor.selection = new vscode.Selection(
          diag.range.start,
          diag.range.end,
        );

        const file = editor.document.uri.fsPath;
        const line = diag.range.start.line + 1;
        const prompt = `Refactor the code at ${file}:${line} to fix the following quality issue:
${diag.message}

Requirements:,
- If you need to split a function consider this:
  - Before creating new functions with a function split, verify if the code base already has a helper function that can replace the new function that will be created, try to reduce code duplication when possible. 
  - If you create new functions, ensure those also meet the quality threshold (you can run npx qualitas ./path/to/file -f flagged to re-check the quality of the new functions).
- It is critical that we preserve the existing code behavior after the refactor.
`;

        await openAIChat(prompt);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("qualitas.fixAllWithAI", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("Qualitas: Open a file first.");
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
      const filePath = editor.document.uri.fsPath;
      const prompt = buildFixAllPrompt(report, scoreThreshold, filePath);

      if (!prompt) {
        vscode.window.showInformationMessage(
          "Qualitas: No issues found in this file.",
        );
        return;
      }

      selectEntireFile(editor);
      await openAIChat(prompt);
    }),
  );
}

function selectEntireFile(editor: vscode.TextEditor): void {
  const lastLine = editor.document.lineCount - 1;
  editor.selection = new vscode.Selection(
    0,
    0,
    lastLine,
    editor.document.lineAt(lastLine).text.length,
  );
}

async function openAIChat(prompt: string): Promise<void> {
  try {
    await vscode.commands.executeCommand("workbench.action.chat.open", {
      query: prompt,
    });
  } catch {
    vscode.window.showInformationMessage(
      "Qualitas: No AI chat found. Install GitHub Copilot or another AI extension to use this feature.",
    );
  }
}

function buildFixAllPrompt(
  report: FileQualityReport,
  threshold: number,
  filePath?: string,
): string | null {
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

  return buildPromptMessage(issues, threshold, filePath);
}

function formatLocation(file: string, line: number): string {
  return file ? `${file}:${line}` : `line ${line}`;
}

function formatIssueHeader(
  name: string,
  loc: string,
  grade: string,
  score: number,
): string[] {
  return [
    `## ${name} at ${loc}`,
    `   Score: ${grade} (${score.toFixed(1)}/100)`,
  ];
}

function formatThresholdWarning(score: number, threshold: number): string[] {
  return score < threshold
    ? [`   Score is below the threshold of ${threshold}.`]
    : [];
}

function formatFlagList(
  flags: Array<{ message: string; suggestion: string }>,
): string[] {
  if (flags.length === 0) return [];
  const lines = ["   Issues:"];
  for (const flag of flags) {
    lines.push(`   - ${flag.message}`);
    lines.push(`     ${flag.suggestion}`);
  }
  return lines;
}

function collectFunctionIssues(
  fn: FunctionQualityReport,
  issues: string[],
  threshold: number,
): void {
  if (fn.flags.length === 0 && fn.score >= threshold) return;

  const loc = formatLocation(fn.location.file, fn.location.startLine);
  const parts = [
    ...formatIssueHeader(`${fn.name}()`, loc, fn.grade, fn.score),
    ...formatThresholdWarning(fn.score, threshold),
    ...formatFlagList(fn.flags),
  ];

  issues.push(parts.join("\n"));
}

function collectClassIssues(
  cls: {
    name: string;
    score: number;
    grade: string;
    flags: Array<{ message: string; suggestion: string }>;
    location: { file: string; startLine: number };
  },
  issues: string[],
  threshold: number,
): void {
  if (cls.flags.length === 0 && cls.score >= threshold) return;

  const loc = formatLocation(cls.location.file, cls.location.startLine);
  const parts = [
    ...formatIssueHeader(`class ${cls.name}`, loc, cls.grade, cls.score),
    ...formatThresholdWarning(cls.score, threshold),
    ...formatFlagList(cls.flags),
  ];

  issues.push(parts.join("\n"));
}

function buildPromptMessage(
  issues: string[],
  threshold: number,
  filePath?: string,
): string {
  const fileRef = filePath ? ` in ${filePath}` : "";
  const lines = [
    `Refactor the code${fileRef} to fix ${issues.length} quality issue(s).`,
    `The minimum acceptable quality score is ${threshold}/100.`,
    "",
    "Issues to fix:",
    "",
    ...issues.flatMap((issue) => [issue, ""]),
    "",
    "Requirements:",
    "- Refactor each flagged function and class to address the specific issues listed above.",
    "- After refactoring, ensure every function scores above the threshold.",
    "- If splitting a function creates new functions, ensure those also meet the threshold.",
    "- Preserve the existing behavior and public API.",
  ];

  return lines.join("\n");
}
