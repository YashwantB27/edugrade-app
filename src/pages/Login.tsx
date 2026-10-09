import { useState } from 'react'
import { Navigate } from 'react-router-dom'
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

          {/* Google Sign-In */}
          <button
            type="button"
            onClick={async () => {
              setError('')
              setSubmitting(true)
              try {
                await signInWithGoogle()
              } catch (err: any) {
                setError(err.message || 'Google sign-in failed')
                setSubmitting(false)
              }
            }}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-[rgb(var(--border))] rounded-lg font-medium text-sm hover:bg-[rgb(var(--bg-tertiary))] transition-colors disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-[rgb(var(--border))]"></div>
            <span className="text-xs text-[rgb(var(--text-secondary))]">or</span>
            <div className="flex-1 h-px bg-[rgb(var(--border))]"></div>
          </div>

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
