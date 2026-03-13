import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

export function loadKeypair(rawPrivateKey: string): Keypair {
  try {
    if (rawPrivateKey.trim().startsWith("[")) {
      const secretArray = Uint8Array.from(JSON.parse(rawPrivateKey));
      return Keypair.fromSecretKey(secretArray);
    }

    return Keypair.fromSecretKey(bs58.decode(rawPrivateKey));
  } catch (error) {
    throw new Error(`Failed to parse private key: ${(error as Error).message}`);
  }
}

export function loadKeypairs(rawPrivateKeys: string[]): Keypair[] {
  if (rawPrivateKeys.length === 0) {
    throw new Error("No private keys provided");
  }

  return rawPrivateKeys.map((raw) => loadKeypair(raw));
}

export class WalletPool {
  private cursor = 0;

  public constructor(private readonly wallets: Keypair[]) {
    if (wallets.length === 0) {
      throw new Error("Wallet pool requires at least one wallet");
    }
  }

  public nextWallet(): Keypair {
    const wallet = this.wallets[this.cursor];
    this.cursor = (this.cursor + 1) % this.wallets.length;
    return wallet;
  }

  public getWallet(publicKey: string): Keypair | undefined {
    return this.wallets.find((wallet) => wallet.publicKey.toBase58() === publicKey);
  }

  public listWallets(): string[] {
    return this.wallets.map((wallet) => wallet.publicKey.toBase58());
  }
}
