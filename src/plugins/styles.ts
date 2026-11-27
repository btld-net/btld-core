import type { BtldElement, BtldElementConstructor } from '../types/element';
import type { BtldPlugin } from '../types/config';
import { $hoisted, $staticConfig } from '../types/element';

export const $hoist = Symbol();

const isDocument = (node: Node): node is Document => node.nodeType === 9;
const isDocumentFragment = (node: Node): node is DocumentFragment => node.nodeType === 11;

export const hoistStylesPlugin: BtldPlugin = (ctor) => {
  ctor.prototype[$hoist] ??= function (this: BtldElement) {
    const ctor = this.constructor as BtldElementConstructor;
    const config = ctor[$staticConfig] ?? {};
    const document = this.ownerDocument;
    const tag = this.localName;
    const rootnode = this.getRootNode();
    const root = isDocumentFragment(rootnode) ? rootnode : document;

    if (!Object.hasOwn(ctor, $hoisted)) {
      ctor[$hoisted] = new WeakMap<Document | DocumentFragment, Set<string>>();
    }
    const byRoot = ctor[$hoisted] as WeakMap<Document | DocumentFragment, Set<string>>;

    let done = byRoot.get(root);
    if (!done) byRoot.set(root, (done = new Set()));

    const styles = config.styles ?? {};
    for (const key in styles) {
      const id = `${tag}--${key}`;

      // Skip previously added - we dont want to update
      if (done.has(id)) continue;
      done.add(id);
      if (root.getElementById(id)) continue;

      const insert = document.createElement('style');
      insert.id = id;
      insert.textContent = styles[key]
        .replaceAll('$tag', tag)
        .replace(/^(\s*)::part\(/gm, (_, ws) => `${ws}${tag}::part(`);

      (isDocument(root) ? root.head || root.documentElement : root).appendChild(insert);
    }
  };
};
