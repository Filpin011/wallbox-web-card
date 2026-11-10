import { css } from "lit";

/**
 * The app's design tokens (Wallbox WEB, dark "Liquid Glass" look): palette, radii, glass recipe, glows.
 * Every token can be overridden from a Home Assistant theme with the same name prefixed by `wallbox-`
 * (e.g. `wallbox-accent: "#3be58a"` in themes.yaml → `--wallbox-accent`).
 */
export const cardStyles = css`
  :host {
    --wc-bg: var(--wallbox-bg, #0a0b0d);
    --wc-surface: var(--wallbox-surface, #15171b);
    --wc-surface-2: var(--wallbox-surface-2, #1e2126);
    --wc-text: var(--wallbox-text, #f4f5f7);
    --wc-text-2: var(--wallbox-text-2, #a3a9b3);
    --wc-text-3: var(--wallbox-text-3, #7c838e);
    --wc-accent: var(--wallbox-accent, #3be58a);
    --wc-info: var(--wallbox-info, #5ab0ff);
    --wc-warning: var(--wallbox-warning, #f5c044);
    --wc-fault: var(--wallbox-fault, #ff8a3d);
    --wc-danger: var(--wallbox-danger, #ff8a80);
    --wc-glass-fill: rgba(36, 39, 45, 0.5);
    --wc-glass-filter: blur(14px) saturate(190%) brightness(1.12);
    --wc-glass-capsule:
      inset 20px 0 20px -30px rgba(178, 178, 178, 0.35), inset -20px 0 20px -30px rgba(178, 178, 178, 0.35),
      inset 0 1px 0.5px -0.5px rgba(255, 255, 255, 0.28), inset 0 -1px 0.5px -0.5px rgba(255, 255, 255, 0.08),
      inset 1.25px 0 0 -0.75px rgba(191, 191, 191, 0.4), inset -1.25px 0 0 -0.75px rgba(191, 191, 191, 0.4),
      0 0 0 0.5px rgba(191, 191, 191, 0.14), 0 6px 18px rgba(0, 0, 0, 0.32);
    --wc-lit: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 0 0.5px rgba(255, 255, 255, 0.05);
    --wc-font: var(--ha-font-family-body, Inter, -apple-system, "SF Pro Text", system-ui, sans-serif);
    --wc-tone: var(--wc-info);
    display: block;
  }
  :host([data-appearance="theme"]) {
    --wc-bg: var(--ha-card-background, var(--card-background-color, #fff));
    --wc-surface: var(--secondary-background-color, rgba(127, 127, 127, 0.1));
    --wc-surface-2: var(--divider-color, rgba(127, 127, 127, 0.2));
    --wc-text: var(--primary-text-color, #212121);
    --wc-text-2: var(--secondary-text-color, #727272);
    --wc-text-3: var(--disabled-text-color, #9e9e9e);
    --wc-glass-fill: var(--secondary-background-color, rgba(127, 127, 127, 0.12));
    --wc-lit: none;
  }

  ha-card {
    position: relative;
    overflow: hidden;
    isolation: isolate;
    padding: 16px;
    background: var(--wc-bg);
    color: var(--wc-text);
    font-family: var(--wc-font);
    border-radius: var(--ha-card-border-radius, 26px);
    display: flex;
    flex-direction: column;
    gap: 14px;
    -webkit-font-smoothing: antialiased;
  }

  /* ambient light in the status colour (the app's <Ambient>), behind everything */
  .ambient {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(120% 60% at 50% -10%, color-mix(in srgb, var(--wc-tone) 14%, transparent), transparent 70%),
      radial-gradient(80% 50% at 110% 110%, rgba(90, 176, 255, 0.045), transparent 70%);
    transition: background 600ms ease;
  }

  .tone-accent { --wc-tone: var(--wc-accent); }
  .tone-info { --wc-tone: var(--wc-info); }
  .tone-warning { --wc-tone: var(--wc-warning); }
  .tone-fault { --wc-tone: var(--wc-fault); }
  .tone-danger { --wc-tone: var(--wc-danger); }
  .tone-neutral { --wc-tone: var(--wc-text-2); }
  .tone-offline { --wc-tone: var(--wc-text-3); }

  /* ---- status band ---- */
  .band {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--wc-tone) 13%, var(--wc-surface));
    box-shadow: var(--wc-lit);
    cursor: pointer;
    position: relative;
    overflow: hidden;
  }
  .band.live::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.07) 50%, transparent 70%);
    transform: translateX(-100%);
    animation: sweep 3.2s ease-in-out infinite;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: none;
    background: var(--wc-tone);
    box-shadow: 0 0 12px color-mix(in srgb, var(--wc-tone) 60%, transparent);
  }
  .tone-offline .dot { background: transparent; box-shadow: inset 0 0 0 2px var(--wc-text-3); }
  .band.live .dot { animation: pulse 1.6s ease-in-out infinite; }
  .band-text { flex: 1; min-width: 0; }
  .band-meta { font-size: 12px; line-height: 1.3; color: var(--wc-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .band-label { font-size: 17px; font-weight: 600; line-height: 1.3; letter-spacing: -0.2px; color: var(--wc-text); }
  .pill {
    flex: none;
    font-size: 12px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 999px;
    color: var(--wc-text);
    background: rgba(244, 245, 247, 0.08);
  }
  .err {
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    color: var(--wc-fault);
    background: rgba(255, 138, 61, 0.14);
    font-weight: 700;
  }

  /* ---- gauge ---- */
  .gauge { position: relative; margin: 0 auto; width: 100%; max-width: 320px; }
  .gauge svg { width: 100%; height: auto; display: block; overflow: visible; }
  .gauge .glow { position: absolute; left: 10%; right: 10%; top: 18%; height: 70%; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--wc-tone) 30%, transparent), transparent); filter: blur(18px); animation: breathe 3.6s ease-in-out infinite; pointer-events: none; }
  .g-track { stroke: var(--wc-surface-2); }
  .g-arc { stroke: var(--wc-tone); transition: d 700ms cubic-bezier(0.2, 0.8, 0.2, 1), stroke 400ms ease; }
  .g-needle, .g-limit { stroke: var(--wc-text); transition: all 700ms cubic-bezier(0.2, 0.8, 0.2, 1); }
  .g-value { font-size: 44px; font-weight: 600; letter-spacing: -1.5px; fill: var(--wc-text); font-variant-numeric: tabular-nums; }
  .g-unit { font-size: 14px; fill: var(--wc-text-2); }
  .g-scale { font-size: 12px; fill: var(--wc-text-3); }
  .legend { display: flex; justify-content: center; gap: 18px; font-size: 13px; color: var(--wc-text-2); margin-top: -2px; flex-wrap: wrap; }
  .legend strong { color: var(--wc-text); font-weight: 600; }
  .dimmed { opacity: 0.5; }

  /* ---- tiles ---- */
  .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .tile { padding: 12px 14px; border-radius: 18px; background: var(--wc-surface); box-shadow: var(--wc-lit); min-width: 0; }
  .tile-label { font-size: 13px; color: var(--wc-text-2); }
  .tile-value { font-size: 26px; font-weight: 600; letter-spacing: -0.6px; line-height: 1.2; font-variant-numeric: tabular-nums; }
  .tile-unit { font-size: 14px; font-weight: 500; color: var(--wc-text-2); margin-left: 4px; letter-spacing: 0; }
  .muted .tile-value { color: var(--wc-text-3); }

  /* ---- glass buttons ---- */
  .actions { display: flex; gap: 10px; }
  .btn {
    flex: 1;
    height: 50px;
    border: 0;
    border-radius: 999px;
    font: 600 16px/1 var(--wc-font);
    color: var(--wc-text);
    background: var(--wc-glass-fill);
    -webkit-backdrop-filter: var(--wc-glass-filter);
    backdrop-filter: var(--wc-glass-filter);
    box-shadow: var(--wc-glass-capsule);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition: transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1), filter 150ms ease, opacity 150ms ease;
    -webkit-tap-highlight-color: transparent;
  }
  .btn:active:not([disabled]) { transform: scale(0.96); filter: brightness(1.25); }
  .btn:focus-visible { outline: 2px solid var(--wc-info); outline-offset: 2px; }
  .btn[disabled] { opacity: 0.4; cursor: default; }
  .btn.primary { background: color-mix(in srgb, var(--wc-text) 86%, transparent); color: var(--wallbox-on-light, #0a0b0d); }
  .btn.danger { color: var(--wc-danger); }
  .btn.busy { opacity: 0.6; pointer-events: none; }
  .btn svg { width: 18px; height: 18px; fill: currentColor; }

  /* ---- curve ---- */
  .curve { padding: 12px 14px 10px; border-radius: 18px; background: var(--wc-surface); box-shadow: var(--wc-lit); }
  .curve-head { display: flex; justify-content: space-between; font-size: 13px; color: var(--wc-text-2); margin-bottom: 6px; }
  .curve-head strong { color: var(--wc-text); font-weight: 600; }
  .curve svg { width: 100%; height: 64px; display: block; }
  .c-line { fill: none; stroke: var(--wc-tone); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; filter: drop-shadow(0 0 6px color-mix(in srgb, var(--wc-tone) 45%, transparent)); }
  .c-area { fill: url(#wc-fill); }
  .c-stop { stop-color: var(--wc-tone); }
  .c-empty { font-size: 13px; color: var(--wc-text-3); text-align: center; padding: 18px 0; }

  /* ---- last charge ---- */
  .last { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: 14px; color: var(--wc-text-2); padding: 0 4px; }
  .last strong { color: var(--wc-text); font-weight: 600; }
  .last .save { color: var(--wc-accent); font-weight: 600; }

  .placeholder { padding: 24px 16px; color: var(--wc-text-2); font-size: 14px; text-align: center; }
  [role="button"] { cursor: pointer; -webkit-tap-highlight-color: transparent; }
  [role="button"]:focus-visible { outline: 2px solid var(--wc-info); outline-offset: 2px; border-radius: 16px; }

  /* ---- compact layout ---- */
  ha-card.compact { gap: 12px; padding: 14px; }
  .c-head { display: flex; align-items: center; gap: 12px; }
  .c-id { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
  .c-name { font-size: 15px; font-weight: 600; letter-spacing: -0.2px; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    max-width: 100%;
    padding: 4px 10px 4px 8px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    color: var(--wc-text);
    background: color-mix(in srgb, var(--wc-tone) 16%, var(--wc-surface));
    box-shadow: var(--wc-lit);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .status-pill .dot { width: 8px; height: 8px; }
  .status-pill.live .dot { animation: pulse 1.6s ease-in-out infinite; }
  .c-power { flex: none; display: flex; align-items: baseline; gap: 4px; font-variant-numeric: tabular-nums; }
  .c-kw { font-size: 34px; font-weight: 600; letter-spacing: -1px; line-height: 1; }
  .c-unit { font-size: 14px; color: var(--wc-text-2); }
  .c-stats { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; color: var(--wc-text-2); padding: 10px 12px; border-radius: 14px; background: var(--wc-surface); box-shadow: var(--wc-lit); }
  .c-stats strong { color: var(--wc-text); font-weight: 600; font-variant-numeric: tabular-nums; }
  .c-stats.muted strong { color: var(--wc-text-3); }
  .stat { cursor: pointer; white-space: nowrap; }
  .actions.small { gap: 8px; }
  .actions.small .btn { height: 38px; font-size: 14px; gap: 6px; }
  .actions.small .btn svg { width: 15px; height: 15px; }

  /* ---- minimal layout (one row, like a tile card) ---- */
  :host([data-layout="minimal"]) { height: 100%; }
  ha-card.minimal { height: 100%; box-sizing: border-box; padding: 0 10px 0 10px; justify-content: center; gap: 0; border-radius: var(--ha-card-border-radius, 18px); }
  .minimal .ambient { background: radial-gradient(70% 160% at 0% 50%, color-mix(in srgb, var(--wc-tone) 16%, transparent), transparent 70%); }
  .m-row { display: flex; align-items: center; gap: 10px; min-height: 56px; }
  .m-badge { flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--wc-tone) 18%, transparent); }
  .m-badge.live .dot { animation: pulse 1.6s ease-in-out infinite; }
  .m-text { flex: 1; min-width: 0; }
  .m-name, .m-state { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .m-name { font-size: 14px; font-weight: 600; line-height: 1.3; letter-spacing: -0.1px; }
  .m-state { font-size: 12px; line-height: 1.3; color: var(--wc-text-2); }
  .m-power { flex: none; font-size: 13px; color: var(--wc-text-2); font-variant-numeric: tabular-nums; }
  .m-power strong { font-size: 18px; font-weight: 600; color: var(--wc-text); letter-spacing: -0.4px; }
  .m-btn {
    flex: none;
    width: 38px;
    height: 38px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--wc-text);
    background: var(--wc-glass-fill);
    -webkit-backdrop-filter: var(--wc-glass-filter);
    backdrop-filter: var(--wc-glass-filter);
    box-shadow: var(--wc-glass-capsule);
    cursor: pointer;
    transition: transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1), filter 150ms ease;
    -webkit-tap-highlight-color: transparent;
  }
  .m-btn svg { width: 17px; height: 17px; fill: currentColor; }
  .m-btn:active { transform: scale(0.92); filter: brightness(1.25); }
  .m-btn:focus-visible { outline: 2px solid var(--wc-info); outline-offset: 2px; }
  .m-btn.primary { background: color-mix(in srgb, var(--wc-text) 86%, transparent); color: var(--wallbox-on-light, #0a0b0d); }
  .m-btn.danger { color: var(--wc-danger); }
  .m-btn.busy { opacity: 0.6; pointer-events: none; }

  @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.35); opacity: 0.7; } }
  @keyframes breathe { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
  @keyframes sweep { 0% { transform: translateX(-100%); } 60%, 100% { transform: translateX(100%); } }

  @media (prefers-reduced-motion: reduce) {
    .band.live::after, .band.live .dot, .gauge .glow, .status-pill.live .dot, .m-badge.live .dot { animation: none; }
    .g-arc, .g-needle, .g-limit, .btn, .m-btn { transition: none; }
  }
  @media (prefers-reduced-transparency: reduce) {
    .btn, .m-btn { -webkit-backdrop-filter: none; backdrop-filter: none; background: var(--wc-surface-2); }
  }
`;
