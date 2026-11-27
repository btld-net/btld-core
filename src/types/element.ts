import type { Config } from './config';
import { sym } from '../internal/utils';

export const $staticConfig = Symbol.for(sym + 'ElConfig');
export const $staticTemplate = Symbol.for(sym + 'ElTemplate');
export const $staticObservedAttrs = 'observedAttributes';
export const $hoisted = Symbol.for(sym + 'StyleHoisted');

export const $setupInternal = Symbol.for(sym + 'ElSetup');
export const $setupCallback = 'setupCallback';
export const $connectedCallback = 'connectedCallback';
export const $propertyChangedCallback = 'propertyChangedCallback';
export const $attributeChangedCallback = 'attributeChangedCallback';

export const $propState = Symbol.for(sym + 'PropState');
export const $flagSetupDone = Symbol.for(sym + 'ElSetupDone');
export const $flagStopAttrPropLoop = Symbol.for(sym + 'AttrPropLoop');

export interface BtldElementConstructor<Instance extends BtldElement = BtldElement> {
  readonly prototype: Instance;
  [$staticConfig]?: Config;
  [$staticTemplate]?: HTMLTemplateElement;
  [$staticObservedAttrs]?: string[];
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
