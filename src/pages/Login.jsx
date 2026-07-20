import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-margin-mobile relative overflow-hidden font-body-md text-on-surface">
      {/* Evocative Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          alt="Background"
          className="w-full h-full object-cover opacity-30 object-center"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBEtrjwLjGN2u0dX4HfGMBrTIxe56qMBohhoK4cN0goi0jHdm9Yg1etxd-9CfsymSJbPt5RTHetTdvHkcYh4-jcd8_-y8YflFAyaBKSUepPzPdXPIt-AQcfMrtgfR2_Pcbz6oeXN4F0KTz8t5IcCB5ff1XdHBB47XAauJRklll0Tj16mh6a6w5wy9_t28eCI_lxrXmsRdELq2X6Mfhx8gPHeFNi6vkVcqwfE0QyQLmhqHGWxA2-RCgUtrcPv9lX9eId7fpJ4o5Etso"
        />
        {/* Subtle gradient overlay to ensure text contrast and maintain brand warmth */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background/90 backdrop-blur-[2px]"></div>
      </div>

      {/* Login Card */}
      <main className="relative z-10 w-full max-w-[420px] bg-surface rounded-xl shadow-[0px_10px_25px_rgba(113,91,62,0.08)] border border-surface-variant flex flex-col p-stack-lg sm:p-8">
        {/* Header Section */}
        <header className="flex flex-col items-center text-center mb-8">
          <img
            alt="Logotipo do Sistema Pastoral"
            className="h-16 w-auto object-contain mb-4"
            src="/assets/logo.svg"
            onError={(e) => { e.target.src = 'https://lh3.googleusercontent.com/aida/AP1WRLvo13LsFqfslwfdSDYOHPBmdW7pf_MtLq5R9-jZGjMLSXu0hHzyhr_F_awEm6-7p8zS06eGZm8siezpZccpjqz5ROtf2u48G4YvXIcdsS4TlteyFyXO-1I1cGf8D6DTRpqSWRRfRWTfQfmGm-mt9s5leqlY-JlsHnmnBlVgjI-7Kzac_YiAu3luANJ4GIr9h9_Z0qpLVOHGQyFIbCR1Ss2qZYK2wf6Ho-le0x88hYMa3Swu-YaNYVtYifA' }}
          />
          <h1 className="font-headline-lg text-headline-lg text-primary mb-2 tracking-tight">Sistema Pastoral</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Cuidando de quem mais precisa</p>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-error-container text-on-error-container text-body-sm rounded-lg border border-error/20 flex items-start gap-2">
            <span className="material-symbols-outlined text-[20px] text-error shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-stack-md w-full">
          {/* Email Input */}
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface ml-1" htmlFor="email">E-mail</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">mail</span>
              <input
                className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none transition-shadow placeholder:text-outline/70"
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface ml-1" htmlFor="password">Senha</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">lock</span>
              <input
                className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none transition-shadow placeholder:text-outline/70"
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            className="mt-4 w-full bg-primary hover:bg-primary-container text-on-primary hover:text-on-primary-container font-label-md text-label-md py-3.5 px-6 rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed"
            type="submit"
            disabled={submitting}
          >
            <span>{submitting ? 'Entrando...' : 'Entrar'}</span>
            {!submitting && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
          </button>
        </form>
      </main>
    </div>
  )
}
