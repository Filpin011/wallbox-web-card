// Pure helpers (no Lit, no DOM): entity resolution, status tones, formatting, curve geometry.
// Unit-tested with `node --test` (Node strips the types).

export const INTEGRATION = "wallbox_web";

/** The subset of `hass` the card uses. */
export interface HassEntityRegistryDisplayEntry {
  entity_id: string;
  device_id?: string | null;
  platform?: string;
  translation_key?: string | null;
  hidden?: boolean;
}

export interface HassState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed?: string;
}

export interface HassDevice {
  id: string;
  name?: string | null;
  name_by_user?: string | null;
}

export interface HassLike {
  states: Record<string, HassState | undefined>;
  entities: Record<string, HassEntityRegistryDisplayEntry | undefined>;
  devices: Record<string, HassDevice | undefined>;
  locale?: { language?: string };
  language?: string;
}

/** translation_key → entity id of one station device. */
export type StationEntities = Partial<Record<EntityKey, string>>;

export const ENTITY_KEYS = [
  "status",
  "power",
  "session_energy",
  "lifetime_energy",
  "session_duration",
  "max_available_power",
  "power_limit",
  "error",
  "last_charge_energy",
  "last_charge_cost",
  "last_charge_saving",
  "plugged",
  "charging",
  "problem",
  "online",
  "start",
  "pause",
  "resume",
  "stop",
  "behaviour_mode",
  "max_current",
] as const;
export type EntityKey = (typeof ENTITY_KEYS)[number];

/** Entities of a Wallbox WEB device, by their translation key. */
export function resolveEntities(hass: HassLike, deviceId: string | undefined): StationEntities {
  const out: StationEntities = {};
  if (!deviceId) return out;
  for (const e of Object.values(hass.entities)) {
    if (!e || e.device_id !== deviceId || e.platform !== INTEGRATION || !e.translation_key) continue;
    const key = e.translation_key as EntityKey;
    if ((ENTITY_KEYS as readonly string[]).includes(key) && !out[key]) out[key] = e.entity_id;
  }
  return out;
}

/** Wallbox WEB station devices (devices with at least one wallbox_web entity with a status). */
export function stationDevices(hass: HassLike): string[] {
  const ids = new Set<string>();
  for (const e of Object.values(hass.entities)) {
    if (e?.platform === INTEGRATION && e.translation_key === "status" && e.device_id) ids.add(e.device_id);
  }
  return [...ids];
}

export type Tone = "accent" | "info" | "warning" | "fault" | "danger" | "neutral" | "offline";

/** Same palette as the app's Home / Status screens. */
export function statusTone(status: string | undefined): Tone {
  switch (status) {
    case "charging":
      return "accent";
    case "idle":
      return "info";
    case "preparing":
    case "connected":
    case "suspended_ev":
    case "suspended_evse":
    case "end_charge":
    case "suspended_no_power":
    case "reserved":
      return "warning";
    case "faulted":
      return "fault";
    case "shutdown":
      return "danger";
    case "unreachable":
    case "not_available":
    case "unavailable":
    case "unknown":
    case undefined:
      return "offline";
    default:
      return "neutral";
  }
}

/** Number of a state in a target unit (W/kW, Wh/kWh, s/min/h); NaN when not numeric. */
export function numeric(state: HassState | undefined, target?: "kW" | "kWh" | "s"): number {
  if (!state) return Number.NaN;
  const v = Number.parseFloat(state.state);
  if (!Number.isFinite(v)) return Number.NaN;
  const unit = String(state.attributes.unit_of_measurement ?? "");
  if (target === "kW") return unit === "W" ? v / 1000 : unit === "MW" ? v * 1000 : v;
  if (target === "kWh") return unit === "Wh" ? v / 1000 : unit === "MWh" ? v * 1000 : v;
  if (target === "s") {
    if (unit === "min") return v * 60;
    if (unit === "h") return v * 3600;
    if (unit === "d") return v * 86400;
    return v;
  }
  return v;
}

/** "1:05" (h:mm) like the app's duration tile; "0:00" when unknown. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

/** Locale number with a fixed number of decimals ("7,2" in Italian). */
export function formatNumber(v: number, decimals: number, language = "it"): string {
  if (!Number.isFinite(v)) return "–";
  return new Intl.NumberFormat(language, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

/** Point on the gauge arc (same geometry as the app's Gauge: 300×178 viewBox, centre 150,150). */
export function arcPoint(f: number, r: number): [number, number] {
  const th = Math.PI * (1 - f);
  return [150 + r * Math.cos(th), 150 - r * Math.sin(th)];
}

/** SVG path of the coloured part of the gauge for a fraction 0…1. */
export function arcPath(f: number): string {
  const [x, y] = arcPoint(Math.max(0.001, Math.min(1, f)), 120);
  return `M30 150 A120 120 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
}

export interface CurvePoint {
  t: number; // epoch ms
  kw: number;
}

/** Line + area paths of a power curve in a w×h box (time on x, 0…max kW on y). */
export function curvePaths(points: CurvePoint[], w: number, h: number, maxKw?: number): { line: string; area: string } {
  const pts = points.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.kw)).sort((a, b) => a.t - b.t);
  if (pts.length < 2) return { line: "", area: "" };
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const span = Math.max(1, t1 - t0);
  const top = Math.max(maxKw ?? 0, ...pts.map((p) => p.kw), 0.1);
  const xy = pts.map((p) => [((p.t - t0) / span) * w, h - (Math.max(0, p.kw) / top) * (h - 2) - 1] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  return { line, area };
}

/** History rows (`history/history_during_period`, minimal response) → curve points in kW. */
export function historyToPoints(rows: { s: string; lu?: number; lc?: number }[] | undefined, unit: string): CurvePoint[] {
  if (!rows) return [];
  const factor = unit === "W" ? 1 / 1000 : 1;
  const out: CurvePoint[] = [];
  for (const r of rows) {
    const v = Number.parseFloat(r.s);
    const t = (r.lu ?? r.lc ?? Number.NaN) * 1000;
    if (Number.isFinite(v) && Number.isFinite(t)) out.push({ t, kw: v * factor });
  }
  return out;
}
