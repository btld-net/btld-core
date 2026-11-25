import type { ModuleAttributes } from '../modules/attributes';
import type { ModuleProperties } from '../modules/properties';
import type { ModuleShadowDom } from '../modules/shadow';
import type { ModuleHoistStyles } from '../modules/styles';

export interface Config {
  tag?: string;
  extend?: string | CustomElementConstructor;
  shadow?: string;
  styles?: Record<string, string>;
  props?: ConfigParams;
  injectSlots?: string[];
  injectStyles?: boolean;
}

export type ConfigParams = Record<string, ParamsWatched | ParamsObserved>;

export type ParamsObserved =
  | { observe: 'string'; reflect?: boolean; default?: string }
  | { observe: 'number'; reflect?: boolean; default?: number }
  | { observe: 'boolean'; reflect?: boolean };

export type ParamsWatched = true | { observe?: never; reflect?: never; default?: unknown };

export type InferredProps<C extends Record<string, ParamsWatched | ParamsObserved>> = {
  [K in keyof C]: InferredPropType<C[K]> | undefined;
};

// prettier-ignore
export type InferredPropType<P> =
  P extends { observe: 'boolean' } ? boolean : 
  P extends { observe: 'string' } ? string : 
  P extends { observe: 'number' } ? number : 
  P extends { default: infer D } ? D : 
  unknown;

export function hasObserve(watched: ParamsWatched | ParamsObserved): watched is ParamsObserved {
  return typeof watched === 'object' && 'observe' in watched;
}

export function hasDefault(watched: ParamsWatched | ParamsObserved): watched is { default: unknown } {
  return typeof watched === 'object' && 'default' in watched;
}

export interface ConfigModules extends Config {
  ModuleShadowCtor?: typeof ModuleShadowDom;
  moduleShadow?: ModuleShadowDom;
  ModuleHoistCtor?: typeof ModuleHoistStyles;
  moduleHoist?: ModuleHoistStyles;
  ModuleAttrsCtor?: typeof ModuleAttributes;
  moduleAttrs?: ModuleAttributes;
  ModulePropsCtor?: typeof ModuleProperties;
  moduleProps?: ModuleProperties;
}

export function instantiateModules(config: ConfigModules): ConfigModules {
  if (config.ModuleShadowCtor) config.moduleShadow = new config.ModuleShadowCtor(config);
  if (config.ModuleHoistCtor) config.moduleHoist = new config.ModuleHoistCtor(config);
  if (config.ModuleAttrsCtor) config.moduleAttrs = new config.ModuleAttrsCtor(config);
  if (config.ModulePropsCtor) config.moduleProps = new config.ModulePropsCtor(config);
  return config;
}
