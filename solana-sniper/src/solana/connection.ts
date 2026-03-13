import { Commitment, Connection } from "@solana/web3.js";

export function createConnection(rpcUrl: string, wsUrl?: string, commitment: Commitment = "confirmed"): Connection {
  return new Connection(rpcUrl, {
    wsEndpoint: wsUrl,
    commitment
  });
}
