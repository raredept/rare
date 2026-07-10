import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const nextDir = path.resolve(".next");
const standaloneDir = path.join(nextDir, "standalone");

await mkdir(path.join(standaloneDir, ".next"), { recursive: true });
await cp(path.join(nextDir, "static"), path.join(standaloneDir, ".next", "static"), { recursive: true });
await cp("public", path.join(standaloneDir, "public"), { recursive: true });

console.log("Standalone assets copied: .next/static and public.");
