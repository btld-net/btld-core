import type { BtldElementConstructor } from './types/element';
import {
  $connectedCallback,
  $setupInternal,
  $setupCallback,
  $flagSetupDone,
  $staticConfig,
} from './types/element';
import { safeInvokeAsTask, safeInvoke, templateDisallowPlaceholder, union } from './internal/utils';
import type { Config } from './types/config';
import { $setup } from './plugins/attributes';
import { $constructorCapturePreupgrade, $setupErrorOnShadowed, $setupFallbackDefaults } from './plugins/properties';
import { $attachShadow } from './plugins/shadow';
import { $hoist } from './plugins/styles';

async function getExtended({ tag, extend }: Config): Promise<BtldElementConstructor> {
  if (!extend) return HTMLElement as BtldElementConstructor;
  return typeof extend === 'string' ? await resolveExtend(tag, extend) : extend;
}

async function resolveExtend(tag: string | undefined, extend: string): Promise<BtldElementConstructor> {
  if (!customElements.get(extend)) {
    const timer = setTimeout(() => console.warn(`<${tag}> waiting on <${extend}> (>10s)`), 10_000);
    await customElements.whenDefined(extend).finally(() => clearTimeout(timer));
  }
  const ctor = customElements.get(extend) as BtldElementConstructor;
  if (!ctor[$staticConfig]) throw Error(`Cannot extend <${extend}>, not a Btld component.`);
  return ctor;
}

export async function base(config: Config): Promise<BtldElementConstructor> {
  const Extended = await getExtended(config);
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
