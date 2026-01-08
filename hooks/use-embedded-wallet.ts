import { useContext } from 'react'
import { EmbeddedWalletContext } from '@/components/embedded-wallet/embedded-wallet-provider'

/**
 * Hook to access the embedded wallet context.
 * Must be used within an EmbeddedWalletProvider.
 */
export function useEmbeddedWallet() {
  const context = useContext(EmbeddedWalletContext)
  if (!context) {
    throw new Error('useEmbeddedWallet must be used within an EmbeddedWalletProvider')
  }
  return context
}
