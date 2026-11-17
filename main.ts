// Gloamgarden's hand-in program (Node 22, standard library only). The game itself is
// this repository's game/ folder: plain static files a desktop browser loads offline.
// This program hands it in — it copies game/ and screenshots/ from beside itself into
// the output directory and writes dossier.json there, the summary the judge reads,
// built with the kit's vendored library (vendor/makefun-game.ts, unchanged).
//
// Run it the way the grader does, with MAKEFUN_OUTPUT_DIR naming the output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own (the kit's gate): they shape only the dossier's text
// budget, and refuse here what the scorer would refuse there — more than 4 screenshots
// or one over 256 KiB, more than 993 files or 48 MiB under game/, a path over 1,000
// bytes — so a bad hand-in fails on the maker's machine, not on the site.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`gloamgarden: dossier written, ${dossier.length} bytes`);
