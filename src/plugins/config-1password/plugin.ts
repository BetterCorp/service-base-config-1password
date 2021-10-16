import { CConfig, DeploymentProfile, DeploymentProfiles, IPluginConfig, IPluginLogger, ServiceConfig } from "@bettercorp/service-base/lib/ILib";
import {
  FieldType,
  FullItem, OnePasswordConnect,
  Vault
} from "@1password/connect";
import { IDictionary } from '@bettercorp/tools/lib/Interfaces';
import { Tools } from '@bettercorp/tools/lib/Tools';

interface OPConnect {
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
  listItems(vaultId: string): Promise<any[]>;
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

export class Config extends CConfig {
  private onePassword: OPConnect;
  private _appConfig!: ServiceConfig;

  constructor(logger: IPluginLogger, cwd: string, deploymentProfile: string) {
    super(logger, cwd, deploymentProfile);

    let serverURL = process.env.BSB_OP_SERVER_URL;
    let token = process.env.BSB_OP_TOKEN;

    if (Tools.isNullOrUndefined(serverURL) || serverURL === '') throw `ENV BSB_OP_SERVER_URL is not defined for OnePassword Server Url`;
    if (Tools.isNullOrUndefined(token) || token === '') throw `ENV BSB_OP_TOKEN is not defined for OnePassword Token`;

    this.onePassword = OnePasswordConnect({
      serverURL: serverURL!,
      token: token!,
      keepAlive: true,
    });

    if (!Tools.isNullOrUndefined(process.env.BSB_LIVE)) {
      this._runningLive = true;
    }
  }

  private _runningLive: boolean = false;
  private _debugMode: boolean = true;

  public get runningInDebug(): boolean {
    return this._debugMode;
  }
  public get runningLive(): boolean {
    return this._runningLive;
  }

  private get activeDeploymentProfile(): DeploymentProfiles<DeploymentProfile> {
    return this._appConfig.deploymentProfiles[this._deploymentProfile] as any;
  }
  public async getPluginDeploymentProfile(pluginName: string): Promise<DeploymentProfile> {
    let pluginMap = (await this.activeDeploymentProfile)[pluginName!];
    if (Tools.isNullOrUndefined(pluginMap)) {
      this._defaultLogger.debug(`Plugin state: ${ pluginName } / enabled: false`);
      return {
        mappedName: pluginName,
        enabled: false,
      };
    }
    this._defaultLogger.debug(`Plugin state: ${ pluginName } / mapName: ${ pluginMap.mappedName } / enabled: ${ pluginMap.enabled }`);
    return pluginMap;
  }
  public async getPluginConfig<T extends IPluginConfig>(pluginName: string): Promise<T> {
    let mappedName = (await this.getPluginDeploymentProfile(pluginName)).mappedName;
    return (this._appConfig.plugins[mappedName] || {}) as T;
  }

  private async parseDeploymentProfile(item: FullItem): Promise<IDictionary<DeploymentProfile>> {
    let deploymentProfile: IDictionary<DeploymentProfile> = {};

    let mappingKeys = [
      'Plugin Maps (Events)',
      'Plugin Maps (Logging)',
      'Plugin Maps (Plugins)'
    ];
    let mappingIds: Array<string> = [];

    for (let section of (item.sections || [])) {
      if (!Tools.isNullOrUndefined(section.id) && mappingKeys.indexOf(section.label || '') >= 0) {
        this._defaultLogger.debug(`OP Profile Section Found: ${ section.label }`);
        mappingIds.push(section.id!);
      }
      else
        this._defaultLogger.debug(`OP Profile Info Section: ${ section.label }`);
    }

    for (let field of (item.fields || [])) {
      let fieldSect: string | null = (field.section || { id: null }).id || null;
      if (!Tools.isString(fieldSect)) continue;
      if (!Tools.isString(field.label)) continue;
      if (mappingIds.indexOf(fieldSect!) < 0) continue;
      if (field.label === '') continue;

      let mapName = field.value || '';
      let enabled = mapName.length > 2 && mapName !== 'false';
      if (mapName.length > 0 && mapName[0] === '!') {
        enabled = false;
        mapName = field.label!;
      }
      this._defaultLogger.debug(`Plugin map: [${ field.label }]=${ mapName } / enabled:${ enabled }`);
      deploymentProfile[field.label || '-X-X-X-'] = {
        mappedName: mapName,
        enabled: enabled
      };
    }
    return deploymentProfile;
  }
  private async parseDeploymentProfileDebug(item: FullItem): Promise<void> {
    let mappingKeys = [
      'Profile Info'
    ];
    let mappingIds: Array<string> = [];

    for (let section of (item.sections || [])) {
      if (!Tools.isNullOrUndefined(section.id) && mappingKeys.indexOf(section.label || '') >= 0) {
        this._defaultLogger.debug(`OP Profile Section Found: ${ section.label }`);
        mappingIds.push(section.id!);
      }
      else
        this._defaultLogger.debug(`OP Profile Info Section: ${ section.label }`);
    }

    for (let field of (item.fields || [])) {
      if (mappingIds.indexOf((field.section || { id: '' }).id || '*****') < 0) continue;
      this._debugMode = `${ field.value || true }` == 'true';
      return;
    }
  }

