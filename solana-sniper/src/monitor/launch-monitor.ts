import { LaunchEvent } from "../types.js";

export type LaunchCallback = (event: LaunchEvent) => Promise<void>;

export interface LaunchMonitor {
  readonly source: "raydium" | "pumpfun";
  start(callback: LaunchCallback): Promise<void>;
  stop(): Promise<void>;
}
