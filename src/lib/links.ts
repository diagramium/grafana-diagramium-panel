/**
 * Drill-down links.
 *
 * A shape's own link wins, else the panel's default template. The template
 * can name the shape — ${__node.id}, ${__node.label}, ${__node.match} (the
 * first thing it matches in the data, else its label) and ${__node.status} —
 * and everything Grafana interpolates on top: dashboard variables,
 * ${__url_time_range}, ${__from}/${__to}. The shape's values are URL-encoded,
 * because they land in paths and query strings.
 */

export interface LinkNode {
  id: string;
  label: string;
  match: string;
  status: string;
}

const NODE_VAR = /\$\{__node\.(id|label|match|status)(?::(raw))?\}/g;

export function interpolateNode(template: string, node: LinkNode): string {
  return template.replace(NODE_VAR, (_m, key: keyof LinkNode, raw?: string) => {
    const v = String(node[key] ?? '');
    return raw ? v : encodeURIComponent(v);
  });
}

export function resolveLink(
  own: string | undefined,
  fallback: string | undefined,
  node: LinkNode,
  replaceVariables: (s: string) => string
): string {
  const template = (own && own.trim()) || (fallback && fallback.trim()) || '';
  if (!template) {
    return '';
  }
  return replaceVariables(interpolateNode(template, node)).trim();
}

/** Only web links; a `javascript:` or `data:` URL from a pasted dashboard never runs. */
export function isSafeLink(url: string): boolean {
  if (/^\s*(javascript|data|vbscript):/i.test(url)) {
    return false;
  }
  return /^(https?:\/\/|\/|\.{0,2}\/|\?|#)/i.test(url) || !/^[a-z][a-z0-9+.-]*:/i.test(url);
}

/** Same-origin (or relative) links navigate inside Grafana without a reload. */
export function internalPath(url: string, origin: string): string | null {
  if (url.startsWith('/') && !url.startsWith('//')) {
    return url;
  }
  try {
    const u = new URL(url);
    if (u.origin === origin) {
      return u.pathname + u.search + u.hash;
    }
  } catch {
    /* not absolute */
  }
  return null;
}
