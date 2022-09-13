export interface MyPluginConfig {
  serverUrl: string; // Server URL: The server URL for the 1password connect service
  token: string; // Token
  vaultId: string; // Vault ID
  lockToVault: boolean; // Vault lock: Lock access to a specific vault ID
}

export default (
  pluginName: string,
  existingPluginConfig: any
): MyPluginConfig => {
  let newConfig: MyPluginConfig = {
    serverUrl: "http://localhost",
    token: "localhost",
    vaultId: "localhost",
    lockToVault: true,
  };
  return newConfig;
};
