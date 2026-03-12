import * as vscode from "vscode";
import type { FileQualityReport, Grade } from "qualitas";

const GRADE_ICONS: Record<Grade, string> = {
  A: "$(pass)",
  B: "$(info)",
  C: "$(warning)",
  D: "$(error)",
  F: "$(error)",
};

let statusBarItem: vscode.StatusBarItem | null = null;

export function createStatusBarItem(): vscode.StatusBarItem {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = "qualitas.showReport";
  statusBarItem.tooltip = "Qualitas - file quality score";
  statusBarItem.show();
  return statusBarItem;
}

export function updateStatusBar(report: FileQualityReport): void {
  if (!statusBarItem) return;
  const icon = GRADE_ICONS[report.grade];
  statusBarItem.text = `${icon} ${report.grade} ${report.score.toFixed(1)}`;
  statusBarItem.show();
}

export function clearStatusBar(): void {
  if (!statusBarItem) return;
  statusBarItem.text = "";
  statusBarItem.hide();
}

export function disposeStatusBar(): void {
  statusBarItem?.dispose();
  statusBarItem = null;
}
