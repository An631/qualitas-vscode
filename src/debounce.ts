// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): T & { cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debounced = ((...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T & { cancel(): void };

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return debounced;
}
