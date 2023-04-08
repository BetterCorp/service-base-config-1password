import { ConfigBase } from "@bettercorp/service-base";
import {
  DeploymentProfile,
  DeploymentProfiles,
  IPluginConfig,
  ServiceConfig,
} from "@bettercorp/service-base/lib/interfaces/config";
import { IPluginLogger } from "@bettercorp/service-base/lib/interfaces/logger";
import { IDictionary } from "@bettercorp/tools/lib/Interfaces";
import { OPConnector } from "../../OPConnect";
import { PluginConfig } from "./sec.config";

export class Config extends ConfigBase<PluginConfig> {
  private _appConfig!: ServiceConfig;

  private _onePassword!: OPConnector;
  private async onePassword() {
    if (this._onePassword !== undefined) return this._onePassword;
    this.log.info("Load 1Pass profile: profile-{deploymentProfile}", {
      deploymentProfile: this._deploymentProfile,
    });
    const pluginPlugin = await this.getPluginConfig();
    this._onePassword = new OPConnector(
      pluginPlugin.serverURL,
      pluginPlugin.token,
      pluginPlugin.vaultId
    );
    return this._onePassword;
  }

  constructor(
    pluginName: string,
    pluginCwd: string,
    cwd: string,
    log: IPluginLogger,
    deploymentProfile: string
  ) {
    super(pluginName, cwd, pluginCwd, log, deploymentProfile);
  }
  private get activeDeploymentProfile(): DeploymentProfiles<DeploymentProfile> {
    return (this._appConfig.deploymentProfiles as IDictionary)[
      this._deploymentProfile
    ];
  }
  public override async getAppPluginDeploymentProfile(
    pluginName: string
  ): Promise<DeploymentProfile> {
    return this.activeDeploymentProfile[pluginName!];
  }

  public override async getAppMappedPluginConfig<T extends IPluginConfig>(
    mappedPluginName: string
  ): Promise<T> {
    if (this._appConfig.plugins[mappedPluginName] === undefined) {
      this._appConfig.plugins[mappedPluginName] = await this.getOPPluginConfig(
        mappedPluginName
      );
    }
    return (this._appConfig.plugins[mappedPluginName] || {}) as T;
  }
  public override async getAppMappedPluginDeploymentProfile(
    mappedPluginName: string
  ): Promise<DeploymentProfile> {
    for (let dpPlugin of Object.keys(this.activeDeploymentProfile)) {
      if (
        this.activeDeploymentProfile[dpPlugin].mappedName === mappedPluginName
      )
        return this.activeDeploymentProfile[dpPlugin];
    }
    this.log.fatal("Cannot find mapped plugin {mappedPluginName}", {
      mappedPluginName,
    });
    return undefined as any; // will not reach
  }

  public override async getAppPluginMappedName(
    pluginName: string
  ): Promise<string> {
    return (
      (this.activeDeploymentProfile[pluginName] || {}).mappedName || pluginName
    );
  }
  public override async getAppPluginState(
    pluginName: string
  ): Promise<boolean> {
    return (this.activeDeploymentProfile[pluginName] || {}).enabled || false;
  }
  public override async getAppMappedPluginState(
    mappedPluginName: string
  ): Promise<boolean> {
    return (await this.getAppMappedPluginDeploymentProfile(mappedPluginName))
      .enabled;
  }

