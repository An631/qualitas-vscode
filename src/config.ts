import * as vscode from 'vscode';
import type { AnalysisOptions } from 'qualitas';

export interface QualitasExtensionConfig {
  enable: boolean;
  analyzeOnSave: boolean;
  analyzeOnChange: boolean;
  changeDelay: number;
  showInlineScores: boolean;
  showStatusBar: boolean;
  scoreThreshold: number;
  analysisOptions: AnalysisOptions;
}

function getAnalysisOptions(cfg: vscode.WorkspaceConfiguration): AnalysisOptions {
  const weights = cfg.get<Record<string, number>>('weights', {});
  const hasWeights = Object.keys(weights).length > 0;

  const flagOverrides = cfg.get<Record<string, unknown>>('flagOverrides', {});
  const hasFlagOverrides = Object.keys(flagOverrides).length > 0;

  return {
    profile: cfg.get('profile', 'default') as AnalysisOptions['profile'],
    refactoringThreshold: cfg.get('scoreThreshold', 65),
    includeTests: cfg.get('includeTests', false),
    ...(hasWeights ? { weights } : {}),
    ...(hasFlagOverrides ? { flagOverrides: flagOverrides as AnalysisOptions['flagOverrides'] } : {}),
  };
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
    analysisOptions: getAnalysisOptions(cfg),
  };
}
