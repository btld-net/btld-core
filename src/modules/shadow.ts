import { ConfigModules } from '../types/config';
import { BtldElement } from '../types/element';

export const $_template = Symbol();
export const $_normalize = Symbol();
export const $_injectSlot = Symbol();
export const $_injectGlobalStyle = Symbol();
export const $_buildGlobalStyleSelector = Symbol();

export class ModuleShadowDom {
  [$_template]: HTMLTemplateElement | undefined;
  constructor(protected config: ConfigModules) {}

  [$_normalize](content: DocumentFragment) {
    const inject = new Set(this.config.injectSlots);
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
      this[$_injectSlot](el, inject, doc, 'before');
      this[$_injectSlot](el, inject, doc, 'after');
      this[$_injectSlot](el, inject, doc, 'inner');
      this[$_injectSlot](el, inject, doc, 'replace');
    }
  }

  [$_injectSlot](element: Element, inject: Set<string>, doc: Document, kind: string) {
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

  [$_buildGlobalStyleSelector](tag: string) {
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
  [$_injectGlobalStyle](content: DocumentFragment) {
    if (!this.config.tag) return;
    const selector = this[$_buildGlobalStyleSelector](this.config.tag);
    const elements = content.ownerDocument.querySelectorAll(selector);
    for (const el of elements) {
      content.appendChild(el.cloneNode(true));
    }
  }

  attachShadow(element: BtldElement) {
    const shadow = element.attachShadow({ mode: 'open' });
    if (!this[$_template]) {
      const template = (this[$_template] = document.createElement('template'));
      template.innerHTML = this.config?.shadow ?? '<slot></slot>';
      this[$_normalize](template.content);
      this[$_injectGlobalStyle](template.content);
    }
    shadow.appendChild(this[$_template].content.cloneNode(true));
  }
}
