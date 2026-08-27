/**
 * T3N connection and authentication.
 */

import {
  T3nClient,
  TenantClient,
  setEnvironment,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
  fetchTrustedManifest,
  getEnvironment,
  getContractVersion,
  getNodeUrl,
} from "@terminal3/t3n-sdk";
import type { TenantSdkEnvironment } from "@terminal3/t3n-sdk";

export interface T3nConnection {
  t3n: T3nClient;
  tenant: TenantClient;
  tenantDid: string;
  address: string;
}

/**
 * Connect to T3N testnet, authenticate, and return a TenantClient.
 */
export async function connectToT3n(
  apiKey: string,
  environment: TenantSdkEnvironment,
): Promise<T3nConnection> {
  setEnvironment(environment);

  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(apiKey);
  const env = getEnvironment();
  const trustAnchor = await fetchTrustedManifest(env);

  const t3n = new T3nClient({
    wasmComponent,
    trustAnchor,
    handlers: {
      EthSign: metamask_sign(address, undefined, apiKey),
    },
  });

  await t3n.handshake();
  const did = await t3n.authenticate(createEthAuthInput(address));
  const tenantDid = did.value;

  const tenant = new TenantClient({
    environment,
    t3n,
    tenantDid,
  });

  return { t3n, tenant, tenantDid, address };
}
