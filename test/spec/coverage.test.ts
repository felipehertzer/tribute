import { expect } from 'vitest';
import { debounce, isJQuery, isKeyOfObject } from '../../src/helpers';
import Tribute from '../../src/index';
import type { Collection } from '../../src/type';
import { clearDom, createDomElement, fillIn, press, simulateMouseClick } from './utils/dom-helpers';
import { attachTribute, detachTribute } from './utils/tribute-helpers';

const delay = (ms = 0) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const values = [
  { key: 'Jordan Humphreys', value: 'Jordan Humphreys' },
  { key: 'Sir Walter Riley', value: 'Sir Walter Riley' },
];

const getLastTextNode = (node: Node): Text | undefined => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node as Text;
  }

  for (let index = node.childNodes.length - 1; index >= 0; index--) {
    const textNode = getLastTextNode(node.childNodes[index]);
    if (textNode) {
      return textNode;
    }
  }

  return undefined;
};

const placeCaretAtEnd = (element: HTMLElement) => {
  element.focus();
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const end = element.value.length;
    element.setSelectionRange(end, end);
    return;
  }

  const range = document.createRange();
  const textNode = getLastTextNode(element);
  if (textNode) {
    range.setStart(textNode, textNode.textContent?.length || 0);
    range.collapse(true);
  } else {
    range.selectNodeContents(element);
    range.collapse(false);
  }
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

describe('Utility coverage', () => {
  afterEach(() => {
    clearDom();
  });

  it('covers helper edge cases', async () => {
    expect(isKeyOfObject('key', { key: 'value' })).to.equal(true);
    expect(isKeyOfObject('missing', { key: 'value' })).to.equal(false);
    expect(isKeyOfObject('key', undefined)).to.equal(false);

    expect(isJQuery({ jquery: '3.7.0', get: () => [] })).to.equal(true);
    expect(isJQuery({ jquery: '3.7.0' })).to.equal(false);
    expect(isJQuery(null)).to.equal(false);

    let immediateTotal = 0;
    const immediate = debounce(
      function (this: { value: number }, amount: number) {
        immediateTotal += this.value + amount;
      },
      5,
      true,
    );
    immediate.call({ value: 2 }, 3);
    immediate.call({ value: 2 }, 3);
    await delay(10);
    expect(immediateTotal).to.equal(5);

    let delayedTotal = 0;
    const delayed = debounce((amount: number) => {
      delayedTotal += amount;
    }, 5);
    delayed(1);
    delayed(4);
    await delay(10);
    expect(delayedTotal).to.equal(4);
  });

  it('covers search utility branches', () => {
    const tribute = new Tribute<{ key?: string; value?: string | null }>({ values: [] });

    expect(tribute.search.simpleFilter('jo', ['Jordan', 'Walter'])).to.deep.equal(['Jordan']);
    expect(tribute.search.test('zz', 'Jordan')).to.equal(false);
    expect(tribute.search.match('jo', 'Jordan', { caseSensitive: true })).to.equal(null);
    expect(tribute.search.filter('x', [{ value: null }, { value: 'xylophone' }], { extract: (item) => item.value })).to.have.length(1);
    expect(tribute.search.filter('jo', ['Jordan', 'Walter'] as never)).to.have.length(1);
    expect(tribute.search.filter('jo', [{ key: 'Jordan' }] as never)).to.deep.equal([]);

    tribute.autocompleteSeparator = null;
    expect(tribute.search.match('word', 'word')?.rendered).to.equal('word');

    tribute.autocompleteSeparator = /\s+/;
    expect(tribute.search.traverse('abc', { split: () => [] } as never, 0, 0, [])).to.equal(undefined);
    expect(tribute.search.traverse('abc', { split: () => [{ length: 1 }] } as never, 0, 0, [])).to.equal(undefined);
  });
});

