import React from 'react';
import type { JSX } from 'react';
import type { StyleEntry } from '@/lib/styles/styleCatalog';

/**
 * Clean architectural elevation for each style, drawn in a soft, shared palette.
 * Vector art keeps the gallery light on phones and always shows the right style.
 */

const INK = '#4A4743';
const SHADE = 'rgba(60, 50, 40, 0.10)';
const GLASS = '#C9DCE6';
const GLASS_DEEP = '#A9C4D2';
const TIMBER = '#B58B62';
const TIMBER_DARK = '#8E6A49';
const STONE = '#D6D0C2';
const LEAF = '#7C9A74';
const LEAF_DARK = '#5F7F5E';
const GROUND = '#E6E1D5';

const GROUND_Y = 470;

function Palm({ x, h = 250, s = 1 }: { x: number; h?: number; s?: number }) {
  const top = GROUND_Y - h;
  return (
    <g transform={`translate(${x} 0) scale(${s} 1)`}>
      <path d={`M0 ${GROUND_Y} Q ${6 * s} ${GROUND_Y - h / 2} 0 ${top}`} stroke="#9A8467" strokeWidth="7" fill="none" strokeLinecap="round" />
      {[-62, -38, -14, 14, 38, 62].map((a) => (
        <path key={a} d={`M0 ${top} q ${a * 0.9} ${-34 + Math.abs(a) * 0.3} ${a * 1.5} ${14 + Math.abs(a) * 0.4}`} stroke={LEAF_DARK} strokeWidth="6" fill="none" strokeLinecap="round" />
      ))}
    </g>
  );
}

function Tree({ x, r = 44, h = 70 }: { x: number; r?: number; h?: number }) {
  return (
    <g>
      <rect x={x - 3} y={GROUND_Y - h} width="6" height={h} fill="#9A8467" />
      <circle cx={x} cy={GROUND_Y - h - r * 0.6} r={r} fill={LEAF} />
      <circle cx={x - r * 0.5} cy={GROUND_Y - h - r * 0.2} r={r * 0.62} fill={LEAF_DARK} opacity=".55" />
    </g>
  );
}

function Shrubs({ xs, y = GROUND_Y }: { xs: number[]; y?: number }) {
  return (
    <g>
      {xs.map((x, i) => (
        <ellipse key={x} cx={x} cy={y - 8} rx={26 + (i % 2) * 8} ry={14 + (i % 3) * 3} fill={i % 2 ? LEAF : LEAF_DARK} opacity=".9" />
      ))}
    </g>
  );
}

function Window({ x, y, w, h, frame = INK, glass = GLASS, bars = 2 }: { x: number; y: number; w: number; h: number; frame?: string; glass?: string; bars?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={glass} stroke={frame} strokeWidth="3" />
      {Array.from({ length: bars - 1 }, (_, i) => (
        <line key={i} x1={x + (w / bars) * (i + 1)} y1={y} x2={x + (w / bars) * (i + 1)} y2={y + h} stroke={frame} strokeWidth="2" />
      ))}
    </g>
  );
}

/** Horizontal tile courses, clipped to the roof polygon so they never spill past its edges. */
function Roof({ id, points, fill, courses, step = 13, shadow }: { id: string; points: string; fill: string; courses: string; step?: number; shadow: string }) {
  const ys = points.split(' ').map((p) => Number(p.split(',')[1]));
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const rows: React.ReactNode[] = [];
  for (let y = top + step; y < bottom; y += step) rows.push(<line key={y} x1="0" y1={y} x2="800" y2={y} stroke={courses} strokeWidth="1.5" opacity=".5" />);
  return (
    <g>
      <clipPath id={id}><polygon points={points} /></clipPath>
      <polygon points={points} fill={fill} />
      <g clipPath={`url(#${id})`}>{rows}</g>
      <polygon points={points} fill="none" stroke={shadow} strokeWidth="1.5" opacity=".35" />
    </g>
  );
}

