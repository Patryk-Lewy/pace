/**
 * Strava brand attribution badge — required by Strava's brand guidelines
 * whenever displaying their data. https://developers.strava.com/guidelines/
 */
export function PoweredByStrava({ className = '' }: { className?: string }) {
  return (
    <a
      href="https://www.strava.com"
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 transition-opacity ${className}`}
      style={{ color: '#FC4C02' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
      </svg>
      <span>Powered by Strava</span>
    </a>
  )
}
