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
 * The undelegate transaction MUST be sent to the Ephemeral Rollup, not the base layer
 * Uses the embedded wallet as payer to avoid MWA chain validation issues with ER blockhashes
 */
export function useUndelegate() {
  const { connection } = useTomoProgram()
  const { keypair } = useEmbeddedWallet()
  const { executeTransaction, erConnection } = useEmbeddedTransaction()
  const invalidate = useTomoAccountInvalidate()

  // Create program service with ER connection for building the transaction
  const erProgramService = useMemo(() => {
    return new TomoProgramService(erConnection)
  }, [erConnection])

  return useMutation({
    mutationKey: ['undelegate-tomo', { endpoint: connection.rpcEndpoint }],
    mutationFn: async (uid: string) => {
      if (!keypair) {
        throw new Error('Embedded wallet not initialized')
      }
      // Use embedded wallet as payer - avoids MWA chain validation issues
      const payer = keypair.publicKey
      // Build transaction using ER service
      const tx = await erProgramService.buildUndelegateTx({ payer, uid })
      // Send to Ephemeral Rollup with embedded wallet signature
      const signature = await executeTransaction(tx)
      return signature
    },
    onSuccess: async (_data, uid) => {
      await invalidate(uid)
    },
  })
}

/**
 * Hook to delete a Tomo account, returning rent to the owner
 * Only the account owner can delete the account
 */
export function useDeleteTomo() {
  const { programService, connection, getAccountPublicKey, executeTransaction } = useTomoProgram()
  const invalidate = useTomoAccountInvalidate()

  return useMutation({
    mutationKey: ['delete-tomo', { endpoint: connection.rpcEndpoint }],
    mutationFn: async (uid: string) => {
      const owner = getAccountPublicKey()
      const tx = await programService.buildDeleteTx({ owner, uid })
      const signature = await executeTransaction(tx)
      return signature
    },
    onSuccess: async (_data, uid) => {
      await invalidate(uid)
    },
  })
}

/**
 * Hook to trigger an item drop using the embedded wallet.
 * Sets item_drop to true if it's false.
 */
export function useTriggerItemDrop() {
  const { programService, connection } = useTomoProgram()
  const { publicKey: embeddedPublicKey, initialize: initializeEmbeddedWallet } = useEmbeddedWallet()
  const { executeTransaction } = useEmbeddedTransaction()
  const invalidate = useTomoAccountInvalidate()

  return useMutation({
    mutationKey: ['trigger-item-drop', { endpoint: connection.rpcEndpoint }],
    mutationFn: async (uid: string) => {
      let payer = embeddedPublicKey
      if (!payer) {
        const keypair = await initializeEmbeddedWallet()
        payer = keypair.publicKey
      }

      const tx = await programService.buildTriggerItemDropTx({ payer, uid })
      const signature = await executeTransaction(tx)
      return signature
    },
    onSuccess: async (_data, uid) => {
      await invalidate(uid)
    },
  })
}

/**
 * Hook to open an item drop using the embedded wallet.
 * Uses VRF to add a random item (1-5) to inventory.
 * NOTE: This uses the ephemeral rollup connection for VRF.
 */
export function useOpenItemDrop() {
  const { connection } = useTomoProgram()
  const { publicKey: embeddedPublicKey, initialize: initializeEmbeddedWallet } = useEmbeddedWallet()
  const { executeTransaction, erConnection } = useEmbeddedTransaction()
  const invalidate = useTomoAccountInvalidate()

  // Create program service with ER connection for VRF
  const erProgramService = useMemo(() => {
    return new TomoProgramService(erConnection)
  }, [erConnection])

  return useMutation({
    mutationKey: ['open-item-drop', { endpoint: connection.rpcEndpoint }],
    mutationFn: async (uid: string) => {
      let payer = embeddedPublicKey
      if (!payer) {
        const keypair = await initializeEmbeddedWallet()
        payer = keypair.publicKey
      }

      // VRF requests must go to the ephemeral rollup
      const tx = await erProgramService.buildOpenItemDropTx({ payer, uid })
      const signature = await executeTransaction(tx)
      return signature
    },
    onSuccess: async (_data, uid) => {
      await invalidate(uid)
    },
  })
}

/**
 * Hook to use an item from inventory using the embedded wallet.
 * Removes the item at the specified index.
 */
export function useUseItem() {
  const { programService, connection } = useTomoProgram()
  const { publicKey: embeddedPublicKey, initialize: initializeEmbeddedWallet } = useEmbeddedWallet()
  const { executeTransaction } = useEmbeddedTransaction()
  const invalidate = useTomoAccountInvalidate()

  return useMutation({
    mutationKey: ['use-item', { endpoint: connection.rpcEndpoint }],
    mutationFn: async ({ uid, index }: { uid: string; index: number }) => {
      let payer = embeddedPublicKey
      if (!payer) {
        const keypair = await initializeEmbeddedWallet()
        payer = keypair.publicKey
      }

      const tx = await programService.buildUseItemTx({ payer, uid, index })
      const signature = await executeTransaction(tx)
      return signature
    },
    onSuccess: async (_data, { uid }) => {
      await invalidate(uid)
    },
  })
}
