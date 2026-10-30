/* eslint-disable @next/next/no-img-element */

interface BlossomProps {
  branch: 'a' | 'b' | 'c';
  /** Which edge it slides in from. */
  side: 'left' | 'right';
  className?: string;
  /** Parallax drift in percent of its own height across the section. */
  speed?: number;
}

/** A bougainvillea branch bleeding off a section edge: parallax, slide-in and a slow sway. Decorative. */
export default function Blossom({ branch, side, className = '', speed = -20 }: BlossomProps) {
  return (
    <div className={`blossom ${className}`} data-blossom={side} data-speed={speed} aria-hidden="true">
      <div className="blossom-slide">
        <img className="blossom-sway" src={`/blossom/branch-${branch}.svg`} alt="" loading="lazy" decoding="async" draggable={false} />
      </div>
    </div>
  );
}
