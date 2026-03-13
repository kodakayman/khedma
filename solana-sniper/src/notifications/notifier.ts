import { LaunchEvent, Position } from "../types.js";

export interface Notifier {
  notifyInfo(message: string): Promise<void>;
  notifyBuy(event: LaunchEvent, position: Position, signature?: string): Promise<void>;
  notifySell(position: Position, reason: string, signature?: string, pnlPct?: number): Promise<void>;
  notifyError(message: string): Promise<void>;
}

export class NoopNotifier implements Notifier {
  public async notifyInfo(): Promise<void> {
    // no-op
  }

  public async notifyBuy(): Promise<void> {
    // no-op
  }

  public async notifySell(): Promise<void> {
    // no-op
  }

  public async notifyError(): Promise<void> {
    // no-op
  }
}
