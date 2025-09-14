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
