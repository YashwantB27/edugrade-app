import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, getAuthErrorMessage } from '../contexts/AuthContext'

export function Login() {
  const { user, loading, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
    <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--bg-primary))] px-4">
      <div className="w-full max-w-md">
        <div className="card">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-display font-bold text-lg">E</span>
            </div>
            <span className="font-display font-semibold text-2xl">EduGrade</span>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-[rgb(var(--border))]">
            <button
              onClick={() => { setMode('login'); setError(''); setNotice(''); }}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                mode === 'login'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); setNotice(''); }}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                mode === 'signup'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
              }`}
            >
              Sign Up
            </button>
          </div>

          <h2 className="text-xl font-semibold mb-4">
            {mode === 'login' ? 'Log in to your account' : 'Create a new account'}
          </h2>

          {/* Notifications */}
          {notice && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200 text-sm">
              {notice}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-primary justify-center"
            >
              {submitting ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          </form>

          <p className="mt-4 text-sm text-center text-[rgb(var(--text-secondary))]">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setNotice(''); }}
              className="ml-1 text-primary-600 hover:underline font-medium"
            >
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>

          <div className="mt-6 flex items-center gap-2 text-xs text-[rgb(var(--text-secondary))]">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
            </svg>
            <span>Secure authentication with persistent sessions</span>
          </div>
        </div>
      </div>
    </div>
  )
}
