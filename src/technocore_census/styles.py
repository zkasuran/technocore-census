"""The stylesheet, one string, from the reference palette in the dataviz skill.

Three categorical slots are used and no more. The all-pairs gate only clears three, and
this site's charts are read as a set on one page (a bar rank beside a meter beside tiles),
which is the all-pairs case rather than the adjacent-stack case. Validated with the
skill's own script against both surfaces:

    node scripts/validate_palette.js "#2a78d6,#eb6834,#1baf7a" --mode light
    node scripts/validate_palette.js "#3987e5,#d95926,#199e70" --mode dark

Light passes with one contrast WARN on aqua (2.74:1), which obligates visible labels
rather than colour alone. Every mark here carries a text label beside it and every chart
has a table twin, so that relief is in place.

Dark mode is selected, not an inverted flip: the same three hues stepped for the dark
surface, and declared under both the media query and the explicit toggle so a viewer's
choice wins over the OS setting either way.
"""

STYLESHEET = """/* Technocore Census — generated. Palette: dataviz reference instance. */
.viz-root {
  color-scheme: light;
  --surface-1: #fcfcfb;
  --plane: #f9f9f7;
  --text-primary: #0b0b0b;
  --text-secondary: #52514e;
  --muted: #898781;
  --grid: #e1e0d9;
  --axis: #c3c2b7;
  --border: rgba(11, 11, 11, 0.1);
  --series-1: #2a78d6;
  --series-2: #eb6834;
  --series-3: #1baf7a;
  --track: #cde2fb;
  --good: #0ca30c;
  --warning: #fab219;
  --critical: #d03b3b;
  --success-text: #006300;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) .viz-root {
    color-scheme: dark;
    --surface-1: #1a1a19;
    --plane: #0d0d0d;
    --text-primary: #ffffff;
    --text-secondary: #c3c2b7;
    --muted: #898781;
    --grid: #2c2c2a;
    --axis: #383835;
    --border: rgba(255, 255, 255, 0.1);
    --series-1: #3987e5;
    --series-2: #d95926;
    --series-3: #199e70;
    --track: #184f95;
    --success-text: #0ca30c;
  }
}
:root[data-theme="dark"] .viz-root {
  color-scheme: dark;
  --surface-1: #1a1a19;
  --plane: #0d0d0d;
  --text-primary: #ffffff;
  --text-secondary: #c3c2b7;
  --grid: #2c2c2a;
  --axis: #383835;
  --border: rgba(255, 255, 255, 0.1);
  --series-1: #3987e5;
  --series-2: #d95926;
  --series-3: #199e70;
  --track: #184f95;
  --success-text: #0ca30c;
}

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--plane);
  color: var(--text-primary);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 16px;
  line-height: 1.55;
}
.wrap { max-width: 1080px; margin: 0 auto; padding: 0 20px; }
.skip {
  position: absolute; left: -9999px; top: 0; background: var(--surface-1);
  padding: 10px 16px; border: 1px solid var(--border); z-index: 10;
}
.skip:focus { left: 8px; top: 8px; }
.masthead { border-bottom: 1px solid var(--grid); background: var(--surface-1); }
.masthead .wrap {
  display: flex; flex-wrap: wrap; gap: 12px 28px;
  align-items: baseline; justify-content: space-between; padding-block: 14px;
}
.brand { margin: 0; font-weight: 650; letter-spacing: -0.01em; }
.masthead nav { display: flex; gap: 18px; flex-wrap: wrap; }
.masthead nav a { color: var(--text-secondary); text-decoration: none; font-size: 0.94rem; }
.masthead nav a:hover { color: var(--text-primary); text-decoration: underline; }
.masthead nav a[aria-current="page"] { color: var(--text-primary); font-weight: 600; }
h1 { font-size: 1.85rem; letter-spacing: -0.02em; margin: 32px 0 8px; }
h2 { font-size: 1.18rem; letter-spacing: -0.01em; margin: 40px 0 4px; }
h3 { font-size: 1rem; margin: 24px 0 4px; }
.lede { color: var(--text-secondary); font-size: 1.05rem; margin: 0 0 16px; max-width: 62ch; }
.stamp, .note { color: var(--muted); font-size: 0.85rem; max-width: 76ch; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em; }
a { color: var(--series-1); }

/* hero + tiles */
.hero {
  background: var(--surface-1); border: 1px solid var(--border); border-radius: 14px;
  padding: 24px 24px 20px; margin: 22px 0 8px;
}
.hero .figure { font-size: 3.4rem; font-weight: 650; line-height: 1; letter-spacing: -0.03em; }
.hero .label { color: var(--text-secondary); margin: 8px 0 0; }
.tiles { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(196px, 1fr)); margin: 14px 0 8px; }
.tile {
  background: var(--surface-1); border: 1px solid var(--border);
  border-radius: 12px; padding: 14px 16px 12px;
}
.tile .label { color: var(--text-secondary); font-size: 0.85rem; margin: 0; }
.tile .value { font-size: 1.7rem; font-weight: 620; line-height: 1.15; margin: 4px 0 0; letter-spacing: -0.02em; }
.tile .sub { color: var(--muted); font-size: 0.8rem; margin: 2px 0 0; }
.tile .delta { font-size: 0.84rem; margin: 4px 0 0; }
.tile .delta.good { color: var(--success-text); }
.tile .delta.flat { color: var(--muted); }

/* charts */
.card {
  background: var(--surface-1); border: 1px solid var(--border);
  border-radius: 14px; padding: 18px 20px 16px; margin: 12px 0 8px;
}
.card h2, .card h3 { margin-top: 0; }
.legend { display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 4px 0 14px; padding: 0; list-style: none; }
.legend li { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 0.86rem; }
.key { width: 12px; height: 12px; border-radius: 3px; flex: none; }
.key.s1 { background: var(--series-1); }
.key.s2 { background: var(--series-2); }
.key.s3 { background: var(--series-3); }

.rank { display: grid; gap: 10px; margin: 0; }
.rank-row { display: grid; grid-template-columns: minmax(0, 15rem) 1fr auto; gap: 12px; align-items: center; }
.rank-row .who { min-width: 0; }
.rank-row .who .id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.86rem; }
.rank-row .who .meta { color: var(--muted); font-size: 0.78rem; }
.bar-track { background: transparent; height: 20px; display: flex; align-items: center; }
.bar {
  height: 16px; max-height: 24px; border-radius: 0 4px 4px 0;
  background: var(--series-1); min-width: 2px;
}
.bar.s2 { background: var(--series-2); }
.bar.s3 { background: var(--series-3); }
.rank-row .val { font-variant-numeric: tabular-nums; font-size: 0.9rem; color: var(--text-secondary); }

.meter { margin: 10px 0 6px; }
.meter .track {
  height: 18px; border-radius: 4px; background: var(--track);
  display: flex; overflow: visible; position: relative;
}
.meter .fill { height: 18px; border-radius: 4px 0 0 4px; background: var(--series-1); }
.meter .fill.warn { background: var(--warning); }
.meter .fill.crit { background: var(--critical); }
.meter .scale { display: flex; justify-content: space-between; color: var(--muted); font-size: 0.78rem; margin-top: 4px; }
.meter .readout { font-size: 1.35rem; font-weight: 620; letter-spacing: -0.02em; }
.meter .readout .of { color: var(--text-secondary); font-size: 0.9rem; font-weight: 400; }

/* table twins */
details.table { margin: 10px 0 0; }
details.table summary { cursor: pointer; color: var(--text-secondary); font-size: 0.88rem; }
table { width: 100%; border-collapse: collapse; margin: 10px 0 0; font-size: 0.87rem; }
th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--grid); vertical-align: top; }
th { color: var(--text-secondary); font-weight: 600; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
caption { text-align: left; color: var(--muted); font-size: 0.82rem; padding-bottom: 6px; }

/* feed */
.thread { background: var(--surface-1); border: 1px solid var(--border); border-radius: 14px; padding: 16px 18px; margin: 12px 0; }
.thread header { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: baseline; margin-bottom: 10px; }
.thread .room { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.thread .count { color: var(--muted); font-size: 0.82rem; }
.line { display: grid; grid-template-columns: minmax(0, 8.5rem) 1fr; gap: 12px; padding: 7px 0; border-top: 1px solid var(--grid); }
.line:first-of-type { border-top: 0; }
.line .author { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; color: var(--text-secondary); min-width: 0; overflow-wrap: anywhere; }
.line .author .mark { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: 1px; }
.line .author .mark.signed { background: var(--series-1); }
.line .author .mark.unsigned { background: var(--muted); }
.line .body { overflow-wrap: anywhere; white-space: pre-wrap; }
.line .ts { color: var(--muted); font-size: 0.74rem; }
.omitted { color: var(--muted); font-size: 0.8rem; padding: 6px 0 0; }
.warnbar {
  border: 1px solid var(--border); border-left: 4px solid var(--warning);
  background: var(--surface-1); border-radius: 8px; padding: 10px 14px; margin: 14px 0;
  color: var(--text-secondary); font-size: 0.88rem;
}
.foot { color: var(--muted); font-size: 0.84rem; border-top: 1px solid var(--grid); margin-top: 44px; padding-top: 16px; padding-bottom: 40px; }
.foot p { margin: 4px 0; }
@media (max-width: 640px) {
  .rank-row { grid-template-columns: 1fr auto; }
  .rank-row .bar-track { grid-column: 1 / -1; }
  .line { grid-template-columns: 1fr; gap: 2px; }
  .hero .figure { font-size: 2.6rem; }
}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
"""
