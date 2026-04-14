"use client";

import { useState, useEffect } from "react";
import { FaWallet, FaSync, FaCoins } from "react-icons/fa";
import { CachedBadge, SkeletonLoader, Alert, ProgressBar } from "@/components/ui";
import { stellar } from "@/lib/stellar-helper";
import type { Asset } from "@/lib/stellar-helper";
import { createContractClient } from "@/lib/contract-client";

interface BalanceCardProps {
  publicKey: string;
  onRefresh?: () => void;
  refreshTrigger?: number;
}

export function BalanceCard({ publicKey, onRefresh, refreshTrigger }: BalanceCardProps) {
  const [balance, setBalance] = useState("0");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cached, setCached] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = async (forceRefresh = false) => {
    if (!forceRefresh) {
      setRefreshing(true);
    }

    try {
      const result = await stellar.getBalance(publicKey, forceRefresh);
      
      // Calculate realistic "mock" balance since native self-payments don't change actual XLM
      const client = createContractClient();
      const entries = await client.getEntriesByOwner(publicKey);
      const totalDeposited = entries
        .filter((e) => e.action === "deposit")
        .reduce((sum, e) => sum + e.amount, 0);
      const totalWithdrawn = entries
        .filter((e) => e.action === "withdraw")
        .reduce((sum, e) => sum + e.amount, 0);
      
      const netFlowXlm = (totalDeposited - totalWithdrawn) / 10_000_000;
      const realXlm = parseFloat(result.xlm);
      
      // Add net flow (deposits minus withdrawals) to simulate XLM being added to the overall mocked portfolio
      const simulatedXlm = Math.max(0, realXlm + netFlowXlm);

      setBalance(simulatedXlm.toString());
      setAssets(result.assets);
      setCached(result.cached);
      setLastFetched(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch balance");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBalance(true);

    const interval = setInterval(() => {
      fetchBalance(false);
    }, 60000);

    return () => clearInterval(interval);
  }, [publicKey, refreshTrigger]);

  const handleRefresh = () => {
    fetchBalance(true);
    onRefresh?.();
  };

  const xlmUsdRate = 0.12;
  const usdEstimate = (parseFloat(balance) * xlmUsdRate).toFixed(2);
  const balancePercent = Math.min(parseFloat(balance), 1000);

  if (loading) {
    return (
      <div className="claude-card p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-surface border border-borderInner rounded-lg flex items-center justify-center">
              <FaWallet className="text-textMuted" />
            </div>
            <span className="font-serif text-xl text-textMain">Net Worth</span>
          </div>
        </div>
        <SkeletonLoader count={2} height="h-8" className="mb-4" />
        <SkeletonLoader height="h-4" width="w-32" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="claude-card p-6 sm:p-8">
        <Alert
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      </div>
    );
  }

  return (
    <div className="claude-card p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-surface border border-borderInner rounded-lg flex items-center justify-center">
            <FaWallet className="text-textMuted" />
          </div>
          <span className="font-serif text-xl text-textMain">Net Worth</span>
        </div>
        <div className="flex items-center gap-3">
          <CachedBadge cached={cached} lastFetched={lastFetched || undefined} />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 hover:bg-surface rounded-lg transition-colors"
          >
            <FaSync
              className={`text-textMuted ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-textMuted text-xs uppercase tracking-widest mb-2">
          Available Balance
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl sm:text-6xl font-serif font-semibold text-textMain">
            {parseFloat(balance).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
          <span className="text-textMuted text-lg font-medium">XLM</span>
        </div>
        <div className="mt-2">
          <span className="text-xs text-textMuted">
            ≈ ${usdEstimate} USD
          </span>
        </div>
      </div>

      <div className="mb-6">
        <ProgressBar
          value={balancePercent}
          max={1000}
          label="Portfolio"
          animated={false}
        />
      </div>

      {assets.length > 0 && (
        <div className="mb-6">
          <p className="text-textMuted text-xs uppercase tracking-widest mb-3">
            Other Assets
          </p>
          {assets.map((asset, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 border-b border-borderInner last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-surface border border-borderInner rounded flex items-center justify-center">
                  <span className="text-xs font-medium text-textMuted">
                    {asset.code.charAt(0)}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-textMain">
                    {asset.code}
                  </span>
                  <span className="text-xs text-textMuted ml-2">
                    {asset.issuer
                      ? `${asset.issuer.slice(0, 6)}...${asset.issuer.slice(-4)}`
                      : ""}
                  </span>
                </div>
              </div>
              <span className="text-sm font-mono text-textMain">
                {parseFloat(asset.balance).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-[#F4F2EC] border border-[#E9E7E0] rounded-lg p-3">
        <p className="text-xs text-textMuted">
          Keep at least 1 XLM for Stellar network reserves.
        </p>
      </div>
    </div>
  );
}