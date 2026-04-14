import { stellar, WalletRejectedError, InsufficientBalanceError, NetworkError } from "./stellar-helper";

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
      const result = await stellar.sendPayment({
        from: ownerKey,
        to: ownerKey,
        amount: amount,
        memo: `${ownerKey}:${action}:${Math.floor(parseFloat(amount) * 10_000_000)}:${memo}`,
      });

      this.setProgress({ stage: "submitting", message: "Broadcasting to network…" });
      this.setProgress({ stage: "confirming", message: "Waiting for confirmation…" });
      this.setProgress({
        stage: "success",
        message: "Transaction confirmed!",
        hash: result.hash,
      });

      stellar.cache.balance.invalidate(`balance:${ownerKey}`);
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

      const result = await stellar.getRecentTransactions(pubKey, 20);
      
      const entries: VaultEntry[] = [];
      
      for (const tx of result.transactions) {
        if (tx.memo) {
          const parts = tx.memo.split(":");
          if (parts.length >= 4) {
            entries.push({
              owner: parts[0],
              action: parts[1],
              amount: parseInt(parts[2], 10),
              memo: parts.slice(3).join(":"),
              timestamp: new Date(tx.created_at).getTime(),
            });
          }
        }
      }

      return entries;
    } catch {
      return [];
    }
  }

  async getEntriesByOwner(ownerKey: string): Promise<VaultEntry[]> {
    try {
      const result = await stellar.getRecentTransactions(ownerKey, 20);
      
      const entries: VaultEntry[] = [];
      
      for (const tx of result.transactions) {
        if (tx.memo) {
          const parts = tx.memo.split(":");
          if (parts.length >= 4 && parts[0] === ownerKey) {
            entries.push({
              owner: parts[0],
              action: parts[1],
              amount: parseInt(parts[2], 10),
              memo: parts.slice(3).join(":"),
              timestamp: new Date(tx.created_at).getTime(),
            });
          }
        }
      }

      return entries;
    } catch {
      return [];
    }
  }

  async getEntryCount(): Promise<number> {
    const entries = await this.getEntries();
    return entries.length;
  }
}

export function createContractClient(onProgress?: (p: TxProgress) => void) {
  return new ContractClient(onProgress);
}