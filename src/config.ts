// Card configuration: defaults per layout, validation and sizing (pure, unit-tested with `node --test`).

export const LAYOUTS = ["full", "compact", "minimal"] as const;
export type Layout = (typeof LAYOUTS)[number];

export const TOGGLES = [
  "show_status",
  "show_gauge",
  "show_limits",
  "show_tiles",
  "show_actions",
  "show_curve",
  "show_last_charge",
] as const;
export type Toggle = (typeof TOGGLES)[number];

/** Home Assistant action config (`tap_action`), as produced by the `ui_action` selector. */
export interface ActionConfig {
  action: string;
  [key: string]: unknown;
}

export interface WallboxWebCardConfig {
  type: string;
  device_id?: string;
  name?: string;
  layout?: Layout;
  show_status?: boolean;
  show_gauge?: boolean;
  show_limits?: boolean;
  show_tiles?: boolean;
  show_actions?: boolean;
  show_curve?: boolean;
  show_last_charge?: boolean;
  curve_hours?: number;
  appearance?: "app" | "theme";
  tap_action?: ActionConfig;
}

/** Config with every option resolved (what the card renders from). */
export type ResolvedConfig = Omit<WallboxWebCardConfig, Toggle | "layout" | "curve_hours" | "appearance"> &
  Record<Toggle, boolean> & { layout: Layout; curve_hours: number; appearance: "app" | "theme" };

/**
 * Blocks shown by default in each layout. `false` = off unless enabled; a block missing from a layout
 * (e.g. the gauge in "compact") is never rendered there, whatever the option says.
 */
export const LAYOUT_DEFAULTS: Record<Layout, Record<Toggle, boolean>> = {
  full: {
    show_status: true,
    show_gauge: true,
    show_limits: true,
    show_tiles: true,
    show_actions: true,
    show_curve: true,
    show_last_charge: true,
  },
  compact: {
    show_status: true,
    show_gauge: false,
    show_limits: false,
    show_tiles: true,
    show_actions: true,
    show_curve: false,
    show_last_charge: false,
  },
  minimal: {
    show_status: true,
    show_gauge: false,
    show_limits: false,
    show_tiles: false,
    show_actions: true,
    show_curve: false,
    show_last_charge: false,
  },
};

/** Options each layout can render (the editor shows only these toggles). */
export const LAYOUT_TOGGLES: Record<Layout, readonly Toggle[]> = {
  full: TOGGLES,
  compact: ["show_status", "show_tiles", "show_limits", "show_actions", "show_curve", "show_last_charge"],
  minimal: ["show_status", "show_actions"],
};

export const DEFAULT_CURVE_HOURS = 6;

/** Validates a raw card config and fills in the defaults of its layout. Throws on invalid values. */
export function normalizeConfig(raw: unknown): ResolvedConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid configuration");
  const config = raw as WallboxWebCardConfig;
  const layout = config.layout ?? "full";
  if (!(LAYOUTS as readonly string[]).includes(layout)) {
    throw new Error(`layout must be one of: ${LAYOUTS.join(", ")}`);
  }
  if (config.curve_hours !== undefined && !(Number(config.curve_hours) > 0)) {
    throw new Error("curve_hours must be a positive number");
  }
  if (config.appearance !== undefined && config.appearance !== "app" && config.appearance !== "theme") {
    throw new Error("appearance must be app or theme");
  }
  if (config.tap_action !== undefined && (typeof config.tap_action !== "object" || !config.tap_action?.action)) {
    throw new Error("tap_action must be an action config (e.g. action: more-info)");
  }
  const toggles = { ...LAYOUT_DEFAULTS[layout] };
  for (const key of TOGGLES) {
    const v = config[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "boolean") throw new Error(`${key} must be true or false`);
    if (LAYOUT_TOGGLES[layout].includes(key)) toggles[key] = v;
  }
  return {
    ...config,
    ...toggles,
    layout,
    curve_hours: config.curve_hours !== undefined ? Number(config.curve_hours) : DEFAULT_CURVE_HOURS,
    appearance: config.appearance ?? "app",
  };
}

export interface GridOptions {
  columns: number | "full";
  rows: number | "auto";
  min_columns?: number;
  max_columns?: number;
  min_rows?: number;
  max_rows?: number;
}

/**
 * Sections view size (12 columns per section, rows of 56 px + 8 px gap).
 * "minimal" behaves like a tile card: half a section, one row; the others take the full width and grow with
 * their content.
 */
export function gridOptions(config: ResolvedConfig): GridOptions {
  if (config.layout === "minimal") return { columns: 6, rows: 1, min_columns: 6, min_rows: 1 };
  return { columns: 12, rows: "auto", min_columns: 6 };
}

/** Masonry height in units of 50 px (estimate from the visible blocks). */
export function cardSize(config: ResolvedConfig): number {
  if (config.layout === "minimal") return 1;
  let px = 32; // card padding
  const block = (on: boolean, h: number) => {
    if (on) px += h + 12;
  };
  if (config.layout === "compact") {
    block(true, 56); // head: name, status, power
    block(config.show_tiles || config.show_limits, 22);
    block(config.show_actions, 40);
  } else {
    block(config.show_status, 64);
    block(config.show_gauge, config.show_limits ? 210 : 190);
    block(!config.show_gauge && config.show_limits, 20);
    block(config.show_tiles, 76);
    block(config.show_actions, 50);
  }
  block(config.show_curve, 104);
  block(config.show_last_charge, 20);
  return Math.max(1, Math.ceil(px / 50));
}

/** The primary command for the one-button layouts: Start, else Resume, else Pause, else Stop. */
export function primaryCommand(
  available: (k: "start" | "pause" | "resume" | "stop") => boolean,
): "start" | "pause" | "resume" | "stop" | null {
  for (const k of ["start", "resume", "pause", "stop"] as const) if (available(k)) return k;
  return null;
}