describe('Tribute API coverage', () => {
  afterEach(async () => {
    await delay();
    clearDom();
  });

  it('attaches and detaches element collections and jquery-like wrappers', async () => {
    const input = createDomElement();
    const second = document.createElement('input');
    document.querySelector('#tribute-wrapper-div')?.appendChild(second);
    const tribute = new Tribute({ values });

    tribute.attach([input, second]);
    expect(input.getAttribute('data-tribute')).to.equal('true');
    expect(second.getAttribute('data-tribute')).to.equal('true');

    tribute.detach({ jquery: '3.7.0', get: () => [input, second] });
    await delay();
    expect(input.hasAttribute('data-tribute')).to.equal(false);
    expect(second.hasAttribute('data-tribute')).to.equal(false);

    tribute.attach({ jquery: '3.7.0', get: () => [input] });
    expect(input.getAttribute('data-tribute')).to.equal('true');
  });

  it('rejects missing elements and warns on duplicate attachment', () => {
    const input = createDomElement();
    const tribute = new Tribute({ values });

    expect(() => tribute.attach(undefined as never)).to.throw('[Tribute] Must pass in a DOM node or NodeList.');
    expect(() => tribute.detach(undefined as never)).to.throw('[Tribute] Must pass in a DOM node or NodeList.');

    const originalWarn = console.warn;
    let warning = '';
    console.warn = (message?: unknown) => {
      warning = String(message);
    };
    try {
      tribute.attach(input);
      tribute.attach(input);
    } finally {
      console.warn = originalWarn;
    }

    expect(warning).to.contain('Tribute was already bound');
  });

  it('throws when a non-editable element cannot be made contenteditable', () => {
    const tribute = new Tribute({ values });

    expect(() => (tribute as never as { ensureEditable: (element: HTMLElement) => void }).ensureEditable({ nodeName: 'DIV' } as HTMLElement)).to.throw(
      '[Tribute] Cannot bind',
    );
  });

  it('covers append, appendCurrent, and collection construction errors', () => {
    const tribute = new Tribute<{ key: string; value: string }>({ values: [values[0]] });

    tribute.append('0', [values[1]] as never);
    expect(tribute.collection[0].values).to.have.length(2);

    tribute.append('0', [values[0]] as never, true);
    expect(tribute.collection[0].values).to.deep.equal([values[0]]);

    expect(() => tribute.append('not-a-number', [] as never)).to.throw('please provide an index');
    expect(() => new Tribute({ values: (_text, callback) => callback([]) }).append('0', [] as never)).to.throw('Unable to append');
    expect(() => tribute.appendCurrent([], false)).to.throw('No active state');

    tribute.current.collection = tribute.collection[0];
    tribute.isActive = true;
    tribute.appendCurrent([values[1]], false);
    expect(tribute.collection[0].values).to.have.length(2);

    expect(() => new Tribute({})).to.throw('[Tribute] No collection specified.');
  });

  it('uses default select templates for text and contenteditable elements', async () => {
    const input = createDomElement();
    const tribute = attachTribute({ values }, input.id);

    await fillIn(input, '@');
    simulateMouseClick(document.querySelector('.tribute-container > ul > li') as HTMLElement);
    expect(input.value).to.equal('@Jordan Humphreys ');

    detachTribute(tribute, input.id);
    clearDom();

    const editable = createDomElement('contenteditable');
    const editableTribute = attachTribute({ values }, editable.id);
    await fillIn(editable, '@');
    simulateMouseClick(document.querySelector('.tribute-container > ul > li') as HTMLElement);
    expect(editable.innerHTML).to.equal('<span class="tribute-mention">@Jordan Humphreys</span>&nbsp;');

    detachTribute(editableTribute, editable.id);
  });

  it('inserts external triggers at the real caret position', () => {
    const input = createDomElement();
    input.value = 'Hello';
    input.focus();
    input.setSelectionRange(0, 0);

    const tribute = attachTribute({ values }, input.id);
    tribute.showMenuForCollection(input);

    expect(input.value).to.equal('@Hello');
    detachTribute(tribute, input.id);
  });

  it('inserts external triggers into contenteditable elements', () => {
    const editable = createDomElement('contenteditable');
    editable.innerText = 'Hello';
    placeCaretAtEnd(editable);

    const tribute = attachTribute({ values }, editable.id);
    tribute.showMenuForCollection(editable);

    expect(editable.innerText).to.equal('Hello@');
    detachTribute(tribute, editable.id);
  });

  it('normalizes no-match templates', async () => {
    const input = createDomElement();
    const tribute = attachTribute(
      {
        noMatchTemplate: '   ',
        values,
      },
      input.id,
    );

    await fillIn(input, '@zzzz');
    expect(tribute.isActive).to.equal(false);
    detachTribute(tribute, input.id);
  });

  it('throws from the default select template without an active collection', () => {
    const tribute = new Tribute({ values });

    expect(() => tribute.collection[0].selectTemplate?.(undefined, tribute)).to.throw('current Collection is undefined');
  });

  it('falls back to mention text when the default fill attribute is missing', () => {
    const tribute = new Tribute<{ key: string; value?: string }>({ values: [{ key: 'Jordan' }] });
    tribute.current.collection = tribute.collection[0];
    tribute.current.mentionText = 'typed';

    const result = tribute.collection[0].selectTemplate?.({ index: 0, original: { key: 'Jordan' }, score: 0, string: 'Jordan' }, tribute);

    expect(result).to.equal('@typed');

    tribute.current.collection = { ...tribute.collection[0], trigger: undefined as never };
    tribute.current.mentionText = 'fallback';
    const missingValue = tribute.collection[0].selectTemplate?.(
      { index: 0, original: { key: 'Jordan', value: undefined }, score: 0, string: 'Jordan' },
      tribute,
    );
    expect(missingValue).to.equal('fallback');
  });

  it('does not show a menu when maximum item rules block it', () => {
    const input = createDomElement();
    const tribute = attachTribute({ values }, input.id);
    tribute.current.collection = {
      ...tribute.collection[0],
      isBlocked: true,
    };

    tribute.showMenuFor(input);

    expect(tribute.isActive).to.equal(false);
    tribute.current.collection = undefined;
    tribute.showMenuFor(input);
    expect(tribute.isActive).to.equal(false);
    detachTribute(tribute, input.id);
  });

  it('warns for autocomplete collection mode and uses collection default select templates', () => {
    const originalWarn = console.warn;
    let warning = '';
    console.warn = (message?: unknown) => {
      warning = String(message);
    };
    try {
      const tribute = new Tribute({
        autocompleteMode: true,
        collection: [
          {
            selectTemplate: (item) => `custom:${item?.original.value || ''}`,
            values,
          },
          {
            values,
          } as never,
        ],
      });
      tribute.current.collection = tribute.collection[0];
      tribute.current.mentionText = 'typed';
      expect(tribute.collection[0].selectTemplate?.({ index: 0, original: values[0], score: 0, string: values[0].value }, tribute)).to.equal(
        'custom:Jordan Humphreys',
      );
      tribute.current.collection = tribute.collection[1];
      expect(tribute.collection[1].selectTemplate?.({ index: 0, original: values[0], score: 0, string: values[0].value }, tribute)).to.equal(
        'Jordan Humphreys',
      );
    } finally {
      console.warn = originalWarn;
    }

    expect(warning).to.contain('autocomplete mode');
  });

  it('exposes contenteditable detection', () => {
    const input = createDomElement();
    const editable = createDomElement('contenteditable');

    expect(Tribute.isContentEditable(input)).to.equal(false);
    expect(Tribute.isContentEditable(editable)).to.equal(true);
  });
});
describe('Menu coverage', () => {
  afterEach(() => {
    clearDom();
  });

  it('handles inactive menu branches', () => {
    const tribute = new Tribute({ values });

    expect(tribute.menu.items.length).to.equal(0);
    expect(tribute.menu.getDimensions()).to.deep.equal({ width: null, height: null });

    tribute.menu.activate();
    tribute.menu.up(1);
    tribute.menu.down(1);
    tribute.menu.deactivate();
    tribute.menu.setActiveLi(0);
    tribute.menu.positionAtCaret(undefined, {});
  });

  it('handles disabled items, explicit selection, positioning, and element templates', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const tribute = new Tribute<{ key: string; value: string; disabled?: boolean }>({
      values: [
        { key: 'Disabled', value: 'Disabled', disabled: true },
        { key: 'Enabled', value: 'Enabled' },
      ],
      menuContainer: container,
      menuItemTemplate: (item) => {
        const span = document.createElement('span');
        span.textContent = item.original.value;
        return span;
      },
    });
    tribute.current.collection = tribute.collection[0];

    const menuElement = tribute.menu.create(document, 'tribute-container');
    const rendered = tribute.menu.render(
      [
        { index: 0, original: { key: 'Disabled', value: 'Disabled', disabled: true }, score: 0, string: 'Disabled' },
        { index: 1, original: { key: 'Enabled', value: 'Enabled' }, score: 0, string: 'Enabled' },
      ],
      tribute.collection[0] as Collection<{ key: string; value: string; disabled?: boolean }>,
    );

    expect(rendered).to.equal(true);
    expect(menuElement.querySelectorAll('li')).to.have.length(2);
    expect(menuElement.querySelector('li')?.getAttribute('data-disabled')).to.equal('true');

    tribute.menu.setActiveLi(0);
    expect(tribute.menu.selected).to.equal(0);

    tribute.menu.selected = -1;
    tribute.menu.up(2);
    tribute.menu.down(2);
    expect(tribute.menu.selected).to.equal(-1);

    tribute.menu.positionAtCaret(undefined, {});
    expect(menuElement.getAttribute('style')).to.contain('display: none');

    tribute.positionMenu = false;
    tribute.menu.positionAtCaret({}, {});
    expect(menuElement.getAttribute('style')).to.contain('display: block');

    tribute.positionMenu = true;
    tribute.menu.positionAtCaret({}, { top: 'auto', left: 'auto', right: 10, bottom: 20 });
    expect(menuElement.style.top).to.equal('auto');
    expect(menuElement.style.left).to.equal('auto');

    const li = menuElement.querySelectorAll('li')[1] as HTMLElement;
    li.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, movementY: 1 }));
    expect(tribute.menu.selected).to.equal(1);

    tribute.menu.selected = 0;
    tribute.menu.up(2);
    expect(tribute.menu.selected).to.equal(1);

    tribute.menu.down(2);
    expect(tribute.menu.selected).to.equal(1);

    tribute.menu.unselect();
    expect(tribute.menu.selected).to.equal(-1);
  });

  it('adjusts active item scroll positions', () => {
    const tribute = new Tribute<{ key: string; value: string }>({ values });
    const menuElement = tribute.menu.create(document, 'tribute-container');
    tribute.menu.setActiveLi(0);
    tribute.current.collection = tribute.collection[0];
    expect(tribute.menu.render([], { ...tribute.collection[0], noMatchTemplate: null })).to.equal(false);
    tribute.current.collection = tribute.collection[0];
    tribute.menu.render(
      [
        { index: 0, original: values[0], score: 0, string: values[0].value },
        { index: 1, original: values[1], score: 0, string: values[1].value },
      ],
      tribute.collection[0],
    );

    const item = menuElement.querySelectorAll('li')[1] as HTMLElement;
    Object.defineProperty(menuElement, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: 0, bottom: 50, height: 50, left: 0, right: 100, width: 100 }),
    });
    Object.defineProperty(item, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: 40, bottom: 80, height: 40, left: 0, right: 100, width: 100 }),
    });
    tribute.menu.setActiveLi(1);
    expect(tribute.menu.selected).to.equal(1);

    menuElement.scrollTop = 0;
    Object.defineProperty(item, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: -20, bottom: 10, height: 30, left: 0, right: 100, width: 100 }),
    });
    tribute.menu.setActiveLi(1);
    expect(tribute.menu.selected).to.equal(1);
  });

  it('covers render branches before menu creation and null menu item templates', () => {
    const tribute = new Tribute<{ key: string; value: string }>({ values });
    expect(tribute.menu.render([], tribute.collection[0])).to.equal(false);
    expect(
      (tribute.menu as never as { _handleNoItem: (list: HTMLElement, collection: Collection<{ key: string; value: string }>) => boolean })._handleNoItem(
        document.createElement('ul'),
        tribute.collection[0],
      ),
    ).to.equal(false);

    tribute.current.collection = { ...tribute.collection[0], menuItemTemplate: null };
    const menuElement = tribute.menu.create(document, 'tribute-container');
    tribute.menu.render([{ index: 0, original: values[0], score: 0, string: values[0].value }], tribute.current.collection);
    expect(menuElement.querySelector('li')?.innerHTML).to.equal('');
  });
});

