export function addHandler(element: EventTarget, ...args: [string, (event: Event) => void, boolean?]) {
  element.addEventListener(...args);
  return () => element.removeEventListener(...args);
}

export function isContentEditable(element: HTMLElement) {
  return element.nodeName !== 'INPUT' && element.nodeName !== 'TEXTAREA';
}

export function isNotContentEditable(element: unknown): element is HTMLInputElement | HTMLTextAreaElement {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

export function isKeyOfObject<T extends object>(key: string | number | symbol, obj: T | undefined): key is keyof T {
  if (!obj) return false;

  return key in obj;
}

export function debounce<F extends (...args: unknown[]) => void>(func: F, wait: number, immediate = false) {
  let timeout: ReturnType<typeof setTimeout> | null;
  return function (this: ThisParameterType<F>, ...args: Parameters<F>) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };
    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(this, args);
  };
}
