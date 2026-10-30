import { Fragment } from 'react';

interface SplitTextProps {
  /** Use "\n" for a hard line break. */
  text: string;
  by?: 'chars' | 'words';
  className?: string;
  lineClassName?: string;
  /** Words (ignoring punctuation and case) to set in the gold accent. */
  gold?: string[];
}

const bare = (word: string) => word.replace(/[^a-z0-9]/gi, '').toLowerCase();

/**
 * Renders text as animatable spans while keeping one readable copy for assistive tech.
 * Lines become `.split-line`, words `.split-word`, glyphs `.split-char`.
 */
export default function SplitText({ text, by = 'chars', className = '', lineClassName = '', gold = [] }: SplitTextProps) {
  const lines = text.split('\n');
  const golden = new Set(gold.map(bare));
  return (
    <span className={`split ${className}`}>
      <span className="sr-only">{text.replace(/\n/g, ' ')}</span>
      <span aria-hidden="true">
        {lines.map((line, li) => (
          <span key={li} className={`split-line ${lineClassName}`}>
            {line.split(' ').map((word, wi, words) => (
              <Fragment key={wi}>
                <span className={golden.has(bare(word)) ? 'split-word gold-text' : 'split-word'}>
                  {by === 'chars' ? Array.from(word).map((char, ci) => <span key={ci} className="split-char">{char}</span>) : word}
                </span>
                {wi < words.length - 1 && ' '}
              </Fragment>
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}
