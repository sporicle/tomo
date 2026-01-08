import { createContext, PropsWithChildren, useCallback, useEffect, useState } from 'react'
import { Keypair, PublicKey } from '@solana/web3.js'
import { EmbeddedWalletService } from '@/services/embedded-wallet'

export interface EmbeddedWalletContextState {
  keypair: Keypair | null
  publicKey: PublicKey | null
  isLoading: boolean
  error: Error | null
  hasWallet: boolean
  initialize: () => Promise<Keypair>
  clear: () => Promise<void>
}

export const EmbeddedWalletContext = createContext<EmbeddedWalletContextState | null>(null)

/**
 * Provider for managing the embedded wallet lifecycle.
 * Auto-initializes the wallet on mount if one exists in storage.
 */
export function EmbeddedWalletProvider({ children }: PropsWithChildren) {
  const [keypair, setKeypair] = useState<Keypair | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Load existing wallet on mount
  useEffect(() => {
    const loadWallet = async () => {
      try {
        const existing = await EmbeddedWalletService.get()
        if (existing) {
          setKeypair(existing)
        }
      } catch (err) {
        console.error('Failed to load embedded wallet:', err)
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }
    loadWallet()
  }, [])

  // Initialize (create if needed) the wallet
  const initialize = useCallback(async (): Promise<Keypair> => {
    setIsLoading(true)
    setError(null)
    try {
      const kp = await EmbeddedWalletService.getOrCreate()
      setKeypair(kp)
      return kp
    } catch (err) {
      const error = err as Error
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Clear the wallet
  const clear = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      await EmbeddedWalletService.clear()
      setKeypair(null)
    } catch (err) {
      const error = err as Error
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  const value: EmbeddedWalletContextState = {
    keypair,
    publicKey: keypair?.publicKey ?? null,
    isLoading,
    error,
    hasWallet: keypair !== null,
    initialize,
    clear,
  }

  return <EmbeddedWalletContext.Provider value={value}>{children}</EmbeddedWalletContext.Provider>
}
