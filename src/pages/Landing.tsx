import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

export function Landing() {
  const { user, loading } = useAuth()
  const { theme, toggleTheme } = useTheme()

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-primary))] flex flex-col justify-between selection:bg-primary-500 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-primary))]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-md shadow-primary-500/20">
              <span className="text-white font-display font-bold text-xl">E</span>
            </div>
            <span className="font-display font-bold text-2xl text-[rgb(var(--text-primary))]">
              EduGrade
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-[rgb(var(--bg-tertiary))] rounded-lg transition-colors text-lg"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold text-[rgb(var(--text-primary))] hover:text-primary-600 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/login"
              className="btn-primary text-sm px-4 py-2"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 border border-primary-200/80 dark:border-primary-800/60 mb-8 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
            Next-Gen Academic Tracker
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold font-display tracking-tight text-[rgb(var(--text-primary))] max-w-4xl mx-auto leading-[1.15]">
            Master Your Grades with{' '}
            <span className="bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              EduGrade
            </span>
          </h1>

          {/* Description */}
          <p className="mt-6 text-lg sm:text-xl text-[rgb(var(--text-secondary))] max-w-2xl mx-auto leading-relaxed">
            The smart, all-in-one academic management platform. Effortlessly track semester courses, compute real-time SGPA & CGPA, visualize progression trends, and plan for distinction.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary-600 text-white font-semibold rounded-xl text-base shadow-lg shadow-primary-600/25 hover:bg-primary-700 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
            >
              Get Started Free
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[rgb(var(--bg-secondary))] text-[rgb(var(--text-primary))] border border-[rgb(var(--border))] font-semibold rounded-xl text-base hover:bg-[rgb(var(--bg-tertiary))] transition-all duration-200"
            >
              Log In to Account
            </Link>
          </div>

          {/* Feature Highlights Grid */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
            <div className="card hover:border-primary-500/40 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl mb-4">
                ⚡
              </div>
              <h3 className="text-lg font-bold font-display text-[rgb(var(--text-primary))] mb-2">
                Instant SGPA & CGPA
              </h3>
              <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                Accurate Indian engineering grading scale with decimal credit support, custom grade points, and CP auditing.
              </p>
            </div>

            <div className="card hover:border-primary-500/40 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-2xl mb-4">
                📈
              </div>
              <h3 className="text-lg font-bold font-display text-[rgb(var(--text-primary))] mb-2">
                Progression Trends
              </h3>
              <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                Interactive sparklines, circular performance gauges, and semester-by-semester performance visualization.
              </p>
            </div>

            <div className="card hover:border-primary-500/40 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center text-2xl mb-4">
                🎓
              </div>
              <h3 className="text-lg font-bold font-display text-[rgb(var(--text-primary))] mb-2">
                Semester Management
              </h3>
              <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                Seamlessly add, edit, or customize subjects and credits across all 4 years with safe cloud synchronization.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[rgb(var(--border))] py-6 text-center text-xs text-[rgb(var(--text-secondary))]">
        <p>© {new Date().getFullYear()} EduGrade. Empowering students toward academic excellence.</p>
      </footer>
    </div>
  )
}
