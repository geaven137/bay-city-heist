// Neon Bay — entrypoint.
// Copies game/ and screenshots/ into the output directory and
// writes dossier.json there with the kit's buildDossier. Runs
// on Node 22 with the standard library only; no network, no
// install step. The output directory comes from the
// MAKEFUN_OUTPUT_DIR environment variable, else /output.

import { buildDossier } from './vendor/makefun-game.ts';
import * as fs from 'node:fs';
import * as path from 'node:path';

const TEXT_CAP = 163840;

function copyTree(fromDir, toDir) {
  fs.mkdirSync(toDir, { recursive: true });
  for (const entry of fs.readdirSync(fromDir, { withFileTypes: true })) {
    const src = path.join(fromDir, entry.name);
    const dst = path.join(toDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(src, dst);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
  }
}

function countTree(dir) {
  let files = 0;
  let bytes = 0;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile()) {
        files += 1;
        bytes += fs.statSync(p).size;
      }
    }
  };
  walk(dir);
  return { files, bytes };
}

async function main() {
  const repoRoot = process.cwd();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
  fs.mkdirSync(outDir, { recursive: true });

  const gameSrc = path.join(repoRoot, 'game');
  const shotsSrc = path.join(repoRoot, 'screenshots');
  const gameDst = path.join(outDir, 'game');
  const shotsDst = path.join(outDir, 'screenshots');
  copyTree(gameSrc, gameDst);
  if (fs.existsSync(shotsSrc)) copyTree(shotsSrc, shotsDst);

  const dossier = await buildDossier(repoRoot, { text_max_bytes: TEXT_CAP });
  const dossierPath = path.join(outDir, 'dossier.json');
  fs.writeFileSync(dossierPath, dossier);

  const gameStats = countTree(gameDst);
  const shotStats = fs.existsSync(shotsDst) ? countTree(shotsDst) : { files: 0, bytes: 0 };
  const dossierBytes = fs.statSync(dossierPath).size;
  console.log('NEON BAY packaged:');
  console.log('  game: ' + gameStats.files + ' files, ' + gameStats.bytes + ' bytes');
  console.log('  screenshots: ' + shotStats.files + ' files, ' + shotStats.bytes + ' bytes');
  console.log('  dossier.json: ' + dossierBytes + ' bytes -> ' + dossierPath);
}

main().catch((err) => {
  console.error('main.ts failed:', err && err.message ? err.message : err);
  process.exit(1);
});
