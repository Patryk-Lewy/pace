export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-10">
          <span
            className="text-3xl font-black tracking-widest uppercase"
            style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif', color: 'var(--green)' }}
          >
            PACE
          </span>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
            AI Running Coach
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
