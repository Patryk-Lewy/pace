import type { Anim } from '@/lib/exercises'
import type { ReactNode } from 'react'

// Animated exercise figure. Front-facing movements use one rigged skeleton
// (data-anim drives per-limb CSS keyframes in globals.css); side-profile poses
// (planks, lunge, stretches…) are drawn as dedicated silhouettes. Pure SVG+CSS.

function FrontRig() {
  return (
    <g className="ef-fig">
      <rect className="ef-limb ef-leg-l" x="45" y="60" width="5" height="44" rx="2.5" />
      <rect className="ef-limb ef-leg-r" x="50" y="60" width="5" height="44" rx="2.5" />
      <rect className="ef-torso" x="46" y="28" width="8" height="33" rx="4" />
      <circle className="ef-head" cx="50" cy="18" r="9" />
      <rect className="ef-limb ef-arm-l" x="43" y="33" width="4.5" height="27" rx="2.25" />
      <rect className="ef-limb ef-arm-r" x="52.5" y="33" width="4.5" height="27" rx="2.25" />
    </g>
  )
}

const SIDE_POSES: Partial<Record<Anim, ReactNode>> = {
  armcircle: (
    <g className="sp">
      <polyline className="sp-line" points="50,58 44,104" />
      <polyline className="sp-line" points="50,58 56,104" />
      <polyline className="sp-line" points="50,37 50,58" />
      <polyline className="sp-line" points="38,37 62,37" />
      <circle className="sp-head" cx="50" cy="25" r="8" />
      <rect className="ac-arm" x="36.5" y="37" width="3.4" height="17" rx="1.7" />
      <rect className="ac-arm" x="60.1" y="37" width="3.4" height="17" rx="1.7" />
    </g>
  ),
  hipcircle: (
    <g className="sp">
      <polyline className="sp-line" points="47,60 45,104" />
      <polyline className="sp-line" points="53,60 55,104" />
      <g className="hc-hips">
        <polyline className="sp-line" points="50,33 50,60" />
        <circle className="sp-head" cx="50" cy="23" r="9" />
        <polyline className="sp-line" points="47,38 37,48 48,59" />
        <polyline className="sp-line" points="53,38 63,48 52,59" />
      </g>
    </g>
  ),
  plank: (
    <g className="sp sp-breath">
      <polyline className="sp-line" points="16,84 46,78 72,72" />
      <polyline className="sp-line" points="72,72 72,92 56,94" />
      <circle className="sp-head" cx="81" cy="67" r="7" />
    </g>
  ),
  sideplank: (
    <g className="sp sp-breath">
      <polyline className="sp-line" points="24,104 66,60" />
      <polyline className="sp-line" points="60,66 54,104" />
      <polyline className="sp-line" points="58,70 72,42" />
      <circle className="sp-head" cx="70" cy="55" r="6.5" />
    </g>
  ),
  bridge: (
    <g className="sp sp-bridge">
      <polyline className="sp-line" points="24,98 48,74 66,80 80,98" />
      <polyline className="sp-line" points="24,98 40,100" />
      <circle className="sp-head" cx="17" cy="97" r="6" />
    </g>
  ),
  lunge: (
    <g className="sp sp-bob">
      <polyline className="sp-line" points="26,104 50,72 64,88 64,104" />
      <polyline className="sp-line" points="50,72 52,44" />
      <polyline className="sp-line" points="51,50 60,60" />
      <polyline className="sp-line" points="51,50 43,61" />
      <circle className="sp-head" cx="53" cy="37" r="7.5" />
    </g>
  ),
  fold: (
    <g className="sp sp-fold">
      <polyline className="sp-line" points="50,64 50,106" />
      <g className="sp-upper">
        <polyline className="sp-line" points="50,64 50,38" />
        <polyline className="sp-line" points="50,44 50,62" />
        <circle className="sp-head" cx="50" cy="30" r="8" />
      </g>
    </g>
  ),
  quadstretch: (
    <g className="sp sp-sway">
      <polyline className="sp-line" points="50,68 50,106" />
      <polyline className="sp-line" points="50,68 50,90 42,66" />
      <polyline className="sp-line" points="50,44 50,68" />
      <polyline className="sp-line" points="50,52 42,66" />
      <polyline className="sp-line" points="50,50 60,58" />
      <circle className="sp-head" cx="50" cy="36" r="7.5" />
    </g>
  ),
  balance: (
    <g className="sp sp-sway">
      <polyline className="sp-line" points="50,68 50,106" />
      <polyline className="sp-line" points="50,68 66,72 66,90" />
      <polyline className="sp-line" points="50,42 50,68" />
      <polyline className="sp-line" points="50,48 38,56" />
      <polyline className="sp-line" points="50,48 62,56" />
      <circle className="sp-head" cx="50" cy="34" r="7.5" />
    </g>
  ),
  roll: (
    <g className="sp sp-roll">
      <polyline className="sp-line" points="24,94 50,88 74,80" />
      <polyline className="sp-line" points="50,88 58,72" />
      <circle className="sp-head" cx="80" cy="77" r="6" />
    </g>
  ),
}

export default function ExerciseFigure({ anim, size = 150 }: { anim: Anim; size?: number }) {
  const side = SIDE_POSES[anim]
  return (
    <svg className="ef" data-anim={anim} width={size} height={size * 1.2} viewBox="0 0 100 120"
      role="img" aria-label="Animacja ćwiczenia">
      {side ?? <FrontRig />}
    </svg>
  )
}
