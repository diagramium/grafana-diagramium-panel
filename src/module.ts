import { FieldColorModeId, FieldConfigProperty, PanelPlugin, ReducerID, ThresholdsMode } from '@grafana/data';
import { DiagramOptions } from './types';
import { DiagramPanel } from './components/DiagramPanel';
import { DiagramEditor } from './components/DiagramEditor';
import { NodeMappingsEditor } from './components/NodeMappingsEditor';

const LINK_HELP =
  'Where clicking a shape goes. ${__node.label}, ${__node.id}, ${__node.match} (the name it matched in the data) ' +
  'and ${__node.status}, plus dashboard variables and ${__url_time_range}. ' +
  'Example: /d/host-details?var-host=${__node.match}&${__url_time_range}';

export const plugin = new PanelPlugin<DiagramOptions>(DiagramPanel)
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Color]: {
        // The colour of a value IS its status here, so thresholds drive it by default.
        defaultValue: { mode: FieldColorModeId.Thresholds },
      },
      [FieldConfigProperty.Thresholds]: {
        defaultValue: {
          mode: ThresholdsMode.Absolute,
          steps: [
            { value: -Infinity, color: 'green' },
            { value: 70, color: 'orange' },
            { value: 90, color: 'red' },
          ],
        },
      },
    },
  })
  .setPanelOptions((builder) => {
    const DIAGRAM = ['Diagram'];
    const DATA = ['Data'];
    const STATUS = ['Status'];
    const LINKS = ['Drill-down'];
    const VIEW = ['Appearance'];
    return builder
      .addRadio({
        path: 'source',
        name: 'Source',
        category: DIAGRAM,
        defaultValue: 'inline',
        settings: {
          options: [
            { value: 'inline', label: 'In the dashboard' },
            { value: 'url', label: 'From a URL' },
          ],
        },
      })
      .addCustomEditor({
        id: 'diagram',
        path: 'diagram',
        name: 'Diagram file',
        description: 'The .json saved from the Diagramium editor (File → Save).',
        category: DIAGRAM,
        editor: DiagramEditor,
        defaultValue: '',
        showIf: (o) => o.source !== 'url',
      })
      .addTextInput({
        path: 'url',
        name: 'Diagram URL',
        description: 'A .json served with CORS, e.g. from your repository or a static host.',
        category: DIAGRAM,
        defaultValue: '',
        showIf: (o) => o.source === 'url',
      })
      .addTextInput({
        path: 'matchLabel',
        name: 'Match by',
        description:
          'The label (or table column) that names a thing. Blank = automatic: service, app, container, pod, host, instance, job, name…, then the series name and query refId.',
        category: DATA,
        defaultValue: '',
        settings: { placeholder: 'auto' },
      })
      .addSelect({
        path: 'reducer',
        name: 'Value',
        description: 'How a time series becomes one value.',
        category: DATA,
        defaultValue: ReducerID.lastNotNull,
        settings: {
          options: [
            { value: ReducerID.lastNotNull, label: 'Last (not null)' },
            { value: ReducerID.mean, label: 'Mean' },
            { value: ReducerID.max, label: 'Max' },
            { value: ReducerID.min, label: 'Min' },
            { value: ReducerID.sum, label: 'Total' },
          ],
        },
      })
      .addCustomEditor({
        id: 'nodes',
        path: 'nodes',
        name: 'Shapes',
        description: 'What each shape matches in the data, and where it links.',
        category: DATA,
        editor: NodeMappingsEditor,
        defaultValue: {},
      })
      .addRadio({
        path: 'colorMode',
        name: 'Show status as',
        category: STATUS,
        defaultValue: 'border',
        settings: {
          options: [
            { value: 'border', label: 'Outline' },
            { value: 'fill', label: 'Fill' },
          ],
        },
      })
      .addRadio({
        path: 'badge',
        name: 'Badge',
        category: STATUS,
        defaultValue: 'value',
        settings: {
          options: [
            { value: 'value', label: 'Value' },
            { value: 'status', label: 'Status' },
            { value: 'none', label: 'None' },
          ],
        },
      })
      .addRadio({
        path: 'edges',
        name: 'Connectors',
        description: 'Colour the lines leading to a shape in trouble.',
        category: STATUS,
        defaultValue: 'target',
        settings: {
          options: [
            { value: 'off', label: 'Off' },
            { value: 'target', label: 'Into it' },
            { value: 'both', label: 'Both ends' },
          ],
        },
      })
      .addRadio({
        path: 'unmatched',
        name: 'Shapes without data',
        category: STATUS,
        defaultValue: 'keep',
        settings: {
          options: [
            { value: 'keep', label: 'As drawn' },
            { value: 'dim', label: 'Dim' },
          ],
        },
      })
      .addTextInput({
        path: 'defaultLink',
        name: 'Default link',
        description: LINK_HELP,
        category: LINKS,
        defaultValue: '',
        settings: { placeholder: '/d/<uid>?var-host=${__node.match}&${__url_time_range}' },
      })
      .addBooleanSwitch({
        path: 'newTab',
        name: 'Open in a new tab',
        category: LINKS,
        defaultValue: false,
      })
      .addSelect({
        path: 'theme',
        name: 'Theme',
        category: VIEW,
        defaultValue: 'auto',
        settings: {
          options: [
            { value: 'auto', label: 'Follow Grafana', description: 'Linear Midnight on dark, Bento Card on light' },
            { value: 'linear-midnight', label: 'Linear Midnight' },
            { value: 'bento-card', label: 'Bento Card' },
            { value: 'glassmorphism', label: 'Glassmorphism' },
          ],
        },
      })
      .addBooleanSwitch({
        path: 'themeBackground',
        name: "Theme's own background",
        description: 'Off: the diagram sits on the panel, like any other visualization.',
        category: VIEW,
        defaultValue: false,
      })
      .addSliderInput({
        path: 'fontScale',
        name: 'Text size',
        category: VIEW,
        defaultValue: 1,
        settings: { min: 0.6, max: 1.8, step: 0.05 },
      })
      .addBooleanSwitch({
        path: 'showLegend',
        name: 'Legend',
        category: VIEW,
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'showTour',
        name: '"Explain" button',
        description: "Plays the diagram's own step-by-step story, with its notes, over the live status.",
        category: VIEW,
        defaultValue: true,
      })
      .addNumberInput({
        path: 'stepSeconds',
        name: 'Seconds per step',
        category: VIEW,
        defaultValue: 4,
        settings: { min: 1, max: 30, integer: false },
        showIf: (o) => o.showTour,
      });
  });
