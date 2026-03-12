import * as vscode from "vscode";
import {
  createDiagnosticCollection,
  updateDiagnostics,
} from "../src/diagnostics";
import type {
  FileQualityReport,
  FunctionQualityReport,
  RefactoringFlag,
} from "qualitas";

function makeFlag(overrides: Partial<RefactoringFlag> = {}): RefactoringFlag {
  return {
    flagType: "HIGH_COGNITIVE_FLOW",
    severity: "error",
    message: "CFC is too high",
    suggestion: "Extract nested branches",
    observedValue: 51,
    threshold: 19,
    ...overrides,
  };
}

function makeFunction(
  overrides: Partial<FunctionQualityReport> = {},
): FunctionQualityReport {
  return {
    name: "testFn",
    score: 45,
    grade: "C",
    needsRefactoring: true,
    flags: [makeFlag()],
    metrics: {} as FunctionQualityReport["metrics"],
    scoreBreakdown: {} as FunctionQualityReport["scoreBreakdown"],
    location: {
      file: "test.ts",
      startLine: 5,
      endLine: 15,
      startCol: 0,
      endCol: 0,
    },
    isAsync: false,
    isGenerator: false,
    ...overrides,
  };
}

function makeReport(
  overrides: Partial<FileQualityReport> = {},
): FileQualityReport {
  return {
    filePath: "test.ts",
    score: 75,
    grade: "B",
    needsRefactoring: false,
    flags: [],
    functions: [makeFunction()],
    classes: [],
    fileDependencies: {} as FileQualityReport["fileDependencies"],
    totalLines: 50,
    functionCount: 1,
    classCount: 0,
    flaggedFunctionCount: 1,
    ...overrides,
  };
}

const mockCollection = () => ({
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  dispose: jest.fn(),
});

describe("createDiagnosticCollection", () => {
  it("creates a diagnostic collection via vscode API", () => {
    const collection = createDiagnosticCollection();
    expect(vscode.languages.createDiagnosticCollection).toHaveBeenCalledWith(
      "qualitas",
    );
    expect(collection).toBeDefined();
  });
});

