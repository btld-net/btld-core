import type { BtldElement } from '../types/element';
import type { BtldPlugin, ParamsObserved } from '../types/config';
import {
  $flagSetupDone,
  $flagStopAttrPropLoop,
  $propState,
  $staticConfig,
  $staticObservedAttrs,
} from '../types/element';
import { hasDefault, hasObserve } from '../types/config';
import { safeDeepClone, sym, union } from '../internal/utils';

export const $changed = Symbol.for(sym + 'AttrChanged');
export const $reflect = Symbol.for(sym + 'AttrReflect');
export const $setup = Symbol.for(sym + 'AttrSetup');
const $coerceAttribute = Symbol.for(sym + 'AttrCoerce');
const $coercePropertyStrict = Symbol.for(sym + 'PropStrict');
const $stoppedLoop = Symbol.for(sym + 'LoopGuard');
const $syncAttribute = Symbol.for(sym + 'AttrSync');

interface ObservedProp {
  prop: string;
  attr: string;
  type: ParamsObserved;
}

const toKebabCase = (str: string) => str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export const attributesPlugin: BtldPlugin = (ctor) => {
  const proto = ctor.prototype;

  const byProp = new Map<string, ObservedProp>();
  const byAttr = new Map<string, ObservedProp>();
  const props = ctor[$staticConfig]?.props ?? {};

  for (const [prop, type] of Object.entries(props)) {
    if (!hasObserve(type)) continue;
    const attr = toKebabCase(prop);
    const existing = byAttr.get(attr);
    if (existing) throw new Error(`Properties "${existing.prop}" and "${prop}" both map to attribute "${attr}".`);

    const observed = { prop, attr, type };
    byProp.set(prop, observed);
    byAttr.set(attr, observed);
  }

  const observedAttrs = Array.from(byProp.values(), (observed) => observed.attr);
  ctor[$staticObservedAttrs] = union(ctor[$staticObservedAttrs], observedAttrs);

  proto[$coerceAttribute] ??= function (value: string | null, type: ParamsObserved) {
    if (type.observe === 'boolean') return value !== null;
    if (value === null) return undefined;
    if (type.observe === 'string') return value;
    if (type.observe === 'number' && value.trim()) {
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }
  };

  proto[$coercePropertyStrict] ??= function (value: unknown, type: ParamsObserved) {
    if (type.observe === 'boolean') return value === true ? '' : null;
    if (type.observe === 'string' && typeof value === 'string') return value;
    if (type.observe === 'number' && Number.isFinite(value)) return '' + value;
    return null;
  };

  proto[$stoppedLoop] ??= function (this: BtldElement, prop: string, action: () => void): true | undefined {
    this[$flagStopAttrPropLoop] ??= new Set();
    if (this[$flagStopAttrPropLoop].has(prop)) return true;
    try {
      this[$flagStopAttrPropLoop].add(prop);
      action();
    } finally {
      this[$flagStopAttrPropLoop].delete(prop);
    }
  };

  proto[$syncAttribute] ??= function (this: BtldElement, type: ParamsObserved, attr: string, raw: unknown) {
    const value = this[$coercePropertyStrict](raw, type);
    if (value === null && raw != null && raw !== false) {
      console.warn(`Attribute "${attr}" removed, expects ${type.observe} got ${typeof raw}`);
    }
    if (value === this.getAttribute(attr)) return;
    if (value === null) this.removeAttribute(attr);
    else this.setAttribute(attr, value);
  };

  // called by attributeChangedCallback

  proto[$changed] = function (this: BtldElement, attr: string, raw: string | null) {
    if (!this[$flagSetupDone]) return;
    this[$propState] ??= {};

    const observed = byAttr.get(attr);
    if (!observed) return;

    const { prop, type } = observed;
    const value = this[$coerceAttribute](raw, type);

    if (this[$stoppedLoop](prop, () => ((this as any)[prop] = value))) return;

    if (type.reflect && !Object.is(this[$propState][prop], value)) {
      // CASE: Property setter calls propertyChangedCallback that normalized the value
      this[$reflect](prop, this[$propState][prop]);
    }
  };

  // called by property setter

  proto[$reflect] = function (this: BtldElement, prop: string, raw: unknown) {
    const observed = byProp.get(prop);
    if (!observed) return;

    this[$stoppedLoop](prop, () => this[$syncAttribute](observed.type, observed.attr, raw));
  };

  // called just before setupCallback

  proto[$setup] = function (this: BtldElement) {
    // Setup is not done yet, so property setters skip callbacks and $changed() is suppressed.
    // Write state directly to apply precedence, then reflect explicitly.

    const state = (this[$propState] ??= {});

    for (const { prop, attr, type } of byProp.values()) {
      if (Object.hasOwn(state, prop)) {
        // PRECEDENCE 1: has preupgrade property or was manually assigned
      } else if (type.observe === 'boolean' || this.hasAttribute(attr)) {
        // PRECEDENCE 2: attribute is meaningful -> update prop
        state[prop] = this[$coerceAttribute](this.getAttribute(attr), type);
        continue; // no reflection
      } else if (hasDefault(type)) {
        // PRECEDENCE 3: use defaults
        state[prop] = safeDeepClone(type.default);
      } else {
        // FALLBACK UNINITIALIZED
        continue; // no reflection
      }
      if (type.reflect) this[$reflect](prop, state[prop]);
    }
  };
};
