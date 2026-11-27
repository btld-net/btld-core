import { ConfigModules } from '../types/config';
import { BtldElement } from '../types/element';

export const $config = Symbol();
export const $attachShadow = Symbol();
export const $template = Symbol();
export const $normalize = Symbol();
export const $injectSlot = Symbol();
export const $injectGlobalStyle = Symbol();
export const $buildGlobalStyleSelector = Symbol();

export class ModuleShadowDom {
  [$template]: HTMLTemplateElement | undefined;
  [$config]: ConfigModules;
  constructor(config: ConfigModules) {
    this[$config] = config;
  }

  [$normalize](content: DocumentFragment) {
    const inject = new Set(this[$config].injectSlots);
    const elements = Array.from(content.querySelectorAll('*'));

    const counts = new Map<string, number>();
    for (const el of elements) {
      const tag = el.localName;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }

    for (const el of elements) {
      const tag = el.localName;

      // 1. ID
      if (el.id.includes('--')) throw Error(`ID "${el.id}" cannot contain "--"`);

      if (tag === 'slot') {
        const name = el.getAttribute('name');
        if (name === 'default') throw Error('<slot name="default"> is not allowed');
        el.id ||= name ? `slot--${name}` : 'slot--default';
      }

      if (!el.id && counts.get(tag) === 1) el.id = tag;
      if (!el.id) throw Error(`Element <${tag}> must have an ID.`);

      // 2. Part
      if (!el.getAttribute('part')) el.setAttribute('part', `${el.id} tag--${tag}`);

      // 3. Slots
      const doc = content.ownerDocument;
      this[$injectSlot](el, inject, doc, 'before');
      this[$injectSlot](el, inject, doc, 'after');
      this[$injectSlot](el, inject, doc, 'inner');
      this[$injectSlot](el, inject, doc, 'replace');
    }
  }

  [$injectSlot](element: Element, inject: Set<string>, doc: Document, kind: string) {
    const name = `${element.id}--${kind}`;
    if (!inject.has(name)) return;

    const slot = doc.createElement('slot');
    slot.id = `slot--${name}`;
    slot.name = name;
    slot.setAttribute('part', `${slot.id} tag--slot`);

    if (kind === 'before') element.before(slot);
    if (kind === 'after') element.after(slot);
    if (kind === 'inner') {
      slot.append(...element.childNodes);
      element.appendChild(slot);
    }
    if (kind === 'replace') {
      element.replaceWith(slot);
      slot.appendChild(element);
    }
  }

  [$buildGlobalStyleSelector](tag: string) {
    // 'a-b-c-d' -> ['a-*', 'a-b-*', 'a-b-c-*']
    const parts = tag.split('-');
    const prefixes = parts.slice(0, -1).map((_, i) => `${parts.slice(0, i + 1).join('-')}-*`);

    const values = [tag, ...prefixes];
    return values.flatMap((v) => [`style[inject~="${v}"]`, `link[inject~="${v}"]`]).join(', ');
  }

  /**
   * Inject document <style> and <link> tags into the template
   * <style inject="prefix-* exact-tag"></style>
   */
  [$injectGlobalStyle](content: DocumentFragment) {
    if (!this[$config].tag) return;
    const selector = this[$buildGlobalStyleSelector](this[$config].tag);
    const elements = content.ownerDocument.querySelectorAll(selector);
    for (const el of elements) {
      content.appendChild(el.cloneNode(true));
    }
  }

  [$attachShadow](element: BtldElement) {
    const shadow = element.attachShadow({ mode: 'open' });
    if (!this[$template]) {
      const template = (this[$template] = document.createElement('template'));
      template.innerHTML = this[$config]?.shadow ?? '<slot></slot>';
      this[$normalize](template.content);
      this[$injectGlobalStyle](template.content);
    }
    shadow.appendChild(this[$template].content.cloneNode(true));
  }
}
