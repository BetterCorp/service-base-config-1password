import { CConfig, DeploymentProfile, DeploymentProfiles, IPluginConfig, ServiceConfig } from "@bettercorp/service-base/lib/interfaces/config";
import { IPluginLogger } from '@bettercorp/service-base/lib/interfaces/logger';
import { IDictionary } from '@bettercorp/tools/lib/Interfaces';
import { Tools } from '@bettercorp/tools/lib/Tools';
import { OPConnector } from '../../OPConnect';

export class Config extends CConfig {
  private onePassword: OPConnector;
  private _appConfig!: ServiceConfig;

  constructor(logger: IPluginLogger, cwd: string, deploymentProfile: string) {
    super(logger, cwd, deploymentProfile);

    let serverURL = process.env.BSB_OP_SERVER_URL;
    let token = process.env.BSB_OP_TOKEN;
    let vaultId = process.env.BSB_OP_VAULT;

    if (Tools.isNullOrUndefined(serverURL) || serverURL === '') throw `ENV BSB_OP_SERVER_URL is not defined for OnePassword Server Url`;
    if (Tools.isNullOrUndefined(token) || token === '') throw `ENV BSB_OP_TOKEN is not defined for OnePassword Token`;
    if (Tools.isNullOrUndefined(vaultId) || vaultId === '') throw `ENV BSB_OP_VAULT is not defined for OnePassword Vault ID`;

    this.onePassword = new OPConnector(serverURL!, token!, vaultId!);

    if (!Tools.isNullOrUndefined(process.env.BSB_LIVE)) {
      this._runningLive = true;
    }
  }

  private _runningLive: boolean = false;
  private _debugMode: boolean = false;

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

  private async parseDeploymentProfile(parsedItem: any): Promise<IDictionary<DeploymentProfile>> {
    let deploymentProfile: IDictionary<DeploymentProfile> = {};

    let mappingKeys = [
      'Plugin Maps (Events)',
      'Plugin Maps (Logging)',
      'Plugin Maps (Plugins)'
    ];
    for (let fieldKey of mappingKeys) {
      for (let pluginDef of Object.keys(parsedItem[fieldKey])) {
        let mapName = parsedItem[fieldKey][pluginDef];
        let enabled = mapName.length > 2 && mapName !== 'false' && mapName !== false;
        let sDisabled = false;
        if (mapName.length > 0 && mapName[0] === '!') {
          enabled = false;
          sDisabled = true;
          mapName = mapName.substring(1);
        }
        this._defaultLogger.debug(`Plugin map: [${ pluginDef }]=${ mapName } / enabled:${ enabled } / disabled but named: better${ sDisabled }`);
        deploymentProfile[pluginDef] = {
          mappedName: mapName,
          enabled: enabled
        };
      }
    }
    return deploymentProfile;
  }

  private async getOPPluginConfig(pluginName: string): Promise<any> {
    const self = this;
    return new Promise(async (resolve, reject) => {
      self._defaultLogger.info(`Load 1Pass plugin: ${ pluginName }`);
      try {
        const parsedItem = await self.onePassword.getParsedItemByTitle(pluginName);
        resolve(parsedItem.Config);
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
        const parsedPluginConfig = await self.onePassword.getParsedItemByTitle(`profile-${ this._deploymentProfile }`);
        self._debugMode = `${ parsedPluginConfig['Profile Info'].debug }` == 'true';

        self._appConfig = {
          deploymentProfiles: {},
          plugins: {}
        } as any;

        self._defaultLogger.info('- Got profile, parsing plugins now');
        self._appConfig.deploymentProfiles[self._deploymentProfile] = await self.parseDeploymentProfile(parsedPluginConfig) as any;

        for (let deploymentProfilePlugin of Object.keys(self._appConfig.deploymentProfiles[self._deploymentProfile])) {
          let pluginDep = (self._appConfig.deploymentProfiles[self._deploymentProfile] as any)[deploymentProfilePlugin] as DeploymentProfile;
          self._defaultLogger.debug(`CHECK plugin definition: ${ deploymentProfilePlugin }=${ pluginDep.mappedName } [${ pluginDep.enabled ? 'enabled' : 'disabled' }]`);
          //if (!pluginDep.enabled) continue;
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