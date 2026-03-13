import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { Logger } from "pino";
import { Position } from "../types.js";

const POSITIONS_FILE = resolve(process.cwd(), ".positions.json");

function positionKey(position: Pick<Position, "wallet" | "mint">): string {
  return `${position.wallet}:${position.mint}`;
}

export class PositionManager {
  private readonly positions = new Map<string, Position>();

  public constructor(private readonly logger: Logger) {}

  public async loadFromDisk(): Promise<void> {
    try {
      const raw = await fs.readFile(POSITIONS_FILE, "utf8");
      const parsed = JSON.parse(raw) as Position[];
      for (const position of parsed) {
        if (!position.wallet || !position.mint) {
          continue;
        }

        this.positions.set(positionKey(position), position);
      }

      this.logger.info({ count: this.positions.size }, "positions loaded");
    } catch {
      // no-op: missing file is expected on first run
    }
  }

  public async saveToDisk(): Promise<void> {
    const data = Array.from(this.positions.values());
    await fs.writeFile(POSITIONS_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  public add(position: Position): void {
    this.positions.set(positionKey(position), position);
  }

  public upsert(position: Position): void {
    this.positions.set(positionKey(position), position);
  }

  public remove(wallet: string, mint: string): Position | undefined {
    const key = `${wallet}:${mint}`;
    const found = this.positions.get(key);
    this.positions.delete(key);
    return found;
  }

  public removeByMint(mint: string): Position[] {
    const removed: Position[] = [];
    for (const [key, position] of this.positions.entries()) {
      if (position.mint !== mint) {
        continue;
      }

      removed.push(position);
      this.positions.delete(key);
    }

    return removed;
  }

  public list(): Position[] {
    return Array.from(this.positions.values()).sort((a, b) => a.openedAt - b.openedAt);
  }

  public getByMint(mint: string): Position[] {
    return this.list().filter((position) => position.mint === mint);
  }

  public count(): number {
    return this.positions.size;
  }

  public update(wallet: string, mint: string, updates: Partial<Position>): Position | undefined {
    const key = `${wallet}:${mint}`;
    const current = this.positions.get(key);
    if (!current) {
      return undefined;
    }

    const next = {
      ...current,
      ...updates
    };

    this.positions.set(key, next);
    return next;
  }
}
