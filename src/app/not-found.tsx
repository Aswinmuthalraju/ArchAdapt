import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-[100svh] flex items-center justify-center bg-[#F4F1EA] px-6 text-center">
      <div className="max-w-md">
        <p className="text-[11px] tracking-[0.2em] uppercase text-stone-500">404</p>
        <h1 className="font-serif text-3xl mt-4 text-stone-900">We could not find that page</h1>
        <p className="text-sm text-stone-600 mt-3 leading-relaxed">The link may be old. These will get you back on track.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="px-5 py-3 bg-plum-900 text-white text-sm min-h-[44px] inline-flex items-center">Home</Link>
          <Link href="/styles" className="px-5 py-3 border border-stone-400 text-sm text-stone-800 min-h-[44px] inline-flex items-center">Browse styles</Link>
        </div>
      </div>
    </main>
  );
}
