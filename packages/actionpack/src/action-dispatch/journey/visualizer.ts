/**
 * HTML rendering for `ActionDispatch::Journey::GTG::TransitionTable#visualizer`.
 *
 * Mirrors the layout of Rails' `journey/visualizer/index.html.erb` so the
 * generated page is functionally compatible with the original d3-based FSM
 * inspector. We do not port the bundled `fsm.js` / `fsm.css` assets — the
 * visualizer is a debug-only surface, and shipping a verbatim d3 script
 * into the runtime bundle isn't worth the weight. Callers that need the
 * full inspector can append their own `<script>` tags around the embedded
 * `tt()` state-machine accessor we emit.
 */
export interface VisualizerOptions {
  title: string;
  states: string;
  svg: string;
  funRoutes: readonly string[];
  paths: readonly string[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderVisualizer(opts: VisualizerOptions): string {
  const { title, states, svg, funRoutes, paths } = opts;
  const funRouteLinks = funRoutes
    .map(
      (p) =>
        `<a href="#" onclick="document.forms[0].elements[0].value=this.text.replace(/^\\s+|\\s+$/g,''); return match(this.text.replace(/^\\s+|\\s+$/g,''));">${escapeHtml(p)}</a>`,
    )
    .join("\n");
  const pathItems = paths.map((p) => `<li>${escapeHtml(p)}</li>`).join("\n");
  return `<!DOCTYPE html>
<html>
  <head>
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/meyer-reset/2.0/reset.css" type="text/css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/3.4.8/d3.min.js"></script>
  </head>
  <body>
    <div id="wrapper">
      <h1>Routes FSM with NFA simulation</h1>
      <div class="instruction form">
        <p>Type a route in to the box and click "simulate".</p>
        <form onsubmit="return match(this.route.value);">
          <input type="text" size="30" name="route" value="/articles/new" />
          <button>simulate</button>
          <input type="reset" value="reset" onclick="return reset_graph();"/>
        </form>
        <p class="fun_routes">
          Some fun routes to try:
          ${funRouteLinks}
        </p>
      </div>
      <div class='chart' id='chart-2'>
        ${svg}
      </div>
      <div class="instruction">
        <p>This is a FSM for a system that has the following routes:</p>
        <ul>
          ${pathItems}
        </ul>
      </div>
    </div>
    <script>${states}</script>
  </body>
</html>`;
}
