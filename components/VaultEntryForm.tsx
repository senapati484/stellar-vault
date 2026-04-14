"use client";

import { useState } from "react";
import { FaPaperPlane, FaArrowDown, FaArrowUp } from "react-icons/fa";
import { createContractClient } from "@/lib/contract-client";
import type { TxProgress } from "@/lib/contract-client";
import {
  WalletRejectedError,
  InsufficientBalanceError,
  NetworkError,
} from "@/lib/stellar-helper";
import { TxProgressStepper, Alert, Input, Button } from "@/components/ui";

interface VaultEntryFormProps {
  publicKey: string;
  onSuccess: () => void;
}

export function VaultEntryForm({ publicKey, onSuccess }: VaultEntryFormProps) {
  const [action, setAction] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; memo?: string }>({});
  const [progress, setProgress] = useState<TxProgress>({ stage: "idle" });
  const [submitError, setSubmitError] = useState<{
    type: "error" | "warning";
    message: string;
    hint?: string;
  } | null>(null);

  const client = createContractClient((p) => setProgress(p));

  const validate = () => {
    const newErrors: { amount?: string; memo?: string } = {};

    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    } else if (isNaN(parseFloat(amount))) {
      newErrors.amount = "Please enter a valid number";
    }

    if (memo.length > 15) {
      newErrors.memo = "Memo must be 15 characters or less";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    try {
      await client.recordEntry({
        ownerKey: publicKey,
        action,
        amount,
        memo,
      });

      // Add delay to allow Horizon to index the transaction before fetching balance
      await new Promise((resolve) => setTimeout(resolve, 1500));

      onSuccess();

      setTimeout(() => {
        setAction("deposit");
        setAmount("");
        setMemo("");
        setProgress({ stage: "idle" });
        setSubmitError(null);
      }, 2000);
    } catch (err) {
      if (err instanceof WalletRejectedError) {
        setSubmitError({
          type: "error",
          message: "You cancelled the signing. Try again.",
        });
      } else if (err instanceof InsufficientBalanceError) {
        setSubmitError({
          type: "warning",
          message: "Insufficient balance for fees. You need 1.5+ XLM.",
          hint: "Get free testnet XLM at friendbot.stellar.org",
        });
      } else if (err instanceof NetworkError) {
        setSubmitError({
          type: "error",
          message: "Network error. Check your connection and retry.",
        });
      } else {
        setSubmitError({
          type: "error",
          message: err instanceof Error ? err.message : "An error occurred",
        });
      }
    }
  };

  const isSubmitting =
    progress.stage !== "idle" &&
    progress.stage !== "success" &&
    progress.stage !== "error";

  return (
    <div className="claude-card p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-surface border border-borderInner rounded-lg flex items-center justify-center">
          <FaPaperPlane className="text-textMuted" />
        </div>
        <h2 className="font-serif text-2xl text-textMain">New Vault Entry</h2>
      </div>

      {submitError && (
        <div className="mb-4">
          <Alert
            type={submitError.type}
            message={submitError.message}
            hint={submitError.hint}
            onClose={() => setSubmitError(null)}
          />
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setAction("deposit")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
              action === "deposit"
                ? "bg-primary text-white shadow-sm"
                : "bg-surface border border-borderInner text-textMuted hover:bg-[#F0EEEB]"
            } ${
              action === "deposit"
                ? "border-[#E2F0E7] bg-[#F2F8F4]"
                : ""
            }`}
          >
            <FaArrowDown className="text-sm" />
            <span className="text-sm font-medium">Deposit</span>
          </button>
          <button
            type="button"
            onClick={() => setAction("withdraw")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
              action === "withdraw"
                ? "bg-primary text-white shadow-sm"
                : "bg-surface border border-borderInner text-textMuted hover:bg-[#F0EEEB]"
            } ${
              action === "withdraw"
                ? "border-[#F8E3E3] bg-[#FCF2F2]"
                : ""
            }`}
          >
            <FaArrowUp className="text-sm" />
            <span className="text-sm font-medium">Withdraw</span>
          </button>
        </div>

        <div className="mb-4">
          <Input
            label="Amount (XLM)"
            value={amount}
            onChange={(v) => {
              setAmount(v);
              setErrors((e) => ({ ...e, amount: undefined }));
            }}
            placeholder="0.00"
            error={errors.amount}
            type="number"
          />
        </div>

        <div className="mb-6">
          <Input
            label="Memo (Optional)"
            value={memo}
            onChange={(v) => {
              setMemo(v);
              setErrors((e) => ({ ...e, memo: undefined }));
            }}
            placeholder="e.g. Salary, Coffee, Rent"
            error={errors.memo}
            hint={
              <span className="text-textMuted text-xs text-right block">
                {memo.length}/15
              </span>
            }
          />
        </div>

        {progress.stage !== "idle" ? (
          <TxProgressStepper progress={progress} />
        ) : (
          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={isSubmitting}
          >
            {action === "deposit" ? "Record Deposit" : "Record Withdrawal"}
          </Button>
        )}
      </form>

      <div className="mt-4 bg-[#F4F2EC] border border-[#E9E7E0] rounded-lg p-3">
        <p className="text-xs text-textMuted">
          This records your vault action on the Soroban contract. Review
          carefully.
        </p>
      </div>
    </div>
  );
}