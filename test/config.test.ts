import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LAYOUTS,
  LAYOUT_DEFAULTS,
  LAYOUT_TOGGLES,
  TOGGLES,
  cardSize,
  gridOptions,
  normalizeConfig,
  primaryCommand,
} from "../src/config.ts";
import { computeHelper, computeLabel, configSchema } from "../src/editor.ts";
import { strings } from "../src/localize.ts";

const base = { type: "custom:wallbox-web-card", device_id: "dev1" };

test("defaults: full layout with every block on", () => {
  const c = normalizeConfig(base);
  assert.equal(c.layout, "full");
  for (const k of TOGGLES) assert.equal(c[k], true, k);
  assert.equal(c.curve_hours, 6);
  assert.equal(c.appearance, "app");
  assert.equal(c.tap_action, undefined);
  assert.equal(c.device_id, "dev1");
});

test("compact defaults: no gauge, curve or last charge; status, tiles and buttons on", () => {
  const c = normalizeConfig({ ...base, layout: "compact" });
  assert.equal(c.show_gauge, false);
  assert.equal(c.show_curve, false);
  assert.equal(c.show_last_charge, false);
  assert.equal(c.show_limits, false);
  assert.equal(c.show_status, true);
  assert.equal(c.show_tiles, true);
  assert.equal(c.show_actions, true);
});

test("explicit toggles override the layout defaults", () => {
  const c = normalizeConfig({ ...base, layout: "compact", show_curve: true, show_actions: false });
  assert.equal(c.show_curve, true);
  assert.equal(c.show_actions, false);
  const f = normalizeConfig({ ...base, show_gauge: false, show_last_charge: false });
  assert.equal(f.show_gauge, false);
  assert.equal(f.show_last_charge, false);
  assert.equal(f.show_tiles, true);
});

test("blocks a layout cannot render stay off whatever the option says", () => {
  const c = normalizeConfig({ ...base, layout: "compact", show_gauge: true });
  assert.equal(c.show_gauge, false);
  const m = normalizeConfig({ ...base, layout: "minimal", show_curve: true, show_tiles: true });
  assert.equal(m.show_curve, false);
  assert.equal(m.show_tiles, false);
  assert.equal(m.show_actions, true);
});

test("null toggles (cleared in the editor) fall back to the default", () => {
  const c = normalizeConfig({ ...base, show_curve: null as unknown as boolean });
  assert.equal(c.show_curve, true);
});

test("invalid configurations are rejected", () => {
  assert.throws(() => normalizeConfig(null), /Invalid configuration/);
  assert.throws(() => normalizeConfig([]), /Invalid configuration/);
  assert.throws(() => normalizeConfig({ ...base, layout: "huge" }), /layout must be one of/);
  assert.throws(() => normalizeConfig({ ...base, curve_hours: 0 }), /curve_hours/);
  assert.throws(() => normalizeConfig({ ...base, curve_hours: "abc" }), /curve_hours/);
  assert.throws(() => normalizeConfig({ ...base, appearance: "neon" }), /appearance/);
  assert.throws(() => normalizeConfig({ ...base, show_curve: "yes" }), /show_curve must be true or false/);
  assert.throws(() => normalizeConfig({ ...base, tap_action: { navigation_path: "/x" } }), /tap_action/);
});

test("curve_hours given as a string is converted; tap_action is kept", () => {
  const c = normalizeConfig({ ...base, curve_hours: "12", tap_action: { action: "navigate", navigation_path: "/energy" } });
  assert.equal(c.curve_hours, 12);
  assert.deepEqual(c.tap_action, { action: "navigate", navigation_path: "/energy" });
});

test("a config without device_id is valid (the card asks to pick a station)", () => {
  assert.equal(normalizeConfig({ type: "custom:wallbox-web-card" }).device_id, undefined);
});

test("sections view sizing per layout", () => {
  assert.deepEqual(gridOptions(normalizeConfig({ ...base, layout: "minimal" })), { columns: 6, rows: 1, min_columns: 6, min_rows: 1 });
  for (const layout of ["full", "compact"] as const) {
    const g = gridOptions(normalizeConfig({ ...base, layout }));
    assert.equal(g.columns, 12);
    assert.equal(g.rows, "auto");
    assert.equal(g.min_columns, 6);
  }
});

test("masonry card size shrinks with the layout and the hidden blocks", () => {
  const full = cardSize(normalizeConfig(base));
  const fullBare = cardSize(normalizeConfig({ ...base, show_gauge: false, show_curve: false, show_last_charge: false }));
  const compact = cardSize(normalizeConfig({ ...base, layout: "compact" }));
  const minimal = cardSize(normalizeConfig({ ...base, layout: "minimal" }));
  assert.equal(minimal, 1);
  assert.ok(compact >= 2 && compact < full, `compact ${compact} < full ${full}`);
  assert.ok(fullBare < full);
  assert.ok(full >= 10 && full <= 14, `full ${full}`);
});

test("primary command: Start, then Resume, Pause, Stop", () => {
  assert.equal(primaryCommand((k) => k === "start"), "start");
  assert.equal(primaryCommand((k) => k === "pause" || k === "stop"), "pause");
  assert.equal(primaryCommand((k) => k === "resume" || k === "stop"), "resume");
  assert.equal(primaryCommand((k) => k === "stop"), "stop");
  assert.equal(primaryCommand(() => false), null);
});

type S = Record<string, unknown> & { name?: string; schema?: S[]; visible?: unknown; default?: unknown };

const flat = (schema: S[]): S[] => schema.flatMap((s) => [s, ...(s.schema ? flat(s.schema) : [])]);

test("editor: layout comes right after the station, one Content section per layout", () => {
  const schema = configSchema(strings("en")) as S[];
  assert.deepEqual(schema.slice(0, 2).map((s) => s.name), ["device_id", "layout"]);
  for (const layout of LAYOUTS) {
    const section = schema.find((s) => s.name === `content_${layout}`);
    assert.ok(section, layout);
    assert.equal(section.type, "expandable");
    assert.equal(section.flatten, true);
    assert.equal(section.title, "Content");
    const toggles = flat(section.schema!).filter((s) => String(s.name).startsWith("show_"));
    assert.deepEqual(
      toggles.map((s) => s.name),
      [...LAYOUT_TOGGLES[layout]],
    );
    for (const s of toggles) assert.equal(s.default, LAYOUT_DEFAULTS[layout][s.name as keyof (typeof LAYOUT_DEFAULTS)["full"]]);
  }
  assert.deepEqual(schema.find((s) => s.name === "content_full")!.visible, {
    field: "layout",
    operator: "not_in",
    value: ["compact", "minimal"],
  });
  const tap = flat(schema).find((s) => s.name === "tap_action");
  assert.deepEqual(tap?.selector, { ui_action: { default_action: "more-info" } });
});

test("editor: labels in Italian, English for every other language", () => {
  const it = strings("it-IT");
  const de = strings("de");
  assert.equal(configSchema(it).find((s) => s.name === "content_compact")?.title, "Contenuti");
  assert.equal(computeLabel(it, { name: "show_gauge" }), "Indicatore di potenza");
  assert.equal(computeLabel(de, { name: "show_gauge" }), "Power gauge");
  assert.equal(computeLabel(strings(undefined), { name: "layout" }), "Layout");
  assert.equal(computeLabel(de, { name: "unknown_field" }), undefined);
  assert.match(computeHelper(de, { name: "tap_action" }) ?? "", /Power sensor/);
});

test("every locale has the same keys", () => {
  assert.deepEqual(Object.keys(strings("it")).sort(), Object.keys(strings("en")).sort());
});
