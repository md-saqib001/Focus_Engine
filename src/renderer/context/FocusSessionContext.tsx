import React, { createContext, useContext } from 'react'
import { useFocusSession } from '../hooks/useFocusSession'

// Dynamically extract the return type of the hook
type FocusSessionContextType = ReturnType<typeof useFocusSession>

const FocusSessionContext = createContext<FocusSessionContextType | null>(null)

export const FocusSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = useFocusSession()
  return (
    <FocusSessionContext.Provider value={session}>
      {children}
    </FocusSessionContext.Provider>
  )
}

export const useFocusSessionContext = () => {
  const context = useContext(FocusSessionContext)
  if (!context) {
    throw new Error('useFocusSessionContext must be used within a FocusSessionProvider')
  }
  return context
}
