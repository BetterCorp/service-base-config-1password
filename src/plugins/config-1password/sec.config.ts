import { IPluginConfig, SecConfig } from "@bettercorp/service-base";

export interface PluginConfig extends IPluginConfig {
  serverURL: string;
  token: string;
  vaultId: string;
}

export class Config extends SecConfig<PluginConfig> {
  public override migrate(
    mappedPluginName: string,
    existingConfig: PluginConfig
  ): PluginConfig {
    let newConfig: any = {
      serverURL: existingConfig.serverURL || process.env.BSB_OP_SERVER_URL,
      token: existingConfig.token || process.env.BSB_OP_TOKEN,
      vaultId: existingConfig.vaultId || process.env.BSB_OP_VAULT,
    };

    if (newConfig.serverURL === undefined || newConfig.serverURL === "")
      throw `ENV BSB_OP_SERVER_URL is not defined for OnePassword Server Url`;
    if (newConfig.token === undefined || newConfig.token === "")
      throw `ENV BSB_OP_TOKEN is not defined for OnePassword Token`;
    if (newConfig.vaultId === undefined || newConfig.vaultId === "")
      throw `ENV BSB_OP_VAULT is not defined for OnePassword Vault ID`;

    return newConfig;
  }
}
