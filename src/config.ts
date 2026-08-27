import type { TenantSdkEnvironment } from "@terminal3/t3n-sdk";

const VALID_ENVIRONMENTS: readonly TenantSdkEnvironment[] = [
  "sandbox",
  "testnet",
  "production",
];

export function parseEnvironment(raw: string | undefined): TenantSdkEnvironment {
  if (!raw) return "testnet";
  const env = raw.trim().toLowerCase() as TenantSdkEnvironment;
  if (!(VALID_ENVIRONMENTS as readonly string[]).includes(env)) {
    throw new Error(
      `Invalid CLUSTER "${raw}". Must be one of: ${VALID_ENVIRONMENTS.join(", ")}`,
    );
  }
  return env;
}

export interface AppConfig {
  environment: TenantSdkEnvironment;
  apiKey: string;
  agentKey?: string | undefined;
}

export function loadConfig(): AppConfig {
  const apiKey = process.env["T3N_API_KEY"];
  if (!apiKey) {
    throw new Error("T3N_API_KEY environment variable is required");
  }

  const agentKey = process.env["AGENT_KEY"];

  // Reject startup if T3N_API_KEY === AGENT_KEY
  // An agent must have a separate key and DID from the tenant
  if (agentKey && agentKey === apiKey) {
    throw new Error(
      "AGENT_KEY must be different from T3N_API_KEY. " +
      "An agent must have a separate key and DID from the tenant.",
    );
  }

  const config: AppConfig = {
    environment: parseEnvironment(process.env["CLUSTER"]),
    apiKey,
  };
  if (agentKey) {
    config.agentKey = agentKey;
  }
  return config;
}
