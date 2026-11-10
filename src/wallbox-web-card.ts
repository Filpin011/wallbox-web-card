// Wallbox WEB card – the app's Status screen as a Home Assistant dashboard card, in three layouts
// (full, compact, minimal). Independent, unofficial project: not affiliated with SCAME PARRE S.p.A. (see DISCLAIMER.md).

import { LitElement, html, nothing, svg, type PropertyValues, type TemplateResult } from "lit";
import { cardStyles } from "./styles";
import { strings, type Strings } from "./localize";
import { cardSize, gridOptions, normalizeConfig, primaryCommand, type ResolvedConfig, type WallboxWebCardConfig } from "./config";
import { computeHelper, computeLabel, configSchema } from "./editor";
import {
  arcPath,
  arcPoint,
  curvePaths,
  formatDuration,
  formatNumber,
  historyToPoints,
  numeric,
  resolveEntities,
  stationDevices,
  statusTone,
  INTEGRATION,
  type CurvePoint,
  type HassLike,
  type HassState,
  type StationEntities,
} from "./data";

export type { WallboxWebCardConfig } from "./config";

declare const __VERSION__: string;

type Command = "start" | "pause" | "resume" | "stop";

/** What the card needs from `hass` besides HassLike. */
interface Hass extends HassLike {
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  formatEntityState?(stateObj: HassState, state?: string): string;
}

interface CurveAnswer {
  charge: { id?: number } | null;
  samples: { t: string | number; powerW: number }[];
}

/** What every layout renders from. */
interface View {
  t: Strings;
  ents: StationEntities;
  lang: string;
  tone: string;
  charging: boolean;
  faulted: boolean;
  unavailable: boolean;
  name: string;
  label: string;
}

const CURVE_REFRESH_MS = 60_000;
const ICONS = {
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8z",
  pause: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z",
  play: "M8 5v14l11-7z",
  stop: "M6 6h12v12H6z",
};
const COMMAND_ICON: Record<Command, string> = { start: ICONS.bolt, pause: ICONS.pause, resume: ICONS.play, stop: ICONS.stop };

const icon = (d: string) => svg`<svg viewBox="0 0 24 24" aria-hidden="true"><path d=${d}></path></svg>`;

/** Texts in the language Home Assistant sets on <html> (used where `hass` is not available). */
const pageStrings = () => strings(document.documentElement.lang || navigator.language);

