import { ConfigModules, hasDefault, hasObserve, ParamsObserved } from '../types/config';
import { BtldElement, $flagSetupDone, $flagStopAttrPropLoop, $propState } from '../types/element';
import { safeDeepClone } from '../internal/utils';

export const $_propToType = Symbol();
export const $_propToAttr = Symbol();
export const $_attrToProp = Symbol();
export const $_coerceAttribute = Symbol();
export const $_coercePropertyStrict = Symbol();
export const $_toKebabCase = Symbol();
export const $_stoppedLoop = Symbol();
export const $_syncAttribute = Symbol();

export class ModuleAttributes {
  [$_propToType] = new Map<string, ParamsObserved>();
  [$_propToAttr] = new Map<string, string>();
  [$_attrToProp] = new Map<string, string>();

  [$_coerceAttribute](value: string | null, type: ParamsObserved) {
    if (type.observe === 'boolean') return value !== null;
    if (value === null) return undefined;
    if (type.observe === 'string') return value;
    if (type.observe === 'number' && value.trim()) {
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }
  }

  [$_coercePropertyStrict](value: unknown, type: ParamsObserved) {
    if (type.observe === 'boolean') return value === true ? '' : null;
    if (type.observe === 'string' && typeof value === 'string') return value;
    if (type.observe === 'number' && Number.isFinite(value)) return '' + value;
    return null;
  }

  [$_toKebabCase](str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  [$_stoppedLoop](element: BtldElement, prop: string, action: () => void): true | undefined {
    element[$flagStopAttrPropLoop] ??= new Set();
    if (element[$flagStopAttrPropLoop].has(prop)) return true;
    try {
      element[$flagStopAttrPropLoop].add(prop);
      action();
    } finally {
      element[$flagStopAttrPropLoop].delete(prop);
    }
  }

  [$_syncAttribute](element: BtldElement, type: ParamsObserved, attr: string, raw: unknown) {
    const value = this[$_coercePropertyStrict](raw, type);
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
      const attr = this[$_toKebabCase](prop);
      const existing = this[$_attrToProp].get(attr);
      if (existing !== prop) throw new Error(`Properties "${existing}" and "${prop}" both map to attribute "${attr}".`);

      this[$_propToType].set(prop, config.props[prop]);
      this[$_propToAttr].set(prop, attr);
      this[$_attrToProp].set(attr, prop);
    }
  }

  observed(inherit: string[] = []) {
    return [...inherit, ...this[$_propToAttr].values()];
  }

  // called by attributeChangedCallback

  changed(element: BtldElement, attr: string, raw: null | string) {
    if (!element[$flagSetupDone]) return;
    element[$propState] ??= {};

    const prop = this[$_attrToProp].get(attr);
    if (!prop) return;

    const type = this[$_propToType].get(prop)!;
    const value = this[$_coerceAttribute](raw, type);

    if (this[$_stoppedLoop](element, prop, () => ((element as any)[prop] = value))) return;

    if (type.reflect && !Object.is(element[$propState][prop], value)) {
      // CASE: Property setter calls propertyChangedCallback that normalized the value
      this.reflect(element, prop, element[$propState][prop]);
    }
  }

  // called by property setter

  reflect(element: BtldElement, prop: string, raw: unknown) {
    if (!element[$flagSetupDone]) return;

    const attr = this[$_propToAttr].get(prop);
    if (!attr) return;

    const type = this[$_propToType].get(prop)!;
    this[$_stoppedLoop](element, prop, () => this[$_syncAttribute](element, type, attr, raw));
  }

  // called just before setupCallback

  setup(element: BtldElement) {
    // $flagSetupDone is already true, so using the property setters would fire propertyChangedCallback.
    // To avoid that we write state directly and use the loop guard to stop changed() from running.

    const state = (element[$propState] ??= {});

    for (const [prop, type] of this[$_propToType]) {
      const attr = this[$_propToAttr].get(prop)!;

      if (Object.hasOwn(state, prop)) {
        // PRECEDENCE 1: has preupgrade property or was manually assigned
      } else if (type.observe === 'boolean' || element.hasAttribute(attr)) {
        // PRECEDENCE 2: attribute is meaningful -> update prop
        state[prop] = this[$_coerceAttribute](element.getAttribute(attr), type);
        continue; // no reflection
      } else if (hasDefault(type)) {
        // PRECEDENCE 3: use defaults
        state[prop] = safeDeepClone(type.default);
      } else {
        // FALLBACK UNINITIALIZED
        continue; // no reflection
      }
      if (type.reflect) this.reflect(element, prop, state[prop]);
    }
  }
}
