import { workspace } from 'vscode';
import { getConfig } from '../src/config';

describe('getConfig', () => {
  it('returns default values', () => {
    const cfg = getConfig();
    expect(cfg.enable).toBe(true);
    expect(cfg.analyzeOnSave).toBe(true);
    expect(cfg.analyzeOnChange).toBe(true);
    expect(cfg.changeDelay).toBe(1000);
    expect(cfg.showInlineScores).toBe(true);
    expect(cfg.showStatusBar).toBe(true);
  });

  it('reads from vscode workspace configuration', () => {
    const mockGet = jest.fn((key: string, defaultValue: unknown) => {
      if (key === 'enable') return false;
      if (key === 'changeDelay') return 2000;
      return defaultValue;
    });
    (workspace.getConfiguration as jest.Mock).mockReturnValueOnce({ get: mockGet });

    const cfg = getConfig();
    expect(cfg.enable).toBe(false);
    expect(cfg.changeDelay).toBe(2000);
    expect(workspace.getConfiguration).toHaveBeenCalledWith('qualitas');
  });
});
