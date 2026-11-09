/**
 * Send Koro logo (brand kit v1): navy ring and fork, red arrow breaking out of the ring.
 * The artwork lives in public/brand/ as outlined SVG, so it needs no font.
 * tone="color" on white or light backgrounds, tone="reversed" on navy or dark ones.
 */
export function BrandLogo({ tone = 'color', height = 32, label }: { tone?: 'color' | 'reversed'; height?: number; label?: string }) {
  return (
    <span className="logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/brand/sendkoro-logo-horizontal-no-tagline-${tone}.svg`} alt="Send Koro" style={{ height, width: 'auto', display: 'block' }} />
      {label ? <span className="logo-label">{label}</span> : null}
    </span>
  );
}
