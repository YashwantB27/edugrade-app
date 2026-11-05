import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

export function Navbar() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student'
  const avatarUrl = user?.user_metadata?.avatar_url

  return (
    <nav className="bg-[rgb(var(--bg-secondary))] border-b border-[rgb(var(--border))] sticky top-0 z-40 backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-rose-500 via-primary-600 to-primary-800 rounded-xl flex items-center justify-center shadow-lg shadow-rose-950/30 border border-rose-400/20">
              <span className="text-white font-display font-extrabold text-xl tracking-tight">E</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-xl text-[rgb(var(--text-primary))] tracking-tight">
                Edu<span className="text-primary-500">Grade</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-[rgb(var(--bg-tertiary))] rounded-xl transition-colors border border-transparent hover:border-[rgb(var(--border))]"
              aria-label="Toggle theme"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            {/* User Info */}
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[rgb(var(--text-secondary))] pl-2 sm:border-l sm:border-[rgb(var(--border))]">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-7 h-7 rounded-full border border-primary-500/40 object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary-600/15 text-primary-500 font-bold flex items-center justify-center text-xs border border-primary-500/30">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="hidden sm:inline font-medium text-[rgb(var(--text-primary))]">
                {displayName}
              </span>
            </div>

            <button
              onClick={() => signOut()}
              className="btn-ghost text-xs sm:text-sm py-1.5 px-3 hover:text-rose-500"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
