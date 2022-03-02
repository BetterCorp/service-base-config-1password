import { FullItem, Vault } from '@1password/connect';
import { CPlugin } from "@bettercorp/service-base/lib/interfaces/plugins";
import { OPConnectItemBuild, OPConnectItemParsed, OPConnector, SimpleItem } from '../../OPConnect';
import { MyPluginConfig } from './sec.config';

export class Plugin extends CPlugin<MyPluginConfig> {
  private onePassword!: OPConnector;

  init(): Promise<void> {
    const self = this;
    return new Promise(async (resolve) => {
      self.onePassword = new OPConnector((await self.getPluginConfig()).serverUrl, (await self.getPluginConfig()).token, (await self.getPluginConfig()).vaultId);
      resolve();
    });
  }

  private async _getVaultId(vaultId?: string): Promise<string> {
    if ((await this.getPluginConfig()).lockToVault) return (await this.getPluginConfig()).vaultId;
    return vaultId || (await this.getPluginConfig()).vaultId;
  }

  public async getParsedItemByTitle(title: string, vaultId?: string): Promise<OPConnectItemParsed> {
    return await this.onePassword.getParsedItemByTitle(title, await this._getVaultId(vaultId));
  }
  public async getParsedItemById(id: string, vaultId?: string): Promise<OPConnectItemParsed> {
    return await this.onePassword.getParsedItemById(id, await this._getVaultId(vaultId));
  }
  public async getVault(vaultId?: string): Promise<Vault> {
    return await this.onePassword.getVault(await this._getVaultId(vaultId));
  }
  public async listVaults(): Promise<Array<Vault>> {
    if ((await this.getPluginConfig()).lockToVault) throw 'Not allowed to view vaults';
    return await this.onePassword.listVaults();
  }
  public async listItems(vaultId?: string): Promise<Array<SimpleItem>> {
    return await this.onePassword.listItems(await this._getVaultId(vaultId));
  }
  public async createItem(title: string, category: FullItem.CategoryEnum, item: OPConnectItemBuild, tags?: Array<string>, vaultId?: string): Promise<OPConnectItemParsed> {
    return await this.onePassword.createItem(title, category, item, tags, await this._getVaultId(vaultId));
  }
  public async replaceItem(item: OPConnectItemParsed, vaultId?: string): Promise<OPConnectItemParsed> {
    return await this.onePassword.replaceItem(item, await this._getVaultId(vaultId), this);
  }
}