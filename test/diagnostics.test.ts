import * as vscode from 'vscode';
import { createDiagnosticCollection, updateDiagnostics } from '../src/diagnostics';
import type { FileQualityReport, FunctionQualityReport, RefactoringFlag } from 'qualitas';

function makeFlag(overrides: Partial<RefactoringFlag> = {}): RefactoringFlag {
  return {
    flagType: 'HIGH_COGNITIVE_FLOW',
    severity: 'error',
    message: 'CFC is too high',
    suggestion: 'Extract nested branches',
    observedValue: 51,
    threshold: 19,
    ...overrides,
  };
}

function makeFunction(overrides: Partial<FunctionQualityReport> = {}): FunctionQualityReport {
  return {
    name: 'testFn',
    score: 45,
    grade: 'C',
    needsRefactoring: true,
    flags: [makeFlag()],
    metrics: {} as FunctionQualityReport['metrics'],
    scoreBreakdown: {} as FunctionQualityReport['scoreBreakdown'],
    location: { file: 'test.ts', startLine: 5, endLine: 15, startCol: 0, endCol: 0 },
    isAsync: false,
    isGenerator: false,
    ...overrides,
  };
}

function makeReport(overrides: Partial<FileQualityReport> = {}): FileQualityReport {
  return {
    filePath: 'test.ts',
    score: 75,
    grade: 'B',
    needsRefactoring: false,
    flags: [],
    functions: [makeFunction()],
    classes: [],
    fileDependencies: {} as FileQualityReport['fileDependencies'],
    totalLines: 50,
    functionCount: 1,
    classCount: 0,
    flaggedFunctionCount: 1,
    ...overrides,
  };
}

describe('createDiagnosticCollection', () => {
  it('creates a diagnostic collection via vscode API', () => {
    const collection = createDiagnosticCollection();
    expect(vscode.languages.createDiagnosticCollection).toHaveBeenCalledWith('qualitas');
    expect(collection).toBeDefined();
  });
});

describe('updateDiagnostics', () => {
  it('creates diagnostics from function flags', () => {
    const collection = { set: jest.fn(), delete: jest.fn(), clear: jest.fn(), dispose: jest.fn() };
    const uri = { toString: () => 'file:///test.ts' } as unknown as vscode.Uri;
    const report = makeReport();

    updateDiagnostics(collection as unknown as vscode.DiagnosticCollection, uri, report);

    expect(collection.set).toHaveBeenCalledTimes(1);
    const [setUri, diagnostics] = collection.set.mock.calls[0];
    expect(setUri).toBe(uri);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].source).toBe('qualitas');
    expect(diagnostics[0].code).toBe('HIGH_COGNITIVE_FLOW');
    expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Warning);
  });

  it('maps error severity to Warning', () => {
    const collection = { set: jest.fn(), delete: jest.fn(), clear: jest.fn(), dispose: jest.fn() };
    const uri = {} as vscode.Uri;
    const report = makeReport({
      functions: [makeFunction({ flags: [makeFlag({ severity: 'error' })] })],
    });

    updateDiagnostics(collection as unknown as vscode.DiagnosticCollection, uri, report);
    const diagnostics = collection.set.mock.calls[0][1];
    expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Warning);
  });

  it('maps warning severity to Information', () => {
    const collection = { set: jest.fn(), delete: jest.fn(), clear: jest.fn(), dispose: jest.fn() };
    const uri = {} as vscode.Uri;
    const report = makeReport({
      functions: [makeFunction({ flags: [makeFlag({ severity: 'warning' })] })],
    });

    updateDiagnostics(collection as unknown as vscode.DiagnosticCollection, uri, report);
    const diagnostics = collection.set.mock.calls[0][1];
    expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Information);
  });

  it('maps info severity to Hint', () => {
    const collection = { set: jest.fn(), delete: jest.fn(), clear: jest.fn(), dispose: jest.fn() };
    const uri = {} as vscode.Uri;
    const report = makeReport({
      functions: [makeFunction({ flags: [makeFlag({ severity: 'info' })] })],
    });

    updateDiagnostics(collection as unknown as vscode.DiagnosticCollection, uri, report);
    const diagnostics = collection.set.mock.calls[0][1];
    expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Hint);
  });

  it('includes metric and suggestion in diagnostic message', () => {
    const collection = { set: jest.fn(), delete: jest.fn(), clear: jest.fn(), dispose: jest.fn() };
    const uri = {} as vscode.Uri;
    const report = makeReport();

    updateDiagnostics(collection as unknown as vscode.DiagnosticCollection, uri, report);
    const msg = collection.set.mock.calls[0][1][0].message;
    expect(msg).toContain('testFn');
    expect(msg).toContain('51 (threshold: 19)');
    expect(msg).toContain('Extract nested branches');
  });

  it('creates diagnostics for class method flags', () => {
    const collection = { set: jest.fn(), delete: jest.fn(), clear: jest.fn(), dispose: jest.fn() };
    const uri = {} as vscode.Uri;
    const method = makeFunction({ name: 'myMethod' });
    const report = makeReport({
      functions: [],
      classes: [
        {
          name: 'MyClass',
          score: 80,
          grade: 'A',
          needsRefactoring: false,
          flags: [],
          structuralMetrics: {} as any,
          methods: [method],
          location: { file: 'test.ts', startLine: 1, endLine: 20, startCol: 0, endCol: 0 },
        },
      ],
    });

    updateDiagnostics(collection as unknown as vscode.DiagnosticCollection, uri, report);
    const diagnostics = collection.set.mock.calls[0][1];
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('myMethod');
  });

  it('produces no diagnostics when there are no flags', () => {
    const collection = { set: jest.fn(), delete: jest.fn(), clear: jest.fn(), dispose: jest.fn() };
    const uri = {} as vscode.Uri;
    const report = makeReport({
      functions: [makeFunction({ flags: [] })],
    });

    updateDiagnostics(collection as unknown as vscode.DiagnosticCollection, uri, report);
    const diagnostics = collection.set.mock.calls[0][1];
    expect(diagnostics).toHaveLength(0);
  });
});
