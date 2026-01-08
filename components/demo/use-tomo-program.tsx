import { useMemo } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { TomoProgramService, TomoAccount } from '@/services/tomo-program'
import { useTransaction } from '@/hooks/use-transaction'

export { TomoAccount }

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

  return useQuery({
    queryKey: ['tomo-account', { endpoint: connection.rpcEndpoint, uid }],
    queryFn: async (): Promise<TomoAccount | null> => {
      if (!uid) return null
      return programService.fetchTomo(uid)
    },
    enabled: !!uid,
  })
}

export function useTomoAccountInvalidate({ uid }: { uid: string }) {
  const { connection } = useTomoProgram()
  const queryClient = useQueryClient()

  return () => {
    return queryClient.invalidateQueries({
      queryKey: ['tomo-account', { endpoint: connection.rpcEndpoint, uid }],
    })
  }
}

export function useInitTomo({ uid }: { uid: string }) {
  const { programService, connection, getAccountPublicKey, executeTransaction } = useTomoProgram()
  const invalidate = useTomoAccountInvalidate({ uid })

  return useMutation({
    mutationKey: ['init-tomo', { endpoint: connection.rpcEndpoint, uid }],
    mutationFn: async () => {
      const payer = getAccountPublicKey()
      const tx = await programService.buildInitTx({ payer, uid })
      const signature = await executeTransaction(tx)
      return signature
    },
    onSuccess: async () => {
      await invalidate()
    },
  })
}

export function useGetCoin({ uid }: { uid: string }) {
  const { programService, connection, getAccountPublicKey, executeTransaction } = useTomoProgram()
  const invalidate = useTomoAccountInvalidate({ uid })

  return useMutation({
    mutationKey: ['get-coin', { endpoint: connection.rpcEndpoint, uid }],
    mutationFn: async () => {
      const payer = getAccountPublicKey()
      const tx = await programService.buildGetCoinTx({ payer, uid })
      const signature = await executeTransaction(tx)
      return signature
    },
    onSuccess: async () => {
      await invalidate()
    },
  })
}

export function useFeed({ uid }: { uid: string }) {
  const { programService, connection, getAccountPublicKey, executeTransaction } = useTomoProgram()
  const invalidate = useTomoAccountInvalidate({ uid })

  return useMutation({
    mutationKey: ['feed', { endpoint: connection.rpcEndpoint, uid }],
    mutationFn: async () => {
      const payer = getAccountPublicKey()
      const tx = await programService.buildFeedTx({ payer, uid })
      const signature = await executeTransaction(tx)
      return signature
    },
    onSuccess: async () => {
      await invalidate()
    },
  })
}
