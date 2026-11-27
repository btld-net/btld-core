import type { Config, ParamsObserved } from './config';

export const $staticConfig = Symbol();
export const $staticTemplate = Symbol();
export const $staticObservedAttrs = 'observedAttributes';
export const $mergeObservedProps = Symbol();
export const $propToType = Symbol();
export const $propToAttr = Symbol();
export const $attrToProp = Symbol();
export const $hoisted = Symbol();

export const $setupInternal = Symbol();
export const $setupCallback = 'setupCallback';
export const $connectedCallback = 'connectedCallback';
export const $propertyChangedCallback = 'propertyChangedCallback';
export const $attributeChangedCallback = 'attributeChangedCallback';

export const $propState = Symbol();
export const $flagSetupDone = Symbol();
export const $flagStopAttrPropLoop = Symbol();

export interface BtldElementConstructor<Instance extends BtldElement = BtldElement> {
  readonly prototype: Instance;
  [$staticConfig]?: Config;
  [$staticTemplate]?: HTMLTemplateElement;
  [$staticObservedAttrs]?: string[];
  [$mergeObservedProps]: (inherit?: string[]) => string[];
  [$propToType]?: Map<string, ParamsObserved>;
  [$propToAttr]?: Map<string, string>;
  [$attrToProp]?: Map<string, string>;
  [$hoisted]?: WeakMap<Document | DocumentFragment, Set<string>>;
  new (...params: any[]): Instance;
}

export interface BtldElement extends HTMLElement {
  [key: symbol]: any;
  [$setupInternal]?(): void;
  [$setupCallback]?(): void;
  [$connectedCallback]?(): void;
  [$propertyChangedCallback]?(name: string, oldValue: unknown, newValue: unknown): void;
  [$attributeChangedCallback]?(name: string, oldValue: string | null, newValue: string | null): void;

  [$propState]?: Record<string, unknown>;
  [$flagSetupDone]?: true;
  [$flagStopAttrPropLoop]?: Set<string>;

  [key: string]: unknown;
}
