import { isContentEditable } from './helpers';
import TributeContext from './TributeContext';
import TributeEvents from './TributeEvents';
import TributeMenu from './TributeMenu';
import TributeMenuEvents from './TributeMenuEvents';
import TributeRange from './TributeRange';
import TributeSearch from './TributeSearch';
import type {
  Collection,
  ITribute,
  ITributeContext,
  ITributeEvents,
  ITributeMenu,
  ITributeRange,
  ITributeSearch,
  TributeArgument,
  TributeCollection,
  TributeElement,
  TributeItem,
  TributeTemplate,
} from './type';

const defaultConfig = {
  values: null,
  loadingItemTemplate: null,
  iframe: null,
  shadowRoot: null,
  selectClass: 'highlight',
  containerClass: 'tribute-container',
  itemClass: '',
  trigger: '@',
  autocompleteMode: false,
  autocompleteSeparator: /\s+/,
  selectTemplate: null,
  menuItemTemplate: null,
  lookup: 'key',
  fillAttr: 'value',
  collection: null,
  menuContainer: null,
  noMatchTemplate: null,
  requireLeadingSpace: true,
  allowSpaces: false,
  replaceTextSuffix: null,
  positionMenu: true,
  spaceSelectsMatch: false,
  searchOpts: {},
  menuItemLimit: null,
  menuShowMinLength: 0,
  closeOnScroll: false,
  maxDisplayItems: null,
  isBlocked: false,
} as const;

type Compact<T> = {
  [P in keyof T]?: Exclude<T[P], undefined>;
};

function compactObject<T extends Record<string, unknown>>(args: T): Compact<T> {
  const entries = Object.entries(args) as [keyof T, T[keyof T]][];
  const filteredEntries = entries.filter(([, value]) => value !== undefined);
  const compactArgs = Object.assign({}, ...filteredEntries.map(([k, v]) => ({ [k]: v }))) as Compact<T>;

  return compactArgs;
}

class Tribute<T extends {}> implements ITribute<T> {
  allowSpaces: boolean;
  autocompleteMode: boolean;
  autocompleteSeparator: RegExp | null;
  collection: Collection<T>[];
  iframe?: HTMLIFrameElement;
  closeOnScroll: boolean | HTMLElement;
  currentMentionTextSnapshot?: string;
  hasTrailingSpace: boolean;
  menu: ITributeMenu<T>;
  menuContainer?: Element | null;
  positionMenu: boolean;
  replaceTextSuffix: string | null;
  spaceSelectsMatch: boolean;
  _isActive: boolean;
  events: ITributeEvents;
  menuEvents: ITributeEvents;
  range: ITributeRange<T>;
  search: ITributeSearch<T>;
  current: ITributeContext<T>;

  constructor(args: Partial<TributeCollection<T> & TributeTemplate<T> & TributeArgument<T>>) {
    const compactArgs: Compact<Partial<TributeCollection<T> & TributeTemplate<T> & TributeArgument<T>>> = compactObject(args);

    const config = {
      ...defaultConfig,
      ...compactArgs,
    };

    this._isActive = false;
    this.autocompleteMode = config.autocompleteMode;
    this.autocompleteSeparator = config.autocompleteSeparator;
    this.current = new TributeContext(this);
    this.isActive = false;
    this.menuContainer = config.menuContainer;
    this.allowSpaces = config.allowSpaces;
    this.replaceTextSuffix = config.replaceTextSuffix;
    this.positionMenu = config.positionMenu;
    this.hasTrailingSpace = false;
    this.spaceSelectsMatch = config.spaceSelectsMatch;
    this.closeOnScroll = config.closeOnScroll;
    this.menu = new TributeMenu(this);

    if (this.autocompleteMode) {
      config.trigger = '';
      config.allowSpaces = false;
    }

    this.collection = this.buildCollection(config);
    this.range = new TributeRange(this);
    this.events = new TributeEvents(this);
    this.menuEvents = new TributeMenuEvents(this);
    this.search = new TributeSearch(this);
  }