  public override async createAppConfig(
    listOfKnownPlugins: Array<string>
  ): Promise<void> {
    try {
      const parsedPluginConfig = await (
        await this.onePassword()
      ).getParsedItemByTitle(`profile-${this._deploymentProfile}`);

      this._appConfig = {
        deploymentProfiles: {
          default: {},
        },
        plugins: {},
      };

      await this.log.info("- Got profile, parsing plugins now");
      this._appConfig.deploymentProfiles[this._deploymentProfile] =
        (await this.parseDeploymentProfile(parsedPluginConfig)) as any;

      for (let deploymentProfilePlugin of Object.keys(
        this._appConfig.deploymentProfiles[this._deploymentProfile]
      )) {
        let pluginDep = (
          this._appConfig.deploymentProfiles[this._deploymentProfile] as any
        )[deploymentProfilePlugin] as DeploymentProfile;
        await this.log.debug(
          "CHECK plugin definition: {deploymentProfilePlugin}={mappedName} [{enabled}]",
          {
            deploymentProfilePlugin,
            mappedName: pluginDep.mappedName,
            enabled: pluginDep.enabled ? "enabled" : "disabled",
          }
        );

        /*try {
          this._appConfig.plugins[pluginDep.mappedName] =
            await this.getOPPluginConfig(pluginDep.mappedName);
        } catch (xc: any) {
          this.log.error(
            'cannot get plugin {mappedName} from config... we will create the entry',
            {mappedName: pluginDep.mappedName}
          );
          this.log.error(xc);
          this._appConfig.plugins[pluginDep.mappedName] = {};
        }*/
      }
    } catch (exc: any) {
      await this.log.error("Cannot find profile profile-{deploymentProfile}", {
        deploymentProfile: this._deploymentProfile,
      });
      await this.log.fatal(exc);
    }

    let existingDefinedPlugins = Object.keys(
      this._appConfig.deploymentProfiles.default
    );
    let pluginsToAdd = listOfKnownPlugins.filter(
      (x) => existingDefinedPlugins.indexOf(x) < 0
    );
    for (let pluginName of pluginsToAdd) {
      this._appConfig.deploymentProfiles.default[pluginName] = {
        mappedName: pluginName,
        enabled: false,
      };
    }
  }
  public override async migrateAppPluginConfig(
    pluginName: string,
    mappedPluginName: string,
    config: IPluginConfig
  ): Promise<void> {
    this._appConfig.deploymentProfiles[this._deploymentProfile][pluginName] =
      this._appConfig.deploymentProfiles[this._deploymentProfile][
        pluginName
      ] || {
        mappedName: mappedPluginName,
        enabled: true,
      };
    this._appConfig.deploymentProfiles[this._deploymentProfile][
      pluginName
    ].enabled = true;
    this._appConfig.plugins[mappedPluginName] = config;
  }

  private async parseDeploymentProfile(
    parsedItem: any
  ): Promise<IDictionary<DeploymentProfile>> {
    let deploymentProfile: IDictionary<DeploymentProfile> = {};

    let mappingKeys = [
      "Plugin Maps (Events)",
      "Plugin Maps (Logging)",
      "Plugin Maps (Plugins)",
    ];
    for (let fieldKey of mappingKeys) {
      for (let pluginDef of Object.keys(parsedItem[fieldKey])) {
        let mapName = parsedItem[fieldKey][pluginDef];
        let enabled =
          mapName.length > 2 && mapName !== "false" && mapName !== false;
        let sDisabled = false;
        if (mapName.length > 0 && mapName[0] === "!") {
          enabled = false;
          sDisabled = true;
          mapName = mapName.substring(1);
        }
        await this.log.debug(
          "Plugin map: [{pluginDef}]={mapName} / enabled:{enabled} / disabled but named: better{sDisabled}",
          { pluginDef, mapName, enabled, sDisabled }
        );
        deploymentProfile[pluginDef] = {
          mappedName: mapName,
          enabled: enabled,
        };
      }
    }
    return deploymentProfile;
  }

  private async getOPPluginConfig(pluginName: string): Promise<any> {
    const self = this;
    return new Promise(async (resolve, reject) => {
      self.log.info("Load 1Pass plugin: {pluginName}", { pluginName });
      try {
        const parsedItem = await (
          await self.onePassword()
        ).getParsedItemByTitle(pluginName);
        resolve(parsedItem.Config);
      } catch (exc) {
        self.log.fatal("Cannot find plugin {pluginName}", { pluginName });
        reject();
      }
    });
  }
}
