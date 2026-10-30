'use client';

import Link from 'next/link';
import { ArrowUp } from 'lucide-react';
import SplitText from '@/components/motion/SplitText';
import { scrollToTop } from '@/lib/motion';

const CTA = 'Start\nyour plan';

/** Plum footer: giant letter-by-letter CTA with a gold sweep, fine-print grid and back to top. */
export default function SiteFooter() {
  return (
    <footer className="site-footer" data-section="Start" data-header="ivory">
      <div className="footer-cta-wrap">
        <p className="label label--gold">Ready when you are</p>
        <Link href="/onboarding" className="footer-cta" data-cta data-cursor="Start">
          <span className="cta-base display"><SplitText text={CTA} /></span>
          <span className="cta-sweep" aria-hidden="true">
            <span className="cta-sweep-inner display">{CTA.split('\n').map((line) => <span key={line} className="split-line">{line}</span>)}</span>
          </span>
        </Link>
      </div>
      <div className="footer-grid">
        <div>
          <p className="label label--gold">Explore</p>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/styles">Styles</Link>
          <Link href="/modes">Design modes</Link>
        </div>
        <div>
          <p className="label label--gold">Account</p>
          <Link href="/login">Sign in</Link>
          <Link href="/register">Create an account</Link>
          <Link href="/dashboard">My projects</Link>
        </div>
        <div>
          <p className="label label--gold">A note</p>
          <p>Concept plans for early design. Review with your architect before construction.</p>
        </div>
        <div className="footer-end">
          <button type="button" className="footer-top" onClick={scrollToTop} data-magnetic>
            <ArrowUp size={14} aria-hidden="true" /> Back to top
          </button>
          <p>© {new Date().getFullYear()} ArchAdapt AI</p>
        </div>
      </div>
    </footer>
  );
}