  private parsePluginConfig(item: FullItem): any {
    let config: any = {};

    let mappingKeys = [
      'Config'
    ];
    let mappingIds: Array<string> = [];

    for (let section of (item.sections || [])) {
      if (mappingKeys.indexOf(section.label || '') >= 0)
        mappingIds.push(section.id || '-X-X-X-');
    }

    for (let field of (item.fields || [])) {
      if (mappingIds.indexOf((field.section || { id: '-X-X-X-' }).id || '-X-X-X-') < 0) continue;
      let value: any = field.value || undefined;
      if (value === 'undefined') value = undefined;
      else if (value === 'null') value = null;
      else if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (Tools.isNumber(value)) value = Number.parseFloat(value);

      this._defaultLogger.debug(`Map config [${ item.title! }] (${ field.label })=(${ [FieldType.Concealed, FieldType.Totp].indexOf(field.type!) >= 0 ? '******' : value })`);
      config = Tools.setUpdatedTemplatePathFinder(field.label!, value, config);
    }

    return config;
  }
  private async getOPPluginConfig(pluginName: string): Promise<any> {
    const self = this;
    return new Promise(async (resolve, reject) => {
      self._defaultLogger.info(`Load 1Pass plugin: ${ pluginName }`);
      try {
        const namedItem = await self.onePassword.getItemByTitle('kinrbtplatsckiakzo4mg7rpii', pluginName);
        resolve(self.parsePluginConfig(namedItem));
      } catch (exc) {
        self._defaultLogger.fatal(`Cannot find plugin ${ pluginName }`);
        reject();
      }
    });
  }

  async refreshAppConfig(): Promise<void> {
    const self = this;
    return new Promise(async (resolve, reject) => {
      self._defaultLogger.info(`Load 1Pass profile: profile-${ this._deploymentProfile }`);
      try {
        const namedItem = await self.onePassword.getItemByTitle('kinrbtplatsckiakzo4mg7rpii', `profile-${ this._deploymentProfile }`);
        self._appConfig = {
          deploymentProfiles: {},
          plugins: {}
        } as any;

        self._defaultLogger.info('- Got profile, parsing plugins now');
        self._appConfig.deploymentProfiles[self._deploymentProfile] = await self.parseDeploymentProfile(namedItem) as any;
        await self.parseDeploymentProfileDebug(namedItem);
        for (let deploymentProfilePlugin of Object.keys(self._appConfig.deploymentProfiles[self._deploymentProfile])) {
          let pluginDep = (self._appConfig.deploymentProfiles[self._deploymentProfile] as any)[deploymentProfilePlugin] as DeploymentProfile;
          self._defaultLogger.debug(`CHECK plugin definition: ${ deploymentProfilePlugin }=${ pluginDep.mappedName } [${ pluginDep.enabled ? 'enabled' : 'disabled' }]`);
          if (!pluginDep.enabled) continue;
          try {
            self._appConfig.plugins[pluginDep.mappedName] = await self.getOPPluginConfig(pluginDep.mappedName);
          } catch (xc) {
            self._defaultLogger.warn(`cannot get plugin ${ pluginDep.mappedName } from config... we will create the entry`, xc);
            self._appConfig.plugins[pluginDep.mappedName] = {};
          }
        }
        resolve();
      } catch (exc) {
        self._defaultLogger.fatal(`Cannot find profile profile-${ this._deploymentProfile }`, exc);
        reject();
      }
    });
  }

  async updateAppConfig(pluginName?: string, mappedPluginName?: string, config?: IPluginConfig): Promise<void> {
    if (!Tools.isNullOrUndefined(pluginName)) {
      this._defaultLogger.debug(`Plugin check ${ pluginName } as ${ mappedPluginName }`);
      if (Tools.isNullOrUndefined(await this.getPluginDeploymentProfile(pluginName!))) {
        ((this._appConfig.deploymentProfiles[this._deploymentProfile] as any)[pluginName!] as DeploymentProfile) = {
          mappedName: mappedPluginName || pluginName!,
          enabled: false
        };
      }
      if (Tools.isNullOrUndefined(this._appConfig.plugins[mappedPluginName!])) {
        this._appConfig.plugins[mappedPluginName!] = {};
      }
      if (!Tools.isNullOrUndefined(config)) {
        this._appConfig.plugins[mappedPluginName!] = config!;
      }
    }
  }
}