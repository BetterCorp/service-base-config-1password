export interface MyPluginConfig {
  serverUrl: string;
  token: string;
  vaultId: string;
  lockToVault: boolean;
}

export default (pluginName: string, existingPluginConfig: any): MyPluginConfig => {
  let newConfig: MyPluginConfig = {
    serverUrl: 'http://localhost',
    token: 'localhost',
    vaultId: 'localhost',
    lockToVault: true
  };
  return newConfig;
};