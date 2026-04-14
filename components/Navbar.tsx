"use client";

import { useState } from "react";
import { stellar, WalletNotFoundError, WalletRejectedError } from "@/lib/stellar-helper";
import { Alert, LoadingSpinner, Button } from "@/components/ui";

interface NavbarProps {
  publicKey: string;
  isConnected: boolean;
  onConnect: (key: string) => void;
  onDisconnect: () => void;
}

export function Navbar({
  publicKey,
  isConnected,
  onConnect,
  onDisconnect,
}: NavbarProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{
    type: "warning" | "info";
    message: string;
    hint?: string;
  } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const formatAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const key = await stellar.connectWallet();
      onConnect(key);
    } catch (err) {
      if (err instanceof WalletNotFoundError) {
        setError({
          type: "warning",
          message: "No Stellar wallet found. Install Freighter.",
          hint: "https://freighter.app",
        });
      } else if (err instanceof WalletRejectedError) {
        setError({
          type: "info",
          message: "Connection cancelled.",
        });
      } else {
        setError({
          type: "warning",
          message: "Failed to connect wallet.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    stellar.disconnect();
    onDisconnect();
  };

  return (
    <>
      <nav className="sticky top-0 z-50 h-[60px] bg-background/80 backdrop-blur-md border-b border-borderOuter">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-textMain flex items-center justify-center">
              <span className="text-white font-bold text-xs">Sv</span>
            </div>
            <div className="flex flex-col">
              <span className="font-serif font-medium text-textMain">
                StellarVault
              </span>
              <span className="text-[10px] uppercase font-mono text-textMuted">
                Testnet
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {error && (
              <Alert
                type={error.type}
                message={error.message}
                hint={error.hint}
                onClose={() => setError(null)}
              />
            )}

            {isConnected ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-surface border border-borderInner rounded-md px-3 py-1">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-xs font-medium text-textMain">
                    Connected
                  </span>
                </div>
                <span className="text-xs font-mono text-textMuted">
                  {formatAddress(publicKey)}
                </span>
                <Button
                  variant="secondary"
                  onClick={handleDisconnect}
                  className="text-xs"
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                onClick={handleConnect}
                loading={isLoading}
                className="px-4 py-1.5 text-xs h-8"
              >
                {isLoading ? "Connecting..." : "Connect Wallet"}
              </Button>
            )}
          </div>

          <button
            className="md:hidden p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <div className="w-6 h-5 flex flex-wrap gap-1">
              <span className="w-full h-0.5 bg-textMain rounded" />
              <span className="w-full h-0.5 bg-textMain rounded" />
              <span className="w-full h-0.5 bg-textMain rounded" />
            </div>
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-[60px] left-0 right-0 bg-background border-b border-borderOuter p-4 animate-slide-up">
            {error && (
              <div className="mb-4">
                <Alert
                  type={error.type}
                  message={error.message}
                  hint={error.hint}
                  onClose={() => setError(null)}
                />
              </div>
            )}

            {isConnected ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 bg-surface border border-borderInner rounded-md px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-xs font-medium text-textMain">
                    Connected
                  </span>
                </div>
                <span className="text-xs font-mono text-textMuted">
                  {formatAddress(publicKey)}
                </span>
                <Button variant="secondary" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                onClick={handleConnect}
                loading={isLoading}
                fullWidth
              >
                {isLoading ? "Connecting..." : "Connect Wallet"}
              </Button>
            )}
          </div>
        )}
      </nav>
    </>
  );
}