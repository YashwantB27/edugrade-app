import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth, getAuthErrorMessage } from '../contexts/AuthContext'

export function Login() {
  const { user, loading, signIn, signUp, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--bg-primary))]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)

    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        await signUp(email, password)
        setNotice('🎉 Account created successfully! Please log in below.')
        setMode('login')
        setPassword('')
      }
    } catch (err: any) {
      setError(getAuthErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--bg-primary))] px-4 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 my-8">
        <div className="card shadow-2xl border border-[rgb(var(--border))]">
          {/* Logo */}
          <Link to="/" className="flex items-center justify-center gap-3 mb-6 group">
            <div className="w-10 h-10 bg-gradient-to-br from-rose-500 via-primary-600 to-primary-800 rounded-xl flex items-center justify-center shadow-lg shadow-rose-950/40 border border-rose-400/20 group-hover:scale-105 transition-transform">
              <span className="text-white font-display font-extrabold text-xl">E</span>
            </div>
            <span className="font-display font-bold text-2xl text-[rgb(var(--text-primary))]">
              Edu<span className="text-primary-500">Grade</span>
            </span>
          </Link>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-[rgb(var(--border))]">
            <button
              onClick={() => { setMode('login'); setError(''); setNotice(''); }}
              className={`flex-1 pb-3 font-semibold text-sm transition-all border-b-2 ${
                mode === 'login'
                  ? 'border-primary-500 text-primary-500'
                  : 'border-transparent text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); setNotice(''); }}
              className={`flex-1 pb-3 font-semibold text-sm transition-all border-b-2 ${
                mode === 'signup'
                  ? 'border-primary-500 text-primary-500'
                  : 'border-transparent text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
              }`}
            >
              Sign Up
            </button>
          </div>

          <h2 className="text-xl font-bold font-display mb-1 text-[rgb(var(--text-primary))]">
            {mode === 'login' ? 'Welcome Back' : 'Create Your Account'}
          </h2>
          <p className="text-xs text-[rgb(var(--text-secondary))] mb-6">
            {mode === 'login' ? 'Access your grades, trends, and simulations' : 'Join EduGrade to track your CGPA effortlessly'}
          </p>

          {/* Notifications */}
          {notice && (
            <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs">
              {notice}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign-in */}
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-primary))] hover:bg-[rgb(var(--bg-tertiary))] text-sm font-semibold text-[rgb(var(--text-primary))] transition-all mb-4"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-[rgb(var(--border))] w-full" />
            <span className="bg-[rgb(var(--bg-secondary))] px-3 text-[11px] uppercase tracking-wider text-[rgb(var(--text-secondary))] absolute">
              or continue with email
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-secondary))] mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@university.edu"
                className="input-field text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-secondary))] mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-primary justify-center py-2.5 text-sm mt-2"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === 'login' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
