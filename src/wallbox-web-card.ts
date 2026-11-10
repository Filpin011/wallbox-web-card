// Wallbox WEB card – the app's Status screen as a Home Assistant dashboard card.
// Independent, unofficial project: not affiliated with SCAME PARRE S.p.A. (see DISCLAIMER.md).

import { LitElement, html, nothing, svg, type PropertyValues, type TemplateResult } from "lit";
import { cardStyles } from "./styles";
import { strings, type Strings } from "./localize";
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

declare const __VERSION__: string;

export interface WallboxWebCardConfig {
  type: string;
  device_id?: string;
  name?: string;
  show_curve?: boolean;
  show_actions?: boolean;
  show_last_charge?: boolean;
  curve_hours?: number;
  appearance?: "app" | "theme";
}

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

const CURVE_REFRESH_MS = 60_000;
const ICONS = {
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8z",
  pause: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z",
  play: "M8 5v14l11-7z",
  stop: "M6 6h12v12H6z",
};

const icon = (d: string) => svg`<svg viewBox="0 0 24 24" aria-hidden="true"><path d=${d}></path></svg>`;

export class WallboxWebCard extends LitElement {
  static override styles = cardStyles;

  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _curve: { state: true },
    _busy: { state: true },
  };

  hass?: Hass;
  private _config?: WallboxWebCardConfig;
  private _curve: CurvePoint[] = [];
  private _curveFrom: "recorder" | "history" | null = null;
  private _busy: string | null = null;
  private _curveTimer?: number;
  private _curveLoadedAt = 0;

  // ---- Lovelace API ------------------------------------------------------------------------

  setConfig(config: WallboxWebCardConfig): void {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    if (config.curve_hours !== undefined && !(Number(config.curve_hours) > 0)) {
      throw new Error("curve_hours must be a positive number");
    }
    this._config = { show_curve: true, show_actions: true, show_last_charge: true, curve_hours: 6, appearance: "app", ...config };
    this._curve = [];
    this._curveLoadedAt = 0;
  }

  getCardSize(): number {
    return 8;
  }

  getGridOptions(): Record<string, unknown> {
    return { columns: 12, rows: "auto", min_columns: 6, min_rows: 6 };
  }

  static getStubConfig(hass: HassLike): Partial<WallboxWebCardConfig> {
    const device = stationDevices(hass)[0];
    return device ? { device_id: device } : {};
  }

  static getConfigForm() {
    return {
      schema: [
        { name: "device_id", required: true, selector: { device: { filter: { integration: INTEGRATION } } } },
        { name: "name", selector: { text: {} } },
        {
          type: "grid",
          name: "",
          schema: [
            { name: "show_actions", selector: { boolean: {} } },
            { name: "show_curve", selector: { boolean: {} } },
            { name: "show_last_charge", selector: { boolean: {} } },
            { name: "curve_hours", selector: { number: { min: 1, max: 48, mode: "box", unit_of_measurement: "h" } } },
          ],
        },
        {
          name: "appearance",
          selector: {
            select: {
              mode: "dropdown",
              options: [
                { value: "app", label: "Wallbox WEB" },
                { value: "theme", label: "Home Assistant" },
              ],
            },
          },
        },
      ],
      computeLabel: (schema: { name: string }) => {
        const s = strings(document.documentElement.lang || navigator.language) as unknown as Record<string, string>;
        return s[schema.name] ?? undefined;
      },
      assertConfig: (config: WallboxWebCardConfig) => {
        if (config.curve_hours !== undefined && !(Number(config.curve_hours) > 0)) {
          throw new Error("curve_hours must be a positive number");
        }
      },
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
      const start = new Date(Date.now() - (config.curve_hours ?? 6) * 3_600_000).toISOString();
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

  private _t(): Strings {
    return strings(this.hass?.locale?.language ?? this.hass?.language);
  }

  private _lang(): string {
    return this.hass?.locale?.language ?? this.hass?.language ?? "it";
  }

  // ---- render ------------------------------------------------------------------------------

  protected override render(): TemplateResult {
    const t = this._t();
    if (!this._config || !this.hass) return html``;
    if (!this._config.device_id) return html`<ha-card><div class="placeholder">${t.pickStation}</div></ha-card>`;
    const ents = this._entities();
    const status = this._st(ents, "status");
    if (!status) return html`<ha-card><div class="placeholder">${t.notFound}</div></ha-card>`;

    const unavailable = status.state === "unavailable" || status.state === "unknown";
    const statusKey = unavailable ? "unreachable" : status.state;
    const tone = statusTone(statusKey);
    const charging = statusKey === "charging";
    const faulted = statusKey === "faulted";
    const device = this.hass.devices[this._config.device_id];
    const name = this._config.name || device?.name_by_user || device?.name || "Wallbox";
    const mode = this._st(ents, "behaviour_mode");
    const problem = this._st(ents, "problem")?.state === "on";
    const error = this._st(ents, "error");
    const lang = this._lang();

    return html`
      <ha-card class="tone-${tone}">
        <div class="ambient"></div>
        <div class="band ${charging ? "live" : ""}" @click=${() => this._moreInfo(ents.status)} role="button" tabindex="0">
          <span class="dot"></span>
          <div class="band-text">
            <div class="band-meta">${name}</div>
            <div class="band-label">${unavailable ? t.offline : this._fmt(status)}</div>
          </div>
          ${problem && error && error.state !== "none"
            ? html`<span class="err" title=${this._fmt(error)} @click=${(e: Event) => (e.stopPropagation(), this._moreInfo(ents.error))}>!</span>`
            : nothing}
          ${mode && mode.state !== "unavailable" && mode.state !== "unknown" ? html`<span class="pill">${this._fmt(mode)}</span>` : nothing}
        </div>
        ${this._renderGauge(ents, charging, faulted || unavailable, lang)}
        ${faulted ? nothing : this._renderTiles(ents, t, lang)}
        ${this._config.show_actions ? this._renderActions(ents, t) : nothing}
        ${this._config.show_curve ? this._renderCurve(t, lang, charging) : nothing}
        ${this._config.show_last_charge ? this._renderLast(ents, t, lang) : nothing}
      </ha-card>
    `;
  }

  private _renderGauge(ents: StationEntities, charging: boolean, dimmed: boolean, lang: string): TemplateResult {
    const t = this._t();
    const kw = numeric(this._st(ents, "power"), "kW");
    const value = Number.isFinite(kw) ? Math.max(0, kw) : 0;
    const maxKw = numeric(this._st(ents, "max_available_power"), "kW");
    const max = Number.isFinite(maxKw) && maxKw > 0 ? maxKw : Math.max(7.4, value);
    const limitKw = numeric(this._st(ents, "power_limit"), "kW");
    const f = Math.min(1, value / max);
    const lim = Number.isFinite(limitKw) && limitKw > 0 && limitKw < max ? limitKw / max : null;
    const [n1x, n1y] = arcPoint(f, 74);
    const [n2x, n2y] = arcPoint(f, 110);
    const fmtMax = formatNumber(max, Number.isInteger(Math.round(max * 10) / 10) ? 0 : 1, lang);
    return html`
      <div class="gauge ${dimmed ? "dimmed" : ""}" @click=${() => this._moreInfo(ents.power)}>
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
          <text x="270" y="176" text-anchor="middle" class="g-scale">${fmtMax}</text>
        </svg>
      </div>
      ${dimmed
        ? nothing
        : html`<div class="legend">
            <span>${t.maxAvailable} <strong>${fmtMax} kW</strong></span>
            <span>${t.limit} <strong>${lim !== null || Number.isFinite(limitKw) ? `${formatNumber(limitKw, 1, lang)} kW` : "—"}</strong></span>
          </div>`}
    `;
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

  private _renderActions(ents: StationEntities, t: Strings): TemplateResult | typeof nothing {
    const avail = (k: "start" | "pause" | "resume" | "stop") => {
      const s = this._st(ents, k);
      return !!s && s.state !== "unavailable";
    };
    const btn = (k: "start" | "pause" | "resume" | "stop", label: string, d: string, cls = "") => html`
      <button class="btn ${cls} ${this._busy === k ? "busy" : ""}" ?disabled=${!avail(k)} @click=${() => this._press(ents[k], k)}>
        ${icon(d)}${label}
      </button>
    `;
    // Like the app: no command possible (fault, unreachable, read-only token) → no buttons at all.
    if (!(["start", "pause", "resume", "stop"] as const).some(avail)) return nothing;
    const showStart = avail("start");
    return html`
      <div class="actions">
        ${showStart
          ? btn("start", t.start, ICONS.bolt, "primary")
          : html`${avail("resume") ? btn("resume", t.resume, ICONS.play) : btn("pause", t.pause, ICONS.pause)}
            ${btn("stop", t.stop, ICONS.stop, "danger")}`}
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
    description: "Stato della colonnina con indicatore di potenza, comandi e curva di ricarica (Wallbox WEB).",
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
