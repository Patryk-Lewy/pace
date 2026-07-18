// Mini route map — draws the GPS path as a normalized SVG polyline.
// No map tiles / external libraries; just the route shape on a card.

type Props = {
  points: [number, number][] // [lat, lng]
  height?: number
}

export default function RouteMap({ points, height = 140 }: Props) {
  if (!points || points.length < 2) return null

  const lats = points.map(p => p[0])
  const lngs = points.map(p => p[1])
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)

  // Equirectangular projection with latitude correction so shapes keep
  // realistic proportions.
  const midLat = (minLat + maxLat) / 2
  const cos = Math.cos((midLat * Math.PI) / 180)
  const spanX = Math.max((maxLng - minLng) * cos, 1e-6)
  const spanY = Math.max(maxLat - minLat, 1e-6)

  const W = 300
  const H = 140
  const PAD = 12
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY)
  const offX = (W - spanX * scale) / 2
  const offY = (H - spanY * scale) / 2

  const xy = (p: [number, number]): [number, number] => [
    offX + (p[1] - minLng) * cos * scale,
    offY + (maxLat - p[0]) * scale,
  ]

  const d = points.map((p, i) => {
    const [x, y] = xy(p)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const [sx, sy] = xy(points[0])
  const [ex, ey] = xy(points[points.length - 1])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Trasa biegu">
      <path d={d} fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
      <circle cx={sx} cy={sy} r="5" fill="var(--blue)" stroke="#000" strokeWidth="1.5" />
      <circle cx={ex} cy={ey} r="5" fill="var(--green)" stroke="#000" strokeWidth="1.5" />
    </svg>
  )
}
