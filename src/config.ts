import * as vscode from 'vscode';

export interface QualitasExtensionConfig {
  enable: boolean;
  analyzeOnSave: boolean;
  analyzeOnChange: boolean;
  changeDelay: number;
  showInlineScores: boolean;
  showStatusBar: boolean;
  scoreThreshold: number;
}

export function getConfig(): QualitasExtensionConfig {
  const cfg = vscode.workspace.getConfiguration('qualitas');
  return {
    enable: cfg.get('enable', true),
    analyzeOnSave: cfg.get('analyzeOnSave', true),
    analyzeOnChange: cfg.get('analyzeOnChange', true),
    changeDelay: cfg.get('changeDelay', 1000),
    showInlineScores: cfg.get('showInlineScores', true),
    showStatusBar: cfg.get('showStatusBar', true),
    scoreThreshold: cfg.get('scoreThreshold', 65),
  };
}
