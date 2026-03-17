'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { DBPlayer, getPlayerByPin, supabase } from './supabase'

interface AuthContextType {
  player: DBPlayer | null
  isAdmin: boolean
  login: (pin: string) => Promise<boolean>
  register: (name: string, pin: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN ?? '0000'
const STORAGE_KEY = 'ncaa_pool_player_id'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<DBPlayer | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setPlayer(parsed.player)
        setIsAdmin(parsed.isAdmin ?? false)
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setLoading(false)
  }, [])

  async function login(pin: string): Promise<boolean> {
    if (pin === ADMIN_PIN) {
      const adminPlayer: DBPlayer = {
        id: 'admin',
        name: 'Commissioner',
        pin: ADMIN_PIN,
        created_at: '',
      }
      setPlayer(adminPlayer)
      setIsAdmin(true)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ player: adminPlayer, isAdmin: true }))
      return true
    }

    const found = await getPlayerByPin(pin)
    if (found) {
      setPlayer(found)
      setIsAdmin(false)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ player: found, isAdmin: false }))
      return true
    }
    return false
  }

  async function register(name: string, pin: string): Promise<{ success: boolean; error?: string }> {
    const trimmedName = name.trim()
    if (!trimmedName) return { success: false, error: 'Please enter your name.' }
    if (pin.length !== 4) return { success: false, error: 'PIN must be 4 digits.' }
    if (pin === ADMIN_PIN) return { success: false, error: 'That PIN is reserved. Choose another.' }

    // Check if PIN already taken
    const existing = await getPlayerByPin(pin)
    if (existing) return { success: false, error: 'That PIN is already taken. Choose another.' }

    // Check if name already taken (case-insensitive)
    const { data: nameTaken } = await supabase
      .from('players')
      .select('id')
      .ilike('name', trimmedName)
      .single()
    if (nameTaken) return { success: false, error: 'That name is already registered.' }

    // Create player
    const { data, error } = await supabase
      .from('players')
      .insert({ name: trimmedName, pin })
      .select()
      .single()

    if (error || !data) return { success: false, error: 'Registration failed. Try again.' }

    setPlayer(data)
    setIsAdmin(false)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ player: data, isAdmin: false }))
    return { success: true }
  }

  function logout() {
    setPlayer(null)
    setIsAdmin(false)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <AuthContext.Provider value={{ player, isAdmin, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
