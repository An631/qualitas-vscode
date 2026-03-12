// Minimal vscode module mock for unit tests

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

export class Range {
  constructor(
    public readonly start: Position | number,
    public readonly end: Position | number,
    startChar?: number,
    endChar?: number,
  ) {
    if (typeof start === "number") {
      this.start = new Position(start, startChar ?? 0);
      this.end = new Position(end as number, endChar ?? 0);
    }
  }
}

export class Diagnostic {
  source?: string;
  code?: string | number;

  constructor(
    public readonly range: Range,
    public readonly message: string,
    public readonly severity: DiagnosticSeverity,
  ) {}
}

export const languages = {
  createDiagnosticCollection: jest.fn(() => ({
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    dispose: jest.fn(),
  })),
};

export const window = {
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    clear: jest.fn(),
    show: jest.fn(),
    dispose: jest.fn(),
  })),
  createStatusBarItem: jest.fn(() => ({
    text: "",
    tooltip: "",
    command: "",
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
  })),
  createTextEditorDecorationType: jest.fn(() => ({
    dispose: jest.fn(),
  })),
};

export const workspace = {
  getConfiguration: jest.fn(() => ({
    get: jest.fn((key: string, defaultValue: unknown) => defaultValue),
  })),
};

export const StatusBarAlignment = {
  Left: 1,
  Right: 2,
};
