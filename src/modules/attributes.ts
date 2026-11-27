import { ConfigModules, hasDefault, hasObserve, ParamsObserved } from '../types/config';
import { BtldElement, $flagSetupDone, $flagStopAttrPropLoop, $propState } from '../types/element';
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

export class ModuleAttributes {
  [$propToType] = new Map<string, ParamsObserved>();
  [$propToAttr] = new Map<string, string>();
  [$attrToProp] = new Map<string, string>();

  [$coerceAttribute](value: string | null, type: ParamsObserved) {
    if (type.observe === 'boolean') return value !== null;
    if (value === null) return undefined;
    if (type.observe === 'string') return value;
    if (type.observe === 'number' && value.trim()) {
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }
  }

  [$coercePropertyStrict](value: unknown, type: ParamsObserved) {
    if (type.observe === 'boolean') return value === true ? '' : null;
    if (type.observe === 'string' && typeof value === 'string') return value;
    if (type.observe === 'number' && Number.isFinite(value)) return '' + value;
    return null;
  }

  [$toKebabCase](str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  [$stoppedLoop](element: BtldElement, prop: string, action: () => void): true | undefined {
    element[$flagStopAttrPropLoop] ??= new Set();
    if (element[$flagStopAttrPropLoop].has(prop)) return true;
    try {
      element[$flagStopAttrPropLoop].add(prop);
      action();
    } finally {
      element[$flagStopAttrPropLoop].delete(prop);
    }
  }

  [$syncAttribute](element: BtldElement, type: ParamsObserved, attr: string, raw: unknown) {
    const value = this[$coercePropertyStrict](raw, type);
    if (value === null && raw != null && raw !== false) {
      console.warn(`Attribute "${attr}" removed, expects ${type.observe} got ${typeof raw}`);
    }
    if (value === element.getAttribute(attr)) return;
    if (value === null) element.removeAttribute(attr);
    else element.setAttribute(attr, value);
  }

  constructor(config: ConfigModules) {
    for (const prop in config.props) {
      if (!hasObserve(config.props[prop])) continue;
      const attr = this[$toKebabCase](prop);
      const existing = this[$attrToProp].get(attr);
      if (existing !== prop) throw new Error(`Properties "${existing}" and "${prop}" both map to attribute "${attr}".`);

      this[$propToType].set(prop, config.props[prop]);
      this[$propToAttr].set(prop, attr);
      this[$attrToProp].set(attr, prop);
    }
  }

  [$observed](inherit: string[] = []) {
    return [...inherit, ...this[$propToAttr].values()];
  }

  // called by attributeChangedCallback

  [$changed](element: BtldElement, attr: string, raw: null | string) {
    if (!element[$flagSetupDone]) return;
    element[$propState] ??= {};

    const prop = this[$attrToProp].get(attr);
    if (!prop) return;

    const type = this[$propToType].get(prop)!;
    const value = this[$coerceAttribute](raw, type);

    if (this[$stoppedLoop](element, prop, () => ((element as any)[prop] = value))) return;

    if (type.reflect && !Object.is(element[$propState][prop], value)) {
      // CASE: Property setter calls propertyChangedCallback that normalized the value
      this[$reflect](element, prop, element[$propState][prop]);
    }
  }

  // called by property setter

  [$reflect](element: BtldElement, prop: string, raw: unknown) {
    if (!element[$flagSetupDone]) return;

    const attr = this[$propToAttr].get(prop);
    if (!attr) return;

    const type = this[$propToType].get(prop)!;
    this[$stoppedLoop](element, prop, () => this[$syncAttribute](element, type, attr, raw));
  }

  // called just before setupCallback

  [$setup](element: BtldElement) {
    // $flagSetupDone is already true, so using the property setters would fire propertyChangedCallback.
    // To avoid that we write state directly and use the loop guard to stop changed() from running.

    const state = (element[$propState] ??= {});

    for (const [prop, type] of this[$propToType]) {
      const attr = this[$propToAttr].get(prop)!;

      if (Object.hasOwn(state, prop)) {
        // PRECEDENCE 1: has preupgrade property or was manually assigned
      } else if (type.observe === 'boolean' || element.hasAttribute(attr)) {
        // PRECEDENCE 2: attribute is meaningful -> update prop
        state[prop] = this[$coerceAttribute](element.getAttribute(attr), type);
        continue; // no reflection
      } else if (hasDefault(type)) {
        // PRECEDENCE 3: use defaults
        state[prop] = safeDeepClone(type.default);
      } else {
        // FALLBACK UNINITIALIZED
        continue; // no reflection
      }
      if (type.reflect) this[$reflect](element, prop, state[prop]);
    }
  }
}
