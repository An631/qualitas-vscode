import { debounce } from "../src/debounce";

jest.useFakeTimers();

describe("debounce", () => {
  it("delays function execution", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 500);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("resets timer on subsequent calls", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 500);

    debounced();
    jest.advanceTimersByTime(300);
    debounced();
    jest.advanceTimersByTime(300);

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("passes arguments to the debounced function", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced("a", "b");
    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith("a", "b");
  });

  it("cancel prevents execution", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 500);

    debounced();
    debounced.cancel();
    jest.advanceTimersByTime(500);

    expect(fn).not.toHaveBeenCalled();
  });

  it("cancel is safe to call when no timer is pending", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 500);

    expect(() => debounced.cancel()).not.toThrow();
  });
});
