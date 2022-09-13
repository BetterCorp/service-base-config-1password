import { FullItem, Vault } from "@1password/connect";
import { ServiceCallable, ServicesBase } from "@bettercorp/service-base";
import {
  OPConnectItemBuild,
  OPConnectItemParsed,
  OPConnector,
  SimpleItem,
} from "../../OPConnect";
import { MyPluginConfig } from "./sec.config";

export interface OnePasswordReturnableEvents extends ServiceCallable {
  getParsedItemByTitle(
    title: string,
    vaultId?: string
  ): Promise<OPConnectItemParsed>;
  getParsedItemById(id: string, vaultId?: string): Promise<OPConnectItemParsed>;
  getVault(vaultId?: string): Promise<Vault>;
  listVaults(): Promise<Array<Vault>>;
  listItems(vaultId?: string): Promise<Array<SimpleItem>>;
  createItem(
    title: string,
    category: FullItem.CategoryEnum,
    item: OPConnectItemBuild,
    tags?: Array<string>,
    vaultId?: string
  ): Promise<OPConnectItemParsed>;
  replaceItem(
    item: OPConnectItemParsed,
    vaultId?: string
  ): Promise<OPConnectItemParsed>;
}

export class Service extends ServicesBase<
  ServiceCallable,
  ServiceCallable,
  OnePasswordReturnableEvents,
  ServiceCallable,
  ServiceCallable,
  MyPluginConfig
> {
  private onePassword!: OPConnector;

  private async _getVaultId(vaultId?: string): Promise<string> {
    if ((await this.getPluginConfig()).lockToVault)
      return (await this.getPluginConfig()).vaultId;
    return vaultId || (await this.getPluginConfig()).vaultId;
  }
  async init() {
    const self = this;
    self.onePassword = new OPConnector(
      (await self.getPluginConfig()).serverUrl,
      (await self.getPluginConfig()).token,
      (await self.getPluginConfig()).vaultId
    );

    self.onReturnableEvent(
      "getParsedItemByTitle",
      async (title: string, vaultId?: string) =>
        await self.onePassword.getParsedItemByTitle(
          title,
          await self._getVaultId(vaultId)
        )
    );
    self.onReturnableEvent(
      "getParsedItemById",
      async (id: string, vaultId?: string) =>
        await self.onePassword.getParsedItemById(
          id,
          await self._getVaultId(vaultId)
        )
    );
    self.onReturnableEvent(
      "getVault",
      async (vaultId?: string) =>
        await self.onePassword.getVault(await self._getVaultId(vaultId))
    );
    self.onReturnableEvent("listVaults", async () => {
      if ((await this.getPluginConfig()).lockToVault)
        throw "Not allowed to view vaults";
      return await this.onePassword.listVaults();
    });
    self.onReturnableEvent(
      "listItems",
      async (vaultId?: string) =>
        await self.onePassword.listItems(await self._getVaultId(vaultId))
    );
    self.onReturnableEvent(
      "createItem",
      async (
        title: string,
        category: FullItem.CategoryEnum,
        item: OPConnectItemBuild,
        tags?: Array<string>,
        vaultId?: string
      ) =>
        await self.onePassword.createItem(
          title,
          category,
          item,
          tags,
          await self._getVaultId(vaultId)
        )
    );
    self.onReturnableEvent(
      "replaceItem",
      async (item: OPConnectItemParsed, vaultId?: string) =>
        await self.onePassword.replaceItem(
          item,
          await self._getVaultId(vaultId)
        )
    );
  }
}
