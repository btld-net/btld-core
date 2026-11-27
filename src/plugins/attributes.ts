import type { BtldElement, BtldElementConstructor } from '../types/element';
import type { BtldPlugin, Config, ParamsObserved } from '../types/config';
import { $flagSetupDone, $flagStopAttrPropLoop, $propState, $staticConfig } from '../types/element';
import { hasDefault, hasObserve } from '../types/config';
import { safeDeepClone } from '../internal/utils';

export const $observed = Symbol();
export const $changed = Symbol();
export const $reflect = Symbol();
export const $setup = Symbol();
export const $propToType = Symbol();
export const $propToAttr = Symbol();
export const $attrToProp = Symbol();
export const $coerceAttribute = Symbol();
export const $coercePropertyStrict = Symbol();
export const $toKebabCase = Symbol();
export const $stoppedLoop = Symbol();
export const $syncAttribute = Symbol();

interface AttributeMaps {
  propToType: Map<string, ParamsObserved>;
  propToAttr: Map<string, string>;
  attrToProp: Map<string, string>;
}

const toKebabCase = (str: string) => str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function buildMaps(config: Config): AttributeMaps {
  const propToType = new Map<string, ParamsObserved>();
  const propToAttr = new Map<string, string>();
  const attrToProp = new Map<string, string>();

  for (const prop in config.props ?? {}) {
    const watched = config.props![prop];
    if (!hasObserve(watched)) continue;
    const attr = toKebabCase(prop);
    const existing = attrToProp.get(attr);
    if (existing !== prop) throw new Error(`Properties "${existing}" and "${prop}" both map to attribute "${attr}".`);

    propToType.set(prop, watched);
    propToAttr.set(prop, attr);
    attrToProp.set(attr, prop);
  }

  return { propToType, propToAttr, attrToProp };
}

function mapsFor(ctor: BtldElementConstructor): AttributeMaps {
  if (!Object.hasOwn(ctor, $propToType)) {
    const maps = buildMaps(ctor[$staticConfig] ?? {});
    ctor[$propToType] = maps.propToType;
    ctor[$propToAttr] = maps.propToAttr;
    ctor[$attrToProp] = maps.attrToProp;
  }
  return {
    propToType: ctor[$propToType],
    propToAttr: ctor[$propToAttr],
    attrToProp: ctor[$attrToProp],
  };
}

export const attributesPlugin: BtldPlugin = (ctor) => {
  const proto = ctor.prototype;

  ctor[$observed] ??= function (this: BtldElementConstructor, inherit: string[] = []) {
    return [...inherit, ...mapsFor(this).propToAttr.values()];
  };

  proto[$toKebabCase] ??= function (str: string): string {
    return toKebabCase(str);
  };

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

  proto[$changed] ??= function (this: BtldElement, attr: string, raw: string | null) {
    if (!this[$flagSetupDone]) return;
    this[$propState] ??= {};

    const maps = mapsFor(this.constructor as BtldElementConstructor);
    const prop = maps.attrToProp.get(attr);
    if (!prop) return;

    const type = maps.propToType.get(prop)!;
    const value = this[$coerceAttribute](raw, type);

    if (this[$stoppedLoop](prop, () => ((this as any)[prop] = value))) return;

    if (type.reflect && !Object.is(this[$propState][prop], value)) {
      // CASE: Property setter calls propertyChangedCallback that normalized the value
      this[$reflect](prop, this[$propState][prop]);
    }
  };

  // called by property setter

  proto[$reflect] ??= function (this: BtldElement, prop: string, raw: unknown) {
    if (!this[$flagSetupDone]) return;

    const maps = mapsFor(this.constructor as BtldElementConstructor);
    const attr = maps.propToAttr.get(prop);
    if (!attr) return;

    const type = maps.propToType.get(prop)!;
    this[$stoppedLoop](prop, () => this[$syncAttribute](type, attr, raw));
  };

  // called just before setupCallback

  proto[$setup] ??= function (this: BtldElement) {
    // $flagSetupDone is already true, so using the property setters would fire propertyChangedCallback.
    // To avoid that we write state directly and use the loop guard to stop changed() from running.

    const maps = mapsFor(this.constructor as BtldElementConstructor);
    const state = (this[$propState] ??= {});

    for (const [prop, type] of maps.propToType) {
      const attr = maps.propToAttr.get(prop)!;

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
