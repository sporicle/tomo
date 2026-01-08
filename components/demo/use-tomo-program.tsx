import { useMemo } from 'react'
import { Connection, PublicKey } from '@solana/web3.js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { TomoProgramService, TomoAccount, TomoAccountWithDelegation } from '@/services/tomo-program'
import { useTransaction } from '@/hooks/use-transaction'
import { useEmbeddedWallet } from '@/hooks/use-embedded-wallet'
import { useEmbeddedTransaction } from '@/hooks/use-embedded-transaction'

export { TomoAccount, TomoAccountWithDelegation }

// MagicBlock Ephemeral Rollup endpoint
const EPHEMERAL_ROLLUP_ENDPOINT = 'https://devnet.magicblock.app/'

export function getTomoPDA(uid: string): PublicKey {
  const service = new TomoProgramService({} as any)
  const [pda] = service.getTomoPDA(uid)
  return pda
}

export function useTomoProgram() {
  const { connection, account } = useMobileWallet()
  const { executeTransaction, isLoading, error } = useTransaction()

  // Create program service instance
  const programService = useMemo(() => {
    return new TomoProgramService(connection)
  }, [connection])

  // Helper to get PublicKey from account
  const getAccountPublicKey = () => {
    if (!account) {
      throw new Error('Wallet not connected')
    }
    return account.publicKey
  }

  return {
    programService,
    connection,
    publicKey: account?.publicKey ?? null,
    executeTransaction,
    getAccountPublicKey,
    isLoading,
    error,
  }
}

export function useTomoAccountQuery({ uid }: { uid: string }) {
  const { programService, connection } = useTomoProgram()

  // Create ER connection and service for fetching delegated account state
  const erConnection = useMemo(() => {
    return new Connection(EPHEMERAL_ROLLUP_ENDPOINT, { commitment: 'confirmed' })
  }, [])

  const erProgramService = useMemo(() => {
    return new TomoProgramService(erConnection)
  }, [erConnection])

  return useQuery({
    queryKey: ['tomo-account', { endpoint: connection.rpcEndpoint, uid }],
    queryFn: async (): Promise<TomoAccountWithDelegation | null> => {
      console.log('useTomoAccountQuery fetching for uid:', uid)
      if (!uid) return null

      // First check base layer to get delegation status
      const baseResult = await programService.fetchTomo(uid)
      if (!baseResult) {
        console.log('Account not found on base layer')
        return null
      }

      // If delegated, fetch fresh state from ephemeral rollup
      if (baseResult.isDelegated) {
        console.log('Account is delegated, fetching from ER...')
        const erResult = await erProgramService.fetchTomo(uid)
        if (erResult) {
          console.log('useTomoAccountQuery ER result:', erResult)
          return { ...erResult, isDelegated: true }
        }
      }

      console.log('useTomoAccountQuery result:', baseResult)
      return baseResult
    },
    enabled: !!uid,
  })
}

export function useTomoAccountInvalidate() {
  const { connection } = useTomoProgram()
  const queryClient = useQueryClient()

  return (uid: string) => {
    return queryClient.invalidateQueries({
      queryKey: ['tomo-account', { endpoint: connection.rpcEndpoint, uid }],
    })
  }
}

export function useInitTomo() {
  const { programService, connection, getAccountPublicKey, executeTransaction } = useTomoProgram()
  const invalidate = useTomoAccountInvalidate()

  return useMutation({
    mutationKey: ['init-tomo', { endpoint: connection.rpcEndpoint }],
    mutationFn: async (uid: string) => {
      const payer = getAccountPublicKey()
      const tx = await programService.buildInitTx({ payer, uid })
      const signature = await executeTransaction(tx)
      return signature
    },
    onSuccess: async (_data, uid) => {
      await invalidate(uid)
    },
  })
}