  get isActive(): boolean {
    return this._isActive;
  }

  set isActive(val: boolean) {
    if (this._isActive !== val) {
      this._isActive = val;
      if (this.current.element) {
        const noMatchEvent = new CustomEvent(`tribute-active-${val}`);
        this.current.element.dispatchEvent(noMatchEvent);
      }
    }
  }

  triggers() {
    return this.collection.map((config) => {
      return config.trigger;
    });
  }

  attach(el: TributeElement | JQuery<HTMLElement>): void {
    // Check if it is a jQuery collection
    let _el: HTMLElement | NodeList | HTMLCollection | Array<HTMLElement>;
    if (isJQuery<HTMLElement>(el)) {
      _el = el.get();
    } else {
      _el = el;
    }

    if (!_el) {
      throw new Error('[Tribute] Must pass in a DOM node or NodeList.');
    }

    // Is el an Array/Array-like object?
    if (_el instanceof NodeList || _el instanceof HTMLCollection || Array.isArray(_el)) {
      for (const e of _el) {
        if (e instanceof HTMLElement) {
          this._attach(e);
        }
      }
    } else {
      this._attach(_el);
    }
  }

  _attach(el: HTMLElement) {
    if (el.hasAttribute('data-tribute')) {
      console.warn(`Tribute was already bound to ${el.nodeName}`);
    }

    this.ensureEditable(el);
    this.events.bind(el);
    el.setAttribute('data-tribute', 'true');
  }

  ensureEditable(element: HTMLElement): void {
    if (isContentEditable(element)) {
      if (typeof element.contentEditable === 'string') {
        element.contentEditable = 'true';
      } else {
        throw new Error(`[Tribute] Cannot bind to ${element.nodeName}, not contentEditable`);
      }
    }
  }

  showMenuForCollection(element: HTMLElement, collectionIndex?: number): void {
    // Check for maximum number of items added to the input for the specific Collection
    const index = collectionIndex || 0;
    const collection = this.collection[index];
    this.current.showMenuForCollection(element, collection);
    this.showMenuFor(element);
  }

  showMenuFor(element: HTMLElement & { tributeMenu?: HTMLElement }, scrollTo?: boolean): void {
    if (typeof this.current.collection === 'undefined') throw new Error('this.current.collection is undefined');

    // Check for maximum number of items added to the input for the specific Collection
    if (this.current.isMaximumItemsAdded(this.current.collection, element)) {
      //console.log("Tribute: Maximum number of items added!");
      return;
    }

    this.currentMentionTextSnapshot = this.current.mentionText;

    // create the menu if it doesn't exist.
    if (!this.menu.element) {
      const menu = this.menu.create(this.range.getDocument(), this.current.collection.containerClass);
      element.tributeMenu = menu;
      this.menuEvents.bind(menu);
    }

    this.isActive = true;
    this.menu.activate();

    this.current.process(scrollTo);
  }

  hideMenu(): void {
    if (this.menu.isActive) {
      this.isActive = false;
      this.menu.deactivate();
      this.current = new TributeContext(this);
    }
  }

  _append(collection: TributeCollection<T>, newValues: T[], replace: boolean): void {
    if (typeof collection.values === 'function') {
      throw new Error('Unable to append to values, as it is a function.');
    }
    if (replace || collection.values === null) {
      collection.values = newValues;
    } else {
      collection.values = collection.values.concat(newValues);
    }
  }

  append(collectionIndex: string, newValues: [], replace?: boolean): void {
    const index = Number.parseInt(collectionIndex, 10);
    if (typeof index !== 'number') throw new Error('please provide an index for the collection to update.');

    const collection = this.collection[index];

    if (typeof collection !== 'undefined') {
      this._append(collection, newValues, !!replace);
    }
  }

  appendCurrent(newValues: T[], replace: boolean): void {
    if (this.isActive && typeof this.current.collection !== 'undefined') {
      this._append(this.current.collection, newValues, replace);
    } else {
      throw new Error('No active state. Please use append instead and pass an index.');
    }
  }

