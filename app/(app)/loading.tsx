// Instant loading skeleton shown the moment a tab is tapped (via Suspense),
// so navigation always gives immediate feedback instead of a frozen screen.
export default function Loading() {
  return (
    <div style={{ paddingTop: 22 }} aria-busy="true" aria-label="Ładowanie">
      <div className="skel" style={{ height: 26, width: '55%', borderRadius: 8, marginBottom: 20 }} />
      <div className="skel" style={{ height: 150, marginBottom: 12 }} />
      <div className="flex" style={{ gap: 10, marginBottom: 12 }}>
        <div className="skel" style={{ height: 78, flex: 1 }} />
        <div className="skel" style={{ height: 78, flex: 1 }} />
        <div className="skel" style={{ height: 78, flex: 1 }} />
      </div>
      <div className="skel" style={{ height: 96 }} />
    </div>
  )
}
