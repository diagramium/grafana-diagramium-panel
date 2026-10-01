import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, PanelProps } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Button, useStyles2, useTheme2 } from '@grafana/ui';
import { DiagramiumPlayer, THEME_PRESETS, type NodeEvent, type StepEvent, type ThemeTokens } from 'diagramium-player';
import { DiagramOptions } from '../types';
import { NodeState, pairNodes, useDiagram } from '../lib/diagram';
import { extractSignals } from '../lib/signals';
import { SEVERITY_NAME, Severity, withAlpha } from '../lib/status';
import { internalPath, isSafeLink, resolveLink } from '../lib/links';

type Props = PanelProps<DiagramOptions>;

const LEGEND_H = 26;

export const DiagramPanel: React.FC<Props> = ({ options, data, width, height, replaceVariables }) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<DiagramiumPlayer | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; rect: DOMRect; box: DOMRect } | null>(null);
  const [tour, setTour] = useState<{ note: string; count: string } | null>(null);

  const { doc, diagram, error, loading } = useDiagram(options.source, options.diagram, options.url);

  /* ---- the look: a Diagramium theme preset, on Grafana's own background ---- */
  const tokens = useMemo<Partial<ThemeTokens>>(() => {
    const name =
      options.theme === 'auto' || !options.theme ? (theme.isDark ? 'linear-midnight' : 'bento-card') : options.theme;
    const base = { ...THEME_PRESETS[name] };
    if (!options.themeBackground) {
      base.background = 'transparent';
      base.gridColor = undefined;
    }
    return base;
  }, [options.theme, options.themeBackground, theme.isDark]);

  /* ---- the player: rebuilt only when the document or its look changes ---- */
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !doc) {
      return;
    }
    let p: DiagramiumPlayer | null = null;
    let failure: string | null = null;
    try {
      p = new DiagramiumPlayer({
        container: host,
        source: doc as any,
        theme: tokens,
        initialStep: 'overview',
        showCaption: false,
        keyboard: false,
        padding: 24,
        stepDuration: Math.max(1, options.stepSeconds || 4) * 1000,
        font: { scale: options.fontScale || 1 },
      });
    } catch (e: any) {
      p = null;
      failure = String(e?.message ?? e);
    }
    setPlayer(p);
    setPlayerError(failure);
    return () => {
      p?.destroy();
      setPlayer(null);
      setHover(null);
      setTour(null);
    };
  }, [doc, tokens, options.stepSeconds, options.fontScale]);

  /* ---- data -> one state per shape ---- */
  const signals = useMemo(
    () => extractSignals(data.series, { matchLabel: options.matchLabel, reducer: options.reducer }, theme),
    [data.series, options.matchLabel, options.reducer, theme]
  );
  const states = useMemo<NodeState[]>(
    () => (diagram ? pairNodes(diagram.nodes, options.nodes ?? {}, signals) : []),
    [diagram, options.nodes, signals]
  );
  const byId = useMemo(() => new Map(states.map((s) => [s.node.id, s])), [states]);

  /* ---- paint: shapes, then connectors ---- */
  useEffect(() => {
    if (!player || !diagram) {
      return;
    }
    player.resetNodeStyle();
    player.resetEdgeStyle();
    for (const s of states) {
      const has = s.signals.length > 0;
      if (!has) {
        if (s.mapped) {
          player.updateNodeStyle(s.node.id, {
            stroke: theme.colors.text.disabled,
            strokeDasharray: '5 4',
            badge: { text: 'No data', color: '#6e7079' },
          });
        } else if (options.unmatched === 'dim') {
          player.updateNodeStyle(s.node.id, { opacity: 0.4 });
        }
        continue;
      }
      if (s.severity === Severity.NoData) {
        player.updateNodeStyle(s.node.id, {
          stroke: theme.colors.text.disabled,
          strokeDasharray: '5 4',
          badge: { text: 'No data', color: '#6e7079' },
        });
        continue;
      }
      const color = s.top!.color;
      const badgeText =
        options.badge === 'value' ? s.top!.text : options.badge === 'status' ? SEVERITY_NAME[s.severity] : '';
      player.updateNodeStyle(s.node.id, {
        stroke: color,
        strokeWidth: s.severity >= Severity.Warning ? 3 : 2.2,
        fill: options.colorMode === 'fill' ? withAlpha(color, theme.isDark ? 0.28 : 0.18) : undefined,
        glow: s.severity === Severity.Critical ? color : false,
        badge: badgeText ? { text: badgeText, color } : null,
      });
    }
    if (options.edges !== 'off') {
      for (const e of diagram.edges) {
        const to = byId.get(e.to);
        const from = byId.get(e.from);
        let worst: NodeState | undefined = to;
        if (options.edges === 'both' && from && (!to || from.severity > to.severity)) {
          worst = from;
        }
        if (worst && worst.severity >= Severity.Warning && worst.top) {
          player.updateEdgeStyle(e.id, {
            stroke: worst.top.color,
            width: worst.severity === Severity.Critical ? 2.6 : 2.2,
            pulse: worst.severity === Severity.Critical,
          });
        }
      }
    }
  }, [player, diagram, states, byId, options.colorMode, options.badge, options.edges, options.unmatched, theme]);

  /* ---- drill-down ---- */
  const linkFor = useCallback(
    (s: NodeState) =>
      resolveLink(
        options.nodes?.[s.node.id]?.link,
        options.defaultLink,
        {
          id: s.node.id,
          label: s.node.label.replace(/\s+/g, ' ').trim(),
          match: s.matchName,
          status: SEVERITY_NAME[s.severity],
        },
        replaceVariables
      ),
    [options.nodes, options.defaultLink, replaceVariables]
  );
  const anyLink = !!(options.defaultLink?.trim() || Object.values(options.nodes ?? {}).some((m) => m.link?.trim()));

  useEffect(() => {
    if (!player) {
      return;
    }
    const onHover = (e: NodeEvent) => {
      const box = wrapRef.current?.getBoundingClientRect();
      setHover(e.nodeId && e.rect && box ? { id: e.nodeId, rect: e.rect, box } : null);
    };
    const onClick = (e: NodeEvent) => {
      const s = e.nodeId ? byId.get(e.nodeId) : undefined;
      const url = s ? linkFor(s) : '';
      if (!url || !isSafeLink(url)) {
        return;
      }
      const inside = internalPath(url, window.location.origin);
      if (inside && !options.newTab) {
        locationService.push(inside);
      } else {
        window.open(url, options.newTab ? '_blank' : '_self', 'noopener,noreferrer');
      }
    };
    player.on('nodehover', onHover);
    if (anyLink) {
      player.on('nodeclick', onClick);
    }
    return () => {
      player.off('nodehover', onHover);
      player.off('nodeclick', onClick);
    };
  }, [player, byId, linkFor, anyLink, options.newTab]);

  /* ---- the guided tour: the diagram's own story, then back to the overview ---- */
  useEffect(() => {
    if (!player) {
      return;
    }
    const onStep = (e: StepEvent) => {
      if (player.isOverview || e.index < 0) {
        return;
      }
      setTour({ note: e.note || e.label, count: `${e.index + 1} / ${e.total}` });
    };
    let t: ReturnType<typeof setTimeout> | undefined;
    const onEnd = () => {
      t = setTimeout(
        () => {
          player.showAll();
          setTour(null);
        },
        Math.max(1, options.stepSeconds || 4) * 1000
      );
    };
    player.on('step', onStep);
    player.on('end', onEnd);
    return () => {
      player.off('step', onStep);
      player.off('end', onEnd);
      if (t) {
        clearTimeout(t);
      }
    };
  }, [player, options.stepSeconds]);

  const startTour = () => {
    if (!player) {
      return;
    }
    if (tour) {
      player.showAll();
      setTour(null);
      return;
    }
    setTour({ note: diagram?.title || '', count: '' });
    player.goToStep(-1).play();
  };

  /* ---- render ---- */
  const legendOn = options.showLegend && states.some((s) => s.signals.length);
  const stageH = Math.max(40, height - (legendOn ? LEGEND_H : 0));

  if (error || playerError) {
    return <div className={styles.message}>Could not read the diagram: {error || playerError}</div>;
  }
  if (!doc) {
    return (
      <div className={styles.message}>
        {loading ? (
          'Loading the diagram…'
        ) : (
          <>
            <strong>No diagram yet.</strong> Draw one at www.diagramium.com, save it (File → Save), then open this
            panel&apos;s options and upload the .json under <em>Diagram</em>.
          </>
        )}
      </div>
    );
  }

  const hovered = hover ? byId.get(hover.id) : undefined;

  return (
    <div ref={wrapRef} className={styles.wrap} style={{ width, height }}>
      <div ref={hostRef} className={styles.stage} style={{ height: stageH }} data-testid="diagramium-stage" />

      {options.showTour && diagram && diagram.steps.length > 1 && (
        <div className={styles.tourBtn}>
          <Button size="sm" variant="secondary" icon={tour ? 'square-shape' : 'play'} onClick={startTour}>
            {tour ? 'Stop' : 'Explain'}
          </Button>
        </div>
      )}

      {tour && tour.note && (
        <div className={styles.caption} aria-live="polite">
          {tour.count && <span className={styles.captionCount}>{tour.count}</span>}
          <span>{tour.note}</span>
        </div>
      )}

      {legendOn && <Legend states={states} />}

      {hovered && hover && (
        <Tooltip state={hovered} rect={hover.rect} box={hover.box} link={anyLink ? linkFor(hovered) : ''} />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------------ */

const Legend: React.FC<{ states: NodeState[] }> = ({ states }) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const rows: Array<[Severity, string]> = [
    [Severity.Ok, theme.visualization.getColorByName('green')],
    [Severity.Info, theme.visualization.getColorByName('blue')],
    [Severity.Warning, theme.visualization.getColorByName('orange')],
    [Severity.Critical, theme.visualization.getColorByName('red')],
    [Severity.NoData, theme.colors.text.disabled],
  ];
  const count = (sev: Severity) =>
    states.filter((s) => (s.signals.length || s.mapped) && (s.signals.length ? s.severity : Severity.NoData) === sev)
      .length;
  return (
    <div className={styles.legend} data-testid="diagramium-legend">
      {rows.map(([sev, color]) => {
        const n = count(sev);
        return n ? (
          <span key={sev} className={styles.legendItem}>
            <i style={{ background: color }} />
            {n} {SEVERITY_NAME[sev]}
          </span>
        ) : null;
      })}
    </div>
  );
};

const Tooltip: React.FC<{ state: NodeState; rect: DOMRect; box: DOMRect; link: string }> = ({
  state,
  rect,
  box,
  link,
}) => {
  const styles = useStyles2(getStyles);
  const W = 260;
  let left = rect.right - box.left + 10;
  if (left + W > box.width) {
    left = Math.max(4, rect.left - box.left - W - 10);
  }
  const top = Math.max(4, Math.min(rect.top - box.top, box.height - 120));
  const shown = state.signals
    .slice()
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 8);
  return (
    <div className={styles.tip} style={{ left, top, width: W }} role="tooltip">
      <div className={styles.tipHead}>{state.node.label.replace(/\s+/g, ' ')}</div>
      {shown.length ? (
        shown.map((s, i) => (
          <div key={i} className={styles.tipRow}>
            <i style={{ background: s.color }} />
            <span className={styles.tipName}>{s.name}</span>
            <b>{s.text}</b>
          </div>
        ))
      ) : (
        <div className={styles.tipMuted}>{state.mapped ? 'No data for this shape' : 'Not linked to any data'}</div>
      )}
      {state.signals.length > shown.length && (
        <div className={styles.tipMuted}>+{state.signals.length - shown.length} more</div>
      )}
      {link && <div className={styles.tipMuted}>Click to drill down</div>}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrap: css`
    position: relative;
    overflow: hidden;
  `,
  stage: css`
    width: 100%;
  `,
  message: css`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: ${theme.spacing(2)};
    color: ${theme.colors.text.secondary};
    text-align: center;
    line-height: 1.5;
    em {
      font-style: normal;
      color: ${theme.colors.text.primary};
    }
  `,
  tourBtn: css`
    position: absolute;
    top: ${theme.spacing(0.5)};
    right: ${theme.spacing(0.5)};
  `,
  caption: css`
    position: absolute;
    left: 50%;
    bottom: ${theme.spacing(4)};
    transform: translateX(-50%);
    max-width: min(640px, 90%);
    display: flex;
    gap: ${theme.spacing(1)};
    align-items: baseline;
    padding: ${theme.spacing(1, 1.5)};
    border-radius: ${theme.shape.radius.default};
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.medium};
    box-shadow: ${theme.shadows.z2};
    font-size: ${theme.typography.bodySmall.fontSize};
    line-height: 1.45;
  `,
  captionCount: css`
    flex: none;
    color: ${theme.colors.text.secondary};
    font-variant-numeric: tabular-nums;
  `,
  legend: css`
    display: flex;
    gap: ${theme.spacing(2)};
    align-items: center;
    height: ${LEGEND_H}px;
    padding: 0 ${theme.spacing(1)};
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
  `,
  legendItem: css`
    display: inline-flex;
    gap: 6px;
    align-items: center;
    i {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
  `,
  tip: css`
    position: absolute;
    z-index: 2;
    pointer-events: none;
    padding: ${theme.spacing(1)};
    border-radius: ${theme.shape.radius.default};
    background: ${theme.colors.background.secondary};
    border: 1px solid ${theme.colors.border.medium};
    box-shadow: ${theme.shadows.z3};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  tipHead: css`
    font-weight: ${theme.typography.fontWeightMedium};
    margin-bottom: ${theme.spacing(0.5)};
  `,
  tipRow: css`
    display: flex;
    gap: 6px;
    align-items: center;
    i {
      flex: none;
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    b {
      margin-left: auto;
      font-variant-numeric: tabular-nums;
    }
  `,
  tipName: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: ${theme.colors.text.secondary};
  `,
  tipMuted: css`
    margin-top: ${theme.spacing(0.5)};
    color: ${theme.colors.text.secondary};
  `,
});
