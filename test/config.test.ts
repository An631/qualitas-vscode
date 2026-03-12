import { workspace } from "vscode";
import { getConfig, getAnalysisOptions } from "../src/config";
import type { QualitasConfig } from "qualitas";

describe("getConfig", () => {
  it("returns default extension behavior values", () => {
    const cfg = getConfig();
    expect(cfg.enable).toBe(true);
    expect(cfg.analyzeOnSave).toBe(true);
    expect(cfg.analyzeOnChange).toBe(true);
    expect(cfg.changeDelay).toBe(1000);
    expect(cfg.showInlineScores).toBe(true);
    expect(cfg.showStatusBar).toBe(true);
    expect(cfg.scoreThreshold).toBe(65);
  });

  it("reads extension behavior from vscode settings", () => {
    const mockGet = jest.fn((key: string, defaultValue: unknown) => {
      if (key === "enable") return false;
      if (key === "changeDelay") return 2000;
      if (key === "scoreThreshold") return 80;
      return defaultValue;
    });
    (workspace.getConfiguration as jest.Mock).mockReturnValueOnce({
      get: mockGet,
    });

    const cfg = getConfig();
    expect(cfg.enable).toBe(false);
    expect(cfg.changeDelay).toBe(2000);
    expect(cfg.scoreThreshold).toBe(80);
    expect(workspace.getConfiguration).toHaveBeenCalledWith("qualitas");
  });

  it("does not include analysis settings", () => {
    const cfg = getConfig();
    expect(cfg).not.toHaveProperty("analysisOptions");
    expect(cfg).not.toHaveProperty("qualitasConfig");
    expect(cfg).not.toHaveProperty("profile");
    expect(cfg).not.toHaveProperty("weights");
    expect(cfg).not.toHaveProperty("flagOverrides");
  });
});

describe("getAnalysisOptions", () => {
  it("returns defaults for empty project config", () => {
    const opts = getAnalysisOptions({});
    expect(opts.profile).toBe("default");
    expect(opts.refactoringThreshold).toBe(65);
    expect(opts.includeTests).toBe(false);
  });

  it("maps project config fields to analysis options", () => {
    const projectConfig: QualitasConfig = {
      profile: "strict",
      threshold: 80,
      includeTests: true,
      exclude: ["vendor"],
      extensions: [".ts"],
      weights: {
        cognitiveFlow: 0.4,
        dataComplexity: 0.2,
        identifierReference: 0.15,
        dependencyCoupling: 0.1,
        structural: 0.15,
      },
      flags: { highCognitiveFlow: { warn: 10, error: 20 } },
    };

    const opts = getAnalysisOptions(projectConfig);
    expect(opts.profile).toBe("strict");
    expect(opts.refactoringThreshold).toBe(80);
    expect(opts.includeTests).toBe(true);
    expect(opts.exclude).toEqual(["vendor"]);
    expect(opts.extensions).toEqual([".ts"]);
    expect(opts.weights?.cognitiveFlow).toBe(0.4);
    expect(opts.flagOverrides).toEqual({
      highCognitiveFlow: { warn: 10, error: 20 },
    });
  });
});
