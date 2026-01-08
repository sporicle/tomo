import { useState, useCallback, useMemo } from 'react'
import { Connection, Transaction } from '@solana/web3.js'
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'

// MagicBlock Ephemeral Rollup endpoint for devnet
const EPHEMERAL_ROLLUP_ENDPOINT = 'https://devnet.magicblock.app/'

/**
 * Hook for executing transactions on the Ephemeral Rollup with main wallet signature.
 * Use this for operations like undelegate that require:
 * 1. Main wallet signature (not embedded wallet)
 * 2. Sending to the Ephemeral Rollup (not base layer)
 */
export function useERTransaction() {
  const { account, identity, chain } = useMobileWallet()
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
    async (transaction: Transaction): Promise<string> => {
      setIsLoading(true)
      setError(null)

      try {
        if (!account) {
          throw new Error('Wallet not connected')
        }

        // Get latest blockhash from ephemeral rollup
        const { value: latestBlockhash } = await erConnection.getLatestBlockhashAndContext()

        // Set transaction properties
        transaction.recentBlockhash = latestBlockhash.blockhash
        transaction.feePayer = account.publicKey

        // Sign using MWA transact with web3js types
        const signedTransactions = await transact(async (wallet) => {
          // Reauthorize with the wallet using the same chain as the current connection
          await wallet.authorize({
            chain,
            identity,
          })
          // Sign the transaction (returns Transaction objects)
          return await wallet.signTransactions({
            transactions: [transaction],
          })
        })

        if (!signedTransactions || signedTransactions.length === 0) {
          throw new Error('Failed to sign transaction')
        }

        const signedTransaction = signedTransactions[0]

        // Send to ephemeral rollup
        const signature = await erConnection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: true,
        })

        // Confirm transaction on ephemeral rollup
        await erConnection.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed')

        setIsLoading(false)
        return signature
      } catch (err) {
        const error = err as Error
        setError(error)
        setIsLoading(false)
        throw error
      }
    },
    [erConnection, account, identity, chain]
  )

  return {
    executeTransaction,
    erConnection,
    isLoading,
    error,
  }
}