function Kerala({ t }: { t: StyleEntry['tint'] }) {
  return (
    <g>
      <Palm x={705} h={280} />
      <Palm x={92} h={210} s={0.9} />
      {/* upper block */}
      <rect x="250" y="240" width="300" height="130" fill={t.wall} />
      <Roof id="k-up" points="215,242 292,150 508,150 585,242" fill={t.roof} courses="#6E3F2C" shadow="#5A301F" />
      <rect x="215" y="240" width="370" height="7" fill="#7E4A36" />
      <Window x={285} y={268} w={46} h={56} frame="#7A4B33" glass="#B9CDD6" />
      <Window x={385} y={268} w={46} h={56} frame="#7A4B33" glass="#B9CDD6" />
      <Window x={485} y={268} w={46} h={56} frame="#7A4B33" glass="#B9CDD6" />
      {/* lower block */}
      <rect x="180" y="330" width="440" height="140" fill={t.wall} />
      <rect x="180" y="430" width="440" height="40" fill={STONE} />
      <rect x="205" y="372" width="390" height="58" fill="#E3DCCB" />
      <rect x="375" y="378" width="50" height="52" rx="2" fill={TIMBER} stroke={TIMBER_DARK} strokeWidth="2" />
      <Window x={238} y={384} w={44} h={38} frame="#7A4B33" glass="#B9CDD6" bars={2} />
      <Window x={518} y={384} w={44} h={38} frame="#7A4B33" glass="#B9CDD6" bars={2} />
      {/* sit-out roof */}
      <Roof id="k-low" points="140,386 214,322 586,322 660,386" fill={t.roof} courses="#6E3F2C" step={12} shadow="#5A301F" />
      <rect x="140" y="384" width="520" height="7" fill="#7E4A36" />
      {[205, 290, 510, 595].map((x) => (
        <rect key={x} x={x - 5} y="391" width="10" height="42" fill={TIMBER_DARK} />
      ))}
      <rect x="150" y="468" width="500" height="6" fill="#CFC8B8" />
      <Shrubs xs={[135, 665]} />
    </g>
  );
}

function Modern({ t }: { t: StyleEntry['tint'] }) {
  return (
    <g>
      <Tree x={100} r={46} h={80} />
      {/* ground box */}
      <rect x="170" y="352" width="330" height="118" fill={t.wall} />
      <rect x="196" y="372" width="170" height="98" fill={GLASS} stroke={INK} strokeWidth="3" />
      {[1, 2, 3].map((i) => (
        <line key={i} x1={196 + 42.5 * i} y1="372" x2={196 + 42.5 * i} y2="470" stroke={INK} strokeWidth="2" />
      ))}
      <rect x="392" y="392" width="84" height="78" fill={TIMBER} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={i} x1="392" y1={402 + i * 12} x2="476" y2={402 + i * 12} stroke={TIMBER_DARK} strokeWidth="1.5" opacity=".6" />
      ))}
      {/* upper box, cantilevered */}
      <rect x="270" y="222" width="420" height="130" fill={t.wall} />
      <rect x="270" y="222" width="420" height="8" fill={INK} />
      <rect x="296" y="248" width="230" height="84" fill={GLASS} stroke={INK} strokeWidth="3" />
      {[1, 2, 3, 4].map((i) => (
        <line key={i} x1={296 + 46 * i} y1="248" x2={296 + 46 * i} y2="332" stroke={INK} strokeWidth="2" />
      ))}
      <rect x="560" y="248" width="104" height="84" fill="#CFC8B8" />
      <rect x="270" y="352" width="420" height="8" fill="#BDB6A6" />
      <rect x="500" y="352" width="190" height="6" fill={SHADE} />
      <rect x="150" y="468" width="560" height="6" fill="#CFC8B8" />
      <Shrubs xs={[565, 640]} />
    </g>
  );
}

