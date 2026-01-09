import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { View, StyleSheet } from 'react-native'
import { TransactionToast, TransactionStatus } from './transaction-toast'

interface Toast {
  id: string
  signature: string
  status: TransactionStatus
}

interface TransactionToastContextValue {
  addToast: (signature: string) => string
  updateToast: (id: string, status: TransactionStatus) => void
  confirmToast: (id: string) => void
  failToast: (id: string) => void
}

const TransactionToastContext = createContext<TransactionToastContextValue | null>(null)

export function useTransactionToast() {
  const context = useContext(TransactionToastContext)
  if (!context) {
    throw new Error('useTransactionToast must be used within TransactionToastProvider')
  }
  return context
}

interface TransactionToastProviderProps {
  children: ReactNode
}

export function TransactionToastProvider({ children }: TransactionToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((signature: string): string => {
    const id = `${signature}-${Date.now()}`
    setToasts((prev) => [...prev, { id, signature, status: 'pending' }])
    return id
  }, [])

  const updateToast = useCallback((id: string, status: TransactionStatus) => {
    setToasts((prev) =>
      prev.map((toast) => (toast.id === id ? { ...toast, status } : toast))
    )
  }, [])

  const confirmToast = useCallback((id: string) => {
    updateToast(id, 'confirmed')
  }, [updateToast])

  const failToast = useCallback((id: string) => {
    updateToast(id, 'failed')
  }, [updateToast])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <TransactionToastContext.Provider value={{ addToast, updateToast, confirmToast, failToast }}>
      {children}
      <View style={styles.container} pointerEvents="none">
        {toasts.map((toast) => (
          <TransactionToast
            key={toast.id}
            signature={toast.signature}
            status={toast.status}
            onComplete={() => removeToast(toast.id)}
          />
        ))}
      </View>
    </TransactionToastContext.Provider>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 120,
    right: 16,
    alignItems: 'flex-end',
  },
})
