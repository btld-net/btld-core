import type { BtldElementConstructor } from './element';

export interface Config {
  tag?: string;
  extend?: string | BtldElementConstructor;
  shadow?: string;
  styles?: Record<string, string>;
  props?: ConfigParams;
  injectSlots?: string[];
  injectStyles?: boolean;
  plugins?: BtldPlugin[];
}

export type BtldPlugin = (ctor: BtldElementConstructor) => void;

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
