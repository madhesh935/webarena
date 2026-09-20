export function debounce<T extends (...args: never[]) => void>(fn: T, wait: number): T {
  let timer = 0;
  const wrapped = ((...args: Parameters<T>) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  }) as T;
  return wrapped;
}
