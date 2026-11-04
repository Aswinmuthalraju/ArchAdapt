import Image from 'next/image';
import type { StyleEntry } from '@/lib/styles/styleCatalog';

/** Real photograph for a style. Files live in public/images/styles/<slug>.jpg (credits in CREDITS.md there). */
export default function StylePhoto({ style, sizes, priority = false }: { style: StyleEntry; sizes: string; priority?: boolean }) {
  return <Image src={`/images/styles/${style.slug}.jpg`} alt={`${style.name} house`} fill sizes={sizes} quality={72} priority={priority} />;
}
