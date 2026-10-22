// Text with Wikipedia previews on names and places: hover on desktop, tap on a phone. Works offline (bundled leads).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { linkTerms, type WikiTerm } from '../domain/wikiTerms';

export function WikiText({ text }: { text: string }) {
  const parts = useMemo(() => linkTerms(text), [text]);
  return <>{parts.map((p, i) => (typeof p === 'string' ? p : <Term key={i} text={p.text} term={p.term} />))}</>;
}

const canHover = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;

function Term({ text, term }: { text: string; term: WikiTerm }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hover = (on: boolean) => {
    if (!canHover()) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(on), on ? 250 : 150);
  };

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <span class="wiki-term" ref={ref} onMouseEnter={() => hover(true)} onMouseLeave={() => hover(false)}>
      <button type="button" class="wiki-term__name" aria-expanded={open} onClick={() => setOpen(!open)}>{text}</button>
      {open && (
        <span class="wiki-pop" role="note">
          <span class="wiki-pop__head">
            <strong>{term.title}</strong>
            <button type="button" class="icon-btn" aria-label="Sluiten" onClick={() => setOpen(false)}>×</button>
          </span>
          {term.description && <span class="meta">{term.description}</span>}
          <span class="wiki-pop__text" lang={term.lang}>{term.extract}{term.truncated ? ' …' : ''}</span>
          <span class="wiki-pop__src">
            <a href={term.url} target="_blank" rel="noopener noreferrer">Wikipedia{term.lang === 'en' ? ' (Engels)' : ''}</a>,{' '}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.nl" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>. Achtergrond, geen bron.
          </span>
        </span>
      )}
    </span>
  );
}