describe("updateDiagnostics", () => {
  it("creates a diagnostic for a function with flags", () => {
    const collection = mockCollection();
    const uri = {} as vscode.Uri;
    const report = makeReport();

    updateDiagnostics(
      collection as unknown as vscode.DiagnosticCollection,
      uri,
      report,
    );

    const diagnostics = collection.set.mock.calls[0][1];
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].source).toBe("qualitas");
  });

  it("uses Warning severity when flags have error severity", () => {
    const collection = mockCollection();
    const uri = {} as vscode.Uri;
    const report = makeReport({
      functions: [makeFunction({ flags: [makeFlag({ severity: "error" })] })],
    });

    updateDiagnostics(
      collection as unknown as vscode.DiagnosticCollection,
      uri,
      report,
    );
    const diagnostics = collection.set.mock.calls[0][1];
    expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Warning);
  });

  it("uses Information severity when only warning flags", () => {
    const collection = mockCollection();
    const uri = {} as vscode.Uri;
    const report = makeReport({
      functions: [makeFunction({ flags: [makeFlag({ severity: "warning" })] })],
    });

    updateDiagnostics(
      collection as unknown as vscode.DiagnosticCollection,
      uri,
      report,
    );
    const diagnostics = collection.set.mock.calls[0][1];
    expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Information);
  });

  it("includes score and flag details in the message", () => {
    const collection = mockCollection();
    const uri = {} as vscode.Uri;
    const report = makeReport();

    updateDiagnostics(
      collection as unknown as vscode.DiagnosticCollection,
      uri,
      report,
    );
    const msg = collection.set.mock.calls[0][1][0].message;
    expect(msg).toContain("testFn scored C (45.0/100)");
    expect(msg).toContain("CFC is too high");
    expect(msg).toContain("Extract nested branches");
  });

  it("flags functions below score threshold even without flags", () => {
    const collection = mockCollection();
    const uri = {} as vscode.Uri;
    const report = makeReport({
      functions: [makeFunction({ score: 60, grade: "C", flags: [] })],
    });

    updateDiagnostics(
      collection as unknown as vscode.DiagnosticCollection,
      uri,
      report,
      { document: undefined, scoreThreshold: 65 },
    );
    const diagnostics = collection.set.mock.calls[0][1];
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("scored C (60.0/100)");
    expect(diagnostics[0].message).toContain("below the threshold of 65");
  });

  it("does not flag functions above score threshold with no flags", () => {
    const collection = mockCollection();
    const uri = {} as vscode.Uri;
    const report = makeReport({
      functions: [makeFunction({ score: 90, grade: "A", flags: [] })],
    });

    updateDiagnostics(
      collection as unknown as vscode.DiagnosticCollection,
      uri,
      report,
      { document: undefined, scoreThreshold: 65 },
    );
    const diagnostics = collection.set.mock.calls[0][1];
    expect(diagnostics).toHaveLength(0);
  });

  it("creates diagnostics for class and its flagged methods", () => {
    const collection = mockCollection();
    const uri = {} as vscode.Uri;
    const method = makeFunction({ name: "myMethod" });
    const report = makeReport({
      functions: [],
      classes: [
        {
          name: "MyClass",
          score: 80,
          grade: "A",
          needsRefactoring: false,
          flags: [],
          structuralMetrics:
            {} as unknown as import("qualitas").StructuralResult,
          methods: [method],
          location: {
            file: "test.ts",
            startLine: 1,
            endLine: 20,
            startCol: 0,
            endCol: 0,
          },
        },
      ],
    });

    updateDiagnostics(
      collection as unknown as vscode.DiagnosticCollection,
      uri,
      report,
    );
    const diagnostics = collection.set.mock.calls[0][1];
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0].message).toContain("class MyClass");
    expect(diagnostics[1].message).toContain("myMethod scored");
  });

  it("flags class below threshold even without flags", () => {
    const collection = mockCollection();
    const uri = {} as vscode.Uri;
    const report = makeReport({
      functions: [],
      classes: [
        {
          name: "WeakClass",
          score: 50,
          grade: "C",
          needsRefactoring: true,
          flags: [],
          structuralMetrics:
            {} as unknown as import("qualitas").StructuralResult,
          methods: [makeFunction({ score: 90, grade: "A", flags: [] })],
          location: {
            file: "test.ts",
            startLine: 1,
            endLine: 20,
            startCol: 0,
            endCol: 0,
          },
        },
      ],
    });

    updateDiagnostics(
      collection as unknown as vscode.DiagnosticCollection,
      uri,
      report,
      { document: undefined, scoreThreshold: 65 },
    );
    const diagnostics = collection.set.mock.calls[0][1];
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("class WeakClass scored C");
    expect(diagnostics[0].message).toContain("below the threshold of 65");
  });

  it("produces no diagnostics when everything passes", () => {
    const collection = mockCollection();
    const uri = {} as vscode.Uri;
    const report = makeReport({
      functions: [makeFunction({ score: 90, grade: "A", flags: [] })],
    });

    updateDiagnostics(
      collection as unknown as vscode.DiagnosticCollection,
      uri,
      report,
    );
    const diagnostics = collection.set.mock.calls[0][1];
    expect(diagnostics).toHaveLength(0);
  });

  it("consolidates multiple flags into one diagnostic", () => {
    const collection = mockCollection();
    const uri = {} as vscode.Uri;
    const report = makeReport({
      functions: [
        makeFunction({
          flags: [
            makeFlag({ message: "CFC is too high" }),
            makeFlag({ message: "Too many parameters" }),
          ],
        }),
      ],
    });

    updateDiagnostics(
      collection as unknown as vscode.DiagnosticCollection,
      uri,
      report,
    );
    const diagnostics = collection.set.mock.calls[0][1];
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("CFC is too high");
    expect(diagnostics[0].message).toContain("Too many parameters");
  });
});
