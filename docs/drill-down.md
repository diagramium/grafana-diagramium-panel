# Drill-down

A diagram is the top of a path. Clicking a shape should take you to the next level of detail: the service's dashboard, the host's metrics, the runbook, or another diagram one level down.

![Platform map → service dashboard → Checkout's internal flow](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/drill-down.png)

## Links

**Drill-down → Default link** is a URL template used by every shape. Each shape can have its own link in **Data → Shapes**, and that link wins. Clicking a shape with neither does nothing.

### Variables

| Variable           | Expands to                                                                      | Example      |
| ------------------ | ------------------------------------------------------------------------------- | ------------ |
| `${__node.match}`  | the name the shape matched in the data; with no data, its Matches text or label | `web-1:9100` |
| `${__node.label}`  | the shape's label (line breaks become spaces)                                   | `Orders DB`  |
| `${__node.id}`     | the shape's id in the diagram file                                              | `ordersdb`   |
| `${__node.status}` | `OK`, `Warning`, `Critical`, `Info` or `No data`                                | `Critical`   |

These values are URL-encoded; add `:raw` to insert them as they are (`${__node.label:raw}`). Everything Grafana interpolates works too: dashboard variables (`$env`, `${cluster}`), `${__url_time_range}` and `${__from}` / `${__to}`.

### Patterns

**One dashboard for every service.** Build one dashboard with a variable (`service`) and point the default link at it:

```text
/d/service-red?var-service=${__node.match}&${__url_time_range}
```

**Host details.** `instance` values carry their port, which node_exporter dashboards expect:

```text
/d/rYdddlPWk/node-exporter-full?var-instance=${__node.match}&${__url_time_range}
```

**A deeper diagram.** Give one shape its own link to a dashboard holding a second Diagramium panel: the service's internal flow, a cluster's nodes, a rack's devices. The demo's Checkout shape does this:

```text
/d/diagramium-checkout/inside-checkout?${__url_time_range}
```

**Runbooks and status pages.** Third-party shapes can link straight out: `https://status.stripe.com`, your wiki's runbook, an incident channel.

**Carry the environment.** Pass dashboard variables through, so the next level keeps the context: `/d/service-red?var-service=${__node.match}&var-env=${env}&${__url_time_range}`.

## Behaviour

- Links inside Grafana (`/d/…`, or a full URL to the same Grafana) open **without a page reload**. **Open in a new tab** sends every link to a new tab instead.
- Only web links run. A `javascript:`, `data:` or other non-web URL in a pasted dashboard does nothing.
- Once any link is set, shapes get a pointer cursor and become keyboard-reachable: **Tab** to a shape, **Enter** or **Space** opens it.
- The hover tooltip ends with "Click to drill down" when a link applies.

## A tour instead of a link

The **Explain** button is the other way down: it walks through the diagram step by step with the notes written in Diagramium, over the live status. It suits a wall screen, an on-call handover, or a new teammate's first day. It returns to the full live view when it ends, and **Stop** ends it early.