function Minimalist({ t }: { t: StyleEntry['tint'] }) {
  return (
    <g>
      <Tree x={662} r={40} h={92} />
      <rect x="190" y="250" width="420" height="220" fill={t.wall} />
      <rect x="190" y="242" width="420" height="10" fill="#C9C7C0" />
      <rect x="190" y="252" width="420" height="5" fill={SHADE} />
      <rect x="230" y="316" width="210" height="34" fill={GLASS} stroke={INK} strokeWidth="2.5" />
      <rect x="480" y="352" width="74" height="118" fill="#8F8D87" />
      <rect x="465" y="342" width="104" height="8" fill="#C9C7C0" />
      <rect x="465" y="350" width="104" height="4" fill={SHADE} />
      <rect x="230" y="406" width="150" height="64" fill={SHADE} />
      <rect x="170" y="468" width="460" height="6" fill="#CFC8B8" />
      <Shrubs xs={[190, 600]} />
    </g>
  );
}

function Contemporary({ t }: { t: StyleEntry['tint'] }) {
  return (
    <g>
      <Tree x={90} r={42} h={86} />
      {/* left lower volume */}
      <rect x="160" y="340" width="260" height="130" fill={t.wall} />
      <rect x="160" y="332" width="260" height="10" fill={t.roof} />
      <rect x="184" y="366" width="170" height="104" fill={GLASS} stroke={INK} strokeWidth="3" />
      <line x1="269" y1="366" x2="269" y2="470" stroke={INK} strokeWidth="2" />
      {/* right upper volume, offset */}
      <rect x="360" y="200" width="320" height="170" fill="#E6E0D3" />
      <polygon points="350,200 690,200 690,176 350,188" fill={t.roof} />
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x={384 + i * 10} y="226" width="5" height="112" fill={TIMBER} />
      ))}
      <rect x="560" y="226" width="96" height="112" fill={GLASS} stroke={INK} strokeWidth="3" />
      <rect x="350" y="370" width="340" height="9" fill="#B5AE9E" />
      {/* lower right recess under overhang */}
      <rect x="420" y="379" width="260" height="91" fill="#DDD6C8" />
      <rect x="450" y="396" width="110" height="74" fill={GLASS} stroke={INK} strokeWidth="3" />
      <rect x="600" y="388" width="60" height="82" fill={t.accent} opacity=".7" />
      <rect x="140" y="468" width="560" height="6" fill="#CFC8B8" />
      <Shrubs xs={[440, 598, 668]} />
    </g>
  );
}

function Colonial({ t }: { t: StyleEntry['tint'] }) {
  const shutters = (x: number, y: number) => (
    <g>
      <rect x={x - 14} y={y} width="12" height="58" fill={t.accent} />
      <rect x={x + 44} y={y} width="12" height="58" fill={t.accent} />
      <Window x={x} y={y} w={42} h={58} frame="#FFFFFF" glass={GLASS} bars={2} />
    </g>
  );
  return (
    <g>
      <Tree x={78} r={46} h={86} />
      <Tree x={724} r={46} h={86} />
      <rect x="180" y="250" width="440" height="220" fill={t.wall} />
      <Roof id="c-roof" points="150,250 250,166 550,166 650,250" fill={t.roof} courses="#6E4636" step={14} shadow="#553426" />
      <rect x="150" y="248" width="500" height="7" fill="#8A5B47" />
      {[200, 262, 496, 558].map((x) => shutters(x, 280))}
      {[200, 262, 496, 558].map((x) => shutters(x, 382))}
      {/* portico */}
      <polygon points="320,276 400,222 480,276" fill="#F8F5EE" stroke="#CFC8B8" strokeWidth="2" />
      <rect x="320" y="276" width="160" height="12" fill="#F8F5EE" stroke="#CFC8B8" strokeWidth="2" />
      {[332, 372, 412, 452].map((x) => (
        <rect key={x} x={x - 6} y="288" width="12" height="170" fill="#FBF9F4" stroke="#D5CEBF" strokeWidth="1.5" />
      ))}
      <rect x="375" y="360" width="50" height="98" rx="25" fill={TIMBER} stroke={TIMBER_DARK} strokeWidth="2" />
      <rect x="300" y="458" width="200" height="12" fill={STONE} />
      <rect x="284" y="466" width="232" height="8" fill="#CFC8B8" />
      <Shrubs xs={[200, 250, 560, 600]} />
    </g>
  );
}

