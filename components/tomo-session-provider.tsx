import { createContext, useContext, useState, PropsWithChildren } from 'react'

interface TomoSessionContextValue {
  scannedUid: string | null
  setScannedUid: (uid: string | null) => void
  clearSession: () => void
}

const TomoSessionContext = createContext<TomoSessionContextValue | null>(null)

export function TomoSessionProvider({ children }: PropsWithChildren) {
  const [scannedUid, setScannedUid] = useState<string | null>(null)

  const clearSession = () => {
    setScannedUid(null)
  }

  return (
    <TomoSessionContext.Provider value={{ scannedUid, setScannedUid, clearSession }}>
      {children}
    </TomoSessionContext.Provider>
  )
}

export function useTomoSession() {
  const context = useContext(TomoSessionContext)
  if (!context) {
    throw new Error('useTomoSession must be used within a TomoSessionProvider')
  }
  return context
}
