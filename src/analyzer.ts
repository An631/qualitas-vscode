import type { FileQualityReport } from 'qualitas';

let analyzeSourceFn: ((source: string, fileName: string) => FileQualityReport) | null = null;

function getAnalyzer() {
  if (analyzeSourceFn) return analyzeSourceFn;
  // Lazy-load to avoid startup cost
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const qualitas = require('qualitas') as typeof import('qualitas');
  analyzeSourceFn = qualitas.analyzeSource;
  return analyzeSourceFn;
}

export function analyzeDocument(source: string, fileName: string): FileQualityReport {
  return getAnalyzer()(source, fileName);
}
