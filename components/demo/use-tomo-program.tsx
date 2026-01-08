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
      console.log('useTomoAccountQuery fetching for uid:', uid)
      if (!uid) return null
      const result = await programService.fetchTomo(uid)
      console.log('useTomoAccountQuery result:', result)
      return result
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

export function useGetCoin() {
  const { programService, connection, getAccountPublicKey, executeTransaction } = useTomoProgram()
  const invalidate = useTomoAccountInvalidate()

  return useMutation({
    mutationKey: ['get-coin', { endpoint: connection.rpcEndpoint }],
    mutationFn: async (uid: string) => {
      const payer = getAccountPublicKey()
      const tx = await programService.buildGetCoinTx({ payer, uid })
      const signature = await executeTransaction(tx)
      return signature
    },
    onSuccess: async (_data, uid) => {
      await invalidate(uid)
    },
  })
}

export function useFeed() {
  const { programService, connection, getAccountPublicKey, executeTransaction } = useTomoProgram()
  const invalidate = useTomoAccountInvalidate()

  return useMutation({
    mutationKey: ['feed', { endpoint: connection.rpcEndpoint }],
    mutationFn: async (uid: string) => {
      const payer = getAccountPublicKey()
      const tx = await programService.buildFeedTx({ payer, uid })
      const signature = await executeTransaction(tx)
      return signature
    },
    onSuccess: async (_data, uid) => {
      await invalidate(uid)
    },
  })
}
