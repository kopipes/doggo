import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { StaffAccount, LoginResponse } from '@petreg/shared'
import { api } from '../lib/api'

interface AuthContextValue {
  account: StaffAccount | null
  token: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<StaffAccount | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('petreg_token'))
  const [loading, setLoading] = useState<boolean>(() => !!localStorage.getItem('petreg_token'))

  const logout = useCallback(() => {
    localStorage.removeItem('petreg_token')
    setToken(null)
    setAccount(null)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('petreg_token')
    if (!stored) {
      setLoading(false)
      return
    }
    api.get<StaffAccount>('/auth/me', stored)
      .then((res) => {
        if (res.ok) {
          setToken(stored)
          setAccount(res.data)
        } else {
          logout()
        }
      })
      .catch(() => logout())
      .finally(() => setLoading(false))
  }, [logout])

  async function login(username: string, password: string) {
    const res = await api.post<LoginResponse>('/auth/login', { username, password })
    if (!res.ok) throw new Error((res as any).error)
    localStorage.setItem('petreg_token', res.data.token)
    setToken(res.data.token)
    setAccount(res.data.account)
  }

  const isAdmin = account?.role === 'admin'

  return (
    <AuthContext.Provider value={{ account, token, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
