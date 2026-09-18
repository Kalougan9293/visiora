/** Bougie SVG animée — scintillement discret pour l’état vide Aqua. */
export function FlickeringCandle() {
  return (
    <div className="aqua-candle relative flex h-24 w-16 items-end justify-center" aria-hidden>
      {/* Halo */}
      <span className="aqua-candle-glow pointer-events-none absolute bottom-8 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full" />

      {/* Colonne centrée : flamme + mèche + cire */}
      <div className="relative z-[1] flex flex-col items-center">
        <span className="aqua-candle-flame relative z-10 -mb-0.5">
          <svg width="22" height="30" viewBox="0 0 22 30" fill="none" className="block">
            <path
              d="M11 1C11 1 4 11 4 17.5C4 22.2 7.1 26 11 26C14.9 26 18 22.2 18 17.5C18 11 11 1 11 1Z"
              fill="url(#flameGrad)"
            />
            <path
              className="aqua-candle-flame-inner"
              d="M11 9C11 9 7.5 15 7.5 18.2C7.5 20.5 9 22.2 11 22.2C13 22.2 14.5 20.5 14.5 18.2C14.5 15 11 9 11 9Z"
              fill="#fff6d5"
              opacity="0.95"
            />
            <defs>
              <linearGradient
                id="flameGrad"
                x1="11"
                y1="1"
                x2="11"
                y2="26"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#ffe08a" />
                <stop offset="0.45" stopColor="#ff9a3c" />
                <stop offset="1" stopColor="#e85d2a" />
              </linearGradient>
            </defs>
          </svg>
        </span>

        {/* Mèche — même axe que la cire (items-center) */}
        <span className="relative z-[5] -mb-px h-2.5 w-[2px] rounded-full bg-[#2a1a12]" />

        <span className="relative h-14 w-8 rounded-b-md rounded-t-sm bg-gradient-to-b from-[#f3efe6] via-[#e8dfd0] to-[#d4c4ae] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_4px_12px_rgba(0,0,0,0.25)]">
          <span className="absolute inset-x-1 top-2 h-px bg-white/35" />
          <span className="absolute inset-y-3 left-1.5 w-px bg-white/25" />
        </span>
      </div>
    </div>
  )
}
