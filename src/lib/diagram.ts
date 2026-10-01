/**
 * The diagram: loading it, and pairing its shapes with the data.
 */
import { useEffect, useMemo, useState } from 'react';
import { parseDiagram, type LayoutNode, type NormalizedDiagram } from 'diagramium-player';
import { NodeMapping } from '../types';
import { matches, nodePatterns } from './match';
import { Signal } from './signals';
import { NodeStatus, reduceStatus } from './status';

export interface DiagramLoad {
  /** The document as parsed JSON (what the player is given). */
  doc: unknown | null;
  /** Its normalised form: shapes, connectors, steps. */
  diagram: NormalizedDiagram | null;
  error: string | null;
  loading: boolean;
}

function parse(text: string): { doc: unknown; diagram: NormalizedDiagram } {
  const doc = JSON.parse(text);
  return { doc, diagram: parseDiagram(doc) };
}

function parseSafe(text: string): DiagramLoad {
  const t = (text || '').trim();
  if (!t) {
    return { doc: null, diagram: null, error: null, loading: false };
  }
  try {
    return { ...parse(t), error: null, loading: false };
  } catch (e: any) {
    return { doc: null, diagram: null, error: String(e?.message ?? e), loading: false };
  }
}

/** Parse the inline diagram, or fetch it from a URL. */
export function useDiagram(source: 'inline' | 'url', inline: string, url: string): DiagramLoad {
  const u = source === 'url' ? (url || '').trim() : '';
  // What the URL returned, remembered with the URL it came from.
  const [fetched, setFetched] = useState<{ url: string; text: string | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!u) {
      return;
    }
    let live = true;
    fetch(u, { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status} loading ${u}`);
        }
        return r.text();
      })
      .then((text) => live && setFetched({ url: u, text, error: null }))
      .catch((e) => live && setFetched({ url: u, text: null, error: String(e?.message ?? e) }));
    return () => {
      live = false;
    };
  }, [u]);

  const inlineLoad = useMemo(() => (source === 'url' ? null : parseSafe(inline)), [source, inline]);
  const urlLoad = useMemo<DiagramLoad | null>(() => {
    if (source !== 'url') {
      return null;
    }
    if (!u) {
      return { doc: null, diagram: null, error: null, loading: false };
    }
    if (!fetched || fetched.url !== u) {
      return { doc: null, diagram: null, error: null, loading: true };
    }
    return fetched.error
      ? { doc: null, diagram: null, error: fetched.error, loading: false }
      : parseSafe(fetched.text ?? '');
  }, [source, u, fetched]);

  return (inlineLoad ?? urlLoad)!;
}

export interface NodeState extends NodeStatus<Signal> {
  node: LayoutNode;
  /** The shape has its own mapping (so "no data" is a real finding, not an unmapped shape). */
  mapped: boolean;
  /** What ${__node.match} expands to. */
  matchName: string;
}

export function pairNodes(nodes: LayoutNode[], mappings: Record<string, NodeMapping>, signals: Signal[]): NodeState[] {
  return nodes.map((node) => {
    const m = mappings[node.id];
    const patterns = nodePatterns(node, m?.match);
    const mine = patterns.length ? signals.filter((s) => matches(patterns, s.raw, s.keys)) : [];
    const status = reduceStatus(mine);
    const matchName = status.top?.raw[0] ?? (m?.match?.trim() || node.label.replace(/\s+/g, ' ').trim());
    return { ...status, node, mapped: !!m?.match?.trim(), matchName };
  });
}
