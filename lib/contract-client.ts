import { stellar, NetworkError, WalletRejectedError, InsufficientBalanceError } from "./stellar-helper";
import * as StellarSdk from "@stellar/stellar-sdk";
import { nativeToScVal, scValToNative } from "@stellar/stellar-sdk";

export type TxProgress =
  | { stage: "idle" }
  | { stage: "building"; message: "Building transaction…" }
  | { stage: "signing"; message: "Waiting for wallet signature…" }
  | { stage: "submitting"; message: "Broadcasting to network…" }
  | { stage: "confirming"; message: "Waiting for confirmation…" }
  | { stage: "success"; message: "Transaction confirmed!"; hash: string }
  | { stage: "error"; message: string; errorType: string };

export interface VaultEntry {
  owner: string;
  action: string;
  amount: number;
  memo: string;
  timestamp: number;
}

export class ContractClient {
  private onProgress?: (p: TxProgress) => void;

  constructor(onProgress?: (p: TxProgress) => void) {
    this.onProgress = onProgress;
    stellar.setProgressHandler((p) => this.onProgress?.(p));
  }

  private setProgress(progress: TxProgress): void {
    this.onProgress?.(progress);
  }

  async recordEntry(params: {
    ownerKey: string;
    action: "deposit" | "withdraw";
    amount: string;
    memo: string;
  }): Promise<string> {
    const { ownerKey, action, amount, memo } = params;

    this.setProgress({ stage: "building", message: "Building transaction…" });

    try {
      const amountInSmallestUnit = Math.floor(parseFloat(amount) * 10_000_000);
      const memoStr = memo || " ";
      const actionStr = action === "deposit" ? "deposit" : "withdraw";

      const result = await stellar.invokeContract({
        method: "record_entry",
        args: [
          nativeToScVal(ownerKey, { type: "address" }),
          nativeToScVal(actionStr, { type: "string" }),
          nativeToScVal(amountInSmallestUnit, { type: "i128" }),
          nativeToScVal(memoStr, { type: "string" }),
        ],
        publicKey: ownerKey,
      });

      this.setProgress({
        stage: "success",
        message: "Transaction confirmed!",
        hash: result.hash,
      });

      stellar.cache.transactions.invalidate(`txs:${ownerKey}`);

      return result.hash;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      let errorType = "Error";

      if (error instanceof WalletRejectedError) {
        errorType = "WalletRejectedError";
      } else if (error instanceof InsufficientBalanceError) {
        errorType = "InsufficientBalanceError";
      } else if (error instanceof NetworkError) {
        errorType = "NetworkError";
      }

      this.setProgress({
        stage: "error",
        message: errorMessage,
        errorType,
      });

      throw error;
    }
  }

  async getEntries(): Promise<VaultEntry[]> {
    try {
      const pubKey = await stellar.getAddress();
      if (!pubKey) return [];

      const result = await stellar.simulateContractCall("get_entries");
      return this.parseEntriesResult(result);
    } catch {
      return [];
    }
  }

  async getEntriesByOwner(ownerKey: string): Promise<VaultEntry[]> {
    try {
      const result = await stellar.simulateContractCall("get_entries_by_owner", [
        nativeToScVal(ownerKey, { type: "address" }),
      ]);
      return this.parseEntriesResult(result);
    } catch {
      return [];
    }
  }

  async getEntryCount(): Promise<number> {
    try {
      const result = await stellar.simulateContractCall("get_entry_count");
      const resultObj = result as { retval?: StellarSdk.xdr.ScVal };
      if (resultObj?.retval) {
        const count = scValToNative(resultObj.retval);
        return Number(count);
      }
      return 0;
    } catch {
      return 0;
    }
  }

  private parseEntriesResult(result: unknown): VaultEntry[] {
    if (!result || typeof result !== "object") return [];

    const resultObj = result as { retval?: StellarSdk.xdr.ScVal };
    if (!resultObj.retval) return [];

    try {
      const nativeData = scValToNative(resultObj.retval);

      if (!Array.isArray(nativeData)) return [];

      return nativeData.map((entry: any) => ({
        owner: entry.owner || "",
        action: entry.action || "",
        amount: Number(entry.amount || 0),
        memo: entry.memo || "",
        timestamp: Number(entry.timestamp || Date.now()),
      }));
    } catch (e) {
      console.error("Failed to parse entries using scValToNative:", e);
      return [];
    }
  }
}

export function createContractClient(onProgress?: (p: TxProgress) => void) {
  return new ContractClient(onProgress);
}
