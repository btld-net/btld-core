import type { BtldElementConstructor } from './types/element';
import {
  $connectedCallback,
  $setupInternal,
  $setupCallback,
  $flagSetupDone,
  $staticConfig,
  $attributeChangedCallback,
} from './types/element';
import { safeInvokeAsTask, safeInvoke, templateDisallowPlaceholder, union } from './internal/utils';
import type { Config } from './types/config';
import { $changed, $setup } from './plugins/attributes';
import { $constructorCapturePreupgrade, $setupErrorOnShadowed, $setupFallbackDefaults } from './plugins/properties';
import { $attachShadow } from './plugins/shadow';
import { $hoist } from './plugins/styles';

async function getExtended(config: Config): Promise<CustomElementConstructor> {
  const { tag, extend } = config;
  if (typeof extend !== 'string') return extend ?? HTMLElement;
  if (!customElements.get(extend)) await waitForExtended(tag, extend);
  return customElements.get(extend)!;
}

async function waitForExtended(tag: string | undefined, extend: string): Promise<void> {
  const warn = () => console.warn(`<${tag}> waiting on <${extend}> (>10s)`);
  const timer = setTimeout(warn, 10_000);
  await customElements.whenDefined(extend);
  clearTimeout(timer);
}

export async function base(config: Config): Promise<BtldElementConstructor> {
  const Extended = (await getExtended(config)) as BtldElementConstructor;
  const parent = Extended[$staticConfig] ?? {};

  class BtldElement extends Extended {
    static readonly [$staticConfig]: Config = {
      ...parent,
      ...config,
      props: { ...parent.props, ...config.props },
      styles: { ...parent.styles, ...config.styles },
      injectSlots: union(parent.injectSlots, config.injectSlots),
      plugins: union(parent.plugins, config.plugins),
    };

    constructor() {
      super();
      this[$constructorCapturePreupgrade]?.();
      // Use setTimeout instead of a microtask. When the parser creates an element synchronously during page load, a
      // microtask checkpoint runs right after the constructor and any setAttribute in it would throw the NotSupportedError
      safeInvokeAsTask(() => this[$setupInternal]());
    }
    [$connectedCallback]() {
      super[$connectedCallback]?.();
      safeInvoke(() => this[$setupInternal]());
    }
    [$attributeChangedCallback](name: string, oldValue: string | null, newValue: string | null) {
      super[$attributeChangedCallback]?.(name, oldValue, newValue);
      this[$changed]?.(name, newValue);
    }
    [$setupInternal]() {
      if (this[$flagSetupDone]) return;

      if (!this.shadowRoot) this[$attachShadow]?.();
      this[$hoist]?.();
      this[$setupErrorOnShadowed]?.();
      this[$setup]?.();
      this[$setupFallbackDefaults]?.();
      this[$flagSetupDone] = true;
      safeInvoke(() => this[$setupCallback]?.());
    }
  }

  for (const plugin of BtldElement[$staticConfig].plugins ?? []) plugin(BtldElement);

  return BtldElement;
}

export function register(element: BtldElementConstructor) {
  if (!element[$staticConfig]?.tag) throw Error('No tag defined via base(...)');
  customElements.define(element[$staticConfig]?.tag, element);
}

export const css = templateDisallowPlaceholder;
export const html = templateDisallowPlaceholder;