export function useInitAndDelegate() {
  const { programService, connection, getAccountPublicKey, executeTransaction } = useTomoProgram()
  const invalidate = useTomoAccountInvalidate()

  return useMutation({
    mutationKey: ['init-and-delegate-tomo', { endpoint: connection.rpcEndpoint }],
    mutationFn: async (uid: string) => {
      const payer = getAccountPublicKey()
      const tx = await programService.buildInitAndDelegateTx({ payer, uid })
      const signature = await executeTransaction(tx)
      return signature
    },
    onSuccess: async (_data, uid) => {
      await invalidate(uid)
    },
  })
}

/**
 * Hook to get a coin using the embedded wallet.
 * This is a permissionless operation - no main wallet signature required.
 */
export function useGetCoin() {
  const { programService, connection } = useTomoProgram()
  const { publicKey: embeddedPublicKey, initialize: initializeEmbeddedWallet } = useEmbeddedWallet()
  const { executeTransaction } = useEmbeddedTransaction()
  const invalidate = useTomoAccountInvalidate()

  return useMutation({
    mutationKey: ['get-coin', { endpoint: connection.rpcEndpoint }],
    mutationFn: async (uid: string) => {
      // Initialize embedded wallet if not already done
      let payer = embeddedPublicKey
      if (!payer) {
        const keypair = await initializeEmbeddedWallet()
        payer = keypair.publicKey
      }

      const tx = await programService.buildGetCoinTx({ payer, uid })
      const signature = await executeTransaction(tx)
      return signature
    },
    onSuccess: async (_data, uid) => {
      await invalidate(uid)
    },
  })
}

/**
 * Hook to feed the pet using the embedded wallet.
 * This is a permissionless operation - no main wallet signature required.
 */
export function useFeed() {
  const { programService, connection } = useTomoProgram()
  const { publicKey: embeddedPublicKey, initialize: initializeEmbeddedWallet } = useEmbeddedWallet()
  const { executeTransaction } = useEmbeddedTransaction()
  const invalidate = useTomoAccountInvalidate()

  return useMutation({
    mutationKey: ['feed', { endpoint: connection.rpcEndpoint }],
    mutationFn: async (uid: string) => {
      // Initialize embedded wallet if not already done
      let payer = embeddedPublicKey
      if (!payer) {
        const keypair = await initializeEmbeddedWallet()
        payer = keypair.publicKey
      }

      const tx = await programService.buildFeedTx({ payer, uid })
      const signature = await executeTransaction(tx)
      return signature
    },
    onSuccess: async (_data, uid) => {
      await invalidate(uid)
    },
  })
}

/**
 * Hook to delegate a Tomo account to the MagicBlock ephemeral rollup
 * The delegate transaction is sent to the BASE LAYER (Solana)
 */
export function useDelegate() {
  const { programService, connection, getAccountPublicKey, executeTransaction } = useTomoProgram()
  const invalidate = useTomoAccountInvalidate()

  return useMutation({
    mutationKey: ['delegate-tomo', { endpoint: connection.rpcEndpoint }],
    mutationFn: async (uid: string) => {
      const payer = getAccountPublicKey()
      const tx = await programService.buildDelegateTx({ payer, uid })
      const signature = await executeTransaction(tx)
      return signature
    },
    onSuccess: async (_data, uid) => {
      await invalidate(uid)
    },
  })
}

/**
 * Hook to undelegate a Tomo account from the ephemeral rollup back to base layer
 * NOTE: In a full implementation, this transaction should be sent to the EPHEMERAL ROLLUP
 * For simplicity, we're sending to the base layer which will work for testing
 */
export function useUndelegate() {
  const { programService, connection, getAccountPublicKey, executeTransaction } = useTomoProgram()
  const invalidate = useTomoAccountInvalidate()

  return useMutation({
    mutationKey: ['undelegate-tomo', { endpoint: connection.rpcEndpoint }],
    mutationFn: async (uid: string) => {
      const payer = getAccountPublicKey()
      const tx = await programService.buildUndelegateTx({ payer, uid })
      const signature = await executeTransaction(tx)
      return signature
    },
    onSuccess: async (_data, uid) => {
      await invalidate(uid)
    },
  })
}
