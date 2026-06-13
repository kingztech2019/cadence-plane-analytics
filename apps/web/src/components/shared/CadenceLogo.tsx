export function CadenceMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="cdnc-g" x1="14" y1="0" x2="14" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      {/* Three rhythmic bars — the Cadence mark */}
      <rect x="1"    y="15" width="7" height="12" rx="3.5" fill="url(#cdnc-g)" />
      <rect x="10.5" y="5"  width="7" height="22" rx="3.5" fill="url(#cdnc-g)" />
      <rect x="20"   y="10" width="7" height="17" rx="3.5" fill="url(#cdnc-g)" />
    </svg>
  );
}

export function CadenceWordmark({ size = 28 }: { size?: number }) {
  const fontSize = Math.round(size * 0.57);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <CadenceMark size={size} />
      <span
        style={{
          fontSize,
          fontWeight: 700,
          color: 'var(--fg)',
          letterSpacing: '-0.015em',
          lineHeight: 1,
        }}
      >
        Cadence
      </span>
    </div>
  );
}
