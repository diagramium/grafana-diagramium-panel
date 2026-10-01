/** Panel options, as saved in the dashboard JSON. */
export type DiagramSource = 'inline' | 'url';
export type ThemeChoice = 'auto' | 'linear-midnight' | 'bento-card' | 'glassmorphism';
export type ColorMode = 'border' | 'fill';
export type EdgeMode = 'off' | 'target' | 'both';
export type BadgeMode = 'value' | 'status' | 'none';
export type UnmatchedMode = 'keep' | 'dim';

/** Per-shape settings, keyed by the shape's id in the diagram file. */
export interface NodeMapping {
  /** What this shape matches in the data. Empty = the shape's own label (then its id).
      Comma-separated; `*` wildcards; `/regex/` for a regular expression. */
  match?: string;
  /** Drill-down link for this shape. Empty = the panel's default link. */
  link?: string;
}

export interface DiagramOptions {
  source: DiagramSource;
  /** The .json saved from the Diagramium editor (File → Save). */
  diagram: string;
  url: string;

  /** Which series label names a thing. Empty = auto (service, instance, host, container, pod, job, name…). */
  matchLabel: string;
  nodes: Record<string, NodeMapping>;

  reducer: string;
  colorMode: ColorMode;
  badge: BadgeMode;
  edges: EdgeMode;
  unmatched: UnmatchedMode;

  /** Link template for any shape without its own. ${__node.id} ${__node.label} ${__node.match} + dashboard variables. */
  defaultLink: string;
  newTab: boolean;

  theme: ThemeChoice;
  themeBackground: boolean;
  fontScale: number;
  showLegend: boolean;
  showTour: boolean;
  stepSeconds: number;
}