export class WallboxWebCard extends LitElement {
  static override styles = cardStyles;

  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _curve: { state: true },
    _busy: { state: true },
  };

  hass?: Hass;
  private _config?: ResolvedConfig;
  private _curve: CurvePoint[] = [];
  private _curveFrom: "recorder" | "history" | null = null;
  private _busy: string | null = null;
  private _curveTimer?: number;
  private _curveLoadedAt = 0;

  // ---- Lovelace API ------------------------------------------------------------------------

  setConfig(config: WallboxWebCardConfig): void {
    this._config = normalizeConfig(config);
    this._curve = [];
    this._curveLoadedAt = 0;
  }

  /** Masonry view height (units of 50 px). */
  getCardSize(): number {
    return this._config ? cardSize(this._config) : 8;
  }

  /** Sections view size: "minimal" is a one-row tile, the other layouts grow with their content. */
  getGridOptions(): Record<string, unknown> {
    return { ...gridOptions(this._config ?? normalizeConfig({ type: "custom:wallbox-web-card" })) };
  }

  static getStubConfig(hass: HassLike): Partial<WallboxWebCardConfig> {
    const device = stationDevices(hass)[0];
    return device ? { device_id: device } : {};
  }

  static getConfigForm() {
    const t = pageStrings();
    return {
      schema: configSchema(t),
      computeLabel: (schema: { name: string }) => computeLabel(t, schema),
      computeHelper: (schema: { name: string }) => computeHelper(t, schema),
      assertConfig: (config: WallboxWebCardConfig) => void normalizeConfig(config),
    };
  }

  // ---- lifecycle ---------------------------------------------------------------------------

  override connectedCallback(): void {
    super.connectedCallback();
    this._curveTimer = window.setInterval(() => void this._loadCurve(), CURVE_REFRESH_MS);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._curveTimer) window.clearInterval(this._curveTimer);
  }

  protected override shouldUpdate(changed: PropertyValues): boolean {
    if (changed.size !== 1 || !changed.has("hass")) return true;
    const old = changed.get("hass") as Hass | undefined;
    if (!old || !this.hass || old.entities !== this.hass.entities || old.locale !== this.hass.locale) return true;
    // Re-render only when one of our entities changed.
    const ents = this._entities();
    return Object.values(ents).some((id) => id && old.states[id] !== this.hass!.states[id]);
  }

  protected override updated(changed: PropertyValues): void {
    this.dataset.appearance = this._config?.appearance === "theme" ? "theme" : "app";
    this.dataset.layout = this._config?.layout ?? "full";
    if (changed.has("hass") && this._config?.show_curve && Date.now() - this._curveLoadedAt > CURVE_REFRESH_MS) {
      void this._loadCurve();
    }
  }

  // ---- data --------------------------------------------------------------------------------

  private _entities(): StationEntities {
    return this.hass ? resolveEntities(this.hass, this._config?.device_id) : {};
  }

  private _st(ents: StationEntities, key: keyof StationEntities): HassState | undefined {
    const id = ents[key];
    return id ? this.hass?.states[id] : undefined;
  }

  private _fmt(state: HassState | undefined): string {
    if (!state) return "–";
    return this.hass?.formatEntityState ? this.hass.formatEntityState(state) : state.state;
  }

  private _available(ents: StationEntities, k: Command): boolean {
    const s = this._st(ents, k);
    return !!s && s.state !== "unavailable";
  }

  private _limits(ents: StationEntities): { maxKw: number; limitKw: number } {
    return {
      maxKw: numeric(this._st(ents, "max_available_power"), "kW"),
      limitKw: numeric(this._st(ents, "power_limit"), "kW"),
    };
  }

  private async _loadCurve(): Promise<void> {
    const hass = this.hass;
    const config = this._config;
    if (!hass || !config?.show_curve || !config.device_id) return;
    this._curveLoadedAt = Date.now();
    try {
      const r = await hass.callWS<CurveAnswer>({ type: `${INTEGRATION}/charge_curve`, device_id: config.device_id });
      const pts = (r.samples ?? []).map((s) => ({ t: typeof s.t === "number" ? s.t : Date.parse(s.t), kw: s.powerW / 1000 }));
      if (pts.length >= 2) {
        this._curve = pts;
        this._curveFrom = "recorder";
        return;
      }
    } catch {
      // older integration / server without recorder: fall back to the power sensor's history
    }
    const power = this._entities().power;
    if (!power) return;
    try {
      const start = new Date(Date.now() - config.curve_hours * 3_600_000).toISOString();
      const r = await hass.callWS<Record<string, { s: string; lu?: number; lc?: number }[]>>({
        type: "history/history_during_period",
        start_time: start,
        entity_ids: [power],
        minimal_response: true,
        no_attributes: true,
      });
      const unit = String(hass.states[power]?.attributes.unit_of_measurement ?? "kW");
      this._curve = historyToPoints(r[power], unit);
      this._curveFrom = "history";
    } catch {
      this._curve = [];
    }
  }

  private async _press(entityId: string | undefined, key: string): Promise<void> {
    if (!entityId || !this.hass || this._busy) return;
    this._busy = key;
    try {
      await this.hass.callService("button", "press", { entity_id: entityId });
    } catch (err) {
      this.dispatchEvent(
        new CustomEvent("hass-notification", {
          detail: { message: `${this._t().commandFailed}: ${(err as Error).message ?? err}` },
          bubbles: true,
          composed: true,
        }),
      );
    } finally {
      this._busy = null;
    }
  }

  private _moreInfo(entityId: string | undefined): void {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  /** The card's tap action: `tap_action` from the config, more-info of the Power sensor by default. */
  private _tap(ents: StationEntities): void {
    const action = this._config?.tap_action;
    const entity = ents.power ?? ents.status;
    if (!action) return this._moreInfo(entity);
    if (action.action === "none") return;
    // Home Assistant runs the standard actions (more-info, navigate, url, perform-action, …) for this event.
    this.dispatchEvent(
      new CustomEvent("hass-action", {
        detail: { config: { entity, tap_action: action }, action: "tap" },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _keyTap(e: KeyboardEvent, ents: StationEntities): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    this._tap(ents);
  }

  private _t(): Strings {
    return strings(this.hass?.locale?.language ?? this.hass?.language);
  }

  private _lang(): string {
    return this.hass?.locale?.language ?? this.hass?.language ?? "en";
  }

  // ---- render ------------------------------------------------------------------------------

  protected override render(): TemplateResult {
    const t = this._t();
    const config = this._config;
    if (!config || !this.hass) return html``;
    if (!config.device_id) return html`<ha-card><div class="placeholder">${t.pickStation}</div></ha-card>`;
    const ents = this._entities();
    const status = this._st(ents, "status");
    if (!status) return html`<ha-card><div class="placeholder">${t.notFound}</div></ha-card>`;

    const unavailable = status.state === "unavailable" || status.state === "unknown";
    const statusKey = unavailable ? "unreachable" : status.state;
    const device = this.hass.devices[config.device_id];
    const view: View = {
      t,
      ents,
      lang: this._lang(),
      tone: statusTone(statusKey),
      charging: statusKey === "charging",
      faulted: statusKey === "faulted",
      unavailable,
      name: config.name || device?.name_by_user || device?.name || "Wallbox",
      label: unavailable ? t.offline : this._fmt(status),
    };
    if (config.layout === "minimal") return this._renderMinimal(config, view);
    if (config.layout === "compact") return this._renderCompact(config, view);
    return this._renderFull(config, view);
  }

  private _renderFull(config: ResolvedConfig, v: View): TemplateResult {
    const { t, ents, lang } = v;
    const mode = this._st(ents, "behaviour_mode");
    const dimmed = v.faulted || v.unavailable;
    return html`
      <ha-card class="tone-${v.tone}">
        <div class="ambient"></div>
        ${config.show_status
          ? html`<div class="band ${v.charging ? "live" : ""}" @click=${() => this._moreInfo(ents.status)} role="button" tabindex="0">
              <span class="dot"></span>
              <div class="band-text">
                <div class="band-meta">${v.name}</div>
                <div class="band-label">${v.label}</div>
              </div>
              ${this._errorBadge(v)}
              ${mode && mode.state !== "unavailable" && mode.state !== "unknown" ? html`<span class="pill">${this._fmt(mode)}</span>` : nothing}
            </div>`
          : nothing}
        ${config.show_gauge ? this._renderGauge(ents, v.charging, dimmed, lang, config.show_limits) : nothing}
        ${config.show_limits && !dimmed ? this._renderLegend(ents, t, lang) : nothing}
        ${config.show_tiles && !v.faulted ? this._renderTiles(ents, t, lang) : nothing}
        ${config.show_actions ? this._renderActions(ents, t) : nothing}
        ${config.show_curve ? this._renderCurve(t, lang, v.charging) : nothing}
        ${config.show_last_charge ? this._renderLast(ents, t, lang) : nothing}
      </ha-card>
    `;
  }

  private _renderCompact(config: ResolvedConfig, v: View): TemplateResult {
    const { t, ents, lang } = v;
    const dimmed = v.faulted || v.unavailable;
    const kw = numeric(this._st(ents, "power"), "kW");
    const energy = numeric(this._st(ents, "session_energy"), "kWh");
    const seconds = numeric(this._st(ents, "session_duration"), "s");
    const { maxKw, limitKw } = this._limits(ents);
    const stats: TemplateResult[] = [];
    if (config.show_tiles && !v.faulted) {
      stats.push(
        html`<span class="stat" @click=${() => this._moreInfo(ents.session_energy)}
          >${t.energy} <strong>${formatNumber(Number.isFinite(energy) ? energy : 0, 1, lang)} kWh</strong></span
        >`,
        html`<span class="stat" @click=${() => this._moreInfo(ents.session_duration)}
          >${t.duration} <strong>${formatDuration(seconds)}</strong></span
        >`,
      );
    }
    if (config.show_limits && !dimmed && Number.isFinite(maxKw)) {
      stats.push(
        html`<span class="stat" @click=${() => this._moreInfo(ents.power_limit)}
          >${t.limit} <strong>${Number.isFinite(limitKw) ? formatNumber(limitKw, 1, lang) : "—"}</strong> /
          ${formatNumber(maxKw, 1, lang)} kW</span
        >`,
      );
    }
    return html`
      <ha-card class="tone-${v.tone} compact">
        <div class="ambient"></div>
        <div class="c-head" role="button" tabindex="0" @click=${() => this._tap(ents)} @keydown=${(e: KeyboardEvent) => this._keyTap(e, ents)}>
          <div class="c-id">
            <div class="c-name">${v.name}</div>
            ${config.show_status
              ? html`<span class="status-pill ${v.charging ? "live" : ""}"><span class="dot"></span>${v.label}</span>`
              : nothing}
          </div>
          ${this._errorBadge(v)}
          <div class="c-power ${dimmed ? "dimmed" : ""}">
            <span class="c-kw">${formatNumber(Number.isFinite(kw) ? Math.max(0, kw) : 0, 1, lang)}</span><span class="c-unit">kW</span>
          </div>
        </div>
        ${stats.length ? html`<div class="c-stats ${!(energy > 0) && !(seconds > 0) ? "muted" : ""}">${stats}</div>` : nothing}
        ${config.show_actions ? this._renderActions(ents, t, true) : nothing}
        ${config.show_curve ? this._renderCurve(t, lang, v.charging) : nothing}
        ${config.show_last_charge ? this._renderLast(ents, t, lang) : nothing}
      </ha-card>
    `;
  }

  private _renderMinimal(config: ResolvedConfig, v: View): TemplateResult {
    const { t, ents, lang } = v;
    const kw = numeric(this._st(ents, "power"), "kW");
    const cmd = config.show_actions ? primaryCommand((k) => this._available(ents, k)) : null;
    const dimmed = v.unavailable || v.faulted;
    return html`
      <ha-card class="tone-${v.tone} minimal">
        <div class="ambient"></div>
        <div class="m-row" role="button" tabindex="0" @click=${() => this._tap(ents)} @keydown=${(e: KeyboardEvent) => this._keyTap(e, ents)}>
          <span class="m-badge ${v.charging ? "live" : ""}"><span class="dot"></span></span>
          <div class="m-text">
            <div class="m-name">${v.name}</div>
            ${config.show_status ? html`<div class="m-state">${v.label}</div>` : nothing}
          </div>
          <div class="m-power ${dimmed ? "dimmed" : ""}">
            <strong>${v.unavailable ? "–" : formatNumber(Number.isFinite(kw) ? Math.max(0, kw) : 0, 1, lang)}</strong> kW
          </div>
          ${cmd
            ? html`<button
                class="m-btn ${cmd === "start" ? "primary" : cmd === "stop" ? "danger" : ""} ${this._busy === cmd ? "busy" : ""}"
                aria-label=${t[cmd]}
                title=${t[cmd]}
                @click=${(e: Event) => (e.stopPropagation(), this._press(ents[cmd], cmd))}
                @keydown=${(e: Event) => e.stopPropagation()}
              >
                ${icon(COMMAND_ICON[cmd])}
              </button>`
            : nothing}
        </div>
      </ha-card>
    `;
  }

  private _errorBadge({ ents }: View): TemplateResult | typeof nothing {
    const error = this._st(ents, "error");
    if (this._st(ents, "problem")?.state !== "on" || !error || error.state === "none") return nothing;
    return html`<span class="err" title=${this._fmt(error)} @click=${(e: Event) => (e.stopPropagation(), this._moreInfo(ents.error))}>!</span>`;
  }

  private _gaugeMax(ents: StationEntities, value: number): number {
    const { maxKw } = this._limits(ents);
    return Number.isFinite(maxKw) && maxKw > 0 ? maxKw : Math.max(7.4, value);
  }

  private _renderGauge(ents: StationEntities, charging: boolean, dimmed: boolean, lang: string, showLimit: boolean): TemplateResult {
    const t = this._t();
    const kw = numeric(this._st(ents, "power"), "kW");
    const value = Number.isFinite(kw) ? Math.max(0, kw) : 0;
    const max = this._gaugeMax(ents, value);
    const { limitKw } = this._limits(ents);
    const f = Math.min(1, value / max);
    const lim = showLimit && Number.isFinite(limitKw) && limitKw > 0 && limitKw < max ? limitKw / max : null;
    const [n1x, n1y] = arcPoint(f, 74);
    const [n2x, n2y] = arcPoint(f, 110);
    return html`
      <div
        class="gauge ${dimmed ? "dimmed" : ""}"
        role="button"
        tabindex="0"
        @click=${() => this._tap(ents)}
        @keydown=${(e: KeyboardEvent) => this._keyTap(e, ents)}
      >
        ${charging && !dimmed ? html`<span class="glow"></span>` : nothing}
        <svg viewBox="0 0 300 178" role="img" aria-label="${t.power} ${formatNumber(value, 1, lang)} kW">
          <defs>
            <filter id="wc-blur" filterUnits="userSpaceOnUse" x="-40" y="-40" width="380" height="258">
              <feGaussianBlur stdDeviation="6"></feGaussianBlur>
            </filter>
          </defs>
          <path class="g-track" d="M30 150 A120 120 0 0 1 270 150" fill="none" stroke-width="12" stroke-linecap="round"></path>
          ${f > 0.004 && charging && !dimmed
            ? svg`<path class="g-arc" d=${arcPath(f)} fill="none" stroke-width="14" stroke-linecap="round" filter="url(#wc-blur)" opacity="0.55"></path>`
            : nothing}
          ${f > 0.004 ? svg`<path class="g-arc" d=${arcPath(f)} fill="none" stroke-width="12" stroke-linecap="round"></path>` : nothing}
          ${lim !== null
            ? svg`<line class="g-limit" x1=${arcPoint(lim, 108)[0]} y1=${arcPoint(lim, 108)[1]} x2=${arcPoint(lim, 134)[0]} y2=${arcPoint(lim, 134)[1]} stroke-width="3" stroke-linecap="round"></line>`
            : nothing}
          ${dimmed ? nothing : svg`<line class="g-needle" x1=${n1x} y1=${n1y} x2=${n2x} y2=${n2y} stroke-width="4" stroke-linecap="round"></line>`}
          <text x="150" y="128" text-anchor="middle" class="g-value">${formatNumber(value, 1, lang)}</text>
          <text x="150" y="154" text-anchor="middle" class="g-unit">kW</text>
          <text x="30" y="176" text-anchor="middle" class="g-scale">0</text>
          <text x="270" y="176" text-anchor="middle" class="g-scale">${formatMax(max, lang)}</text>
        </svg>
      </div>
    `;
  }

  private _renderLegend(ents: StationEntities, t: Strings, lang: string): TemplateResult {
    const kw = numeric(this._st(ents, "power"), "kW");
    const max = this._gaugeMax(ents, Number.isFinite(kw) ? kw : 0);
    const { limitKw } = this._limits(ents);
    return html`<div class="legend">
      <span>${t.maxAvailable} <strong>${formatMax(max, lang)} kW</strong></span>
      <span>${t.limit} <strong>${Number.isFinite(limitKw) ? `${formatNumber(limitKw, 1, lang)} kW` : "—"}</strong></span>
    </div>`;
  }

  private _renderTiles(ents: StationEntities, t: Strings, lang: string): TemplateResult {
    const energy = numeric(this._st(ents, "session_energy"), "kWh");
    const seconds = numeric(this._st(ents, "session_duration"), "s");
    const muted = !(energy > 0) && !(seconds > 0);
    return html`
      <div class="tiles ${muted ? "muted" : ""}">
        <div class="tile" @click=${() => this._moreInfo(ents.session_energy)}>
          <div class="tile-label">${t.energy}</div>
          <div class="tile-value">${formatNumber(Number.isFinite(energy) ? energy : 0, 1, lang)}<span class="tile-unit">kWh</span></div>
        </div>
        <div class="tile" @click=${() => this._moreInfo(ents.session_duration)}>
          <div class="tile-label">${t.duration}</div>
          <div class="tile-value">${formatDuration(seconds)}<span class="tile-unit">${t.hoursMinutes}</span></div>
        </div>
      </div>
    `;
  }

  private _renderActions(ents: StationEntities, t: Strings, small = false): TemplateResult | typeof nothing {
    const avail = (k: Command) => this._available(ents, k);
    const btn = (k: Command, cls = "") => html`
      <button class="btn ${cls} ${this._busy === k ? "busy" : ""}" ?disabled=${!avail(k)} @click=${() => this._press(ents[k], k)}>
        ${icon(COMMAND_ICON[k])}${t[k]}
      </button>
    `;
    // Like the app: no command possible (fault, unreachable, read-only token) → no buttons at all.
    if (!(["start", "pause", "resume", "stop"] as const).some(avail)) return nothing;
    return html`
      <div class="actions ${small ? "small" : ""}">
        ${avail("start")
          ? btn("start", "primary")
          : html`${avail("resume") ? btn("resume") : btn("pause")} ${btn("stop", "danger")}`}
      </div>
    `;
  }

  private _renderCurve(t: Strings, lang: string, charging: boolean): TemplateResult {
    const pts = this._curve;
    const { line, area } = curvePaths(pts, 300, 64);
    const peak = pts.reduce((m, p) => Math.max(m, p.kw), 0);
    return html`
      <div class="curve" data-source=${this._curveFrom ?? "none"}>
        <div class="curve-head">
          <span>${t.curve}</span>
          ${line ? html`<span>max <strong>${formatNumber(peak, 1, lang)} kW</strong></span>` : nothing}
        </div>
        ${line
          ? html`<svg viewBox="0 0 300 64" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="wc-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop class="c-stop" offset="0" stop-opacity="0.32"></stop>
                  <stop class="c-stop" offset="1" stop-opacity="0"></stop>
                </linearGradient>
              </defs>
              <path class="c-area" d=${area}></path>
              <path class="c-line" d=${line} vector-effect="non-scaling-stroke"></path>
            </svg>`
          : html`<div class="c-empty">${charging ? "…" : t.curveEmpty}</div>`}
      </div>
    `;
  }

  private _renderLast(ents: StationEntities, t: Strings, lang: string): TemplateResult | typeof nothing {
    const energy = numeric(this._st(ents, "last_charge_energy"), "kWh");
    if (!Number.isFinite(energy)) return nothing;
    const cost = this._st(ents, "last_charge_cost");
    const saving = this._st(ents, "last_charge_saving");
    const money = (s: HassState | undefined) => {
      const v = numeric(s);
      if (!Number.isFinite(v)) return null;
      const cur = String(s?.attributes.unit_of_measurement ?? "EUR");
      try {
        return new Intl.NumberFormat(lang, { style: "currency", currency: cur }).format(v);
      } catch {
        return `${formatNumber(v, 2, lang)} ${cur}`;
      }
    };
    const c = money(cost);
    const sv = money(saving);
    return html`
      <div class="last" @click=${() => this._moreInfo(ents.last_charge_energy)}>
        <span>${t.lastCharge} <strong>${formatNumber(energy, 1, lang)} kWh</strong>${c ? html` · <strong>${c}</strong>` : nothing}</span>
        ${sv ? html`<span class="save">${sv} ${t.saving}</span>` : nothing}
      </div>
    `;
  }
}

/** Gauge scale end: "7,4" or "22". */
function formatMax(max: number, lang: string): string {
  return formatNumber(max, Number.isInteger(Math.round(max * 10) / 10) ? 0 : 1, lang);
}

if (!customElements.get("wallbox-web-card")) customElements.define("wallbox-web-card", WallboxWebCard);

interface CustomCardEntry {
  type: string;
  name: string;
  description: string;
  preview?: boolean;
  documentationURL?: string;
  getEntitySuggestion?: (hass: HassLike, entityId: string) => { config: Record<string, unknown> } | null;
}

const w = window as unknown as { customCards?: CustomCardEntry[] };
w.customCards = w.customCards || [];
if (!w.customCards.some((c) => c.type === "wallbox-web-card")) {
  w.customCards.push({
    type: "wallbox-web-card",
    name: "Wallbox WEB",
    description: pageStrings().cardDescription,
    preview: true,
    documentationURL: "https://github.com/Filpin011/wallbox-web-card",
    getEntitySuggestion: (hass, entityId) => {
      const e = hass.entities[entityId];
      if (e?.platform !== INTEGRATION || !e.device_id || e.translation_key !== "status") return null;
      return { config: { type: "custom:wallbox-web-card", device_id: e.device_id } };
    },
  });
}

console.info(`%c WALLBOX-WEB-CARD %c ${typeof __VERSION__ === "string" ? __VERSION__ : "dev"} `, "background:#3be58a;color:#0a0b0d;font-weight:700", "background:#15171b;color:#f4f5f7");
