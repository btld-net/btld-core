import { ConfigModules } from './types/config';
import { BtldElementConstructor } from './types/element';
import { ModuleShadowDom } from './modules/shadow';
import { ModuleHoistStyles } from './modules/styles';
import { ModuleAttributes } from './modules/attributes';
import { ModuleProperties } from './modules/properties';
import { base } from './base';

export { html, css, register } from './base';

export async function component(config: ConfigModules): Promise<BtldElementConstructor> {
  return base({
    ModuleShadowCtor: ModuleShadowDom,
    ModuleHoistCtor: ModuleHoistStyles,
    ModuleAttrsCtor: ModuleAttributes,
    ModulePropsCtor: ModuleProperties,
    ...config,
  });
}
