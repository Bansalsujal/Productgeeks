import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '@/lib/api'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [sessions, setSessions] = useState([])
  const [userStats, setUserStats] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingData, setIsLoadingData] = useState(false)

  const loadUserData = async () => {
    if (!user?.id) return
    
    setIsLoadingData(true)
    try {
      const [sessionsData, statsData] = await Promise.all([
        api.getSessions(),
        api.getUserStats()
      ])
      
      setSessions(sessionsData)
      setUserStats(statsData)
    } catch (error) {
      console.error('Error loading user data:', error)
    }
    setIsLoadingData(false)
  }

  const refreshUserData = () => {
    if (user?.id) {
      loadUserData()
    }
  }

  useEffect(() => {
    const initAuth = async () => {
      try {
        const userData = await api.me()
        setUser(userData)
        
        if (userData?.id) {
          await loadUserData()
        }
      } catch (error) {
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [])

  const login = async (email, password) => {
    const response = await api.login(email, password)
    setUser(response.user)
    await loadUserData()
    return response
  }

  const register = async (userData) => {
    const response = await api.register(userData)
    setUser(response.user)
    return response
  }

  const googleLogin = async (token) => {
    const response = await api.googleAuth(token)
    setUser(response.user)
    await loadUserData()
    return response
  }

  const logout = async () => {
    await api.logout()
    setUser(null)
    setSessions([])
    setUserStats(null)
  }

  const updateProfile = async (data) => {
    const updatedUser = await api.updateProfile(data)
    setUser(updatedUser)
    return updatedUser
  }

  const value = {
    user,
    sessions,
    userStats,
    isAuthenticated: !!user,
    isLoading,
    isLoadingData,
    login,
    register,
    googleLogin,
    logout,
    updateProfile,
    refreshUserData
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}