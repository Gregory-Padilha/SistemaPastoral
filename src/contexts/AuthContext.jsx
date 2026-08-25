import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({
  user: null,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
  loading: true
})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // Fetch corresponding profile metadata
        const { data: profile } = await supabase
          .from('perfis')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        setUser(profile ? { ...session.user, profile } : session.user)
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error('Session check error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkSession()

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setLoading(true)
      if (session) {
        // Fetch corresponding profile metadata
        const { data: profile } = await supabase
          .from('perfis')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        setUser(profile ? { ...session.user, profile } : session.user)
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const refreshUser = async () => {
    if (!user) return
    try {
      const { data: profile } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', user.id)
        .single()
      
      setUser(prev => prev ? { ...prev, profile } : null)
    } catch (err) {
      console.error('Error refreshing user profile:', err)
    }
  }

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) throw error
    return data
  }

  const logout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
