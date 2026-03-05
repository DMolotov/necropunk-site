#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const DEFAULT_IMAGE = "pdf2htmlex/pdf2htmlex:0.18.8.rc2-master-20200820-alpine-3.12.0-x86_64";
const DEFAULT_OUTPUT_DIR = path.resolve("artifacts", "pdf2html", "output");
const FALLBACK_INPUT = path.resolve("artifacts", "pdf2html", "input", "NPCL_fillable.pdf");

function getFlagValue(flagName) {
  const index = process.argv.indexOf(flagName);
  if (index === -1 || index === process.argv.length - 1) {
    return null;
  }
  return process.argv[index + 1];
}

function hasFlag(flagName) {
  return process.argv.includes(flagName);
}

if (hasFlag("--help")) {
  console.log("Usage:");
  console.log("  node scripts/pdf2htmlex-convert.js --input <path/to/file.pdf> [options]");
  console.log("");
  console.log("Options:");
  console.log(`  --output-dir <dir>     Output directory (default: ${DEFAULT_OUTPUT_DIR})`);
  console.log("  --output-name <name>   Output HTML filename (default: <input>.html)");
  console.log(`  --image <docker-image> Docker image (default: ${DEFAULT_IMAGE})`);
  console.log("  --process-form <0|1>   Include PDF form fields (default: 1)");
  process.exit(0);
}

const inputArg = getFlagValue("--input") || (fs.existsSync(FALLBACK_INPUT) ? FALLBACK_INPUT : null);
if (!inputArg) {
  console.error("Missing --input <path/to/file.pdf>.");
  console.error("Tip: run with --help for usage.");
  process.exit(1);
}

const inputAbsPath = path.resolve(inputArg);
if (!fs.existsSync(inputAbsPath)) {
  console.error(`Input PDF not found: ${inputAbsPath}`);
  process.exit(1);
}

const outputDir = path.resolve(getFlagValue("--output-dir") || DEFAULT_OUTPUT_DIR);
fs.mkdirSync(outputDir, { recursive: true });

const outputName =
  getFlagValue("--output-name") || `${path.basename(inputAbsPath, path.extname(inputAbsPath))}.html`;
const image = getFlagValue("--image") || DEFAULT_IMAGE;
const processForm = getFlagValue("--process-form") || "1";

const dockerArgs = [
  "run",
  "--rm",
  "-v",
  `${path.dirname(inputAbsPath)}:/in:ro`,
  "-v",
  `${outputDir}:/out`,
  image,
  "--process-form",
  processForm,
  "--dest-dir",
  "/out",
  `/in/${path.basename(inputAbsPath)}`,
  outputName
];

const run = spawnSync("docker", dockerArgs, { stdio: "inherit" });
if (run.error) {
  console.error(`Failed to start Docker: ${run.error.message}`);
  process.exit(1);
}

process.exit(run.status === null ? 1 : run.status);