describe('Context coverage', () => {
  afterEach(() => {
    clearDom();
  });

  it('returns early or throws for invalid process states', () => {
    const tribute = new Tribute<{ key: string; value: string }>({ values });

    tribute.current.process(false);

    tribute.menu.element = document.createElement('div');
    tribute.current.process(false);

    tribute.current.collection = tribute.collection[0];
    expect(() => tribute.current.process(false)).to.throw('menu do not have "ul" element');
  });

  it('returns early when async values resolve after the menu is inactive', () => {
    const tribute = new Tribute<{ key: string; value: string }>({
      values: (_text, callback) => callback(values),
    });
    const input = createDomElement();
    tribute.current.element = input;
    tribute.current.collection = tribute.collection[0];
    tribute.menu.create(document, 'tribute-container');
    tribute.isActive = false;

    tribute.current.process(false);

    expect(tribute.current.filteredItems).to.equal(undefined);
  });

  it('does not externally trigger when no collection is available or maximum item rules block it', () => {
    const input = createDomElement();
    const tribute = attachTribute({ values }, input.id);

    tribute.current.showMenuForCollection(input, undefined);
    expect(input.value).to.equal('');

    tribute.current.showMenuForCollection(input, { ...tribute.collection[0], isBlocked: true });
    expect(input.value).to.equal('');

    detachTribute(tribute, input.id);
  });

  it('emits no-match selection and rejects invalid lookup configuration', () => {
    const input = createDomElement();
    const tribute = attachTribute({ values }, input.id);
    let selectedNoMatch = '';

    input.addEventListener('tribute-selected-no-match', (event) => {
      selectedNoMatch = (event as CustomEvent<string>).detail;
    });
    tribute.current.element = input;
    tribute.current.collection = {
      ...tribute.collection[0],
      selectTemplate: () => 'No Match',
    };
    tribute.current.filteredItems = [];

    tribute.current.selectItemAtIndex('-1', new Event('click'));
    expect(selectedNoMatch).to.equal('No Match');

    expect(() =>
      tribute.current._filterItems(
        {
          ...tribute.collection[0],
          lookup: undefined as never,
        },
        values,
      ),
    ).to.throw('Invalid lookup attribute');

    const functionLookupItems = tribute.current._filterItems(
      {
        ...tribute.collection[0],
        lookup: (item, mentionText) => `${item.value} ${mentionText}`,
      },
      values,
    );
    expect(functionLookupItems).to.have.length(2);

    expect(
      tribute.current.isMaximumItemsAdded(
        { ...tribute.collection[0], maxDisplayItems: 1 },
        Object.assign(input, { innerHTML: '<span data-tribute-trigger="@"></span>' }),
      ),
    ).to.equal(true);

    detachTribute(tribute, input.id);
  });

  it('covers select and insert early exits', () => {
    const input = createDomElement();
    const tribute = attachTribute({ values }, input.id);

    tribute.current.selectItemAtIndex('not-a-number', new Event('click'));
    tribute.current.element = input;
    tribute.current.collection = { ...tribute.collection[0], selectTemplate: null };
    tribute.current.filteredItems = [{ index: 0, original: values[0], score: 0, string: values[0].value }];
    tribute.current.selectItemAtIndex('0', new Event('click'));

    const editable = createDomElement('contenteditable');
    editable.focus();
    window.getSelection()?.removeAllRanges();
    tribute.current.showMenuForCollection(editable, tribute.collection[0]);
    expect(editable.innerHTML).to.equal('');

    const originalGetSelection = window.getSelection;
    Object.defineProperty(window, 'getSelection', { configurable: true, value: () => null });
    try {
      (tribute.current as never as { insertTextAtCursor: (text: string) => void }).insertTextAtCursor('@');
    } finally {
      Object.defineProperty(window, 'getSelection', { configurable: true, value: originalGetSelection });
    }

    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    tribute.current.showMenuForCollection(numberInput, tribute.collection[0]);
    expect(numberInput.value).to.equal('');

    detachTribute(tribute, input.id);
  });
});

