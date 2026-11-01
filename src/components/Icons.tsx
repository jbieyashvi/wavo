/** Seated e-scooty glyph drawn on lucide's 24px grid and 2px stroke so it sits with the rest of the icon set. */
export function ScooterGlyph({ size = 24, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5.5" cy="17.5" r="2.5" />
      <circle cx="18.5" cy="17.5" r="2.5" />
      <path d="M3 14.5h7.5l1.5 3h3.5L17 6" />
      <path d="M4 11h6" />
      <path d="M15 6h4" />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`wordmark ${className}`} aria-label="WAVO">
      <svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true">
        <path d="M2 4l5.5 12L13 7l2 4" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 11l2 5 5.5-12" fill="none" stroke="var(--green-bright)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="26.5" cy="4" r="2" fill="var(--green-bright)" />
      </svg>
      <span aria-hidden="true">WAVO</span>
    </span>
  );
}
