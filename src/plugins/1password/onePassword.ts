import { FullItem, Vault } from '@1password/connect';
import { CPluginClient } from "@bettercorp/service-base/lib/ILib";
import { OPConnectItemBuild, OPConnectItemParsed, SimpleItem } from '../../OPConnect';
import { MyPluginConfig } from './sec.config';

export class onePassword<Parsed = OPConnectItemParsed, Build = OPConnectItemBuild> extends CPluginClient<MyPluginConfig> {
  public readonly _pluginName: string = "1password";

  public async getParsedItemByTitle(title: string, vaultId?: string): Promise<Parsed> {
    return this.initForPlugins('getParsedItemByTitle', title, vaultId);
  }
  public async getParsedItemById(id: string, vaultId?: string): Promise<Parsed> {
    return this.initForPlugins('getParsedItemById', id, vaultId);
  }
  public async getVault(vaultId?: string): Promise<Vault> {
    return this.initForPlugins('getVault', vaultId);
  }
  public async listVaults(): Promise<Array<Vault>> {
    return this.initForPlugins('listVaults');
  }
  public async listItems(vaultId?: string): Promise<Array<SimpleItem>> {
    return this.initForPlugins('listItems', vaultId);
  }
  public async createItem(title: string, category: FullItem.CategoryEnum, item: Build, tags?: Array<string>, vaultId?: string): Promise<Parsed> {
    return (this.initForPlugins as any)('createItem', title, category, item, tags, vaultId);
  }
  public async replaceItem(item: Parsed, vaultId?: string): Promise<Parsed> {
    return (this.initForPlugins as any)('replaceItem', item, vaultId);
  }
}
