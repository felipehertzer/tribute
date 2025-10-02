import type { Collection, ITribute, ITributeContext, TributeItem, TriggerInfo } from './type';

class TributeContext<T extends {}> implements ITributeContext<T> {
  element?: HTMLElement;
  filteredItems?: TributeItem<T>[];
  collection?: Collection<T>;
  mentionText: string;
  externalTrigger: boolean;
  tribute: ITribute<T>;
  selectedPath?: (number | undefined)[];
  selectedOffset?: number;
  trigger?: string;

  constructor(tribute: ITribute<T>) {
    this.tribute = tribute;
    this.mentionText = '';
    this.externalTrigger = false;
  }

  process(scrollTo: boolean) {
    if (this.tribute.menu.element === null || !this.collection) return;

    const ul = this.tribute.menu.element.querySelector('ul');
    if (ul === null) throw new Error('menu do not have "ul" element');

    const collection = this.collection;
    const processor = (values: T[]) => {
      // Tribute may not be active any more by the time the value callback returns
      if (!this.tribute.isActive) {
        return;
      }

      const items = this._filterItems(collection, values);
      this.filteredItems = items;

      const scroll = this.tribute.menu.render(items, collection);
      if (scroll === true && scrollTo === true) {
        this.tribute.range.positionMenuAtCaret(scrollTo);
      }
    };

    if (typeof collection.values === 'function') {
      if (collection.loadingItemTemplate) {
        ul.innerHTML = collection.loadingItemTemplate;
        this.tribute.range.positionMenuAtCaret(scrollTo);
      }

      collection.values(this.mentionText, processor);
    } else if (collection.values !== null) {
      processor(collection.values);
    }
  }

  updateSelection(info: TriggerInfo) {
    this.selectedPath = info.mentionSelectedPath;
    this.mentionText = info.mentionText || '';
    this.selectedOffset = info.mentionSelectedOffset;
  }

  get isMentionLengthUnderMinimum() {
    if (!this.collection) return undefined;

    return this.mentionText.length < this.collection.menuShowMinLength;
  }

  _filterItems(collection: Collection<T>, values: T[]) {
    const opts = collection.searchOpts;
    const lookup = collection.lookup;
    const items = this.tribute.search.filter(this.mentionText, values, {
      pre: opts.pre || '<span>',
      post: opts.post || '</span>',
      skip: opts.skip || false,
      caseSensitive: opts.caseSensitive || false,
      extract: (el) => {
        if (typeof lookup === 'string') {
          return el[lookup];
        }
        if (typeof lookup === 'function') {
          return lookup(el, this.mentionText);
        }
        throw new Error('Invalid lookup attribute, lookup must be string or function.');
      },
    });

    if (collection.menuItemLimit) {
      return items.slice(0, collection.menuItemLimit);
    }

    return items;
  }
}

export default TributeContext;