describe('Range coverage', () => {
  afterEach(() => {
    clearDom();
  });

  it('covers document, selection, offscreen, and scroll helpers', () => {
    const input = createDomElement();
    const tribute = attachTribute({ values }, input.id);
    const range = tribute.range as never as {
      getDocument: () => Document;
      getWindowSelection: () => Selection | null;
      isMenuOffScreen: (coordinates: object, dimensions: { width: number; height: number }) => object;
      menuContainerIsBody: boolean;
      scrollIntoView: () => void;
    };

    expect(range.menuContainerIsBody).to.equal(true);

    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    tribute.collection[0].iframe = iframe;
    tribute.current.collection = tribute.collection[0];
    expect(range.getDocument()).to.equal(iframe.contentWindow?.document);
    expect(range.getWindowSelection()).to.equal(iframe.contentWindow?.getSelection());

    tribute.collection[0].iframe = null;
    const selection = window.getSelection();
    tribute.collection[0].shadowRoot = { getSelection: () => selection } as never;
    expect(range.getWindowSelection()).to.equal(selection);
    tribute.collection[0].shadowRoot = null;

    expect(range.isMenuOffScreen({ top: -1, left: -1 }, { width: 10, height: 10 })).to.deep.equal({
      top: true,
      right: false,
      bottom: false,
      left: true,
    });
    expect(range.isMenuOffScreen({ right: -1, bottom: -1 }, { width: 10, height: 10 })).to.deep.equal({
      top: false,
      right: false,
      bottom: false,
      left: false,
    });
    expect(range.isMenuOffScreen({}, { width: 10, height: 10 })).to.deep.equal({
      top: undefined,
      right: undefined,
      bottom: undefined,
      left: undefined,
    });

    const menu = document.createElement('div');
    Object.defineProperty(menu, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: -10, bottom: 10, height: 20, left: 0, right: 10, width: 10 }),
    });
    tribute.menu.element = menu;
    const originalScrollTo = window.scrollTo;
    let scrollY = 0;
    window.scrollTo = (_x: number, y: number) => {
      scrollY = y;
    };
    try {
      range.scrollIntoView();
    } finally {
      window.scrollTo = originalScrollTo;
    }
    expect(scrollY).to.be.lessThan(0);

    Object.defineProperty(menu, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: window.innerHeight + 10, bottom: window.innerHeight + 50, height: 40, left: 0, right: 10, width: 10 }),
    });
    window.scrollTo = (_x: number, y: number) => {
      scrollY = y;
    };
    try {
      range.scrollIntoView();
    } finally {
      window.scrollTo = originalScrollTo;
    }
    expect(scrollY).to.be.greaterThan(0);

    Object.defineProperty(menu, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: 1000, bottom: 2000, height: 1000, left: 0, right: 10, width: 10 }),
    });
    window.scrollTo = (_x: number, y: number) => {
      scrollY = y;
    };
    try {
      range.scrollIntoView();
    } finally {
      window.scrollTo = originalScrollTo;
    }
    expect(scrollY).to.equal(100);

    tribute.menu.element = null;
    range.scrollIntoView();
    tribute.menu.element = menu;

    Object.defineProperty(menu, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: 0, bottom: 0, height: 0, left: 0, right: 0, width: 0 }),
    });
    range.scrollIntoView();

    menu.appendChild(document.createTextNode('text child'));
    range.scrollIntoView();

    detachTribute(tribute, input.id);
  });

  it('covers flipped coordinate calculations and null range handlers', () => {
    const tribute = new Tribute({ values });
    const range = tribute.range as never as {
      rangeHandler: {
        getCoordinate: (element: HTMLElement, position: number) => object | undefined;
        getFixedCoordinatesRelativeToRect: (rect: { top: number; left: number; height: number; width: number }) => object;
        getSelectionInfo: (element: HTMLElement) => undefined;
        getTextPrecedingCurrentSelection: (element: HTMLElement) => undefined;
        replaceTriggerText: (info: object, text: string, element: HTMLElement) => void;
      };
    };

    expect(range.rangeHandler.getSelectionInfo(document.body)).to.equal(undefined);
    expect(range.rangeHandler.getTextPrecedingCurrentSelection(document.body)).to.equal(undefined);
    expect(range.rangeHandler.getCoordinate(document.body, 0)).to.equal(undefined);
    range.rangeHandler.replaceTriggerText({}, 'x', document.body);
    expect(tribute.range.getTrigger('z'.charCodeAt(0))).to.equal(undefined);
    expect(tribute.range.getTriggerInfo(false, false, true, false)).to.equal(undefined);

    const originalHeight = window.innerHeight;
    const originalWidth = window.innerWidth;
    tribute.menu.getDimensions = () => ({ height: 50, width: 50 });
    try {
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 120 });
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 120 });
      expect(range.rangeHandler.getFixedCoordinatesRelativeToRect({ top: 100, left: 100, height: 10, width: 10 })).to.include({
        top: 'auto',
        left: 'auto',
        maxHeight: 100,
        maxWidth: 100,
      });

      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 40 });
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 40 });
      expect(range.rangeHandler.getFixedCoordinatesRelativeToRect({ top: 10, left: 10, height: 10, width: 10 })).to.include({
        maxHeight: 20,
        maxWidth: 30,
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
    }
  });

  it('covers autocomplete range parsing with a null separator', () => {
    const input = createDomElement();
    input.value = 'hello world';
    input.setSelectionRange(input.value.length, input.value.length);

    const tribute = attachTribute(
      {
        autocompleteMode: true,
        autocompleteSeparator: null,
        values,
      },
      input.id,
    );
    tribute.range.element = input;

    const info = tribute.range.getTriggerInfo(false, false, true, false);
    expect(info?.mentionText).to.equal('hello world');
    expect(tribute.range.getTrigger('z'.charCodeAt(0))).to.equal('');

    detachTribute(tribute, input.id);
  });

  it('covers range early exits and non-leading-space triggers', () => {
    const input = createDomElement();
    input.value = 'hello@Jo';
    input.setSelectionRange(input.value.length, input.value.length);
    const tribute = attachTribute(
      {
        requireLeadingSpace: false,
        values,
      },
      input.id,
    );
    tribute.range.element = input;

    expect(tribute.range.getTriggerInfo(false, false, true, false)?.mentionText).to.equal('Jo');
    input.value = 'plain';
    input.setSelectionRange(input.value.length, input.value.length);
    tribute.range.positionMenuAtCaret(false);
    tribute.range.replaceTriggerText('Jordan', true, true, new Event('click'), { index: 0, original: values[0], score: 0, string: values[0].value });

    detachTribute(tribute, input.id);
  });

  it('returns undefined autocomplete trigger info before an element is selected', () => {
    const tribute = new Tribute({
      autocompleteMode: true,
      autocompleteSeparator: null,
      values,
    });

    expect(tribute.range.getTriggerInfo(false, false, true, false)).to.equal(undefined);
  });

  it('covers textarea range handling and coordinates', () => {
    const wrapper = document.createElement('div');
    wrapper.id = 'tribute-wrapper-div';
    const textarea = document.createElement('textarea');
    textarea.id = 'tribute-textarea';
    wrapper.appendChild(textarea);
    document.body.appendChild(wrapper);

    textarea.value = 'hello world';
    textarea.setSelectionRange(5, 5);

    const tribute = attachTribute({ values }, textarea.id);
    tribute.range.element = textarea;

    expect(tribute.range.getTextPrecedingCurrentSelection()).to.equal('hello');
    const coordinate = (
      tribute.range as never as { rangeHandler: { getCoordinate: (element: HTMLElement, position: number) => object | undefined } }
    ).rangeHandler.getCoordinate(textarea, 5);
    expect(coordinate).to.include({ position: 'fixed' });
    expect(
      (
        tribute.range as never as {
          rangeHandler: {
            getCoordinate: (element: HTMLElement, position: number) => object | undefined;
            getTextPrecedingCurrentSelection: (element: HTMLElement) => string | undefined;
            replaceTriggerText: (info: object, text: string, element: HTMLElement) => void;
          };
        }
      ).rangeHandler.getCoordinate(document.createElement('div'), 0),
    ).to.equal(undefined);
    expect(
      (
        tribute.range as never as {
          rangeHandler: {
            getTextPrecedingCurrentSelection: (element: HTMLElement) => string | undefined;
          };
        }
      ).rangeHandler.getTextPrecedingCurrentSelection(document.createElement('div')),
    ).to.equal(undefined);

    (
      tribute.range as never as {
        rangeHandler: {
          replaceTriggerText: (info: object, text: string, element: HTMLElement) => void;
        };
      }
    ).rangeHandler.replaceTriggerText({ mentionPosition: 0, mentionText: 'hello' }, 'Name', document.createElement('div'));

    textarea.value = '';
    expect(tribute.range.getTextPrecedingCurrentSelection()).to.equal(undefined);

    detachTribute(tribute, textarea.id);
  });

  it('covers text input replacement suffix branches', () => {
    const input = createDomElement();
    input.value = '@Jo ';
    input.setSelectionRange(3, 3);
    const tribute = attachTribute(
      {
        replaceTextSuffix: '',
        values,
      },
      input.id,
    );
    tribute.range.element = input;
    const handler = (
      tribute.range as never as {
        rangeHandler: {
          replaceTriggerText: (info: object, text: string, element: HTMLElement) => void;
        };
      }
    ).rangeHandler;

    handler.replaceTriggerText({ mentionPosition: 0, mentionText: 'Jo', mentionTriggerChar: '@' }, 'Jordan', input);
    expect(input.value).to.equal('Jordan ');

    input.value = '@Jo';
    handler.replaceTriggerText({ mentionPosition: 0, mentionText: 'Jo' }, 'Name', input);
    expect(input.value).to.contain('Name');

    detachTribute(tribute, input.id);
  });

  it('covers contenteditable noneditable nodes and HTMLElement replacement', async () => {
    const editable = createDomElement('contenteditable');
    const tribute = attachTribute(
      {
        selectTemplate: () => {
          const span = document.createElement('span');
          span.className = 'selected-node';
          span.textContent = 'Selected';
          return span;
        },
        values,
      },
      editable.id,
    );

    await fillIn(editable, '@');
    simulateMouseClick(document.querySelector('.tribute-container > ul > li') as HTMLElement);
    expect(editable.querySelector('.selected-node')?.textContent).to.equal('Selected');

    const suffixWrapper = document.createElement('div');
    suffixWrapper.id = 'tribute-wrapper-div';
    const suffixEditable = document.createElement('div');
    suffixEditable.id = 'tribute-contenteditable-suffix';
    suffixWrapper.appendChild(suffixEditable);
    document.body.appendChild(suffixWrapper);
    suffixEditable.innerHTML = '@Jordan';
    const defaultSuffixTribute = attachTribute({ values }, suffixEditable.id);
    defaultSuffixTribute.range.element = suffixEditable;
    placeCaretAtEnd(suffixEditable);
    defaultSuffixTribute.range.replaceTriggerText('Name', true, true, new Event('click'), { index: 0, original: values[0], score: 0, string: values[0].value });
    expect(suffixEditable.innerHTML).to.contain('Name&nbsp;');
    detachTribute(defaultSuffixTribute, suffixEditable.id);

    editable.innerHTML = '<span contenteditable="false">locked</span>';
    const lockedText = editable.querySelector('span')?.firstChild;
    const selection = window.getSelection();
    const range = document.createRange();
    if (lockedText) {
      range.setStart(lockedText, 3);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    tribute.range.element = editable;
    expect(tribute.range.getTextPrecedingCurrentSelection()).to.equal(undefined);

    selection?.removeAllRanges();
    expect(tribute.range.getSelectionInfo()).to.equal(undefined);
    expect(tribute.range.getTextPrecedingCurrentSelection()).to.equal(undefined);

    tribute.collection[0].shadowRoot = { getSelection: () => null } as never;
    expect(tribute.range.getTextPrecedingCurrentSelection()).to.equal('');
    expect(tribute.range.getSelectionInfo()).to.equal(undefined);
    expect(
      (
        tribute.range as never as {
          rangeHandler: {
            getCoordinate: (element: HTMLElement, position: number) => object | undefined;
          };
        }
      ).rangeHandler.getCoordinate(editable, 0),
    ).to.equal(undefined);
    tribute.collection[0].shadowRoot = null;

    editable.innerHTML = '@Jo';
    placeCaretAtEnd(editable);
    let selectionCall = 0;
    const activeSelection = window.getSelection();
    tribute.collection[0].shadowRoot = {
      getSelection: () => {
        selectionCall += 1;
        return selectionCall === 1 ? activeSelection : null;
      },
    } as never;
    expect(tribute.range.getTextPrecedingCurrentSelection()).to.equal(undefined);
    tribute.collection[0].shadowRoot = null;

    const elementRange = document.createRange();
    elementRange.setStart(editable, 0);
    elementRange.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(elementRange);
    expect(tribute.range.getSelectionInfo()?.selected).to.equal(editable);

    const contentHandler = (
      tribute.range as never as {
        rangeHandler: {
          getNodePositionInParent: (node: Node) => number | undefined;
        };
      }
    ).rangeHandler;
    expect(contentHandler.getNodePositionInParent(document)).to.equal(0);
    expect(contentHandler.getNodePositionInParent({ parentNode: { childNodes: [] } } as never)).to.equal(undefined);

    detachTribute(tribute, editable.id);
  });

  it('covers contenteditable replacement suffix branches', () => {
    const editable = createDomElement('contenteditable');
    editable.innerHTML = '@Jo';
    const tribute = attachTribute(
      {
        replaceTextSuffix: ' ',
        values,
      },
      editable.id,
    );
    tribute.range.element = editable;
    placeCaretAtEnd(editable);
    const handler = (
      tribute.range as never as {
        rangeHandler: {
          replaceTriggerText: (info: object, text: string, element: HTMLElement) => void;
        };
      }
    ).rangeHandler;

    handler.replaceTriggerText({ mentionPosition: 0, mentionText: 'Jo', mentionTriggerChar: '@' }, 'Jordan', editable);
    expect(editable.textContent).to.equal('Jordan ');

    editable.textContent = '@Jo';
    placeCaretAtEnd(editable);
    handler.replaceTriggerText({ mentionPosition: 0, mentionText: 'Jo' }, 'Name', editable);
    expect(editable.textContent).to.contain('Name');

    detachTribute(tribute, editable.id);
  });

  it('covers autocomplete contenteditable and empty selection branches', () => {
    const editable = createDomElement('contenteditable');
    editable.innerText = 'hello';
    const tribute = attachTribute(
      {
        autocompleteMode: true,
        values,
      },
      editable.id,
    );
    tribute.range.element = editable;
    placeCaretAtEnd(editable);

    expect(tribute.range.getTriggerInfo(false, false, true, false)?.mentionText).to.equal('hello');
    expect(
      (
        tribute.range as never as { rangeHandler: { getCoordinate: (element: HTMLElement, position: number) => object | undefined } }
      ).rangeHandler.getCoordinate(editable, 1),
    ).to.include({
      position: 'fixed',
    });

    window.getSelection()?.removeAllRanges();
    expect(
      (tribute.range as never as { rangeHandler: { pasteHtml: (html: string, start: number, end: number) => void } }).rangeHandler.pasteHtml('x', 0, 0),
    ).to.equal(undefined);

    detachTribute(tribute, editable.id);
  });
});

