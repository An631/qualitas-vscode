import { analyzeProject, analyzeSource, type AnalysisOptions, type FileQualityReport, type ProjectQualityReport } from 'qualitas';

export function analyzeDocument(
  source: string,
  fileName: string,
  options: AnalysisOptions = {},
): FileQualityReport {
  return analyzeSource(source, fileName, options);
}

export async function analyzeWorkspace(
  dirPath: string,
  options: AnalysisOptions = {},
): Promise<ProjectQualityReport> {
  return analyzeProject(dirPath, options);
}
