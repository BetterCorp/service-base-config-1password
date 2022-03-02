import { FieldType, FullItem, ItemBuilder, OnePasswordConnect, Vault } from "@1password/connect";
import { FullItemAllOfFields } from '@1password/connect/dist/model/fullItemAllOfFields';
import { CPlugin } from '@bettercorp/service-base/lib/interfaces/plugins';
import { IDictionary } from '@bettercorp/tools/lib/Interfaces';
import { Tools } from '@bettercorp/tools/lib/Tools';

export interface OPConnectPartialItem {
  title: string;
  category: FullItem.CategoryEnum;
  tags?: Array<string>;
}
export interface OPConnectItemParsed extends OPConnectItemBuild<any> {
  _ref: FullItem;
}
export interface OPConnectItemBuild<T = any> extends IDictionary<T | any> {
  _: T;
  _fieldDefinitions: IDictionary<IDictionary<FullItemAllOfFields.TypeEnum>>;
}
export interface ItemVault {
  id: string;
}
export interface SimpleItem {
  id: string;
  title: string;
  vault: ItemVault;
  category: FullItem.CategoryEnum;
  urls: any;
  favorite: any;
  tags?: Array<string>;
  version: number;
  trashed: any;
  createdAt: Date;
  updatedAt: Date;
  lastEditedBy: string;
}
export interface OPConnect {
  /**
   * Returns a list of all Vaults the Service Account has permission
   * to view.
   *
   * @returns {Promise<Vault[]>}
   */
  listVaults(): Promise<Vault[]>;
  /**
   * Get details about a specific vault.
   *
   * If the Service Account does not have permission to view the vault, an
   * error is returned.
   *
   * @param {string} vaultId
   * @returns {Promise<Vault>}
   */
  getVault(vaultId: string): Promise<Vault>;
  /**
   * Lists all Items inside a specific Vault.
   *
   * @param {string} vaultId
   * @returns {Promise<SimpleItem[]>}
   */
  listItems(vaultId: string): Promise<SimpleItem[]>;
  /**
   * Get details about a specific Item in a Vault.
   *
   * @param {string} vaultId
   * @param {string} itemId
   * @returns {Promise<FullItem>}
   */
  getItem(vaultId: string, itemId: string): Promise<FullItem>;
  /**
   * Get details about a specific item with a matching Title value.
   *
   * The Item Title is case-sensitive and must be an exact-match.
   *
   * @param {string} vaultId
   * @param {string} title
   * @returns {Promise<FullItem>}
   */
  getItemByTitle(vaultId: string, title: string): Promise<FullItem>;
  /**
   * Creates a new Item inside the specified Vault.
   *
   * @param {string} vaultId
   * @param {FullItem} item
   * @returns {Promise<FullItem>}
   */
  createItem(vaultId: string, item: FullItem): Promise<FullItem>;
  /**
   * Perform a replacement update of an Item. The given `item` object will
   * overwrite the existing item in the Vault.
   *
   * @param {string} vaultId
   * @param {FullItem} item
   * @returns {Promise<FullItem>}
   */
  updateItem(vaultId: string, item: FullItem): Promise<FullItem>;
  /**
   * Deletes a single Item matching the given Item ID.
   *
   * @param {string} vaultId
   * @param {string} itemId
   * @returns {Promise<void>}
   */
  deleteItem(vaultId: string, itemId: string): Promise<void>;
}

export class OPConnector {
  public onePassword: OPConnect;
  private vaultId?: string;
  constructor(serverUrl: string, token: string, vaultId?: string) {
    this.vaultId = vaultId || undefined;
    this.onePassword = OnePasswordConnect({
      serverURL: serverUrl,
      token: token,
      keepAlive: true,
    }) as any;
  }

  private getVaultId(vaultId: string | undefined): string {
    return vaultId || this.vaultId || '_';
  }

  private parseItem(item: FullItem, self?: CPlugin): any {
    if (self && self.appConfig.runningInDebug) {
      self.log.debug(`ParseItem: ${item.id}`);
      self.log.debug(JSON.stringify(item, null, 2));
    }
    let config: any = {
      _: {},
      _fieldDefinitions: {
        _: {}
      },
      _ref: item
    };

    let mappingKeys: any = {};

    for (let section of (item.sections || [])) {
      config[section.label || '_'] = config[section.label || '_'] || {};
      config._fieldDefinitions[section.label || '_'] = config._fieldDefinitions[section.label || '_'] || {};
      mappingKeys[section.id || '_'] = section.label || '_';
    }

    for (let field of (item.fields || [])) {
      let value: any = field.value || undefined;
      if (value === 'undefined') value = undefined;
      else if (value === 'null') value = null;
      else if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else {
        let isNumber = Tools.isStringNumber(value);
        if (isNumber.status) {
          value = isNumber.value;
        }
      }

      //this._defaultLogger.debug(`Map config [${ item.title! }] (${ field.label })=(${ [FieldType.Concealed, FieldType.Totp].indexOf(field.type!) >= 0 ? '******' : value })`);
      let alreadySetToArray = Tools.GetValueFromObjectBasedOnStringPath(config[mappingKeys[(field.section || { id: '_' }).id || '_'] || '_'], field.label!);
      if (!Tools.isNullOrUndefined(alreadySetToArray)) {
        if (Tools.isArray(alreadySetToArray)) {
          alreadySetToArray.push(value);
          value = alreadySetToArray;
        } else {
          value = [alreadySetToArray, value];
        }
      }
      config._fieldDefinitions[mappingKeys[(field.section || { id: '_' }).id || '_'] || '_'][field.label!] = field.type || FullItemAllOfFields.TypeEnum.String;
      config[mappingKeys[(field.section || { id: '_' }).id || '_'] || '_'] = Tools.setUpdatedTemplatePathFinder(field.label!, value,
        config[mappingKeys[(field.section || { id: '_' }).id || '_'] || '_']);
    }

    if (self && self.appConfig.runningInDebug) {
      self.log.debug(`ParseDItem: ${item.id}`);
      self.log.debug(JSON.stringify(config, null, 2));
    }
    return config;
  }

