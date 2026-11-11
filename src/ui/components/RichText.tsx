import { CLASSES } from '@/content/classes';

const KEYWORDS = new Set([
  'Burn',
  'Burning',
  'Poison',
  'Frost',
  'Frozen',
  'Lightning',
  'Crit',
  'Crits',
  'Shield',
  'Shielded',
  'Qi Shield',
  'Surge',
  'Enlightenment',
  'Meditation',
  'Dao Companion',
  'Companion',
  'Heal',
  'Taunt',
  'Omnivamp',
  'Execute',
  'Qi',
  'Stun',
  'Stunning',
  'Weaken',
  'Sunder',
  'Sunders',
  'Cleanse',
  'Cleanses',
  'Bleed',
  'Stall',
  'Resonance',
  'Seal',
  'Seals',
  'Sealed',
  'Reflection',
  'Reflections',
]);

const KEYWORD_CLASS: Record<string, string> = {
  Burning: 'Burn',
  Frozen: 'Frost',
  Crits: 'Crit',
  Shielded: 'Shield',
  'Qi Shield': 'Shield',
  'Dao Companion': 'Companion',
  Stunning: 'Lightning',
  Stun: 'Lightning',
  Weaken: 'Poison',
  Sunder: 'Crit',
  Sunders: 'Crit',
  Cleanse: 'Heal',
  Cleanses: 'Heal',
  Bleed: 'Omnivamp',
  Stall: 'Enlightenment',
  Seals: 'Seal',
  Sealed: 'Seal',
  Reflections: 'Reflection',
};

const CLASS_NAMES = new Map<string, string>();
for (const c of Object.values(CLASSES)) {
  CLASS_NAMES.set(c.name, c.id);
  CLASS_NAMES.set(c.name + 's', c.id);
}

/**
 * Renders a description string. Tokens in [brackets] are highlighted:
 * known keywords get their color class, class names gold, everything else (numbers) bold.
 */
export function RichText({ text, class: cls }: { text: string; class?: string }) {
  const parts: preact.ComponentChildren[] = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[1];
    const kwMatch = matchKeyword(token);
    if (kwMatch) parts.push(<span key={i++} class={`kw kw-${KEYWORD_CLASS[kwMatch] ?? kwMatch}`}>{token}</span>);
    else if (CLASS_NAMES.has(token)) parts.push(<span key={i++} class="kw kw-class">{token}</span>);
    else parts.push(<span key={i++} class="kw kw-num">{token}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span class={cls}>{parts}</span>;
}

function matchKeyword(token: string): string | null {
  if (KEYWORDS.has(token)) return token;
  // e.g. "Surge (6)", "Enlightenment (12)", "3 Poison", "20 Frost", "+1 Range"
  const words = token.replace(/\(.*?\)/g, '').trim().split(/\s+/);
  for (const w of words) {
    const clean = w.replace(/[^A-Za-z]/g, '');
    if (KEYWORDS.has(clean)) return clean;
  }
  return null;
}
