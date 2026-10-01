# Contributing to the Diagramium panel

Thanks for helping. Bug reports, fixes, docs and new ideas are all welcome.

## Getting started

```bash
npm install
npm run build
npm run server     # Grafana on http://localhost:3000 with the demo dashboards (needs Docker)
npm run dev        # in a second terminal: rebuild on change, then reload the dashboard
```

Developing needs Node 22 or newer and Docker.

## Where things live

| File                                | What it does                                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/lib/signals.ts`                | Turns query results (series and tables) into named, coloured values.                                     |
| `src/lib/match.ts`                  | Decides which values belong to which shape.                                                              |
| `src/lib/status.ts`                 | Reads a status from a colour and picks a shape's worst signal.                                           |
| `src/lib/links.ts`                  | Drill-down link templates and their safety checks.                                                       |
| `src/lib/diagram.ts`                | Loads the diagram and pairs its shapes with the data.                                                    |
| `src/components/`                   | The panel and its option editors.                                                                        |
| `examples/`                         | The demo diagrams, made in Diagramium.                                                                   |
| `docs/`                             | The user documentation: getting started, connecting data, status, drill-down, examples, troubleshooting. |
| `scripts/build-demo-dashboards.mjs` | Writes `provisioning/dashboards/` from `examples/`.                                                      |

The diagram itself is drawn by [diagramium-player](https://github.com/diagramium/diagramium-player); changes to how shapes look belong there.

## Pull requests

- Keep the panel **private**: no network calls except a diagram URL the dashboard author configured, no analytics, no telemetry. Grafana's plugin policy requires it too.
- Treat the diagram file and the query results as untrusted: render text through React, never `dangerouslySetInnerHTML`, and keep links behind `isSafeLink()`.
- Add or update a test in `src/lib/lib.test.ts` when you change matching, status or links, and update `docs/` when behaviour changes.
- Run `npm run typecheck`, `npm run lint` and `npm run test:ci` before opening the PR (CI runs them, plus the Playwright tests).
- One topic per pull request, with a short description of what changed and why.

By contributing, you agree that your contribution is licensed under the project's [MIT licence](LICENSE).

## Reporting bugs

Open an issue with your Grafana version, the data source, what you expected and what happened. If you can, attach the diagram `.json` and an export of the panel JSON (remove anything private first).
