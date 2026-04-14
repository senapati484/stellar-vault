import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock next/font
vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: '--font-sans', className: '' }),
  Fraunces: () => ({ variable: '--font-serif', className: '' }),
  JetBrains_Mono: () => ({ variable: '--font-mono', className: '' }),
}))

// Mock stellar-helper
vi.mock('@/lib/stellar-helper', () => ({
  stellar: {
    connectWallet: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockResolvedValue(false),
    getAddress: vi.fn().mockResolvedValue(null),
    getBalance: vi.fn().mockResolvedValue({ xlm: '100', assets: [], cached: false }),
    getRecentTransactions: vi.fn().mockResolvedValue({ transactions: [], cached: false }),
    getExplorerLink: vi.fn((hash: string, type: string) => `https://stellar.expert/explorer/testnet/${type}/${hash}`),
    formatAddress: vi.fn((addr: string) => addr.slice(0,4) + '...' + addr.slice(-4)),
    cache: {
      balance: { invalidate: vi.fn(), get: vi.fn(), set: vi.fn() },
      transactions: { invalidate: vi.fn(), get: vi.fn(), set: vi.fn() }
    },
    getKit: vi.fn().mockReturnValue({
      signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: 'mock-signed-tx' })
    })
  },
  WalletNotFoundError: class WalletNotFoundError extends Error { name='WalletNotFoundError' },
  WalletRejectedError: class WalletRejectedError extends Error { name='WalletRejectedError' },
  InsufficientBalanceError: class InsufficientBalanceError extends Error { name='InsufficientBalanceError' },
  NetworkError: class NetworkError extends Error { name='NetworkError' },
}))

// Mock contract-client
vi.mock('@/lib/contract-client', () => ({
  createContractClient: vi.fn(() => ({
    recordEntry: vi.fn().mockResolvedValue('mockhash123'),
    getEntries: vi.fn().mockResolvedValue([]),
    getEntriesByOwner: vi.fn().mockResolvedValue([]),
    getEntryCount: vi.fn().mockResolvedValue(0),
  })),
  TxProgress: {
    stage: 'idle'
  }
}))