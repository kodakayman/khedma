import { Logger } from "pino";
import { LaunchEvent, Position } from "../types.js";
import { Notifier } from "./notifier.js";

function formatNumber(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }

  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export class TelegramNotifier implements Notifier {
  private readonly apiUrl: string;

  public constructor(
    private readonly botToken: string,
    private readonly chatId: string,
    private readonly logger: Logger
  ) {
    this.apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  }

  public async notifyInfo(message: string): Promise<void> {
    await this.sendMessage(`Info\n${message}`);
  }

  public async notifyBuy(event: LaunchEvent, position: Position, signature?: string): Promise<void> {
    const lines = [
      "Buy Executed",
      `${event.symbol ?? "?"} (${event.mint})`,
      `Source: ${event.source}`,
      `Wallet: ${position.wallet}`,
      `Amount: ${position.amountInSol.toFixed(4)} SOL`,
      `Market Cap: $${formatNumber(event.marketCapUsd)}`,
      `Liquidity: $${formatNumber(event.liquidityUsd)}`
    ];

    if (signature) {
      lines.push(`Tx: https://solscan.io/tx/${signature}`);
    }

    await this.sendMessage(lines.join("\n"));
  }

  public async notifySell(position: Position, reason: string, signature?: string, pnlPct?: number): Promise<void> {
    const lines = [
      "Sell Executed",
      `${position.symbol ?? "?"} (${position.mint})`,
      `Wallet: ${position.wallet}`,
      `Reason: ${reason}`
    ];

    if (pnlPct !== undefined && Number.isFinite(pnlPct)) {
      lines.push(`PnL: ${pnlPct.toFixed(2)}%`);
    }

    if (signature) {
      lines.push(`Tx: https://solscan.io/tx/${signature}`);
    }

    await this.sendMessage(lines.join("\n"));
  }

  public async notifyError(message: string): Promise<void> {
    await this.sendMessage(`Error\n${message}`);
  }

  private async sendMessage(text: string): Promise<void> {
    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text
        })
      });

      if (!response.ok) {
        this.logger.warn({ status: response.status }, "telegram notification failed");
      }
    } catch (error) {
      this.logger.warn({ error }, "telegram notification error");
    }
  }
}
