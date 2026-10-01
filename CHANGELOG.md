# Changelog

## 0.1.0 — 2026-10-01

First release.

- Draws a Diagramium diagram (uploaded into the dashboard, or loaded from a URL) with the diagramium-player engine.
- Matches shapes to data by name: well-known labels, any label when none is present, series names, refIds and table rows; case, punctuation, `:port` and domain suffixes ignored; per-shape names, wildcards and regular expressions; a live "matches the current data" dot per shape in the editor.
- Status from Grafana's own thresholds and value mappings: outline or fill, value or status badge, critical glow, coloured connectors with a pulse on critical paths, legend. Blue (informational) series never decide a status.
- Hover tooltip listing every signal of a shape; drill-down links with `${__node.*}` variables, per-shape links, same-Grafana links without a reload, web links only.
- Explain: plays the diagram's step notes as a guided tour over the live status.
- Eight demo dashboards on the TestData source: a 27-shape e-commerce platform that drills into a service dashboard and into Checkout's internal flow, a Kubernetes cluster, a data pipeline, a production deployment, a server rack, a Docker host and a zero-configuration microservices map.