describe('Event coverage', () => {
  afterEach(async () => {
    await delay();
    clearDom();
  });

  it('hides the menu when the mention text is under the minimum length', async () => {
    const input = createDomElement();
    const tribute = attachTribute(
      {
        menuShowMinLength: 2,
        values,
      },
      input.id,
    );

    await fillIn(input, '@a');

    expect(tribute.isActive).to.equal(false);
    (tribute.events as never as { inputEvent: boolean; triggerChar: (event: Event, element: HTMLElement, trigger: string) => void }).inputEvent = true;
    tribute.current.mentionText = 'ab';
    (tribute.events as never as { triggerChar: (event: Event, element: HTMLElement, trigger: string) => void }).triggerChar(new Event('keyup'), input, '@');
    expect(tribute.isActive).to.equal(true);
    detachTribute(tribute, input.id);
  });

  it('handles escape, space, backspace, tab, and composition events', async () => {
    const input = createDomElement();
    const tribute = attachTribute(
      {
        allowSpaces: false,
        spaceSelectsMatch: true,
        values,
      },
      input.id,
    );

    await fillIn(input, '@');
    expect(tribute.isActive).to.equal(true);

    await press('Escape');
    expect(tribute.isActive).to.equal(false);

    input.value = '';
    input.setSelectionRange(0, 0);
    await fillIn(input, '@');
    await press('Tab');
    await delay();
    expect(input.value).to.equal('@Jordan Humphreys ');

    await fillIn(input, '@J');
    await press('Backspace');
    expect(tribute.isActive).to.equal(true);

    await press(' ');
    await delay();

    let syntheticInputs = 0;
    input.addEventListener('input', () => {
      syntheticInputs += 1;
    });
    (tribute.events as never as { keydown: (event: Event) => void; keyup: (event: Event) => void; shouldDeactivate: (event: Event) => boolean }).keydown(
      new Event('keydown'),
    );
    (tribute.events as never as { keyup: (event: Event) => void }).keyup(new KeyboardEvent('keyup'));
    tribute.isActive = true;
    expect((tribute.events as never as { shouldDeactivate: (event: Event) => boolean }).shouldDeactivate(new Event('keydown'))).to.equal(false);
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'あ' }));
    input.dispatchEvent(new Event('keydown', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'Enter', key: 'Enter' }));
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'あ' }));
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'あ' }));
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'あ' }));
    const insertFromComposition = new InputEvent('input', { bubbles: true, data: 'あ' });
    Object.defineProperty(insertFromComposition, 'inputType', { value: 'insertFromComposition' });
    input.dispatchEvent(insertFromComposition);
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'あ' }));
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'あ' }));
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'あ' }));
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'あ' }));
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'あ' }));
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromComposition', data: 'あ' }));

    expect(syntheticInputs).to.be.greaterThan(0);

    tribute.current.mentionText = '';
    tribute.isActive = true;
    (tribute.events as never as { callbacks: { backspace: (event: Event, element: HTMLElement) => void } }).callbacks.backspace(new Event('keydown'), input);
    expect(tribute.isActive).to.equal(false);
    detachTribute(tribute, input.id);
  });

  it('handles menu event no-match and external trigger clicks', () => {
    const input = createDomElement();
    const tribute = attachTribute({ values }, input.id);

    tribute.current.element = input;
    tribute.current.collection = tribute.collection[0];
    tribute.current.filteredItems = [];
    const menuElement = tribute.menu.create(document, 'tribute-container');
    const list = menuElement.querySelector('ul');
    if (!list) throw new Error('Expected menu list');
    list.innerHTML = '<li data-index="0"><span>No Match</span></li>';

    tribute.menuEvents.click(new MouseEvent('click', { bubbles: true }));
    tribute.menuEvents.click(
      new MouseEvent('click', {
        bubbles: true,
      }),
    );
    tribute.menuEvents.click({
      target: menuElement,
      preventDefault() {},
      stopPropagation() {},
    } as never);
    tribute.menuEvents.click({
      target: menuElement.querySelector('span'),
      preventDefault() {},
      stopPropagation() {},
    } as never);
    expect(menuElement.querySelector('li')?.getAttribute('data-index')).to.equal('-1');

    tribute.current.externalTrigger = true;
    tribute.menuEvents.click({ target: document.body } as never);
    expect(tribute.current.externalTrigger).to.equal(false);

    detachTribute(tribute, input.id);
  });
});
