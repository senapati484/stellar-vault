"use client";

import React from "react";
import { TxProgress } from "@/lib/contract-client";
import {
  FaCheck,
  FaExclamationTriangle,
  FaClock,
  FaTimes,
} from "react-icons/fa";
import { IoCopyOutline } from "react-icons/io5";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: "primary" | "white" | "muted";
}

export function LoadingSpinner({
  size = "md",
  color = "primary",
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-10 w-10 border-[3px]",
  };

  const colorClasses = {
    primary: "border-textMain border-r-transparent",
    white: "border-white border-r-transparent",
    muted: "border-borderOuter border-r-transparent",
  };

  return (
    <div
      className={`rounded-full animate-spin ${sizeClasses[size]} ${colorClasses[color]}`}
    />
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  animated?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  animated = false,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="w-full">
      <div className="relative h-2 bg-borderInner rounded-full w-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 bg-primary"
          style={{ width: `${percentage}%` }}
        />
        {animated && value === 0 && (
          <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-progress" />
        )}
      </div>
      {label && <p className="text-textMuted text-xs mt-1">{label}</p>}
    </div>
  );
}

interface TxProgressStepperProps {
  progress: TxProgress;
}

export function TxProgressStepper({ progress }: TxProgressStepperProps) {
  const steps = ["Building", "Signing", "Submitting", "Confirming"];

  const getStepIndex = () => {
    switch (progress.stage) {
      case "building":
        return 0;
      case "signing":
        return 1;
      case "submitting":
        return 2;
      case "confirming":
        return 3;
      case "success":
        return 4;
      case "error":
        return 3;
      default:
        return -1;
    }
  };

  const stepIndex = getStepIndex();

  const renderStepCircle = (index: number) => {
    const isCompleted = index < stepIndex;
    const isActive = index === stepIndex;
    const isError = progress.stage === "error" && index === stepIndex;

    if (isCompleted) {
      return (
        <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
          <FaCheck className="text-white text-xs" />
        </div>
      );
    }
    if (isActive) {
      return (
        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
          <LoadingSpinner size="sm" color="white" />
        </div>
      );
    }
    if (isError) {
      return (
        <div className="w-6 h-6 rounded-full bg-error flex items-center justify-center">
          <FaExclamationTriangle className="text-white text-xs" />
        </div>
      );
    }
    return (
      <div className="w-6 h-6 rounded-full border-2 border-borderOuter" />
    );
  };

  if (progress.stage === "idle") {
    return null;
  }

  return (
    <div className="animate-slide-up">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step} className="flex flex-col items-center">
            {renderStepCircle(index)}
            <span
              className={`text-xs mt-1 ${
                index <= stepIndex ? "text-textMain" : "text-textMuted"
              }`}
            >
              {step}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 text-center">
        {"message" in progress && (
          <p className="text-textMuted text-sm">{progress.message}</p>
        )}
      </div>

      {progress.stage === "success" && "hash" in progress && (
        <div className="mt-4 p-3 bg-[#F2F8F4] border border-[#E2F0E7] rounded-lg animate-slide-up">
          <p className="text-success font-medium text-sm">
            Transaction confirmed!
          </p>
          <div className="flex items-center gap-2 mt-2">
            <code className="text-xs text-textMuted font-mono">
              {progress.hash.slice(0, 12)}...
              {progress.hash.slice(-12)}
            </code>
            <button
              className="p-1 hover:bg-[#E2F0E7] rounded transition-colors"
              onClick={() => navigator.clipboard.writeText(progress.hash)}
            >
              <IoCopyOutline className="text-textMuted text-sm" />
            </button>
          </div>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${progress.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary text-xs hover:underline mt-2 inline-block"
          >
            View on Explorer
          </a>
        </div>
      )}

      {progress.stage === "error" && (
        <div className="mt-4 p-3 bg-[#FCF2F2] border border-[#F8E3E3] rounded-lg animate-slide-up">
          <p className="text-error font-medium text-sm">{progress.message}</p>
          {"errorType" in progress && (
            <p className="text-textMuted text-xs mt-1">
              Error type: {progress.errorType}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface CachedBadgeProps {
  cached: boolean;
  lastFetched?: Date;
}

export function CachedBadge({ cached, lastFetched }: CachedBadgeProps) {
  if (cached) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F4F2EC] border border-borderInner rounded text-textMuted text-[10px] font-mono">
        <FaClock className="text-[10px]" />
        Cached
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F2F8F4] border border-[#E2F0E7] rounded text-[#2F593F] text-[10px]">
      <span className="w-1.5 h-1.5 rounded-full bg-success" />
      Live
    </span>
  );
}

interface SkeletonLoaderProps {
  count?: number;
  height?: string;
  width?: string;
  className?: string;
}

export function SkeletonLoader({
  count = 1,
  height = "h-4",
  width = "w-full",
  className = "",
}: SkeletonLoaderProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse bg-borderInner rounded-md ${height} ${width} ${className}`}
        />
      ))}
    </>
  );
}

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-borderOuter rounded-xl">
      <p className="text-textMuted text-sm">{description}</p>
      <p className="text-textMain font-medium mt-1">{title}</p>
    </div>
  );
}

interface AlertProps {
  type: "success" | "error" | "warning" | "info";
  message: string;
  hint?: string;
  onClose: () => void;
}

export function Alert({ type, message, hint, onClose }: AlertProps) {
  const styles = {
    success: "bg-[#F2F8F4] border-[#E2F0E7] text-[#2F593F]",
    error: "bg-[#FCF2F2] border-[#F8E3E3] text-[#8C2F2B]",
    warning: "bg-[#FEF3C7] border-[#FDE68A] text-[#7C4A00]",
    info: "bg-[#F4F2EC] border-[#E9E7E0] text-textMuted",
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 border rounded-lg animate-slide-up ${styles[type]}`}
    >
      <p className="flex-1 text-sm">{message}</p>
      {hint && <p className="text-xs opacity-80">{hint}</p>}
      <button
        onClick={onClose}
        className="p-1 hover:bg-black/5 rounded transition-colors"
      >
        <FaTimes className="text-xs" />
      </button>
    </div>
  );
}

interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  type?: string;
  disabled?: boolean;
  hint?: React.ReactNode;
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  error,
  type = "text",
  disabled = false,
  hint,
}: InputProps) {
  return (
    <div className="w-full">
      <label className="block text-textMain text-sm font-medium mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`claude-input ${error ? "!border-error !focus:border-error" : ""}`}
      />
      {(hint || error) && (
        <p
          className={`text-xs mt-1 ${error ? "text-error" : "text-textMuted"}`}
        >
          {error ? error : hint}
        </p>
      )}
    </div>
  );
}

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";
  loading?: boolean;
  className?: string;
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  fullWidth = false,
  type = "button",
  loading = false,
  className = "",
}: ButtonProps) {
  const baseClasses = "claude-button";
  const variantClasses = {
    primary: "claude-button-primary",
    secondary: "claude-button-secondary",
  };
  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${widthClass} px-4 py-2 ${className}`}
    >
      {loading && (
        <span className="mr-2">
          <LoadingSpinner
            size="sm"
            color={variant === "primary" ? "white" : "muted"}
          />
        </span>
      )}
      {children}
    </button>
  );
}

interface CardProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function Card({
  title,
  subtitle,
  icon,
  children,
  className = "",
  action,
}: CardProps) {
  return (
    <div className={`claude-card p-6 ${className}`}>
      {(title || icon || action) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-10 h-10 bg-surface border border-borderInner rounded-lg flex items-center justify-center shadow-sm">
                {icon}
              </div>
            )}
            <div>
              {title && (
                <h3 className="text-textMain font-medium">{title}</h3>
              )}
              {subtitle && (
                <p className="text-textMuted text-sm">{subtitle}</p>
              )}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}