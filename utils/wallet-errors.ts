/**
 * Utility functions for handling wallet-related errors gracefully.
 */

/**
 * Check if an error is a user cancellation (e.g., pressing back in wallet app).
 */
export function isUserCancellation(error: unknown): boolean {
  if (!error) return false

  const message = getErrorMessage(error)
  const errorName = (error as Error)?.name || ''

  // Solana Mobile Wallet Adapter cancellation patterns
  if (
    message.includes('CancellationException') ||
    message.includes('User rejected') ||
    message.includes('User declined') ||
    message.includes('cancelled') ||
    errorName === 'SolanaMobileWalletAdapterError'
  ) {
    return true
  }

  return false
}

/**
 * Check if an error is a wallet not connected error.
 */
export function isWalletNotConnected(error: unknown): boolean {
  const message = getErrorMessage(error)
  return (
    message.includes('Wallet not connected') ||
    message.includes('not connected') ||
    message.includes('No wallet')
  )
}

/**
 * Get a user-friendly error message from a wallet error.
 * Returns null if the error should be silently ignored (e.g., cancellation).
 */
export function getWalletErrorMessage(error: unknown): string | null {
  if (isUserCancellation(error)) {
    // User cancelled - no need to show an error
    return null
  }

  if (isWalletNotConnected(error)) {
    return 'Please connect your wallet first'
  }

  const message = getErrorMessage(error)

  // Clean up common Solana/Anchor error messages
  if (message.includes('insufficient funds') || message.includes('Insufficient')) {
    return 'Insufficient funds for transaction'
  }

  if (message.includes('blockhash not found') || message.includes('Blockhash not found')) {
    return 'Transaction expired. Please try again'
  }

  if (message.includes('Transaction simulation failed')) {
    // Try to extract the actual error from simulation failure
    const match = message.match(/Error Message: (.+?)(?:\.|$)/)
    if (match) {
      return match[1]
    }
    return 'Transaction failed. Please try again'
  }

  // Return a cleaned version of the original message
  return message.length > 100 ? message.substring(0, 100) + '...' : message
}

/**
 * Extract error message from various error types.
 */
function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.error === 'string') return obj.error
  }
  return String(error)
}
