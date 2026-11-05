import { useEffect, useState } from 'react'

interface SplashIntroProps {
  onFinish: () => void
}

export function SplashIntro({ onFinish }: SplashIntroProps) {
  // Phase 1 (0s): Symbol appears
  // Phase 2 (2.2s): Name reveals
  // Phase 3 (4.4s): Exit transition starts
  // End (5.0s): Completed
  const [phase, setPhase] = useState<'symbol' | 'revealName' | 'fadeOut'>('symbol')

  useEffect(() => {
    // Step 1: Reveal the name after symbol shines alone
    const timerName = setTimeout(() => {
      setPhase('revealName')
    }, 2200)

    // Step 2: Begin smooth fadeout before 5 seconds
    const timerFade = setTimeout(() => {
      setPhase('fadeOut')
    }, 4500)

    // Step 3: Conclude splash animation exactly at 5.0 seconds
    const timerFinish = setTimeout(() => {
      onFinish()
    }, 5000)

    return () => {
      clearTimeout(timerName)
      clearTimeout(timerFade)
      clearTimeout(timerFinish)
    }
  }, [onFinish])

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-[#070204] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 selection:bg-rose-500 ${
        phase === 'fadeOut' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Cinematic Ambient Glow Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-rose-900/30 via-primary-700/20 to-transparent rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-primary-600/25 rounded-full blur-[90px] pointer-events-none" />

      {/* Subtle Skip Button */}
      <button
        type="button"
        onClick={onFinish}
        className="absolute top-6 right-6 z-20 text-xs font-semibold text-rose-200/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-1.5 rounded-full transition-all backdrop-blur-md cursor-pointer"
        title="Skip intro animation"
      >
        Skip ✕
      </button>

      {/* Main Animated Stage */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 max-w-lg mx-auto">
        
        {/* Phase 1: Symbol First with glowing emergence */}
        <div
          className={`relative transition-all duration-1000 ease-out transform ${
            phase === 'symbol'
              ? 'scale-100 translate-y-4'
              : 'scale-95 -translate-y-2'
          }`}
        >
          {/* Radiant Backdrop Glow */}
          <div className="absolute inset-0 bg-primary-500/20 rounded-full blur-2xl transform scale-125 animate-pulse pointer-events-none" />

          <img
            src="/logo-symbol-transparent.png"
            alt="EduGrade Symbol"
            className="w-36 h-36 sm:w-44 sm:h-44 object-contain drop-shadow-[0_0_35px_rgba(225,29,72,0.65)] select-none animate-float-gentle"
          />
        </div>

        {/* Phase 2: Name Revealing (The symbol first, then revealing the name) */}
        <div
          className={`mt-4 flex flex-col items-center transition-all duration-1000 ease-out ${
            phase !== 'symbol'
              ? 'opacity-100 translate-y-0 scale-100 filter-none'
              : 'opacity-0 translate-y-6 scale-90 blur-sm pointer-events-none'
          }`}
        >
          {/* Logo Name & Underline Graphic */}
          <div className="relative">
            <img
              src="/logo-text-transparent.png"
              alt="EduGrade"
              className="h-16 sm:h-20 object-contain drop-shadow-[0_2px_15px_rgba(225,29,72,0.4)] select-none"
            />
            
            {/* Shimmer Light Sweep Effect over the text */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer pointer-events-none" />
          </div>

          {/* Subtitle / Tagline */}
          <p className="mt-2 text-xs sm:text-sm font-semibold tracking-widest uppercase text-rose-200/80 text-center font-display">
            Academic Performance & CGPA Intelligence
          </p>
        </div>
      </div>

      {/* 5-Second Luxury Crimson Progress Line at Bottom */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-rose-600 via-primary-500 to-rose-400 animate-progress-5s shadow-[0_0_12px_#e11d48]" />
      </div>
    </div>
  )
}

