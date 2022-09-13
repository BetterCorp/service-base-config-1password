import { SecConfig } from "@bettercorp/service-base";

export interface MyPluginConfig {
  serverUrl: string; // Server URL: The server URL for the 1password connect service
  token: string; // Token
  vaultId: string; // Vault ID
  lockToVault: boolean; // Vault lock: Lock access to a specific vault ID
}

export class Config extends SecConfig<MyPluginConfig> {
  public override migrate(
    mappedPluginName: string,
    existingConfig: MyPluginConfig
  ): MyPluginConfig {
    let newConfig: any = {
      serverUrl: existingConfig.serverUrl || "http://localhost",
      token: existingConfig.token || "localhost",
      vaultId: existingConfig.vaultId || "localhost",
      lockToVault:
        existingConfig.lockToVault === undefined
          ? existingConfig.lockToVault
          : true,
    };

    return newConfig;
  }
}
