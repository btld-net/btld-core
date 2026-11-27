import type { Config } from './types/config';
import type { BtldElementConstructor } from './types/element';
import { attributesPlugin } from './plugins/attributes';
import { propertiesPlugin } from './plugins/properties';
import { shadowPlugin } from './plugins/shadow';
import { hoistStylesPlugin } from './plugins/styles';
import { base } from './base';
import { union } from './internal/utils';

export { html, css, register } from './base';

const builtin = [
  shadowPlugin, 
  hoistStylesPlugin, 
  propertiesPlugin, 
  attributesPlugin,
];

export async function component(config: Config): Promise<BtldElementConstructor> {
  return base({
    ...config,
    plugins: union(builtin, config.plugins),
  });
}
