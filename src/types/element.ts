import type { Config } from './config';

export const $staticConfig = Symbol();
export const $staticTemplate = Symbol();
export const $staticObservedAttrs = 'observedAttributes';

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
  [key: symbol]: any;
  [$staticConfig]?: Config;
  [$staticTemplate]?: HTMLTemplateElement;
  [$staticObservedAttrs]?: string[];
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
