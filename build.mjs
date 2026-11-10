// Bundles the card into ONE file: dist/wallbox-web-card.js (what HACS installs and Lovelace loads).
import { readFileSync } from "node:fs";
import * as esbuild from "esbuild";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const watch = process.argv.includes("--watch");

const options = {
  entryPoints: ["src/wallbox-web-card.ts"],
  outfile: "dist/wallbox-web-card.js",
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: !watch,
  sourcemap: false,
  legalComments: "eof",
  define: { __VERSION__: JSON.stringify(pkg.version) },
  banner: {
    js: `/*! wallbox-web-card ${pkg.version} | MIT | Independent, unofficial project - not affiliated with SCAME PARRE S.p.A. */`,
  },
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
