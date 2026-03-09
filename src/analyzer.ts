import type { AnalysisOptions, FileQualityReport, ProjectQualityReport } from 'qualitas';

// eslint-disable-next-line @typescript-eslint/no-require-imports
let qualitasModule: typeof import('qualitas') | null = null;

function getQualitas() {
  if (qualitasModule) return qualitasModule;
  // Lazy-load to avoid startup cost
  qualitasModule = require('qualitas') as typeof import('qualitas');
  return qualitasModule;
}

export function analyzeDocument(
  source: string,
  fileName: string,
  options: AnalysisOptions = {},
): FileQualityReport {
  return getQualitas().analyzeSource(source, fileName, options);
}

export async function analyzeWorkspace(
  dirPath: string,
  options: AnalysisOptions = {},
): Promise<ProjectQualityReport> {
  return getQualitas().analyzeProject(dirPath, options);
}
