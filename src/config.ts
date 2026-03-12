import * as vscode from "vscode";
import type { AnalysisOptions, QualitasConfig } from "qualitas";
import { existsSync } from "fs";
import { join, dirname, resolve } from "path";

// ── Extension behavior settings (from VS Code settings) ─────────────────────

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
  const cfg = vscode.workspace.getConfiguration("qualitas");

  return {
    enable: cfg.get("enable", true),
    analyzeOnSave: cfg.get("analyzeOnSave", true),
    analyzeOnChange: cfg.get("analyzeOnChange", true),
    changeDelay: cfg.get("changeDelay", 1000),
    showInlineScores: cfg.get("showInlineScores", true),
    showStatusBar: cfg.get("showStatusBar", true),
    scoreThreshold: cfg.get("scoreThreshold", 65),
  };
}

// ── Project analysis settings (from qualitas.config.js) ─────────────────────

const CONFIG_FILENAME = "qualitas.config.js";

let cachedConfig: QualitasConfig | null = null;
let cachedConfigDir: string | null = null;

export function loadProjectConfig(): QualitasConfig {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) return {};

  // Return cached if workspace hasn't changed
  if (cachedConfig && cachedConfigDir === workspaceRoot) return cachedConfig;

  cachedConfigDir = workspaceRoot;
  cachedConfig = loadConfigFromDir(workspaceRoot);
  return cachedConfig;
}

export function clearConfigCache(): void {
  cachedConfig = null;
  cachedConfigDir = null;
}

function loadConfigFromDir(startDir: string): QualitasConfig {
  try {
    const configPath = findConfigFile(startDir);
    if (!configPath) return {};
    // Clear require cache to pick up changes
    delete require.cache[require.resolve(configPath)];
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Dynamic config file loading
    const loaded = require(configPath);
    return (
      loaded && typeof loaded === "object" ? loaded : {}
    ) as QualitasConfig;
  } catch {
    return {};
  }
}

function findConfigFile(startDir: string): string | null {
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, CONFIG_FILENAME);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// ── Build analysis options from project config ──────────────────────────────

export function getAnalysisOptions(
  projectConfig: QualitasConfig,
): AnalysisOptions {
  return {
    profile: projectConfig.profile ?? "default",
    refactoringThreshold: projectConfig.threshold ?? 65,
    includeTests: projectConfig.includeTests ?? false,
    ...(projectConfig.weights ? { weights: projectConfig.weights } : {}),
    ...(projectConfig.flags ? { flagOverrides: projectConfig.flags } : {}),
    ...(projectConfig.exclude ? { exclude: projectConfig.exclude } : {}),
    ...(projectConfig.extensions
      ? { extensions: projectConfig.extensions }
      : {}),
  };
}
