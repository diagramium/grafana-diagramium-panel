import React, { useMemo, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import { Input, Stack, useStyles2, useTheme2 } from '@grafana/ui';
import { DiagramOptions, NodeMapping } from '../types';
import { pairNodes, useDiagram } from '../lib/diagram';
import { extractSignals } from '../lib/signals';

type Mappings = Record<string, NodeMapping>;

/**
 * One row per shape in the diagram: what it matches in the data (blank = its
 * own label) and where clicking it goes (blank = the default link). A dot
 * shows whether the CURRENT query results reach it, so a mapping can be
 * fixed while looking at the answer.
 */
export const NodeMappingsEditor: React.FC<StandardEditorProps<Mappings, unknown, DiagramOptions>> = ({
  value,
  onChange,
  context,
}) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const o = context.options;
  const { diagram } = useDiagram(o?.source ?? 'inline', o?.diagram ?? '', o?.url ?? '');
  const [filter, setFilter] = useState('');
  const mappings = useMemo(() => value ?? {}, [value]);

  const states = useMemo(() => {
    if (!diagram) {
      return [];
    }
    const signals = extractSignals(
      context.data ?? [],
      { matchLabel: o?.matchLabel ?? '', reducer: o?.reducer ?? '' },
      theme
    );
    return pairNodes(diagram.nodes, mappings, signals);
  }, [diagram, context.data, o?.matchLabel, o?.reducer, mappings, theme]);

  if (!diagram) {
    return <div className={styles.muted}>Load a diagram first.</div>;
  }

  const set = (id: string, patch: Partial<NodeMapping>) => {
    const next: Mappings = { ...mappings };
    const m = { ...next[id], ...patch };
    if (!m.match?.trim()) {
      delete m.match;
    }
    if (!m.link?.trim()) {
      delete m.link;
    }
    if (Object.keys(m).length) {
      next[id] = m;
    } else {
      delete next[id];
    }
    onChange(next);
  };

  const linked = states.filter((s) => s.signals.length).length;
  const q = filter.trim().toLowerCase();
  const rows = states.filter(
    (s) => !q || s.node.label.toLowerCase().includes(q) || s.node.id.toLowerCase().includes(q)
  );

  return (
    <Stack direction="column" gap={1}>
      <div className={styles.muted}>
        {linked} of {states.length} shapes match the current data. Leave <em>Matches</em> blank to use the shape&apos;s
        label; use commas for several names, <code>*</code> as a wildcard, or <code>/regex/</code>.
      </div>
      {states.length > 8 && (
        <Input placeholder="Filter shapes" value={filter} onChange={(e) => setFilter(e.currentTarget.value)} />
      )}
      <div className={styles.list}>
        {rows.map((s) => {
          const m = mappings[s.node.id] ?? {};
          const label = s.node.label.replace(/\s+/g, ' ').trim() || s.node.id;
          return (
            <div key={s.node.id} className={styles.row}>
              <div className={styles.head}>
                <i
                  className={styles.dot}
                  style={{ background: s.signals.length ? s.top?.color : 'transparent' }}
                  title={
                    s.signals.length
                      ? `${s.signals.length} signal(s): ${s.top?.name} = ${s.top?.text}`
                      : 'No data matches'
                  }
                />
                <span className={styles.name} title={`${label} (${s.node.type}, id ${s.node.id})`}>
                  {label}
                </span>
                <span className={styles.count}>{s.signals.length ? `${s.signals.length}` : ''}</span>
              </div>
              <Input
                placeholder={`Matches: ${label}`}
                defaultValue={m.match ?? ''}
                onBlur={(e) =>
                  e.currentTarget.value !== (m.match ?? '') && set(s.node.id, { match: e.currentTarget.value })
                }
              />
              <Input
                placeholder="Link: default"
                defaultValue={m.link ?? ''}
                onBlur={(e) =>
                  e.currentTarget.value !== (m.link ?? '') && set(s.node.id, { link: e.currentTarget.value })
                }
              />
            </div>
          );
        })}
      </div>
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  muted: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    em {
      font-style: normal;
      color: ${theme.colors.text.primary};
    }
  `,
  list: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1.5)};
  `,
  row: css`
    display: grid;
    gap: ${theme.spacing(0.5)};
  `,
  head: css`
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  dot: css`
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 1px solid ${theme.colors.border.strong};
  `,
  name: css`
    font-weight: ${theme.typography.fontWeightMedium};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  count: css`
    margin-left: auto;
    color: ${theme.colors.text.secondary};
  `,
});
