import { analyzeDocument } from '../src/analyzer';

describe('analyzeDocument', () => {
  it('analyzes a simple function and returns a report', () => {
    const report = analyzeDocument(
      'function add(a: number, b: number) { return a + b; }',
      'test.ts',
    );
    expect(report).toBeDefined();
    expect(report.score).toBeGreaterThan(0);
    expect(report.grade).toBe('A');
    expect(report.functionCount).toBe(1);
  });

  it('detects complex functions with low scores', () => {
    const source = `
function complex(a: any, b: any, c: any, d: any, e: any, f: any) {
  for (const x of a) {
    if (x.status === 'pending') {
      if (x.items && x.items.length > 0) {
        for (const item of x.items) {
          if (item.quantity > 0) {
            try {
              if (b.isValid(item)) {
                if (c.dryRun || c.verbose && d.level === 'debug') {
                  d.info('processing');
                }
              }
            } catch (err: any) {
              if (err.code === 'NETWORK') {
                d.error(err.message);
              }
            }
          }
        }
      }
    }
  }
}`;
    const report = analyzeDocument(source, 'complex.ts');
    expect(report.functions[0].score).toBeLessThan(80);
    expect(report.functions[0].flags.length).toBeGreaterThan(0);
  });

  it('throws for unsupported file types', () => {
    expect(() => analyzeDocument('content', 'file.xyz')).toThrow('Unsupported file type');
  });

  it('handles empty source', () => {
    const report = analyzeDocument('', 'empty.ts');
    expect(report.functionCount).toBe(0);
    expect(report.score).toBeGreaterThanOrEqual(0);
  });
});
