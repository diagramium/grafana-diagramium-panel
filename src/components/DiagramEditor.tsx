import React, { useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import { Alert, Button, FileUpload, Stack, TextArea, useStyles2 } from '@grafana/ui';
import { parseDiagram } from 'diagramium-player';

/**
 * The diagram itself: upload the .json the Diagramium editor saves, or paste
 * it. It is stored in the dashboard, so the panel needs nothing else to draw.
 */
export const DiagramEditor: React.FC<StandardEditorProps<string>> = ({ value, onChange }) => {
  const styles = useStyles2(getStyles);
  const [showJson, setShowJson] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  let summary = '';
  if (value?.trim()) {
    try {
      const d = parseDiagram(JSON.parse(value));
      summary = `${d.title || 'Untitled diagram'} · ${d.nodes.length} shapes · ${d.edges.length} connectors`;
    } catch (e: any) {
      summary = '';
    }
  }

  const accept = (text: string) => {
    try {
      parseDiagram(JSON.parse(text));
      setErr(null);
      onChange(text);
    } catch (e: any) {
      setErr(`Not a Diagramium diagram: ${e?.message ?? e}`);
    }
  };

  return (
    <Stack direction="column" gap={1}>
      {summary ? (
        <div className={styles.summary}>{summary}</div>
      ) : (
        <div className={styles.hint}>No diagram loaded.</div>
      )}
      <Stack gap={1} wrap="wrap">
        <FileUpload
          accept=".json,application/json"
          size="sm"
          onFileUpload={({ currentTarget }) => {
            const f = currentTarget.files?.[0];
            if (f) {
              f.text().then(accept);
            }
          }}
        >
          Upload .json
        </FileUpload>
        <Button size="sm" variant="secondary" fill="outline" onClick={() => setShowJson((v) => !v)}>
          {showJson ? 'Hide JSON' : 'Paste / edit JSON'}
        </Button>
      </Stack>
      {showJson && (
        <TextArea
          rows={10}
          className={styles.json}
          defaultValue={value}
          placeholder="Paste the file saved from diagramium.com (File → Save)"
          onBlur={(e) => (e.currentTarget.value.trim() ? accept(e.currentTarget.value) : onChange(''))}
        />
      )}
      {err && (
        <Alert severity="error" title="" onRemove={() => setErr(null)}>
          {err}
        </Alert>
      )}
      <div className={styles.hint}>
        Draw it at{' '}
        <a href="https://www.diagramium.com" target="_blank" rel="noreferrer">
          diagramium.com
        </a>{' '}
        — name each shape after the thing it monitors (a service, host, container or device) and it links to your data
        with no further setup.
      </div>
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  summary: css`
    font-weight: ${theme.typography.fontWeightMedium};
  `,
  hint: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    a {
      color: ${theme.colors.text.link};
    }
  `,
  json: css`
    font-family: ${theme.typography.fontFamilyMonospace};
    font-size: 12px;
  `,
});
