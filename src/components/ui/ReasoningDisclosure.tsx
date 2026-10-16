import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useT } from '../../i18n';

// The thinking behind an answer, folded by default: the card's face is the
// answer, reasoning is backstage. Rendered only when the model emitted it
// (data-driven adaptation, no capability registry) and NEVER sent anywhere:
// not into context, fingerprints, summaries or exports beyond raw JSON.
//
// An opened disclosure renders as continuous text and the SURFACE's own scroll
// region carries the length — the card page, the panel and the reading view all
// scroll, so a long chain of thought reads top to bottom and any stretch of it
// can be selected and asked about. Capping it here would plant a second,
// narrower scrollbar inside the surface's own scrollbar.
export default function ReasoningDisclosure({ text }: { text: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2 nopan">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex items-center gap-1 text-2xs text-ink-faint hover:text-ink-muted transition-colors"
        data-reasoning-toggle
      >
        {open ? <ChevronDown size={12} strokeWidth={1.75} /> : <ChevronRight size={12} strokeWidth={1.75} />}
        <span>{'\u{1F4AD}'} {t('node.reasoning')}</span>
      </button>
      {open && (
        <div
          className="mt-1.5 px-3 py-2 bg-wash/70 rounded-xl text-xs text-ink-faint italic leading-relaxed whitespace-pre-wrap break-words nowheel nodrag cursor-text"
          data-reasoning-body
        >
          {text}
        </div>
      )}
    </div>
  );
}
