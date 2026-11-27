import type { BtldElement, BtldElementConstructor } from '../types/element';
import type { BtldPlugin } from '../types/config';
import { $flagSetupDone, $propState, $staticConfig } from '../types/element';
import { hasDefault } from '../types/config';
import { safeDeepClone } from '../internal/utils';
import { $reflect } from './attributes';

export const $constructorCapturePreupgrade = Symbol();
export const $setupErrorOnShadowed = Symbol();
export const $setupFallbackDefaults = Symbol();

function defineOnPrototype(ctor: BtldElementConstructor) {
  const config = ctor[$staticConfig] ?? {};

  for (const prop in config.props ?? {}) {
    if (prop in HTMLElement.prototype) {
      throw new Error(`Configured property "${prop}" overrides an existing property of HTMLElement.`);
    }

    Object.defineProperty(ctor.prototype, prop, {
      get(this: BtldElement) {
        return this[$propState]?.[prop];
      },
      set(this: BtldElement, value: unknown) {
        const state = (this[$propState] ??= {});
        const old = state[prop];
        state[prop] = value;

        if (!this[$flagSetupDone]) return;
        try {
          if (this.propertyChangedCallback) this.propertyChangedCallback(prop, old, value);
        } finally {
          // Dont use value as this might be stale, if propertyChangedCallback makes changes to it
          this[$reflect]?.(prop, state[prop]);
        }
      },
      enumerable: true,
      configurable: true, // false would still allow the field to be shadowed in sub class
    });
  }
}

export const propertiesPlugin: BtldPlugin = (ctor) => {
  defineOnPrototype(ctor);

  const proto = ctor.prototype;

  proto[$constructorCapturePreupgrade] ??= function (this: BtldElement) {
    const config = (this.constructor as BtldElementConstructor)[$staticConfig] ?? {};
    const props = config.props ?? {};
    const state = (this[$propState] ??= {});
    for (const prop in props) {
      if (Object.hasOwn(this, prop)) state[prop] = this[prop];
      // Delete preupgrade props to expose properties on prototype
      delete this[prop];
    }
  };

  proto[$setupErrorOnShadowed] ??= function (this: BtldElement) {
    // Show error if props on the prototype are shadowed / hidden by subclass
    const config = (this.constructor as BtldElementConstructor)[$staticConfig] ?? {};
    for (const prop in config.props ?? {}) {
      if (Object.hasOwn(this, prop)) {
        console.error(`Configured property "${prop}" is shadowed. Use "declare" instead of a class-field.`);
        // We dont rescue the value, because that might make the error acceptable since it still works
        delete this[prop];
      }
    }
  };

  proto[$setupFallbackDefaults] ??= function (this: BtldElement) {
    const config = (this.constructor as BtldElementConstructor)[$staticConfig] ?? {};
    const props = config.props ?? {};
    const state = (this[$propState] ??= {});
    for (const prop in props) {
      if (!Object.hasOwn(state, prop) && hasDefault(props[prop])) {
        state[prop] = safeDeepClone(props[prop].default);
      }
    }
  };
};