  public async getParsedItemByTitle(title: string, vaultId?: string, self?: CPlugin): Promise<OPConnectItemParsed> {
    let opItem = await this.onePassword.getItemByTitle(this.getVaultId(vaultId), title);
    return this.parseItem(opItem, self);
  }
  public async getParsedItemById(id: string, vaultId?: string, self?: CPlugin): Promise<OPConnectItemParsed> {
    let opItem = await this.onePassword.getItem(this.getVaultId(vaultId), id);
    return this.parseItem(opItem, self);
  }

  public async getVault(vaultId?: string): Promise<Vault> {
    return await this.onePassword.getVault(this.getVaultId(vaultId));
  }
  public async listVaults(): Promise<Array<Vault>> {
    return await this.onePassword.listVaults();
  }

  public async listItems(vaultId?: string): Promise<Array<SimpleItem>> {
    return await this.onePassword.listItems(this.getVaultId(vaultId));
  }

  private async buildItem(title: string, category: FullItem.CategoryEnum, item: OPConnectItemBuild, tags?: Array<string>): Promise<FullItem> {
    let newItem = new ItemBuilder()
      .setCategory(category)
      .setTitle(title);
    if (!Tools.isNullOrUndefined(tags)) {
      for (let tag of tags!) newItem.addTag(tag);
    }
    let flattened: any = {};
    for (let sect of Object.keys(item)) {
      if (sect.indexOf('_') === 0 && sect.length > 2) continue;
      flattened[sect] = Tools.flattenObject(item[sect]);
    }
    for (let sect of Object.keys(flattened)) {
      newItem = newItem.addSection(sect);
      for (let fieldItem of Object.keys(flattened[sect])) {
        newItem = newItem.addField({
          label: fieldItem,
          value: Tools.isUndefined(flattened[sect][fieldItem]) ? undefined : `${ flattened[sect][fieldItem] }`,
          sectionName: sect === '_' ? undefined : sect,
          type: (item._fieldDefinitions[sect] || {})[fieldItem] || FullItemAllOfFields.TypeEnum.String
        });
      }
    }
    return newItem.build();
  }
  public async createItem(title: string, category: FullItem.CategoryEnum, item: OPConnectItemBuild, tags?: Array<string>, vaultId?: string, self?: CPlugin): Promise<OPConnectItemParsed> {
    let createdItem = await this.onePassword.createItem(this.getVaultId(vaultId), await this.buildItem(title, category, item, tags));
    return this.parseItem(createdItem, self);
  }
  private async rebuildItem(item: OPConnectItemParsed): Promise<FullItem> {
    let newItem = item._ref;

    let flattened: any = {};
    for (let sect of Object.keys(item)) {
      if (sect.indexOf('_') === 0 && sect.length > 2) continue;
      flattened[sect] = Tools.flattenObject(item[sect]);
    }

    const findSectionId = (key: string): string | undefined => {
      for (let section of newItem.sections!) {
        if (section.label === key) return section.id!;
      }
      return undefined;
    };
    const findFieldIndexById = (fieldId: string): Number => {
      for (let i = 0; i < newItem.fields!.length; i++) {
        if (newItem.fields![i].id! === fieldId) return i;
      }
      return -1;
    };
    for (let flatItem of Object.keys(flattened)) {
      let section = findSectionId(flatItem);
      let tempFiels: Array<FullItemAllOfFields> = [];
      for (let field of newItem.fields!) {
        if (section === undefined) {
          if (field.section !== undefined) continue;
        } else {
          if (field.section === undefined || field.section!.id !== section) continue;
        }
        tempFiels.push(field);
      }
      for (let tField of tempFiels) {
        if (Object.keys(flattened[flatItem]).indexOf(tField.label!) <= 0) {
          newItem.fields![findFieldIndexById(tField.id!) as any].value = undefined;
        }
      }
      for (let iField of Object.keys(flattened[flatItem])) {
        let found: any = null;
        for (let tField of tempFiels) {
          if (tField.label === iField) {
            found = tField;
            break;
          }
        }
        if (found === null) {
          // add
          newItem.fields!.push({
            type: item._fieldDefinitions[flatItem][iField] || FieldType.String,
            label: iField,
            section: {
              id: section
            },
            value: Tools.isUndefined(flattened[flatItem][iField]) ? undefined : `${ flattened[flatItem][iField] }`
          });
        } else {
          newItem.fields![findFieldIndexById(found.id) as any].type = item._fieldDefinitions[flatItem][iField] || FieldType.String;
          newItem.fields![findFieldIndexById(found.id) as any].value = Tools.isUndefined(flattened[flatItem][iField]) ? undefined : `${ flattened[flatItem][iField] }`;
        }
      }
    }

    return newItem;
  }
  public async replaceItem(item: OPConnectItemParsed, vaultId?: string, self?: CPlugin): Promise<OPConnectItemParsed> {
    const actVaultId = this.getVaultId(vaultId);
    if (self && self.appConfig.runningInDebug) {      
      self.log.debug(`UPDATE ITEM /${ item._ref.id }/ VAULT: ${ actVaultId }`);
    }
    const rebuiltItem = await this.rebuildItem(item);
    if (self && self.appConfig.runningInDebug) {
      self.log.debug(JSON.stringify(rebuiltItem, null, 2));
    }
    const createdItem = await this.onePassword.updateItem(actVaultId, rebuiltItem);
    return this.parseItem(createdItem);
  }
}