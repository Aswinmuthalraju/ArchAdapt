interface BlossomProps {
  branch: 'a' | 'b' | 'c';
  /** Which edge it slides in from. */
  side: 'left' | 'right';
  className?: string;
  /** Parallax drift in percent of its own height across the section. */
  speed?: number;
}

/** A bougainvillea branch bleeding off a section edge: parallax, slide-in and a slow sway. Decorative. */
const SIZE = { a: [700, 560], b: [620, 620], c: [560, 420] } as const;

export default function Blossom({ branch, side, className = '', speed = -20 }: BlossomProps) {
  const [width, height] = SIZE[branch];
  return (
    <div className={`blossom ${className}`} data-blossom={side} data-speed={speed} aria-hidden="true">
      <div className="blossom-slide">
        <img className="blossom-sway" src={`/blossom/branch-${branch}.svg`} alt="" width={width} height={height} loading="lazy" decoding="async" draggable={false} />
      </div>
    </div>
  );
}
