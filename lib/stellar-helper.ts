import * as StellarSdk from "@stellar/stellar-sdk";
import { Horizon, Networks as StellarNetworks, TransactionBuilder, Operation, Asset as StellarAsset, Memo, Transaction as StellarTransaction } from "@stellar/stellar-sdk";
import type { Keypair } from "@stellar/stellar-sdk";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

let kitInitialized = false;

export class WalletNotFoundError extends Error {
  name = "WalletNotFoundError";
}

export class WalletRejectedError extends Error {
  name = "WalletRejectedError";
}

export class InsufficientBalanceError extends Error {
  name = "InsufficientBalanceError";
}

export class DestinationUnfundedError extends Error {
  name = "DestinationUnfundedError";
}

export class NetworkError extends Error {
  name = "NetworkError";
}

class TTLCache<T> {
  private store: Map<string, { data: T; expiry: number }> = new Map();

  set(key: string, data: T, ttlMs: number): void {
    this.store.set(key, {
      data,
      expiry: Date.now() + ttlMs,
    });
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidateAll(): void {
    this.store.clear();
  }
}

export interface Asset {
  code: string;
  issuer?: string;
  balance: string;
}

export interface Transaction {
  id: string;
  created_at: string;
  source_account: string;
  fee: string;
  operations: unknown[];
  memo?: string;
  memo_bytes?: string;
  hash: string;
}

export interface TransactionRecord {
  id: string;
  created_at: string;
  source_account: string;
  fee: string;
  operations: unknown[];
  memo?: string;
  memo_bytes?: string;
  hash: string;
}

interface BalanceCacheData {
  xlm: string;
  assets: Asset[];
}

interface TransactionsCacheData {
  transactions: Transaction[];
}

export class StellarHelper {
  public cache = {
    balance: new TTLCache<BalanceCacheData>(),
    transactions: new TTLCache<TransactionsCacheData>(),
    account: new TTLCache<unknown>(),
  };
  
  private server: Horizon.Server;
  private networkPassphrase: string;
  private network: "testnet" | "mainnet";
  private publicKey: string | null = null;

  constructor(network: "testnet" | "mainnet" = "testnet") {
    this.network = network;

    this.server = new Horizon.Server(
      network === "testnet"
        ? "https://horizon-testnet.stellar.org"
        : "https://horizon.stellar.org"
    );

    this.networkPassphrase =
      network === "testnet"
        ? StellarNetworks.TESTNET
        : StellarNetworks.PUBLIC;
  }

  async connectWallet(): Promise<string> {
    if (!isBrowser()) {
      throw new WalletNotFoundError("Must connect in browser");
    }

    // Load module dynamically
    const swk = await import("@creit.tech/stellar-wallets-kit");
    const { defaultModules } = await import("@creit.tech/stellar-wallets-kit/modules/utils");
    const { Networks } = await import("@creit.tech/stellar-wallets-kit");
    const StellarWalletsKit = swk.StellarWalletsKit;

    // Initialize kit once
    if (!kitInitialized) {
      try {
        const kitNetwork = this.network === "testnet" ? Networks.TESTNET : Networks.PUBLIC;
        console.log("Initializing StellarWalletsKit with network:", kitNetwork);
        StellarWalletsKit.init({
          network: kitNetwork,
          modules: defaultModules(),
        });
        kitInitialized = true;
        console.log("StellarWalletsKit initialized successfully");
      } catch (e: unknown) {
        console.error("kit init failed:", e);
        throw new NetworkError(`Failed to initialize wallet: ${e}`);
      }
    }

    try {
      // Open wallet selector modal and get address
      // authModal opens a modal where user picks wallet, sets it as active, and returns address
      console.log("Calling StellarWalletsKit.authModal()...");
      const result = await StellarWalletsKit.authModal();
      console.log("authModal result:", result);
      if (result.address) {
        this.publicKey = result.address;
        return result.address;
      }
      throw new WalletNotFoundError("No wallet connected. Please authorize in your wallet.");
    } catch (error) {
      console.error("connectWallet error:", error);
      // The wallet kit throws plain objects or errors with empty messages when:
      // - User closes the modal
      // - No wallet is available/installed
      // These are considered cancellation/rejection events
      const errMsg = error instanceof Error ? error.message : "";
      const isNonInformativeError = !errMsg || errMsg === "undefined" || errMsg === "[object Object]";
      if (isNonInformativeError) {
        throw new WalletRejectedError("Wallet connection was cancelled or no wallet selected");
      }
      if (error instanceof WalletNotFoundError) throw error;
      const isCancelled = errMsg.includes("closed") || errMsg.includes("cancel") || errMsg.includes("rejected");
      if (isCancelled) {
        throw new WalletRejectedError("Wallet connection was cancelled");
      }
      throw error;
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      if (!kitInitialized) return false;
      const swk = await import("@creit.tech/stellar-wallets-kit");
      const result = await swk.StellarWalletsKit.getAddress();
      return !!result.address;
    } catch {
      return false;
    }
  }

  async getAddress(): Promise<string | null> {
    try {
      if (!kitInitialized) return null;
      const swk = await import("@creit.tech/stellar-wallets-kit");
      const result = await swk.StellarWalletsKit.getAddress();
      return result.address || null;
    } catch {
      return null;
    }
  }

  disconnect(): void {
    this.publicKey = null;
    kitInitialized = false;
    this.cache.balance.invalidateAll();
    this.cache.transactions.invalidateAll();
    this.cache.account.invalidateAll();
  }

