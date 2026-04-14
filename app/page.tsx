"use client";

import { useState, useEffect } from "react";
import { stellar } from "@/lib/stellar-helper";
import { Navbar } from "@/components/Navbar";
import { BalanceCard } from "@/components/BalanceCard";
import { VaultEntryForm } from "@/components/VaultEntryForm";
import { VaultHistory } from "@/components/VaultHistory";
import { StatsPanel } from "@/components/StatsPanel";
import { Button } from "@/components/ui";

export default function Home() {
  const [publicKey, setPublicKey] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      const connected = await stellar.isConnected();
      if (connected) {
        const address = await stellar.getAddress();
        if (address) {
          setPublicKey(address);
          setIsConnected(true);
        }
      }
    };
    checkConnection();
  }, []);

  const handleConnect = async (key: string) => {
    setPublicKey(key);
    setIsConnected(true);
  };

  const handleDisconnect = () => {
    stellar.disconnect();
    setPublicKey("");
    setIsConnected(false);
  };

  const handleSuccess = async () => {
    // Force-refresh balance to bypass stale cache and get fresh data from Horizon
    // This primes the cache so BalanceCard's next poll gets fresh data
    await stellar.getBalance(publicKey, true);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleConnectWallet = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const key = await stellar.connectWallet();
      handleConnect(key);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      <Navbar
        publicKey={publicKey}
        isConnected={isConnected}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {!isConnected ? (
          <div className="animate-fade-in">
            <div className="bg-surface border border-borderInner rounded-2xl shadow-sm mb-10 px-6 py-20 text-center">
              <h1 className="font-serif text-5xl sm:text-6xl font-medium tracking-tight text-textMain mb-4">
                StellarVault
              </h1>
              <p className="text-textMuted text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-8">
                A personal asset vault powered by Soroban smart contracts on the
                Stellar testnet.
              </p>
              <Button
                variant="primary"
                onClick={handleConnectWallet}
                loading={isLoading}
                className="px-8 py-3 text-base"
              >
                Connect Wallet
              </Button>
              {error && (
                <p className="text-red-400 text-sm mt-3">{error}</p>
              )}
              <p className="text-textMuted text-xs mt-3">
                Supports Freighter, xBull, Albedo, Rabet, Lobstr + more
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up stagger-2 mt-8">
              <div className="claude-card p-6">
                <div className="w-10 h-10 bg-surface border border-borderInner rounded-lg flex items-center justify-center mb-4">
                  <span className="text-xl">🔐</span>
                </div>
                <h3 className="font-serif font-medium text-textMain mb-2">
                  Connect
                </h3>
                <p className="text-textMuted text-sm">
                  Link any Stellar wallet via StellarWalletsKit
                </p>
              </div>

              <div className="claude-card p-6">
                <div className="w-10 h-10 bg-surface border border-borderInner rounded-lg flex items-center justify-center mb-4">
                  <span className="text-xl">📊</span>
                </div>
                <h3 className="font-serif font-medium text-textMain mb-2">
                  Track
                </h3>
                <p className="text-textMuted text-sm">
                  Record deposits and withdrawals on-chain
                </p>
              </div>

              <div className="claude-card p-6">
                <div className="w-10 h-10 bg-surface border border-borderInner rounded-lg flex items-center justify-center mb-4">
                  <span className="text-xl">⚡</span>
                </div>
                <h3 className="font-serif font-medium text-textMain mb-2">
                  Fast
                </h3>
                <p className="text-textMuted text-sm">
                  Soroban contracts confirm in ~5 seconds
                </p>
              </div>

              <div className="claude-card p-6">
                <div className="w-10 h-10 bg-surface border border-borderInner rounded-lg flex items-center justify-center mb-4">
                  <span className="text-xl">🔍</span>
                </div>
                <h3 className="font-serif font-medium text-textMain mb-2">
                  Transparent
                </h3>
                <p className="text-textMuted text-sm">
                  All entries verifiable on Stellar Expert
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            <StatsPanel
              publicKey={publicKey}
              refreshTrigger={refreshTrigger}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-6">
                <BalanceCard publicKey={publicKey} refreshTrigger={refreshTrigger} />
              </div>
              <div className="lg:col-span-2">
                <VaultEntryForm
                  publicKey={publicKey}
                  onSuccess={handleSuccess}
                />
              </div>
            </div>

            <VaultHistory
              key={`history-${refreshTrigger}`}
              publicKey={publicKey}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}
      </main>

      <footer className="border-t border-borderOuter bg-background mt-auto">
        <div className="max-w-[1200px] mx-auto px-6 py-6 text-center text-textMuted text-xs">
          <p className="font-medium mb-1">
            StellarVault · Soroban Testnet · Level 3 Orange Belt
          </p>
          <p className="opacity-70 uppercase tracking-widest">
            Do not use real funds
          </p>
        </div>
      </footer>
    </div>
  );
}