import { addHandler, debounce } from './helpers';
import type { ITribute } from './type';

class TributeMenuEvents<T extends {}> {
  removers: (() => void)[];
  tribute: ITribute<T>;

  constructor(tribute: ITribute<T>) {
    this.tribute = tribute;
    this.removers = [];
  }

  bind(_menu: EventTarget) {
    const hideMenu = debounce(
      () => {
        if (this.tribute.isActive) {
          this.tribute.hideMenu();
        }
      },
      10,
      false,
    );

    this.removers.push(addHandler(this.tribute.range.getDocument(), 'mousedown', (event: Event) => this.click(event), false));
    this.removers.push(addHandler(window, 'resize', hideMenu));

    if (this.tribute.closeOnScroll === true) {
      this.removers.push(addHandler(window, 'scroll', hideMenu));
    } else if (this.tribute.closeOnScroll !== false) {
      this.removers.push(addHandler(this.tribute.closeOnScroll, 'scroll', hideMenu, false));
    } else {
      if (this.tribute.menuContainer) {
        this.removers.push(addHandler(this.tribute.menuContainer, 'scroll', hideMenu, false));
      } else {
        this.removers.push(addHandler(window, 'scroll', hideMenu));
      }
    }
  }

  unbind(_menu: EventTarget) {
    for (const remover of this.removers) {
      remover();
    }
  }

  click(event: Event) {
    const element = event.target;
    const tribute = this.tribute;
    if (!tribute.current || !(element instanceof Node)) return;

    if (tribute.menu.element?.contains(element)) {
      let li: Node | undefined | null = element;
      event.preventDefault();
      event.stopPropagation();
      while (li.nodeName.toLowerCase() !== 'li') {
        li = li.parentNode;
        if (!li || li === tribute.menu.element) {
          // When li === tribute.menu, it's either a click on the entire component or on the scrollbar (if visible)
          li = undefined;
          break;
        }
      }

      if (!(li instanceof HTMLElement)) return;

      if (li.getAttribute('data-disabled') === 'true') {
        return;
      }
      if (tribute.current.filteredItems?.length === 0) {
        li.setAttribute('data-index', '-1');
      }

      const index = li.getAttribute('data-index');
      if (index !== null) {
        tribute.current.selectItemAtIndex(index, event);
      }
      tribute.hideMenu();

      // TODO: should fire with externalTrigger and target is outside of menu
    } else if (tribute.current.externalTrigger) {
      tribute.current.externalTrigger = false;
    } else if (tribute.current.element && !tribute.current.externalTrigger) {
      setTimeout(() => tribute.hideMenu());
    }
  }
}

export default TributeMenuEvents;
