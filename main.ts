// NEON BAY — entrypoint for the Make GTA 6 bounty.
// Packages the game for the grader: copies game/ and screenshots/
// into the output directory and writes dossier.json there, built
// with the kit's buildDossier helper.
// Runs on Node 22, standard library only, no network, no install.
// The repository is located from this file's own position (or from
// MAKEFUN_BOT_DIR when the grader provides it) — never from the
// process working directory, because the grader starts the program
// from an unrelated directory and the game folder would not be found.

import { buildDossier } from './vendor/makefun-game.ts';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXT_CAP_BYTES = 163840;
const FALLBACK_OUTPUT_DIR = '/output';

function findRepoRoot(): string {
  const declared = process.env.MAKEFUN_BOT_DIR;
  if (declared !== undefined && declared !== '') {
    return declared;
  }
  const ownFile = fileURLToPath(import.meta.url);
  return path.dirname(ownFile);
}

function copyTree(sourceDir: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const from = path.join(sourceDir, entry.name);
    const to = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

function tallyTree(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const walk = (d: string): void => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (entry.isFile()) {
        files += 1;
        bytes += fs.statSync(p).size;
      }
    }
  };
  walk(dir);
  return { files, bytes };
}

async function main(): Promise<void> {
  const repoRoot = findRepoRoot();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || FALLBACK_OUTPUT_DIR;
  fs.mkdirSync(outDir, { recursive: true });

  const gameFrom = path.join(repoRoot, 'game');
  const shotsFrom = path.join(repoRoot, 'screenshots');
  const gameTo = path.join(outDir, 'game');
  const shotsTo = path.join(outDir, 'screenshots');

  // Fail fast with the resolved root in the message when the game
  // folder is not where this file thinks the repository is.
  if (!fs.existsSync(path.join(gameFrom, 'index.html'))) {
    throw new Error(`game/index.html not found under repo root ${repoRoot}`);
  }

  copyTree(gameFrom, gameTo);
  if (fs.existsSync(shotsFrom)) {
    copyTree(shotsFrom, shotsTo);
  }

  const dossierBytes = await buildDossier(repoRoot, { text_max_bytes: TEXT_CAP_BYTES });
  const dossierPath = path.join(outDir, 'dossier.json');
  fs.writeFileSync(dossierPath, dossierBytes);

  const gameStats = tallyTree(gameTo);
  const shotStats = fs.existsSync(shotsTo) ? tallyTree(shotsTo) : { files: 0, bytes: 0 };
  const dossierSize = fs.statSync(dossierPath).size;
  console.log('NEON BAY packaged:');
  console.log(`  game: ${gameStats.files} files, ${gameStats.bytes} bytes`);
  console.log(`  screenshots: ${shotStats.files} files, ${shotStats.bytes} bytes`);
  console.log(`  dossier.json: ${dossierSize} bytes -> ${dossierPath}`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`main.ts failed: ${message}`);
  process.exit(1);
});
