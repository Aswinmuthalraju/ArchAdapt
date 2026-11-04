import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import StyleDetail from '@/components/styles/StyleDetail';
import { STYLE_CATALOG, styleBySlug } from '@/lib/styles/styleCatalog';

export const dynamicParams = false;

export function generateStaticParams() {
  return STYLE_CATALOG.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const style = styleBySlug(slug);
  if (!style) return { title: 'Style not found | ArchAdapt AI' };
  return { title: `${style.name} | ArchAdapt AI`, description: style.overview };
}

export default async function StylePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const style = styleBySlug(slug);
  if (!style) notFound();
  const index = STYLE_CATALOG.findIndex((s) => s.slug === style.slug);
  const next = STYLE_CATALOG[(index + 1) % STYLE_CATALOG.length];
  const prev = STYLE_CATALOG[(index + STYLE_CATALOG.length - 1) % STYLE_CATALOG.length];
  return <StyleDetail style={style} index={index} next={next} prev={prev} />;
}
