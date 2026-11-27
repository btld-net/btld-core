import {
  BtldElementConstructor,
  $connectedCallback,
  $setupInternal,
  $setupCallback,
  $flagSetupDone,
  $staticConfig,
  $staticObservedAttrs,
  $attributeChangedCallback,
} from './types/element';
import { safeInvokeAsTask, safeInvoke, templateDisallowPlaceholder } from './internal/utils';
import { Config } from './types/config';
import { $changed, $observed, $setup } from './plugins/attributes';
import { $setupErrorOnShadowed, $setupFallbackDefaults } from './plugins/properties';
import { $attachShadow } from './plugins/shadow';
import { $hoist } from './plugins/styles';

function mergeConfig(config: Config, inherited: Config): Config {
  return {
    ...inherited,
    ...config,
    props: { ...inherited.props, ...config.props },
    styles: { ...inherited.styles, ...config.styles },
    injectSlots: [...(inherited.injectSlots ?? []), ...(config.injectSlots ?? [])],
    plugins: [...new Set([...(inherited.plugins ?? []), ...(config.plugins ?? [])])],
  };
}

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
  class BtldElement extends Extended {
    static [$staticConfig] = mergeConfig(config, Extended[$staticConfig] ?? {});

    constructor() {
      super();
      // Use setTimeout instead of a microtask. When the parser creates an element synchronously during page load, a
      // microtask checkpoint runs right after the constructor and any setAttribute in it would throw the NotSupportedError
      safeInvokeAsTask(() => this[$setupInternal]());
    }
    [$connectedCallback]() {
      super[$connectedCallback]?.();
      safeInvoke(() => this[$setupInternal]());
    }
    [$attributeChangedCallback](name: string, _: unknown, newValue: string | null) {
      this[$changed]?.(name, newValue);
    }
    [$setupInternal]() {
      if (this[$flagSetupDone]) return;
      this[$flagSetupDone] = true;

      if (!this.shadowRoot) this[$attachShadow]?.();
      this[$hoist]?.();
      this[$setupErrorOnShadowed]?.();
      this[$setup]?.();
      this[$setupFallbackDefaults]?.();
      safeInvoke(() => this[$setupCallback]?.());
    }
  }

  for (const plugin of BtldElement[$staticConfig].plugins ?? []) plugin(BtldElement);

  const observed = BtldElement[$observed];
  if (observed) {
    Object.defineProperty(BtldElement, $staticObservedAttrs, {
      value: observed.call(BtldElement, Extended[$staticObservedAttrs] ?? []),
      configurable: true,
    });
  }

  return BtldElement;
}

export function register(element: BtldElementConstructor) {
  if (!element[$staticConfig]?.tag) throw Error('No tag defined via base(...)');
  customElements.define(element[$staticConfig]?.tag, element);
}

export const css = templateDisallowPlaceholder;
export const html = templateDisallowPlaceholder;
