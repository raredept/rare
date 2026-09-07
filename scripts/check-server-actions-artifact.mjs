import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const buildRoot = path.join(root, ".next");
const standaloneRoot = path.join(buildRoot, "standalone", ".next");
const sourceRoot = path.join(root, "src");
const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`FAIL server-actions: ${message}`);
}

function readRequired(file) {
  if (!fs.existsSync(file)) {
    fail(`arquivo ausente: ${path.relative(root, file)}`);
    return null;
  }
  return fs.readFileSync(file);
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function discoverSourceActions() {
  const actionPattern = /export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z_$][\w$]*)/g;
  const actions = [];

  for (const file of walk(sourceRoot).filter((entry) => /\.[cm]?[jt]sx?$/.test(entry))) {
    const source = fs.readFileSync(file, "utf8");
    const withoutBom = source.replace(/^\uFEFF/, "").trimStart();
    if (!/^(["'])use server\1\s*;/.test(withoutBom)) continue;

    for (const match of source.matchAll(actionPattern)) {
      actions.push({
        exportedName: match[1],
        filename: path.relative(root, file).replaceAll("\\", "/"),
      });
    }
  }

  return actions.sort((a, b) => `${a.filename}:${a.exportedName}`.localeCompare(`${b.filename}:${b.exportedName}`));
}

function readManifest(file) {
  const bytes = readRequired(file);
  if (!bytes) return null;
  try {
    return { bytes, data: JSON.parse(bytes.toString("utf8")) };
  } catch {
    fail(`JSON inválido: ${path.relative(root, file)}`);
    return null;
  }
}

const buildManifestPath = path.join(buildRoot, "server", "server-reference-manifest.json");
const standaloneManifestPath = path.join(standaloneRoot, "server", "server-reference-manifest.json");
const buildManifest = readManifest(buildManifestPath);
const standaloneManifest = readManifest(standaloneManifestPath);

const requiredStandaloneFiles = [
  "BUILD_ID",
  "build-manifest.json",
  "prerender-manifest.json",
  "required-server-files.json",
  "routes-manifest.json",
  "server/app-paths-manifest.json",
  "server/middleware-manifest.json",
  "server/server-reference-manifest.js",
  "server/server-reference-manifest.json",
];
for (const relative of requiredStandaloneFiles) readRequired(path.join(standaloneRoot, relative));

if (buildManifest && standaloneManifest) {
  if (!buildManifest.bytes.equals(standaloneManifest.bytes)) {
    fail("o manifest standalone difere do manifest produzido pelo build");
  }

  const sourceActions = discoverSourceActions();
  const manifestEntries = [...Object.values(buildManifest.data.node ?? {}), ...Object.values(buildManifest.data.edge ?? {})];
  const manifestActions = new Set(manifestEntries.map((entry) => `${entry.filename}:${entry.exportedName}`));

  for (const action of sourceActions) {
    const key = `${action.filename}:${action.exportedName}`;
    if (!manifestActions.has(key)) fail(`export não encontrado no manifest: ${key}`);
  }

  if (manifestEntries.length !== sourceActions.length) {
    fail(`contagem divergente: fonte=${sourceActions.length}, manifest=${manifestEntries.length}`);
  }

  if (!buildManifest.data.encryptionKey || !standaloneManifest.data.encryptionKey) {
    fail("material de criptografia das Server Actions ausente do manifest");
  }

  const actionIds = [...Object.keys(buildManifest.data.node ?? {}), ...Object.keys(buildManifest.data.edge ?? {})];
  if (!actionIds.length || !actionIds.every((id) => /^[a-f0-9]+$/i.test(id))) {
    fail("IDs internos das Server Actions ausentes ou em formato inesperado");
  }

  if (!failures.length) {
    console.log(`OK server-actions: ${sourceActions.length} exports presentes no build e no standalone.`);
    console.log("OK server-actions: manifest e material de criptografia presentes; valores sensíveis não foram exibidos.");
  }
}

const buildId = readRequired(path.join(buildRoot, "BUILD_ID"));
const standaloneBuildId = readRequired(path.join(standaloneRoot, "BUILD_ID"));
if (buildId && standaloneBuildId && !buildId.equals(standaloneBuildId)) {
  fail("BUILD_ID do standalone difere do build principal");
}

if (failures.length) process.exitCode = 1;
