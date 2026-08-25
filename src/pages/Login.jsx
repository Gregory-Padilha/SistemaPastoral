import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      console.error('Login error:', err)
      if (err.message.includes('Invalid login credentials') || err.message.includes('invalid_credentials')) {
        setError('E-mail ou senha inválidos. Por favor, verifique as suas credenciais.')
      } else {
        setError('Erro ao realizar login: ' + err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden font-body-md text-on-surface">
      {/* Evocative Background Texture with gradient */}
      <div className="absolute inset-0 z-0 opacity-40">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-secondary/20 rounded-full blur-3xl"></div>
      </div>

      {/* Login Card */}
      <main className="relative z-10 w-full max-w-[420px] bg-surface rounded-3xl shadow-xl border border-outline-variant/80 flex flex-col p-8 sm:p-10 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Section */}
        <header className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-md mb-4 ring-4 ring-primary/10">
            <span className="material-symbols-outlined text-[34px]">church</span>
          </div>
          <h1 className="text-2xl font-display-lg font-bold text-primary tracking-tight">Sistema Pastoral</h1>
          <p className="text-xs text-on-surface-variant mt-1 font-medium">Cuidando de quem mais precisa • Paz e Bem</p>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 bg-rose-50 text-rose-800 text-xs rounded-2xl border border-rose-200 flex items-start gap-2 animate-in fade-in duration-150">
            <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0">error</span>
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
          {/* Email Input */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-on-surface ml-1" htmlFor="email">E-mail de Acesso</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">mail</span>
              <input
                className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-outline-variant/80 rounded-2xl text-xs font-semibold text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/40 outline-none transition-all placeholder:text-outline/70"
                id="email"
                type="email"
                placeholder="seu.email@paroquia.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-on-surface ml-1" htmlFor="password">Senha</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">lock</span>
              <input
                className="w-full pl-10 pr-10 py-3 bg-surface-container-low border border-outline-variant/80 rounded-2xl text-xs font-semibold text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/40 outline-none transition-all placeholder:text-outline/70"
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            className="mt-3 w-full bg-primary hover:bg-primary-container text-on-primary font-bold text-xs py-3.5 px-6 rounded-2xl shadow-xs transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            type="submit"
            disabled={submitting}
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Acessar o Sistema</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </>
            )}
          </button>
        </form>

        <footer className="mt-8 text-center text-[10px] text-outline font-medium">
          Sistema Pastoral Social & Solidariedade
        </footer>
      </main>
    </div>
  )
}
