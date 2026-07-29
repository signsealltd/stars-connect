export type DeploymentEnvironment = Record<string, string | undefined>;
export type Pm2Process = {
  name?: string;
  pm2_env?: {
    exec_mode?: string;
    status?: string;
  };
};

export function deploymentConfigurationErrors(
  environment: DeploymentEnvironment,
  processes: Pm2Process[],
  cwd?: string,
  nodeVersion?: string,
): string[];