function Tropical({ t }: { t: StyleEntry['tint'] }) {
  return (
    <g>
      <Palm x={86} h={270} />
      <Palm x={726} h={230} s={0.9} />
      <Palm x={660} h={170} s={0.8} />
      {/* wide eave */}
      <polygon points="120,282 400,230 680,282 680,298 120,298" fill={t.roof} />
      <rect x="120" y="296" width="560" height="6" fill="#6D5640" />
      {/* open pavilion body */}
      <rect x="170" y="302" width="460" height="168" fill="#EAE4D4" />
      <rect x="200" y="320" width="230" height="150" fill={GLASS} stroke={INK} strokeWidth="3" />
      {[1, 2, 3, 4].map((i) => (
        <line key={i} x1={200 + 46 * i} y1="320" x2={200 + 46 * i} y2="470" stroke={INK} strokeWidth="2" />
      ))}
      {Array.from({ length: 11 }, (_, i) => (
        <rect key={i} x={452 + i * 14} y="320" width="8" height="150" fill={TIMBER} />
      ))}
      {[170, 630].map((x) => (
        <rect key={x} x={x - 5} y="298" width="10" height="172" fill={TIMBER_DARK} />
      ))}
      <ellipse cx="400" cy="488" rx="260" ry="9" fill={GLASS_DEEP} opacity=".55" />
      <Shrubs xs={[150, 222, 580, 640]} />
    </g>
  );
}

function TraditionalIndian({ t }: { t: StyleEntry['tint'] }) {
  const arch = (x: number, y: number, w: number, h: number) => (
    <g>
      <path d={`M${x} ${y + h} V${y + w / 2} a${w / 2} ${w / 2} 0 0 1 ${w} 0 V${y + h} Z`} fill="#DCC7A8" stroke={t.accent} strokeWidth="2.5" />
      {[1, 2, 3].map((i) => (
        <line key={i} x1={x + (w / 4) * i} y1={y + w / 2 - 4} x2={x + (w / 4) * i} y2={y + h} stroke={t.accent} strokeWidth="1.5" opacity=".7" />
      ))}
    </g>
  );
  const chhatri = (cx: number, base: number) => (
    <g>
      <rect x={cx - 28} y={base - 36} width="56" height="6" fill={STONE} />
      {[-22, 0, 22].map((d) => (
        <rect key={d} x={cx + d - 3} y={base - 30} width="6" height="30" fill="#E8DBC4" />
      ))}
      <path d={`M${cx - 30} ${base - 36} a30 30 0 0 1 60 0 Z`} fill={t.roof} />
      <rect x={cx - 2} y={base - 78} width="4" height="12" fill={t.accent} />
    </g>
  );
  return (
    <g>
      <Tree x={82} r={42} h={86} />
      <Tree x={722} r={42} h={86} />
      <rect x="170" y="250" width="460" height="220" fill={t.wall} />
      <rect x="160" y="238" width="480" height="14" fill="#DCCBAF" />
      <rect x="160" y="252" width="480" height="5" fill={SHADE} />
      {chhatri(200, 238)}
      {chhatri(400, 238)}
      {chhatri(600, 238)}
      <rect x="170" y="338" width="460" height="10" fill="#DCCBAF" />
      {[1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <rect x={150 + i * 70 + 4} y={266} width="46" height="58" fill="#DCC7A8" stroke={t.accent} strokeWidth="2.5" />
          {[1, 2, 3].map((j) => (
            <line key={j} x1={150 + i * 70 + 4 + 11.5 * j} y1={266} x2={150 + i * 70 + 4 + 11.5 * j} y2={324} stroke={t.accent} strokeWidth="1.5" opacity=".7" />
          ))}
        </g>
      ))}
      {arch(222, 366, 62, 104)}
      {arch(369, 366, 62, 104)}
      {arch(516, 366, 62, 104)}
      <rect x="160" y="468" width="480" height="6" fill="#CFC8B8" />
      <Shrubs xs={[150, 650]} />
    </g>
  );
}

