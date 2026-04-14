"use client";

import { useState, useEffect } from "react";
import { FaSearch, FaArrowDown, FaArrowUp, FaSync } from "react-icons/fa";
import { createContractClient, VaultEntry } from "@/lib/contract-client";
import { stellar } from "@/lib/stellar-helper";
import {
  CachedBadge,
  SkeletonLoader,
  EmptyState,
  Input,
  Button,
} from "@/components/ui";

interface VaultHistoryProps {
  publicKey: string;
  refreshTrigger: number;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function formatAmount(amount: number, action: string): string {
  const xlm = amount / 10_000_000;
  const prefix = action === "deposit" ? "+" : "-";
  return `${prefix}${xlm.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function VaultHistory({ publicKey, refreshTrigger }: VaultHistoryProps) {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [allEntries, setAllEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "deposit" | "withdraw">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cached, setCached] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const client = createContractClient();

  const fetchEntries = async (forceRefresh = true) => {
    if (!forceRefresh) {
      setRefreshing(true);
    }

    try {
      const [contractEntries, txResult] = await Promise.all([
        client.getEntriesByOwner(publicKey),
        stellar.getRecentTransactions(publicKey, 20, forceRefresh),
      ]);

      const mergedEntries: VaultEntry[] = [];

      for (const tx of txResult.transactions) {
        if (tx.memo) {
          const parts = tx.memo.split(":");
          if (parts.length >= 4 && parts[0] === publicKey) {
            mergedEntries.push({
              owner: parts[0],
              action: parts[1],
              amount: parseInt(parts[2], 10),
              memo: parts.slice(3).join(":"),
              timestamp: new Date(tx.created_at).getTime(),
            });
          }
        }
      }

      if (contractEntries.length > 0) {
        mergedEntries.push(...contractEntries);
      }

      const uniqueByTimestamp = mergedEntries.reduce((acc, entry) => {
        const key = `${entry.timestamp}-${entry.amount}-${entry.memo}`;
        if (!acc.has(key)) {
          acc.set(key, entry);
        }
        return acc;
      }, new Map<string, VaultEntry>());

      const sorted = Array.from(uniqueByTimestamp.values()).sort(
        (a, b) => b.timestamp - a.timestamp
      );

      setAllEntries(sorted);
      setCached(!forceRefresh);
      setLastFetched(new Date());
    } catch (err) {
      console.error("Failed to fetch entries:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEntries(true);
  }, [publicKey, refreshTrigger]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchEntries(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [publicKey]);

  const filteredEntries = allEntries
    .filter((e) => filter === "all" || e.action === filter)
    .filter(
      (e) =>
        !searchQuery ||
        e.memo.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleRefresh = () => {
    fetchEntries(true);
  };

  return (
    <div className="claude-card p-6 sm:p-8 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📜</span>
          <h2 className="font-serif text-xl text-textMain">Vault History</h2>
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

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === "all"
                ? "bg-primary text-white"
                : "bg-surface border border-borderInner text-textMuted hover:bg-[#F0EEEB]"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("deposit")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === "deposit"
                ? "bg-primary text-white"
                : "bg-surface border border-borderInner text-textMuted hover:bg-[#F0EEEB]"
            }`}
          >
            Deposits
          </button>
          <button
            onClick={() => setFilter("withdraw")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === "withdraw"
                ? "bg-primary text-white"
                : "bg-surface border border-borderInner text-textMuted hover:bg-[#F0EEEB]"
            }`}
          >
            Withdrawals
          </button>
        </div>
        <div className="sm:ml-auto">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted text-xs" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memo…"
              className="claude-input text-sm py-1.5 pl-8 w-48"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonLoader count={3} height="h-20" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <EmptyState
          icon="🏦"
          title="No vault entries yet"
          description="Record your first deposit or withdrawal above."
        />
      ) : (
        <div className="space-y-3 flex-1">
          {filteredEntries.map((entry, index) => (
            <div
              key={index}
              className="bg-surface rounded-xl p-4 sm:p-5 border border-borderInner hover:border-borderOuter shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      entry.action === "deposit"
                        ? "bg-[#F2F8F4] text-[#2F593F] border border-[#E2F0E7]"
                        : "bg-[#FCF2F2] text-[#8C2F2B] border border-[#F8E3E3]"
                    }`}
                  >
                    {entry.action === "deposit" ? (
                      <FaArrowDown className="text-sm" />
                    ) : (
                      <FaArrowUp className="text-sm" />
                    )}
                  </div>
                  <div>
                    <p className="text-textMain font-medium text-sm">
                      {entry.action === "deposit"
                        ? "Deposit"
                        : "Withdrawal"}
                    </p>
                    <p
                      className={`text-lg font-semibold ${
                        entry.action === "deposit"
                          ? "text-success"
                          : "text-error"
                      }`}
                    >
                      {formatAmount(entry.amount, entry.action)} XLM
                    </p>
                  </div>
                </div>
                <p className="text-textMuted text-xs">
                  {formatRelativeTime(entry.timestamp)}
                </p>
              </div>
              {entry.memo && (
                <p className="text-textMuted text-xs mt-2">
                  {entry.memo}
                </p>
              )}
              <p className="text-textMuted text-xs mt-1 font-mono">
                {entry.owner.slice(0, 6)}...{entry.owner.slice(-4)}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="text-textMuted text-xs text-center mt-4">
        Showing {filteredEntries.length} of {allEntries.length} entries
      </p>
    </div>
  );
}