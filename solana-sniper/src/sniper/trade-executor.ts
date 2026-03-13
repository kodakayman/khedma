import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  VersionedTransaction
} from "@solana/web3.js";
import { Logger } from "pino";
import { WalletPool } from "../solana/wallet.js";
import { ResilientRpcPool } from "../solana/rpc-pool.js";
import { BuyResult, LaunchEvent, Position, SellResult, SnipeParameters } from "../types.js";

const JUPITER_QUOTE_URL = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_URL = "https://quote-api.jup.ag/v6/swap";
const SOL_MINT = "So11111111111111111111111111111111111111112";

interface JupiterQuoteRoute {
  inAmount?: string;
  outAmount?: string;
  priceImpactPct?: string;
  [key: string]: unknown;
}

interface JupiterSwapResponse {
  swapTransaction?: string;
}

export interface TradeExecutor {
  executeBuy(event: LaunchEvent, params: SnipeParameters): Promise<BuyResult>;
  executeSell(position: Position, params: SnipeParameters): Promise<SellResult>;
  getWalletTokenBalance(wallet: string, mint: string): Promise<string>;
  listWallets(): string[];
}

export class DryRunTradeExecutor implements TradeExecutor {
  public constructor(private readonly walletPool: WalletPool, private readonly logger: Logger) {}

  public async executeBuy(event: LaunchEvent, params: SnipeParameters): Promise<BuyResult> {
    const wallet = this.walletPool.nextWallet().publicKey.toBase58();

    this.logger.info(
      {
        mint: event.mint,
        source: event.source,
        buyAmountSol: params.maxBuyAmountSol,
        slippageBps: params.slippageBps,
        wallet
      },
      "dry-run: buy skipped"
    );

    return { success: true, reason: "dry-run mode", wallet };
  }

  public async executeSell(position: Position, params: SnipeParameters): Promise<SellResult> {
    this.logger.info(
      {
        mint: position.mint,
        wallet: position.wallet,
        sellSlippageBps: params.sellSlippageBps
      },
      "dry-run: sell skipped"
    );

    return {
      success: true,
      reason: "dry-run mode",
      wallet: position.wallet,
      soldAmountRaw: position.tokenAmountRaw
    };
  }

  public async getWalletTokenBalance(wallet: string, mint: string): Promise<string> {
    this.logger.debug({ wallet, mint }, "dry-run: token balance requested");
    return "0";
  }

  public listWallets(): string[] {
    return this.walletPool.listWallets();
  }
}

export class JupiterTradeExecutor implements TradeExecutor {
  public constructor(
    private readonly rpcPool: ResilientRpcPool,
    private readonly walletPool: WalletPool,
    private readonly logger: Logger
  ) {}

  public async executeBuy(event: LaunchEvent, params: SnipeParameters): Promise<BuyResult> {
    const wallet = this.walletPool.nextWallet();

    try {
      const amount = Math.floor(params.maxBuyAmountSol * LAMPORTS_PER_SOL);
      const route = await this.fetchBestRoute(SOL_MINT, event.mint, String(amount), params.slippageBps);

      if (!route) {
        return { success: false, reason: "no swap route found", wallet: wallet.publicKey.toBase58() };
      }

      const signature = await this.executeSwap(wallet, route, params.slippageBps, params.priorityFeeMaxLamports);
      this.logger.info({ signature, mint: event.mint, wallet: wallet.publicKey.toBase58() }, "buy transaction confirmed");

      return {
        success: true,
        signature,
        wallet: wallet.publicKey.toBase58(),
        receivedAmountRaw: route.outAmount
      };
    } catch (error) {
      this.logger.error({ error, mint: event.mint }, "buy execution failed");
      return {
        success: false,
        reason: (error as Error).message,
        wallet: wallet.publicKey.toBase58()
      };
    }
  }