function ModernLuxury({ t }: { t: StyleEntry['tint'] }) {
  return (
    <g>
      <Tree x={80} r={42} h={96} />
      <Tree x={730} r={38} h={80} />
      {/* base with stone */}
      <rect x="140" y="360" width="520" height="110" fill="#E4DED1" />
      <rect x="140" y="360" width="190" height="110" fill="#CFC8B8" />
      {Array.from({ length: 5 }, (_, i) => (
        <line key={i} x1="140" y1={380 + i * 20} x2="330" y2={380 + i * 20} stroke="#B9B2A2" strokeWidth="1.5" />
      ))}
      <rect x="352" y="378" width="270" height="92" fill={GLASS} stroke={INK} strokeWidth="3" />
      {[1, 2, 3, 4, 5].map((i) => (
        <line key={i} x1={352 + 45 * i} y1="378" x2={352 + 45 * i} y2="470" stroke={INK} strokeWidth="2" />
      ))}
      {/* upper volume with double-height glass */}
      <rect x="230" y="176" width="440" height="184" fill="#F1EEE6" />
      <rect x="210" y="162" width="480" height="14" fill={INK} />
      <rect x="436" y="196" width="196" height="164" fill={GLASS} stroke={INK} strokeWidth="3" />
      {[1, 2, 3, 4].map((i) => (
        <line key={i} x1={436 + 39.2 * i} y1="196" x2={436 + 39.2 * i} y2="360" stroke={INK} strokeWidth="2" />
      ))}
      <line x1="436" y1="278" x2="632" y2="278" stroke={INK} strokeWidth="2" />
      <rect x="260" y="212" width="146" height="60" fill={GLASS} stroke={INK} strokeWidth="3" />
      <rect x="260" y="292" width="146" height="60" fill="#DDD6C8" />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x="260" y={296 + i * 9} width="146" height="3" fill={TIMBER} />
      ))}
      <rect x="140" y="470" width="560" height="6" fill="#CFC8B8" />
      <rect x="190" y="484" width="420" height="22" fill={GLASS_DEEP} opacity=".6" />
      <Shrubs xs={[150, 668]} />
    </g>
  );
}

const SCENES: Record<string, (props: { t: StyleEntry['tint'] }) => JSX.Element> = {
  'kerala-traditional': Kerala,
  modern: Modern,
  minimalist: Minimalist,
  contemporary: Contemporary,
  colonial: Colonial,
  tropical: Tropical,
  'traditional-indian': TraditionalIndian,
  'modern-luxury': ModernLuxury
};

export default function StyleIllustration({ style, className = '', title }: { style: Pick<StyleEntry, 'slug' | 'name' | 'tint'>; className?: string; title?: string }) {
  const Scene = SCENES[style.slug] ?? Modern;
  const gradId = `sky-${style.slug}`;
  return (
    <svg
      className={className}
      viewBox="0 0 800 600"
      role="img"
      aria-label={title ?? `${style.name} house elevation`}
      preserveAspectRatio="xMidYMid slice"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={style.tint.sky} />
          <stop offset="1" stopColor="#F6F3EC" />
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill={`url(#${gradId})`} />
      <circle cx="640" cy="120" r="46" fill="#FFFFFF" opacity=".55" />
      <circle cx="640" cy="120" r="30" fill="#FFFFFF" opacity=".7" />
      <rect y={GROUND_Y} width="800" height={600 - GROUND_Y} fill={GROUND} />
      <rect y={GROUND_Y} width="800" height="2" fill="#D3CDBE" />
      <ellipse cx="400" cy={GROUND_Y + 4} rx="320" ry="10" fill={SHADE} />
      <Scene t={style.tint} />
    </svg>
  );
}
