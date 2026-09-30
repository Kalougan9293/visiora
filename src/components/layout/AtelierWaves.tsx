/** Ondes lentes du logo — visibles seulement en mode « Version d'essai ». */

export function AtelierWaves() {
  return (
    <div aria-hidden className="vs-atelier-waves pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <svg
        className="vs-atelier-wave absolute -left-1/4 top-[8%] h-[42%] w-[150%] text-[var(--vs-azur)]"
        viewBox="0 0 1200 240"
        fill="none"
        preserveAspectRatio="none"
      >
        <path
          d="M0 120 C150 40 300 200 450 120 C600 40 750 200 900 120 C1050 40 1150 160 1200 120"
          stroke="currentColor"
          strokeWidth="1.25"
          opacity="0.28"
        />
        <path
          d="M0 150 C180 70 340 210 520 140 C700 70 860 210 1040 140 C1120 110 1160 150 1200 150"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.18"
        />
      </svg>
      <svg
        className="vs-atelier-wave-slow absolute -right-1/4 bottom-[18%] h-[36%] w-[150%] text-[var(--vs-or)]"
        viewBox="0 0 1200 240"
        fill="none"
        preserveAspectRatio="none"
      >
        <path
          d="M0 130 C200 210 380 50 560 130 C740 210 920 50 1100 130 C1150 150 1180 140 1200 130"
          stroke="currentColor"
          strokeWidth="1.1"
          opacity="0.2"
        />
      </svg>
    </div>
  )
}
