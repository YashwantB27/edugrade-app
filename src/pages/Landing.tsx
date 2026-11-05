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
            <img
              src="/logo-symbol-transparent.png"
              alt="EduGrade"
              className="w-10 h-10 object-contain drop-shadow-[0_2px_10px_rgba(225,29,72,0.45)]"
            />
            <span className="font-display font-bold text-2xl text-[rgb(var(--text-primary))]">
              Edu<span className="text-primary-500">Grade</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-[rgb(var(--bg-tertiary))] rounded-xl transition-colors text-lg"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold text-[rgb(var(--text-primary))] hover:text-primary-500 transition-colors"
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
      <main className="flex-1 flex flex-col justify-center relative overflow-hidden py-16 sm:py-24">
        {/* Ambient Crimson Background Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-primary-500/10 text-primary-500 border border-primary-500/20 mb-8 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
            Next-Gen Academic Analytics Suite
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold font-display tracking-tight text-[rgb(var(--text-primary))] max-w-4xl mx-auto leading-[1.15]">
            Master Your Grades with{' '}
            <span className="bg-gradient-to-r from-rose-500 via-primary-600 to-rose-400 bg-clip-text text-transparent">
              EduGrade
            </span>
          </h1>

          {/* Description */}
          <p className="mt-6 text-base sm:text-xl text-[rgb(var(--text-secondary))] max-w-2xl mx-auto leading-relaxed">
            The elite academic performance dashboard for engineering students. Auto-scan results, compute live SGPA/CGPA, visualize trendlines, simulate targets, and export verified transcripts.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary-600 text-white font-semibold rounded-xl text-base shadow-xl shadow-rose-900/30 hover:bg-primary-700 hover:shadow-rose-900/50 hover:-translate-y-0.5 transition-all duration-200"
            >
              Get Started Free
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[rgb(var(--bg-secondary))] text-[rgb(var(--text-primary))] border border-[rgb(var(--border))] font-semibold rounded-xl text-base hover:bg-[rgb(var(--bg-tertiary))] hover:border-primary-500/30 transition-all duration-200"
            >
              Log In to Account
            </Link>
          </div>

          {/* Feature Highlights Grid */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
            <div className="card hover:border-primary-500/40 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-primary-500/10 text-primary-500 border border-primary-500/20 flex items-center justify-center text-2xl mb-4">
                ⚡
              </div>
              <h3 className="text-lg font-bold font-display text-[rgb(var(--text-primary))] mb-2">
                Instant SGPA & CGPA
              </h3>
              <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                Real-time calculation following Indian 10-point standard grading with full credit weightings, backlogs, and lateral entry support.
              </p>
            </div>

            <div className="card hover:border-primary-500/40 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-primary-500/10 text-primary-500 border border-primary-500/20 flex items-center justify-center text-2xl mb-4">
                📷
              </div>
              <h3 className="text-lg font-bold font-display text-[rgb(var(--text-primary))] mb-2">
                Smart Result Scanner
              </h3>
              <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                Upload results as Photos, PDFs, Word, or Excel sheets. Runs 100% in-browser with zero API keys and auto-fills course grades.
              </p>
            </div>

            <div className="card hover:border-primary-500/40 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-primary-500/10 text-primary-500 border border-primary-500/20 flex items-center justify-center text-2xl mb-4">
                🎯
              </div>
              <h3 className="text-lg font-bold font-display text-[rgb(var(--text-primary))] mb-2">
                Target Simulator
              </h3>
              <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                Project future semesters and discover exactly what upcoming SGPA you need to hit your dream graduation CGPA.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[rgb(var(--border))] py-8 text-center text-xs text-[rgb(var(--text-secondary))] bg-[rgb(var(--bg-primary))]">
        <p>© {new Date().getFullYear()} EduGrade. Crafted for ambitious engineers.</p>
      </footer>
    </div>
  )
}