  public async executeSell(position: Position, params: SnipeParameters): Promise<SellResult> {
    const wallet = this.walletPool.getWallet(position.wallet);
    if (!wallet) {
      return {
        success: false,
        reason: `wallet not found in pool: ${position.wallet}`,
        wallet: position.wallet
      };
    }

    try {
      const rawBalance = await this.getWalletTokenBalance(wallet.publicKey.toBase58(), position.mint);
      const amount = BigInt(rawBalance);
      if (amount <= 0n) {
        return {
          success: false,
          reason: "token balance is zero",
          wallet: wallet.publicKey.toBase58()
        };
      }

      if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
        return {
          success: false,
          reason: "token balance too large for quote request",
          wallet: wallet.publicKey.toBase58()
        };
      }

      const route = await this.fetchBestRoute(position.mint, SOL_MINT, amount.toString(), params.sellSlippageBps);
      if (!route) {
        return {
          success: false,
          reason: "no sell route found",
          wallet: wallet.publicKey.toBase58()
        };
      }

      const signature = await this.executeSwap(wallet, route, params.sellSlippageBps, params.priorityFeeMaxLamports);
      this.logger.info({ signature, mint: position.mint, wallet: wallet.publicKey.toBase58() }, "sell transaction confirmed");

      return {
        success: true,
        signature,
        wallet: wallet.publicKey.toBase58(),
        soldAmountRaw: rawBalance
      };
    } catch (error) {
      this.logger.error({ error, mint: position.mint, wallet: position.wallet }, "sell execution failed");
      return {
        success: false,
        reason: (error as Error).message,
        wallet: position.wallet
      };
    }
  }

  public async getWalletTokenBalance(wallet: string, mint: string): Promise<string> {
    const owner = new PublicKey(wallet);
    const mintKey = new PublicKey(mint);

    const response = await this.rpcPool.call("getTokenAccountsByOwner", (connection) =>
      connection.getParsedTokenAccountsByOwner(owner, { mint: mintKey }, "confirmed")
    );

    let total = 0n;
    for (const entry of response.value) {
      const parsed = entry.account.data;
      if (parsed.program !== "spl-token") {
        continue;
      }

      const amount = parsed.parsed.info.tokenAmount.amount as string;
      total += BigInt(amount);
    }

    return total.toString();
  }

  public listWallets(): string[] {
    return this.walletPool.listWallets();
  }

  private async fetchBestRoute(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: number
  ): Promise<JupiterQuoteRoute | undefined> {
    const quoteUrl = new URL(JUPITER_QUOTE_URL);
    quoteUrl.searchParams.set("inputMint", inputMint);
    quoteUrl.searchParams.set("outputMint", outputMint);
    quoteUrl.searchParams.set("amount", amount);
    quoteUrl.searchParams.set("slippageBps", String(slippageBps));
    quoteUrl.searchParams.set("onlyDirectRoutes", "false");
    quoteUrl.searchParams.set("restrictIntermediateTokens", "true");

    const quoteResponse = await fetch(quoteUrl);
    if (!quoteResponse.ok) {
      throw new Error(`quote request failed: ${quoteResponse.status}`);
    }

    const quoteJson = (await quoteResponse.json()) as { data?: JupiterQuoteRoute[] };
    return quoteJson.data?.[0];
  }

  private async executeSwap(
    wallet: Keypair,
    route: JupiterQuoteRoute,
    slippageBps: number,
    priorityFeeMaxLamports: number
  ): Promise<string> {
    const swapResponse = await fetch(JUPITER_SWAP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: route,
        userPublicKey: wallet.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicSlippage: { maxBps: slippageBps },
        dynamicComputeUnitLimit: true,
        useSharedAccounts: false,
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            priorityLevel: "veryHigh",
            maxLamports: priorityFeeMaxLamports
          }
        }
      })
    });

    if (!swapResponse.ok) {
      throw new Error(`swap request failed: ${swapResponse.status}`);
    }

    const swapJson = (await swapResponse.json()) as JupiterSwapResponse;
    if (!swapJson.swapTransaction) {
      throw new Error("swap transaction missing");
    }

    const tx = VersionedTransaction.deserialize(Buffer.from(swapJson.swapTransaction, "base64"));
    tx.sign([wallet]);

    const signature = await this.rpcPool.call("sendRawTransaction", (connection) =>
      connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        maxRetries: 3
      })
    );

    await this.rpcPool.call("confirmTransaction", (connection) =>
      connection.confirmTransaction(signature, "confirmed")
    );

    return signature;
  }
}

export class AdaptiveTradeExecutor implements TradeExecutor {
  public constructor(
    private readonly dryRunExecutor: DryRunTradeExecutor,
    private readonly liveExecutor: JupiterTradeExecutor
  ) {}

  public async executeBuy(event: LaunchEvent, params: SnipeParameters): Promise<BuyResult> {
    if (params.dryRun) {
      return this.dryRunExecutor.executeBuy(event, params);
    }

    return this.liveExecutor.executeBuy(event, params);
  }

  public async executeSell(position: Position, params: SnipeParameters): Promise<SellResult> {
    if (params.dryRun) {
      return this.dryRunExecutor.executeSell(position, params);
    }

    return this.liveExecutor.executeSell(position, params);
  }

  public async getWalletTokenBalance(wallet: string, mint: string): Promise<string> {
    if (mint.length === 0) {
      return "0";
    }

    return this.liveExecutor.getWalletTokenBalance(wallet, mint);
  }

  public listWallets(): string[] {
    return this.liveExecutor.listWallets();
  }
}
