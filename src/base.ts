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
import { ConfigModules, instantiateModules } from './types/config';

function mergeConfig(config: ConfigModules, inherited: ConfigModules): ConfigModules {
  return instantiateModules({
    ...inherited,
    ...config,
    props: { ...inherited.props, ...config.props },
    styles: { ...inherited.styles, ...config.styles },
    injectSlots: [...(inherited.injectSlots ?? []), ...(config.injectSlots ?? [])],
  });
}

async function getExtended(config: ConfigModules): Promise<CustomElementConstructor> {
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

export async function base(config: ConfigModules): Promise<BtldElementConstructor> {
  const Extended = (await getExtended(config)) as BtldElementConstructor;
  class BtldElement extends Extended {
    static readonly [$staticConfig] = mergeConfig(config, Extended[$staticConfig] ?? {});
    static readonly [$staticObservedAttrs] = this[$staticConfig].moduleAttrs?.observed(super[$staticObservedAttrs]);

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
      const ctor = this.constructor as BtldElementConstructor;
      ctor[$staticConfig]?.moduleAttrs?.changed(this, name, newValue);
    }
    [$setupInternal]() {
      if (this[$flagSetupDone]) return;
      this[$flagSetupDone] = true;

      const ctor = this.constructor as BtldElementConstructor;
      if (!this.shadowRoot) ctor[$staticConfig]?.moduleShadow?.attachShadow(this);
      ctor[$staticConfig]?.moduleHoist?.hoist(this);
      ctor[$staticConfig]?.moduleProps?.setupErrorOnShadowed(this);
      ctor[$staticConfig]?.moduleAttrs?.setup(this);
      ctor[$staticConfig]?.moduleProps?.setupFallbackDefaults(this);
      safeInvoke(() => this[$setupCallback]?.());
    }
  }

  BtldElement[$staticConfig].moduleProps?.defineOnPrototype(BtldElement.prototype);

  return BtldElement;
}

export function register(element: BtldElementConstructor) {
  if (!element[$staticConfig]?.tag) throw Error('No tag defined via base(...)');
  customElements.define(element[$staticConfig]?.tag, element);
}

export const css = templateDisallowPlaceholder;
export const html = templateDisallowPlaceholder;
