import type { Anim } from '@/lib/exercises'

// Animated stick-figure that schematically demonstrates a movement pattern.
// One rigged skeleton; the archetype (data-anim) drives per-limb CSS keyframes
// defined in globals.css. Pure SVG + CSS — self-contained, offline, theme-aware.
export default function ExerciseFigure({ anim, size = 150 }: { anim: Anim; size?: number }) {
  return (
    <svg className="ef" data-anim={anim} width={size} height={size * 1.3} viewBox="0 0 100 130"
      role="img" aria-label="Animacja ćwiczenia">
      <g className="ef-fig">
        {/* legs (behind torso) */}
        <rect className="ef-limb ef-leg-l" x="45.5" y="72" width="5" height="44" rx="2.5" />
        <rect className="ef-limb ef-leg-r" x="49.5" y="72" width="5" height="44" rx="2.5" />
        {/* upper body group — folds forward for stretches */}
        <g className="ef-upper">
          <rect className="ef-torso" x="46.5" y="30" width="7" height="44" rx="3.5" />
          <circle className="ef-head" cx="50" cy="19" r="10" />
          <rect className="ef-limb ef-arm-l" x="43.5" y="34" width="4.5" height="30" rx="2.25" />
          <rect className="ef-limb ef-arm-r" x="52" y="34" width="4.5" height="30" rx="2.25" />
        </g>
      </g>
    </svg>
  )
}
