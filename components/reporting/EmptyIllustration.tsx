// Own drawing for the empty instant report canvas: a chart window with a table behind it. No external assets.
export function EmptyIllustration() {
  return (
    <svg width="220" height="150" viewBox="0 0 220 150" role="img" aria-label="Empty report" data-testid="empty-illustration">
      <rect x="10" y="20" width="150" height="100" rx="8" fill="#e8f0fe" />
      <rect x="22" y="34" width="60" height="8" rx="4" fill="#aecbfa" />
      <rect x="22" y="52" width="126" height="6" rx="3" fill="#c6dafc" />
      <rect x="22" y="66" width="126" height="6" rx="3" fill="#c6dafc" />
      <rect x="22" y="80" width="90" height="6" rx="3" fill="#c6dafc" />
      <rect x="22" y="94" width="108" height="6" rx="3" fill="#c6dafc" />
      <rect x="100" y="52" width="104" height="80" rx="8" fill="#fff" stroke="#1a73e8" strokeWidth="2" />
      <rect x="114" y="98" width="14" height="22" rx="2" fill="#1a73e8" />
      <rect x="136" y="84" width="14" height="36" rx="2" fill="#4285f4" />
      <rect x="158" y="70" width="14" height="50" rx="2" fill="#8ab4f8" />
      <rect x="180" y="90" width="14" height="30" rx="2" fill="#d2e3fc" />
      <circle cx="190" cy="30" r="12" fill="#fbbc04" />
    </svg>
  );
}
