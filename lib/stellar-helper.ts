import * as StellarSdk from "@stellar/stellar-sdk";
import { Horizon, Networks as StellarNetworks, TransactionBuilder, Operation, Asset as StellarAsset, Memo, Transaction as StellarTransaction } from "@stellar/stellar-sdk";
import { Server as RpcServer } from "@stellar/stellar-sdk/rpc";
import { Contract } from "@stellar/stellar-sdk";
import type { Keypair } from "@stellar/stellar-sdk";
import type { TxProgress } from "./contract-client";
import { Api } from "@stellar/stellar-sdk/rpc";

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
  private sorobanRpc: RpcServer;
  private networkPassphrase: string;
  private network: "testnet" | "mainnet";
  private publicKey: string | null = null;
  private contractId: string;
  private _contract: Contract | null = null;

  private get contract(): Contract {
    if (!this._contract) {
      if (!this.contractId) {
        throw new NetworkError("Contract ID not set. Please deploy the contract and set NEXT_PUBLIC_CONTRACT_ID.");
      }
      this._contract = new Contract(this.contractId);
    }
    return this._contract;
  }

  constructor(network: "testnet" | "mainnet" = "testnet") {
    this.network = network;

    this.server = new Horizon.Server(
      network === "testnet"
        ? "https://horizon-testnet.stellar.org"
        : "https://horizon.stellar.org"
    );

    this.sorobanRpc = new RpcServer(
      network === "testnet"
        ? "https://soroban-testnet.stellar.org:443"
        : "https://soroban.stellar.org:443"
    );

    this.networkPassphrase =
      network === "testnet"
        ? StellarNetworks.TESTNET
        : StellarNetworks.PUBLIC;

    this.contractId = process.env.NEXT_PUBLIC_CONTRACT_ID || "";
  }

  setContractId(contractId: string): void {
    this.contractId = contractId;
    this._contract = null;
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

  async invokeContract(params: {
    method: string;
    args?: StellarSdk.xdr.ScVal[];
    publicKey: string;
  }): Promise<{ hash: string; result: unknown }> {
    const { method, args = [], publicKey } = params;

    try {
      this.emitProgress({ stage: "building", message: "Building transaction…" });

      const account = await this.sorobanRpc.getAccount(publicKey);

      // First, build and simulate the transaction to get the footprint
      const baseFee = 5000; // Higher fee to avoid resource issues
      const scValArgs = args as StellarSdk.xdr.ScVal[];
      
      const transactionForSim = new TransactionBuilder(account, {
        fee: baseFee,
        networkPassphrase: this.networkPassphrase,
      })
        .setTimeout(30)
        .addOperation(this.contract.call(method, ...scValArgs))
        .build();

      // Simulate to get the transaction data and footprint
      const simResult = await this.sorobanRpc.simulateTransaction(transactionForSim);
      if ("error" in simResult) {
        throw new NetworkError(`Simulation failed: ${simResult.error}`);
      }

      // IMPORTANT: We cannot use sorobanRpc.prepareTransaction() because it
      // internally calls assembleTransaction → TransactionBuilder.cloneFrom(),
      // which performs an `instanceof Transaction` check. Due to a dual-class
      // identity issue (browser bundle uses one Transaction class, the RPC
      // module uses a different nested stellar-base Transaction class),
      // that instanceof check always fails with:
      //   TypeError: expected a 'Transaction', got: [object Object]
      //
      // Instead, we manually rebuild the transaction with the simulation
      // results (fee, sorobanData, auth) baked in, which entirely bypasses
      // the problematic cloneFrom path.
      const successSim = simResult as Api.SimulateTransactionSuccessResponse;

      // Calculate the total fee: base fee + resource fee from simulation
      const classicFeeNum = parseInt(String(baseFee)) || 0;
      const minResourceFeeNum = parseInt(successSim.minResourceFee) || 0;
      const totalFee = (classicFeeNum + minResourceFeeNum).toString();

      // Rebuild a fresh account with the correct sequence number
      // (same as the original, since we haven't submitted yet)
      const freshAccount = await this.sorobanRpc.getAccount(publicKey);

      const preparedBuilder = new TransactionBuilder(freshAccount, {
        fee: totalFee,
        networkPassphrase: this.networkPassphrase,
      })
        .setTimeout(30)
        .setSorobanData(successSim.transactionData.build());

      // Re-add the operation with auth from simulation
      const originalOp = transactionForSim.operations[0] as {
        type: string;
        source?: string;
        func: StellarSdk.xdr.HostFunction;
        auth?: StellarSdk.xdr.SorobanAuthorizationEntry[];
      };

      if (originalOp.type === "invokeHostFunction") {
        const existingAuth = originalOp.auth ?? [];
        preparedBuilder.addOperation(
          Operation.invokeHostFunction({
            source: originalOp.source,
            func: originalOp.func,
            auth: existingAuth.length > 0 ? existingAuth : successSim.result?.auth ?? [],
          })
        );
      } else {
        // For non-invokeHostFunction ops (extendFootprintTtl, restoreFootprint),
        // just re-add the original operation
        preparedBuilder.addOperation(this.contract.call(method, ...scValArgs));
      }

      const preparedTx = preparedBuilder.build();
      
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

      this.emitProgress({ stage: "signing", message: "Waiting for wallet signature…" });
      console.log("Before wallet sign. XDR:", preparedTx.toXDR());
      let signedTxXdr;
      try {
        const signResult = await swk.StellarWalletsKit.signTransaction(preparedTx.toXDR(), {
          networkPassphrase: this.networkPassphrase,
          address: publicKey,
        });
        signedTxXdr = signResult.signedTxXdr;
        console.log("Wallet sign complete.");
      } catch (e: any) {
        console.error("Error internally during SWK signing:", e);
        throw e;
      }

      console.log("Instantiating parsedTx");
      const parsedTx = new StellarTransaction(signedTxXdr, this.networkPassphrase);

      console.log("Sending transaction");
      this.emitProgress({ stage: "submitting", message: "Broadcasting to network…" });
      const sendResult = await this.sorobanRpc.sendTransaction(parsedTx);
      
      console.log("Send result:", sendResult);

      this.emitProgress({ stage: "confirming", message: "Waiting for confirmation…" });
      const txResult = await this.sorobanRpc.pollTransaction(sendResult.hash);

      if (txResult.status === Api.GetTransactionStatus.SUCCESS) {
        this.emitProgress({
          stage: "success",
          message: "Transaction confirmed!",
          hash: sendResult.hash,
        });
        return { hash: sendResult.hash, result: (txResult as Api.GetSuccessfulTransactionResponse).returnValue };
      } else if (txResult.status === Api.GetTransactionStatus.FAILED) {
        const failedTx = txResult as Api.GetFailedTransactionResponse;
        throw new NetworkError(`Transaction failed: ${failedTx.resultXdr}`);
      }

      throw new NetworkError(`Transaction ended with unexpected status: ${txResult.status}`);
    } catch (error) {
      console.error("Caught error in invokeContract:", error);
      if (error instanceof Error && error.stack) {
        console.error("Stack trace:", error.stack);
      }
      if (error instanceof WalletRejectedError) throw error;
      throw new NetworkError(`Contract invocation failed: ${error}`);
    }
  }

  async simulateContractCall(method: string, args?: StellarSdk.xdr.ScVal[]): Promise<unknown> {
    if (!this.contractId) {
      throw new NetworkError("Contract ID not set");
    }

    const publicKey = await this.getAddress();
    if (!publicKey) {
      throw new WalletNotFoundError("No wallet connected");
    }

    const account = await this.sorobanRpc.getAccount(publicKey);

    const scValArgs = (args || []) as StellarSdk.xdr.ScVal[];
    const transaction = new TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .setTimeout(30)
      .addOperation(this.contract.call(method, ...scValArgs))
      .build();

    const simResult = await this.sorobanRpc.simulateTransaction(transaction);

    if ("error" in simResult) {
      throw new NetworkError(`Simulation failed: ${(simResult as Api.SimulateTransactionErrorResponse).error}`);
    }

    return (simResult as Api.SimulateTransactionSuccessResponse).result;
  }

  setProgressHandler(handler: (p: TxProgress) => void): void {
    this.progressHandler = handler;
  }

  private progressHandler?: (p: TxProgress) => void;

  private emitProgress(progress: TxProgress): void {
    this.progressHandler?.(progress);
  }
}

export const stellar = new StellarHelper("testnet");