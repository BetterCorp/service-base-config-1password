import { FullItem, Vault } from "@1password/connect";
import {
  ServicesClient,
  ServiceCallable,
  ServicesBase,
} from "@bettercorp/service-base";
import {
  OPConnectItemBuild,
  OPConnectItemParsed,
  SimpleItem,
} from "../../OPConnect";
import { OnePasswordReturnableEvents } from "../../plugins/service-1password/plugin";
import { MyPluginConfig } from "../../plugins/service-1password/sec.config";

export class onePasswordClient extends ServicesClient<
  ServiceCallable,
  ServiceCallable,
  OnePasswordReturnableEvents,
  ServiceCallable,
  ServiceCallable,
  MyPluginConfig
> {
  public readonly _pluginName: string = "service-1password";
  constructor(self: ServicesBase) {
    super(self);
  }
  public async register(): Promise<void> {
    await this._register();
  }

  getParsedItemByTitle(
    title: string,
    vaultId?: string
  ): Promise<OPConnectItemParsed> {
    return this._plugin.emitEventAndReturn(
      "getParsedItemByTitle",
      title,
      vaultId
    );
  }
  getParsedItemById(
    id: string,
    vaultId?: string
  ): Promise<OPConnectItemParsed> {
    return this._plugin.emitEventAndReturn("getParsedItemById", id, vaultId);
  }
  getVault(vaultId?: string): Promise<Vault> {
    return this._plugin.emitEventAndReturn("getVault", vaultId);
  }
  listVaults(): Promise<Array<Vault>> {
    return this._plugin.emitEventAndReturn("listVaults");
  }
  listItems(vaultId?: string): Promise<Array<SimpleItem>> {
    return this._plugin.emitEventAndReturn("listItems", vaultId);
  }
  createItem(
    title: string,
    category: FullItem.CategoryEnum,
    item: OPConnectItemBuild,
    tags?: Array<string>,
    vaultId?: string
  ): Promise<OPConnectItemParsed> {
    return this._plugin.emitEventAndReturn(
      "createItem",
      title,
      category,
      item,
      tags,
      vaultId
    );
  }
  replaceItem(
    item: OPConnectItemParsed,
    vaultId?: string
  ): Promise<OPConnectItemParsed> {
    return this._plugin.emitEventAndReturn("replaceItem", item, vaultId);
  }
}