  detach(el: TributeElement): void {
    if (!el) {
      throw new Error('[Tribute] Must pass in a DOM node or NodeList.');
    }

    // Check if it is a jQuery collection
    const _el = isJQuery(el) ? el.get() : el;

    // Is el an Array/Array-like object?
    if (_el instanceof NodeList || _el instanceof HTMLCollection || Array.isArray(_el)) {
      for (const e of _el) {
        if (e instanceof HTMLElement) {
          this._detach(e);
        }
      }
    } else {
      this._detach(_el);
    }
  }

  _detach(el: HTMLElement & { tributeMenu?: HTMLElement }): void {
    this.events.unbind(el);
    if (el.tributeMenu) {
      this.menuEvents.unbind(el.tributeMenu);
    }

    setTimeout(() => {
      el.removeAttribute('data-tribute');
      this.isActive = false;
      if (el.tributeMenu) {
        el.tributeMenu.remove();
      }
    });
  }

  private buildCollection(config: TributeCollection<T> & TributeTemplate<T> & TributeArgument<T>) {
    const { values, collection, menuItemTemplate, noMatchTemplate, selectTemplate, ...collectionConfig } = config;

    if (values) {
      return [
        {
          ...collectionConfig,
          values: values,
          selectTemplate: selectTemplate ? selectTemplate.bind(this) : (item?: TributeItem<T>) => defaultSelectTemplate(this.current, item),
          menuItemTemplate: (menuItemTemplate || defaultMenuItemTemplate).bind(this),
          noMatchTemplate: this.createNoMatchTemplate(noMatchTemplate, noMatchTemplate),
        },
      ];
    }

    if (collection) {
      if (this.autocompleteMode) console.warn('Tribute in autocomplete mode does not work for collections');
      return collection.map((item) => ({
        ...collectionConfig,
        ...item,
        selectTemplate: item.selectTemplate ? item.selectTemplate.bind(this) : (item?: TributeItem<T>) => defaultSelectTemplate(this.current, item),
        menuItemTemplate: (item.menuItemTemplate || defaultMenuItemTemplate).bind(this),
        noMatchTemplate: this.createNoMatchTemplate(item.noMatchTemplate, noMatchTemplate),
      }));
    } else {
      throw new Error('[Tribute] No collection specified.');
    }
  }

  private createNoMatchTemplate(template: TributeTemplate<T>['noMatchTemplate'], defaultNoMatchTemplate: TributeTemplate<T>['noMatchTemplate']) {
    if (typeof template === 'string') {
      return template.trim() === '' ? null : template;
    }

    if (typeof template === 'function') {
      return template.bind(this);
    }

    return defaultNoMatchTemplate ?? (() => '<li>No Match Found!</li>').bind(this);
  }

  static isContentEditable(element: HTMLElement) {
    return isContentEditable(element);
  }
}

function defaultSelectTemplate<T extends {}>(current: ITributeContext<T> | undefined, item?: TributeItem<T>): string {
  if (typeof current?.collection === 'undefined') throw new Error('current Collection is undfined');
  if (typeof item === 'undefined') return `${current.collection.trigger}${current.mentionText}`;

  // FIXME: should not use 'as'
  const original = item.original as { [key: string]: string };
  const result = original[current.collection.fillAttr];

  if (current.element && isContentEditable(current.element)) {
    return `<span class="tribute-mention">${current.collection.trigger}${result}</span>`;
  }

  return `${current.collection.trigger}${result}`;
}

function defaultMenuItemTemplate<T extends {}>(matchItem: TributeItem<T>) {
  return matchItem.string;
}

function isJQuery<T>(element: unknown): element is JQuery<T> {
  if (typeof element !== 'object' || element == null) {
    return false;
  }
  return 'jquery' in element && typeof element.jquery !== 'undefined';
}

export default Tribute;
