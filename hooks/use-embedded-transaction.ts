import { useState, useCallback, useMemo } from 'react'
import { Connection, Transaction } from '@solana/web3.js'
import { useEmbeddedWallet } from './use-embedded-wallet'

// MagicBlock Ephemeral Rollup endpoint for devnet
const EPHEMERAL_ROLLUP_ENDPOINT = 'https://devnet.magicblock.app/'

export interface TransactionCallbacks {
  onSent?: (signature: string) => void
  onConfirmed?: (signature: string) => void
  onError?: (error: Error, signature?: string) => void
}

/**
 * Hook for executing transactions signed with the embedded wallet.
 * Uses the MagicBlock Ephemeral Rollup for gasless transactions.
 */
export function useEmbeddedTransaction() {
  const { keypair } = useEmbeddedWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Create dedicated connection to ephemeral rollup
  const erConnection = useMemo(() => {
    return new Connection(EPHEMERAL_ROLLUP_ENDPOINT, {
      commitment: 'confirmed',
      wsEndpoint: 'wss://devnet.magicblock.app/',
    })
  }, [])

  const executeTransaction = useCallback(
    async (transaction: Transaction, callbacks?: TransactionCallbacks): Promise<string> => {
      setIsLoading(true)
      setError(null)

      let signature: string | undefined

      try {
        if (!keypair) {
          throw new Error('Embedded wallet not initialized')
        }

        // Get latest blockhash from ephemeral rollup
        const { value: latestBlockhash } = await erConnection.getLatestBlockhashAndContext()

        // Set transaction properties
        transaction.recentBlockhash = latestBlockhash.blockhash
        transaction.feePayer = keypair.publicKey

        // Sign with embedded wallet keypair
        transaction.sign(keypair)

        // Send raw transaction to ephemeral rollup - skip preflight since it's gasless
        signature = await erConnection.sendRawTransaction(transaction.serialize(), {
          skipPreflight: true,
        })

        // Notify that transaction was sent
        callbacks?.onSent?.(signature)

        // Confirm transaction on ephemeral rollup
        await erConnection.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed')

        // Notify that transaction was confirmed
        callbacks?.onConfirmed?.(signature)

        setIsLoading(false)
        return signature
      } catch (err) {
        const error = err as Error
        setError(error)
        setIsLoading(false)
        callbacks?.onError?.(error, signature)
        throw error
      }
    },
    [erConnection, keypair]
  )

  return {
    executeTransaction,
    erConnection,
    isLoading,
    error,
  }
}
