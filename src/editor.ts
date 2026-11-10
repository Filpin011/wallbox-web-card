// Visual editor (Home Assistant's `getConfigForm`): layout first, then the blocks of that layout in an expandable
// "Content" section, then the tap action. Pure data, unit-tested.

import { INTEGRATION } from "./data.ts";
import { LAYOUTS, LAYOUT_DEFAULTS, LAYOUT_TOGGLES, DEFAULT_CURVE_HOURS, type Layout } from "./config.ts";
import type { Strings } from "./localize.ts";

type Schema = Record<string, unknown>;

const LAYOUT_LABEL: Record<Layout, keyof Strings> = {
  full: "layoutFull",
  compact: "layoutCompact",
  minimal: "layoutMinimal",
};

/**
 * One "Content" section per layout, shown only while that layout is selected (ha-form `visible` conditions).
 * Each section carries the layout's own defaults, so the switches show what the card really renders.
 * `flatten` keeps the options at the top level of the card config.
 */
function contentSection(layout: Layout, t: Strings): Schema {
  const isLayout =
    layout === "full"
      ? { field: "layout", operator: "not_in", value: ["compact", "minimal"] } // also when layout is not set
      : { field: "layout", operator: "eq", value: layout };
  const toggles: Schema[] = LAYOUT_TOGGLES[layout].map((name) => ({
    name,
    default: LAYOUT_DEFAULTS[layout][name],
    selector: { boolean: {} },
  }));
  const schema: Schema[] = [{ type: "grid", name: "", schema: toggles }];
  if (LAYOUT_TOGGLES[layout].includes("show_curve")) {
    schema.push({
      name: "curve_hours",
      default: DEFAULT_CURVE_HOURS,
      selector: { number: { min: 1, max: 48, mode: "box", unit_of_measurement: "h" } },
    });
  }
  return {
    type: "expandable",
    name: `content_${layout}`,
    title: t.content,
    icon: "mdi:view-dashboard-edit-outline",
    flatten: true,
    expanded: false,
    visible: isLayout,
    schema,
  };
}

export function configSchema(t: Strings): Schema[] {
  return [
    { name: "device_id", required: true, selector: { device: { filter: { integration: INTEGRATION } } } },
    {
      name: "layout",
      default: "full",
      selector: {
        select: {
          mode: "list",
          options: LAYOUTS.map((value) => ({ value, label: t[LAYOUT_LABEL[value]] })),
        },
      },
    },
    ...LAYOUTS.map((l) => contentSection(l, t)),
    {
      type: "grid",
      name: "",
      schema: [
        { name: "name", selector: { text: {} } },
        {
          name: "appearance",
          default: "app",
          selector: {
            select: {
              mode: "dropdown",
              options: [
                { value: "app", label: t.appearanceApp },
                { value: "theme", label: t.appearanceTheme },
              ],
            },
          },
        },
      ],
    },
    {
      type: "expandable",
      name: "interactions",
      title: t.interactions,
      icon: "mdi:gesture-tap",
      flatten: true,
      schema: [{ name: "tap_action", selector: { ui_action: { default_action: "more-info" } } }],
    },
  ];
}

export function computeLabel(t: Strings, schema: { name: string }): string | undefined {
  return (t as unknown as Record<string, string>)[schema.name] ?? undefined;
}

export function computeHelper(t: Strings, schema: { name: string }): string | undefined {
  if (schema.name === "tap_action") return t.tapHelper;
  return undefined;
}
