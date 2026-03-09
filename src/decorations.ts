import * as vscode from 'vscode';
import type { FileQualityReport, Grade, FunctionQualityReport } from 'qualitas';

const GRADE_COLORS: Record<Grade, string> = {
  A: '#4caf50',
  B: '#00bcd4',
  C: '#ffc107',
  D: '#ff5722',
  F: '#d32f2f',
};

let decorationTypes: Map<Grade, vscode.TextEditorDecorationType> | null = null;

function getDecorationTypes(): Map<Grade, vscode.TextEditorDecorationType> {
  if (decorationTypes) return decorationTypes;
  decorationTypes = new Map();
  for (const grade of ['A', 'B', 'C', 'D', 'F'] as Grade[]) {
    decorationTypes.set(
      grade,
      vscode.window.createTextEditorDecorationType({
        after: {
          color: GRADE_COLORS[grade],
          margin: '0 0 0 1em',
          fontWeight: 'normal',
          fontStyle: 'normal',
        },
        isWholeLine: false,
      }),
    );
  }
  return decorationTypes;
}

export function updateDecorations(
  editor: vscode.TextEditor,
  report: FileQualityReport,
): void {
  const types = getDecorationTypes();
  const byGrade = new Map<Grade, vscode.DecorationOptions[]>();
  for (const grade of ['A', 'B', 'C', 'D', 'F'] as Grade[]) {
    byGrade.set(grade, []);
  }

  const addDecoration = (fn: FunctionQualityReport) => {
    const line = fn.location.startLine - 1;
    const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
    byGrade.get(fn.grade)!.push({
      range,
      renderOptions: {
        after: {
          contentText: `  * ${fn.grade} ${fn.score.toFixed(1)}`,
        },
      },
    });
  };

  for (const fn of report.functions) addDecoration(fn);
  for (const cls of report.classes) {
    for (const method of cls.methods) addDecoration(method);
  }

  for (const [grade, decorations] of byGrade) {
    editor.setDecorations(types.get(grade)!, decorations);
  }
}

export function clearDecorations(editor: vscode.TextEditor): void {
  if (!decorationTypes) return;
  for (const type of decorationTypes.values()) {
    editor.setDecorations(type, []);
  }
}

export function disposeDecorations(): void {
  if (!decorationTypes) return;
  for (const type of decorationTypes.values()) {
    type.dispose();
  }
  decorationTypes = null;
}
