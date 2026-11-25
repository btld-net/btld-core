import { BtldElement, $flagSetupDone, $propState } from '../types/element';
import { safeDeepClone } from '../internal/utils';
import { ConfigModules, hasDefault } from '../types/config';

export class ModuleProperties {
  constructor(protected config: ConfigModules) {}

  defineOnPrototype(prototype: any) {
    const { moduleAttrs } = this.config;

    for (const prop in this.config.props) {
      if (prop in HTMLElement.prototype) {
        throw new Error(`Configured property "${prop}" overrides an existing property of HTMLElement.`);
      }

      Object.defineProperty(prototype, prop, {
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
            moduleAttrs?.reflect(this, prop, state[prop]);
          }
        },
        enumerable: true,
        configurable: true, // false would still allow the field to be shadowed in sub class
      });
    }
  }

  constructorCapturePreupgrade(instance: BtldElement) {
    const state = (instance[$propState] ??= {});
    for (const prop in this.config.props) {
      if (Object.hasOwn(instance, prop)) state[prop] = instance[prop];
      // Delete preupgrade props to expose properties on prototype
      delete instance[prop];
    }
  }

  setupErrorOnShadowed(instance: BtldElement) {
    // Show error if props on the prototype are shadowed / hidden by subclass
    for (const prop in this.config.props) {
      if (Object.hasOwn(instance, prop)) {
        console.error(`Configured property "${prop}" is shadowed. Use "declare" instead of a class-field.`);
        // We dont rescue the value, because that might make the error acceptable since it still works
        delete instance[prop];
      }
    }
  }

  setupFallbackDefaults(instance: BtldElement) {
    const state = (instance[$propState] ??= {});
    for (const prop in this.config.props) {
      if (!Object.hasOwn(state, prop) && hasDefault(this.config.props[prop])) {
        state[prop] = safeDeepClone(this.config.props[prop].default);
      }
    }
  }
}
