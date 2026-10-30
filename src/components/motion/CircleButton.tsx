import Link from 'next/link';
import { useId } from 'react';

interface CircleButtonProps {
  href: string;
  label: string;
  /** Text that runs around the ring; repeated to fill it. */
  ring: string;
  tone?: 'ink' | 'ivory';
  className?: string;
}

/** Circular outlined link with slowly rotating ring text and a gold wipe on hover. */
export default function CircleButton({ href, label, ring, tone = 'ink', className = '' }: CircleButtonProps) {
  const id = `ring${useId().replace(/:/g, '')}`;
  return (
    <Link href={href} className={`circle-btn circle-btn--${tone} ${className}`} data-magnetic data-cursor="">
      <svg className="circle-btn-ring" viewBox="0 0 100 100" aria-hidden="true">
        <defs><path id={id} d="M50,50 m-40,0 a40,40 0 1,1 80,0 a40,40 0 1,1 -80,0" /></defs>
        <text><textPath href={`#${id}`} textLength="249" lengthAdjust="spacing">{ring}</textPath></text>
      </svg>
      <span className="circle-btn-label">{label}</span>
    </Link>
  );
}
