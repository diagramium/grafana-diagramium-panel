/**
 * Matching: which data belongs to which shape.
 *
 * Every signal (one reduced number from a series, or one cell of a table row)
 * carries a set of KEYS — the strings that name the thing it measures: label
 * values, the series name, the query's refId, a table row's text columns. A
 * shape matches a signal when one of its PATTERNS equals one of those keys.
 *
 * A shape's patterns are its mapping's `match` (comma-separated), else its
 * own label and id — so a diagram whose shapes are named after the services
 * works with no configuration at all. Comparison is forgiving on purpose:
 * case, punctuation and a trailing :port are ignored, so the shape
 * "API Gateway" matches service="api-gateway" and instance="api-gateway:8080".
 */

/** Labels tried, in order, when the panel's "Match by" is left on auto. */
export const AUTO_LABELS = [
  'service',
  'service_name',
  'app',
  'application',
  'container',
  'container_name',
  'name',
  'pod',
  'deployment',
  'host',
  'hostname',
  'instance',
  'node',
  'nodename',
  'device',
  'job',
];

/** "API-Gateway:8080" -> "apigateway8080"; the forgiving form every comparison uses. */
export function norm(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/** Every key a raw name contributes: itself, and without a :port or a domain suffix. */
export function keysOf(raw: string): string[] {
  const s = String(raw ?? '').trim();
  if (!s) {
    return [];
  }
  const out = new Set<string>([norm(s)]);
  const noPort = s.replace(/:\d+$/, '');
  out.add(norm(noPort));
  // host.example.internal -> host (an IP address keeps its dots)
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(noPort) && noPort.includes('.')) {
    out.add(norm(noPort.split('.')[0]));
  }
  out.delete('');
  return [...out];
}

export type Pattern = { kind: 'exact'; key: string } | { kind: 'regex'; re: RegExp };

/** Parse a mapping's match text. `/re/i` is a regex on the RAW key; `*` is a wildcard. */
export function parsePatterns(text: string): Pattern[] {
  const out: Pattern[] = [];
  for (const part of splitPatterns(text)) {
    const rx = /^\/(.+)\/([a-z]*)$/.exec(part);
    if (rx) {
      try {
        out.push({ kind: 'regex', re: new RegExp(rx[1], rx[2].replace(/[gy]/g, '')) });
      } catch {
        /* an invalid expression matches nothing */
      }
      continue;
    }
    if (part.includes('*')) {
      const body = part
        .split('*')
        .map((p) => norm(p))
        .join('.*');
      out.push({ kind: 'regex', re: new RegExp(`^${body}$`) });
      continue;
    }
    const key = norm(part);
    if (key) {
      out.push({ kind: 'exact', key });
    }
  }
  return out;
}

/** Commas separate patterns, except inside a /regex/. */
function splitPatterns(text: string): string[] {
  const t = String(text ?? '').trim();
  if (!t) {
    return [];
  }
  if (/^\/.+\/[a-z]*$/.test(t)) {
    return [t];
  }
  return t
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The patterns a shape answers to. */
export function nodePatterns(node: { id: string; label: string }, match?: string): Pattern[] {
  if (match && match.trim()) {
    return parsePatterns(match);
  }
  const label = node.label.replace(/\s+/g, ' ').trim();
  const first = node.label.split('\n')[0].trim();
  const out: Pattern[] = [];
  for (const s of new Set([label, first, node.id])) {
    const key = norm(s);
    if (key) {
      out.push({ kind: 'exact', key });
    }
  }
  return out;
}

/** Does one signal (its raw names + normalised keys) answer to these patterns? */
export function matches(patterns: Pattern[], raw: string[], keys: string[]): boolean {
  for (const p of patterns) {
    if (p.kind === 'exact') {
      if (keys.includes(p.key)) {
        return true;
      }
    } else {
      // A wildcard is compiled against normalised keys, a /regex/ against raw names.
      if (keys.some((k) => p.re.test(k)) || raw.some((r) => p.re.test(r))) {
        return true;
      }
    }
  }
  return false;
}
