import { test } from "node:test";
import assert from "node:assert/strict";
import {
  arcPath,
  curvePaths,
  formatDuration,
  formatNumber,
  historyToPoints,
  numeric,
  resolveEntities,
  stationDevices,
  statusTone,
  type HassLike,
} from "../src/data.ts";

const hass: HassLike = {
  states: {},
  devices: {},
  entities: {
    "sensor.garage_stato": { entity_id: "sensor.garage_stato", device_id: "dev1", platform: "wallbox_web", translation_key: "status" },
    "sensor.garage_potenza": { entity_id: "sensor.garage_potenza", device_id: "dev1", platform: "wallbox_web", translation_key: "power" },
    "button.garage_avvia": { entity_id: "button.garage_avvia", device_id: "dev1", platform: "wallbox_web", translation_key: "start" },
    "sensor.other": { entity_id: "sensor.other", device_id: "dev1", platform: "other", translation_key: "status" },
    "sensor.ospiti_stato": { entity_id: "sensor.ospiti_stato", device_id: "dev2", platform: "wallbox_web", translation_key: "status" },
  },
};

test("resolveEntities picks the device's wallbox_web entities by translation key", () => {
  assert.deepEqual(resolveEntities(hass, "dev1"), {
    status: "sensor.garage_stato",
    power: "sensor.garage_potenza",
    start: "button.garage_avvia",
  });
  assert.deepEqual(resolveEntities(hass, undefined), {});
});

test("stationDevices lists devices with a status sensor", () => {
  assert.deepEqual(stationDevices(hass).sort(), ["dev1", "dev2"]);
});

test("statusTone follows the app palette", () => {
  assert.equal(statusTone("charging"), "accent");
  assert.equal(statusTone("idle"), "info");
  assert.equal(statusTone("suspended_evse"), "warning");
  assert.equal(statusTone("faulted"), "fault");
  assert.equal(statusTone("unreachable"), "offline");
  assert.equal(statusTone("rebooting"), "neutral");
});

test("numeric converts units", () => {
  assert.equal(numeric({ entity_id: "x", state: "7200", attributes: { unit_of_measurement: "W" } }, "kW"), 7.2);
  assert.equal(numeric({ entity_id: "x", state: "5120", attributes: { unit_of_measurement: "Wh" } }, "kWh"), 5.12);
  assert.equal(numeric({ entity_id: "x", state: "45", attributes: { unit_of_measurement: "min" } }, "s"), 2700);
  assert.ok(Number.isNaN(numeric({ entity_id: "x", state: "unavailable", attributes: {} })));
  assert.ok(Number.isNaN(numeric(undefined)));
});

test("formatting", () => {
  assert.equal(formatDuration(3900), "1:05");
  assert.equal(formatDuration(Number.NaN), "0:00");
  assert.equal(formatNumber(7.25, 1, "it"), "7,3");
  assert.equal(formatNumber(Number.NaN, 1), "–");
});

test("gauge arc geometry", () => {
  assert.equal(arcPath(1), "M30 150 A120 120 0 0 1 270.00 150.00");
  assert.match(arcPath(0.5), /150\.00 30\.00$/);
});

test("curve paths and history conversion", () => {
  const pts = historyToPoints(
    [
      { s: "0", lu: 1000 },
      { s: "7000", lu: 1060 },
      { s: "bad", lu: 1100 },
      { s: "3500", lc: 1120 },
    ],
    "W",
  );
  assert.deepEqual(pts, [
    { t: 1_000_000, kw: 0 },
    { t: 1_060_000, kw: 7 },
    { t: 1_120_000, kw: 3.5 },
  ]);
  const { line, area } = curvePaths(pts, 300, 64);
  assert.match(line, /^M0\.0 63\.0 L150\.0 1\.0 L300\.0 32\.0$/);
  assert.ok(area.endsWith("L300 64 L0 64 Z"));
  assert.deepEqual(curvePaths(pts.slice(0, 1), 300, 64), { line: "", area: "" });
});
