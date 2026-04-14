import { describe, it, expect, vi } from 'vitest'

describe('StellarVault', () => {
  it('test suite works', () => {
    expect(true).toBe(true)
  })
  
  it('can create contract client', async () => {
    const { createContractClient } = await import('@/lib/contract-client')
    const client = createContractClient()
    const hash = await client.recordEntry({
      ownerKey: 'GAAAAAAA',
      action: 'deposit',
      amount: '100',
      memo: 'test'
    })
    expect(hash).toBe('mockhash123')
  })
  
  it('can get entries', async () => {
    const { createContractClient } = await import('@/lib/contract-client')
    const client = createContractClient()
    const entries = await client.getEntries()
    expect(entries).toEqual([])
  })
  
  it('has stellar helper defined', async () => {
    const { stellar } = await import('@/lib/stellar-helper')
    expect(stellar.formatAddress('GABCDEFGHIJKLMNOP')).toBe('GABC...MNOP')
  })
})