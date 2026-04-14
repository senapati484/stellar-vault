"use client";

import { useState, useEffect } from "react";
import { createContractClient, VaultEntry } from "@/lib/contract-client";
import { SkeletonLoader } from "@/components/ui";

interface StatsPanelProps {
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

export function StatsPanel({ publicKey, refreshTrigger }: StatsPanelProps) {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const client = createContractClient();

  useEffect(() => {
    const fetchEntries = async () => {
      setLoading(true);
      try {
        const result = await client.getEntriesByOwner(publicKey);
        setEntries(result);
      } catch (err) {
        console.error("Failed to fetch entries:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, [publicKey, refreshTrigger]);

  const totalDeposited = entries
    .filter((e) => e.action === "deposit")
    .reduce((sum, e) => sum + e.amount, 0);

  const totalWithdrawn = entries
    .filter((e) => e.action === "withdraw")
    .reduce((sum, e) => sum + e.amount, 0);

  const netFlow = totalDeposited - totalWithdrawn;
  const netFlowXlm = netFlow / 10_000_000;
  const depositedXlm = totalDeposited / 10_000_000;
  const withdrawnXlm = totalWithdrawn / 10_000_000;

  const entryCount = entries.length;

  const lastActivity = entries.length > 0
    ? formatRelativeTime(Math.max(...entries.map((e) => e.timestamp)))
    : "No activity";

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-surface border border-borderInner rounded-xl p-5 shadow-sm"
          >
            <SkeletonLoader height="h-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-surface border border-borderInner rounded-xl p-5 shadow-sm">
        <p className="text-textMuted text-[10px] uppercase tracking-widest font-semibold mb-2">
          Total Flow
        </p>
        <p
          className={`text-2xl font-serif font-semibold text-textMain ${
            netFlowXlm >= 0 ? "text-success" : "text-error"
          }`}
        >
          {netFlowXlm >= 0 ? "+" : ""}
          {netFlowXlm.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          <span className="text-base font-normal">XLM</span>
        </p>
        <p className="text-textMuted text-xs mt-1">
          across {entryCount} {entryCount === 1 ? "entry" : "entries"}
        </p>
      </div>

      <div className="bg-surface border border-borderInner rounded-xl p-5 shadow-sm">
        <p className="text-textMuted text-[10px] uppercase tracking-widest font-semibold mb-2">
          Deposited
        </p>
        <p className="text-2xl font-serif font-semibold text-textMain">
          {depositedXlm.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          <span className="text-base font-normal">XLM</span>
        </p>
        <p className="text-textMuted text-xs mt-1">lifetime inflow</p>
      </div>

      <div className="bg-surface border border-borderInner rounded-xl p-5 shadow-sm">
        <p className="text-textMuted text-[10px] uppercase tracking-widest font-semibold mb-2">
          Withdrawn
        </p>
        <p className="text-2xl font-serif font-semibold text-textMain">
          {withdrawnXlm.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          <span className="text-base font-normal">XLM</span>
        </p>
        <p className="text-textMuted text-xs mt-1">lifetime outflow</p>
      </div>
    </div>
  );
}