  async getBalance(
    publicKey: string,
    forceRefresh = false
  ): Promise<{ xlm: string; assets: Asset[]; cached: boolean }> {
    const cacheKey = `balance:${publicKey}`;

    if (!forceRefresh) {
      const cached = this.cache.balance.get(cacheKey);
      if (cached) {
        return { xlm: cached.xlm, assets: cached.assets, cached: true };
      }
    }

    try {
      const account = await this.server.accounts().accountId(publicKey).call();

      const nativeBalance = account.balances.find(
        (b): b is Horizon.HorizonApi.BalanceLineNative =>
          b.asset_type === "native"
      );

      const xlm = nativeBalance?.balance ?? "0";

      const assets: Asset[] = [];
      for (const balance of account.balances) {
        if (balance.asset_type !== "native") {
          const assetBalance = balance as Horizon.HorizonApi.BalanceLineAsset;
          assets.push({
            code: assetBalance.asset_code,
            issuer: assetBalance.asset_issuer,
            balance: assetBalance.balance,
          });
        }
      }

      const data: BalanceCacheData = { xlm, assets };
      this.cache.balance.set(cacheKey, data, 30_000);

      if (parseFloat(xlm) < 1.5) {
        throw new InsufficientBalanceError(
          `Insufficient XLM balance. Have: ${xlm}, Required: 1.5`
        );
      }

      return { xlm, assets, cached: false };
    } catch (error) {
      if (error instanceof InsufficientBalanceError) throw error;
      throw new NetworkError(`Failed to fetch balance: ${error}`);
    }
  }

  async getRecentTransactions(
    publicKey: string,
    limit = 10,
    forceRefresh = false
  ): Promise<{ transactions: Transaction[]; cached: boolean }> {
    const cacheKey = `txs:${publicKey}`;

    if (!forceRefresh) {
      const cached = this.cache.transactions.get(cacheKey);
      if (cached) {
        return { transactions: cached.transactions, cached: true };
      }
    }

    try {
      const transactions = await this.server
        .transactions()
        .forAccount(publicKey)
        .limit(limit)
        .order("desc")
        .call();

      const txs: Transaction[] = transactions.records.map((tx) => ({
        id: tx.id,
        created_at: tx.created_at,
        source_account: tx.source_account,
        fee: String(typeof tx.fee_charged === "number" ? tx.fee_charged : tx.fee_charged),
        operations: [],
        memo: tx.memo,
        memo_bytes: tx.memo_bytes,
        hash: tx.hash,
      }));

      const data: TransactionsCacheData = { transactions: txs };
      this.cache.transactions.set(cacheKey, data, 20_000);

      return { transactions: txs, cached: false };
    } catch (error) {
      throw new NetworkError(`Failed to fetch transactions: ${error}`);
    }
  }

  async sendPayment(params: {
    from: string;
    to: string;
    amount: string;
    memo?: string;
  }): Promise<{ hash: string; success: boolean }> {
    const { from, to, amount, memo } = params;

    try {
      await this.server.accounts().accountId(to).call();
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err.response?.status === 404) {
        throw new DestinationUnfundedError(
          "Destination account not found or not funded"
        );
      }
      throw new NetworkError(`Failed to verify destination: ${error}`);
    }

    try {
      const sourceAccount = await this.server.loadAccount(from);

      const builder = new TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: to,
            asset: StellarAsset.native(),
            amount: amount,
          })
        )
        .setTimeout(30);

      if (memo) {
        builder.addMemo(Memo.text(memo));
      }

      const transaction = builder.build();

      let swk: typeof import("@creit.tech/stellar-wallets-kit");
      if (!kitInitialized) {
        swk = await import("@creit.tech/stellar-wallets-kit");
        const { defaultModules } = await import("@creit.tech/stellar-wallets-kit/modules/utils");
        const { Networks } = await import("@creit.tech/stellar-wallets-kit");
        const kitNetwork = this.network === "testnet" ? Networks.TESTNET : Networks.PUBLIC;
        swk.StellarWalletsKit.init({
          network: kitNetwork,
          modules: defaultModules(),
        });
        kitInitialized = true;
      } else {
        swk = await import("@creit.tech/stellar-wallets-kit");
      }

      const addressResult = await swk.StellarWalletsKit.getAddress();
      const { signedTxXdr } = await swk.StellarWalletsKit.signTransaction(transaction.toXDR(), {
        networkPassphrase: this.networkPassphrase,
        address: addressResult.address,
      });

      const parsedTx = new StellarTransaction(signedTxXdr, this.networkPassphrase);
      const response = await this.server.submitTransaction(parsedTx);

      this.cache.balance.invalidate(`balance:${from}`);
      this.cache.transactions.invalidate(`txs:${from}`);

      return { hash: response.hash, success: response.successful ?? false };
    } catch (error) {
      if (error instanceof WalletRejectedError) throw error;
      if (error instanceof NetworkError) throw error;
      throw new NetworkError(`Payment failed: ${error}`);
    }
  }

  getExplorerLink(hash: string, type: "tx" | "account"): string {
    const baseUrl =
      this.networkPassphrase === StellarNetworks.TESTNET
        ? "https://stellar.expert/explorer/testnet"
        : "https://stellar.expert/explorer/public";

    if (type === "tx") {
      return `${baseUrl}/tx/${hash}`;
    }
    return `${baseUrl}/account/${hash}`;
  }

  formatAddress(address: string, start = 4, end = 4): string {
    if (address.length <= start + end) return address;
    return `${address.slice(0, start)}...${address.slice(-end)}`;
  }
}

export const stellar = new StellarHelper("testnet");