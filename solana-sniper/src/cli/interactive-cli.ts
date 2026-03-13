import readline from "node:readline";
import { Logger } from "pino";
import { saveRuntimeConfig } from "../config/runtime-config.js";
import { SniperEngine } from "../sniper/sniper-engine.js";
import { SnipeParameters } from "../types.js";

const numericKeys: Array<keyof SnipeParameters> = [
  "maxBuyAmountSol",
  "slippageBps",
  "sellSlippageBps",
  "maxMarketCapUsd",
  "minLiquiditySol",
  "minLiquidityUsd",
  "takeProfitPct",
  "stopLossPct",
  "maxRiskScore",
  "maxOpenPositions",
  "priorityFeeMaxLamports",
  "positionCheckIntervalMs",
  "alertMinMarketCapUsd"
];

const booleanKeys: Array<keyof SnipeParameters> = [
  "dryRun",
  "autoSell",
  "requireSellable",
  "persistPositions"
];

const listKeys: Array<keyof SnipeParameters> = ["allowedSymbols", "deniedSymbols"];

export class InteractiveCli {
  private readonly rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  public constructor(
    private readonly engine: SniperEngine,
    private params: SnipeParameters,
    private readonly logger: Logger
  ) {}

  public async run(): Promise<void> {
    this.printHelp();

    for await (const line of this.rl) {
      const trimmed = line.trim();
      if (!trimmed) {
        this.prompt();
        continue;
      }

      const [cmd, ...rest] = trimmed.split(" ");

      try {
        if (cmd === "help") {
          this.printHelp();
        } else if (cmd === "show") {
          this.showConfig();
        } else if (cmd === "status") {
          this.showStatus();
        } else if (cmd === "positions") {
          this.showPositions();
        } else if (cmd === "sell") {
          await this.handleSell(rest);
        } else if (cmd === "start") {
          await this.engine.start();
          console.log("Sniping started.");
        } else if (cmd === "stop") {
          await this.engine.stop();
          console.log("Sniping stopped.");
        } else if (cmd === "set") {
          await this.handleSet(rest);
        } else if (cmd === "exit" || cmd === "quit") {
          await this.shutdown();
          return;
        } else {
          console.log("Unknown command. Type 'help' for available commands.");
        }
      } catch (error) {
        this.logger.error({ error, cmd }, "cli command failed");
        console.error(`Command failed: ${(error as Error).message}`);
      }

      this.prompt();
    }
  }

  private prompt(): void {
    this.rl.setPrompt("sniper> ");
    this.rl.prompt();
  }

  private printHelp(): void {
    console.log("Commands:");
    console.log("  help                               Show commands");
    console.log("  show                               Show current parameters");
    console.log("  status                             Show runtime stats and health");
    console.log("  positions                          Show open positions");
    console.log("  sell <mint>                        Manually sell position(s) for mint");
    console.log("  set <key> <value>                  Update parameter");
    console.log("  start                              Start sniping");
    console.log("  stop                               Stop sniping");
    console.log("  exit | quit                        Stop and exit");
    this.prompt();
  }

  private showConfig(): void {
    console.log(JSON.stringify(this.params, null, 2));
    console.log(`running: ${this.engine.isRunning()}`);
  }

  private showStatus(): void {
    console.log(JSON.stringify(this.engine.getStatus(), null, 2));
  }

  private showPositions(): void {
    const positions = this.engine.listPositions();
    if (positions.length === 0) {
      console.log("No open positions.");
      return;
    }

    for (const position of positions) {
      const opened = new Date(position.openedAt).toISOString();
      console.log(
        `${position.symbol ?? "?"} ${position.mint} wallet=${position.wallet} opened=${opened} entryPrice=${position.entryPriceUsd ?? "n/a"} currentPrice=${position.currentPriceUsd ?? "n/a"}`
      );
    }
  }

  private async handleSell(args: string[]): Promise<void> {
    const [mint] = args;
    if (!mint) {
      throw new Error("Usage: sell <mint>");
    }

    const result = await this.engine.manualSellByMint(mint);
    console.log(`Sell attempts: ${result.attempted}, success: ${result.sold}`);
    if (result.errors.length > 0) {
      for (const error of result.errors) {
        console.log(`  error: ${error}`);
      }
    }
  }

  private async handleSet(args: string[]): Promise<void> {
    const [keyRaw, ...valueParts] = args;
    if (!keyRaw || valueParts.length === 0) {
      throw new Error("Usage: set <key> <value>");
    }

    const key = keyRaw as keyof SnipeParameters;
    const value = valueParts.join(" ").trim();

    if (numericKeys.includes(key)) {
      const parsed = Number(value);
      if (Number.isNaN(parsed)) {
        throw new Error(`Invalid number for ${key}: ${value}`);
      }

      this.params = { ...this.params, [key]: parsed };
    } else if (booleanKeys.includes(key)) {
      this.params = { ...this.params, [key]: value.toLowerCase() === "true" };
    } else if (listKeys.includes(key)) {
      this.params = {
        ...this.params,
        [key]: value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      };
    } else {
      throw new Error(`Unknown parameter: ${key}`);
    }

    this.engine.updateParams(this.params);
    await saveRuntimeConfig(this.params);
    console.log("Parameter updated.");
  }

  private async shutdown(): Promise<void> {
    await this.engine.stop();
    await saveRuntimeConfig(this.params);
    this.rl.close();
  }
}
