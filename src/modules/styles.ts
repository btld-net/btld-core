import { ConfigModules } from '../types/config';

export const $config = Symbol();
export const $hoist = Symbol();
export const $hoisted = Symbol();

const isDocument = (node: Node): node is Document => node.nodeType === 9;
const isDocumentFragment = (node: Node): node is DocumentFragment => node.nodeType === 11;

export class ModuleHoistStyles {
  static [$hoisted] = new WeakMap<Document | DocumentFragment, Set<string>>();
  
  [$config]: ConfigModules;
  constructor(config: ConfigModules) {
    this[$config] = config;
  }

  /**
   * Hoists styles into the root context (Document or ShadowRoot)
   * Injected into host.getRootNode() as <style id="btld-hoist-{key}"></style>
   * Use <style> to support SSR with https://github.com/WebReflection/linkedom
   */
  [$hoist](host: Element) {
    const document = host.ownerDocument;
    const tag = host.localName;
    const rootnode = host.getRootNode();
    const root = isDocumentFragment(rootnode) ? rootnode : document;

    let done = ModuleHoistStyles[$hoisted].get(root);
    if (!done) ModuleHoistStyles[$hoisted].set(root, (done = new Set()));

    for (const key in this[$config].styles) {
      const id = `${tag}--${key}`;

      // Skip previously added - we dont want to update
      if (done.has(id)) continue;
      done.add(id);
      if (root.getElementById(id)) continue;

      const insert = document.createElement('style');
      insert.id = id;
      insert.textContent = this[$config].styles[key]
        .replaceAll('$tag', tag)
        .replace(/^(\s*)::part\(/gm, (_, ws) => `${ws}${tag}::part(`);

      (isDocument(root) ? root.head || root.documentElement : root).appendChild(insert);
    }
  }
}
