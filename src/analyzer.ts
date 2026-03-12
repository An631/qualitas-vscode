import {
  analyzeProject,
  analyzeSource,
  type AnalysisOptions,
  type FileQualityReport,
  type ProjectQualityReport,
  type QualitasConfig,
} from "qualitas";

export function analyzeDocument(
  source: string,
  fileName: string,
  options: AnalysisOptions = {},
  config?: QualitasConfig,
): FileQualityReport {
  return analyzeSource(source, fileName, options, config);
}

export async function analyzeWorkspace(
  dirPath: string,
  options: AnalysisOptions = {},
): Promise<ProjectQualityReport> {
  return analyzeProject(dirPath, options);
}
