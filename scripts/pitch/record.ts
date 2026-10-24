// Why: the pitch video is filmed from the real site, not drawn in an editor, so it shows what a reader
// actually gets and can be re-cut whenever the site changes. This starts the dev server, plays the stage
// (stage.html) in a 1920×1080 browser while Playwright records it, then lays the voice lines from
// scripts/pitch/audio/ over the music, dips the music under the voice, and writes site/public/media/pitch.mp4
// with its captions (pitch.vtt) and the still shown before it plays (pitch.jpg).
// Usage: npm run pitch:voice (once), then npm run pitch. Needs ffmpeg.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { BPM, TOTAL, VO_AT, captions, roomFor, scenes, timelineProblems } from './scenes.js';

const root = new URL('../../', import.meta.url).pathname;
const audio = join(root, 'scripts/pitch/audio');
const out = join(root, 'site/public/media/pitch.mp4');
const PORT = 4399;

function duration(file: string): number {
  const s = execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    file,
  ]);
  return Number(s.toString().trim()) || 0;
}

function voFile(key: string): string {
  return join(audio, `vo-${key}.mp3`);
}

/** Astro runs one dev server per project: use the one that is running, or start one and stop it after. */
function devServer(): { base: string; stop: () => void } {
  try {
    const status = execFileSync('npx', ['astro', 'dev', 'status'], { cwd: join(root, 'site') });
    const running = /running at (http:\/\/localhost:\d+)/.exec(status.toString());
    if (running?.[1]) return { base: running[1], stop: () => undefined };
  } catch {
    // none running
  }
  const server = spawn('npx', ['astro', 'dev', '--port', String(PORT)], {
    cwd: join(root, 'site'),
    stdio: 'ignore',
  });
  return { base: `http://localhost:${PORT}`, stop: () => server.kill() };
}

async function waitForServer(base: string): Promise<void> {
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(base);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('The dev server did not start.');
}

async function main(): Promise<void> {
  const problems = timelineProblems(scenes);
  if (problems.length) throw new Error(`The timeline is broken:\n  ${problems.join('\n  ')}`);
  const music = join(audio, 'music.mp3');
  if (!existsSync(music))
    throw new Error('No scripts/pitch/audio/music.mp3: run npm run pitch:voice');
  scenes.forEach((s, i) => {
    if (!s.vo) return;
    const file = voFile(s.vo.key);
    if (!existsSync(file)) {
      console.warn(`   ! no vo-${s.vo.key}.mp3; the scene plays silent`);
      return;
    }
    const len = duration(file);
    const room = roomFor(scenes, i);
    if (len > room)
      console.warn(`   ! vo-${s.vo.key}.mp3 is ${len.toFixed(1)}s, room for ${room.toFixed(1)}s`);
  });

  const tokens = await readFile(join(root, 'site/src/styles/tokens.css'), 'utf8');
  const mark = (await readFile(join(root, 'site/src/assets/logo/mark.svg'), 'utf8'))
    .replace(/<!--[\s\S]*?-->/, '')
    .replace(/<style>[\s\S]*?<\/style>/, '')
    .replace('role="img" aria-label="Agentic Blog"', 'aria-hidden="true"');
  const stage = (await readFile(join(root, 'scripts/pitch/stage.html'), 'utf8'))
    .replace('/*TOKENS*/', tokens)
    .replace('<!--MARK-->', mark);
  const work = await mkdtemp(join(tmpdir(), 'pitch-'));
  const { base, stop } = devServer();
  try {
    await waitForServer(base);
    const browser = await chromium.launch({ args: ['--force-device-scale-factor=1'] });
    const size = { width: 1920, height: 1080 };

    // The dev server builds each page on its first visit; visit them all first so none loads late on film.
    const warm = await browser.newPage();
    for (const s of scenes)
      if (s.kind === 'page') await warm.goto(base + s.path, { waitUntil: 'load' });
    await warm.close();

    const ctx = await browser.newContext({
      viewport: size,
      colorScheme: 'light',
      recordVideo: { dir: work, size },
    });
    await ctx.route(`${base}/__pitch`, (route) =>
      route.fulfill({ contentType: 'text/html', body: stage }),
    );
    const tPage = performance.now();
    const page = await ctx.newPage();
    await page.goto(`${base}/__pitch`);
    // The stage runs in the browser; the scripts' types are Node-only, so it is reached through globalThis.
    await page.evaluate('document.fonts.ready.then(() => true)');
    await page.waitForTimeout(800);
    const tPlay = performance.now();
    await page.evaluate(
      (timeline) =>
        (globalThis as unknown as { play: (t: unknown) => Promise<void> }).play(timeline),
      { bpm: BPM, scenes },
    );
    console.info(`filmed ${((performance.now() - tPlay) / 1000).toFixed(1)}s`);
    const video = page.video();
    await ctx.close();
    await browser.close();
    const raw = video ? await video.path() : '';
    if (!raw) throw new Error('Playwright saved no video.');

    const offset = (tPlay - tPage) / 1000 + 0.05;
    const silent = join(work, 'silent.mp4');
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-ss',
      offset.toFixed(3),
      '-i',
      raw,
      '-t',
      String(TOTAL),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '18',
      '-r',
      '30',
      silent,
    ]);

    // Each voice line on its scene; the music ducks under the voice; loudness to -14 LUFS.
    const inputs = ['-i', silent, '-i', music];
    const filters: string[] = [];
    const voLabels: string[] = [];
    let n = 2;
    for (const s of scenes) {
      if (!s.vo || !existsSync(voFile(s.vo.key))) continue;
      const ms = Math.round((s.start + VO_AT) * 1000);
      inputs.push('-i', voFile(s.vo.key));
      filters.push(
        `[${n}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[v${n}]`,
      );
      voLabels.push(`[v${n}]`);
      n++;
    }
    const bed = '[1:a]aresample=44100,aformat=channel_layouts=stereo,volume=0.8[m]';
    if (voLabels.length) {
      filters.push(
        `${voLabels.join('')}amix=inputs=${voLabels.length}:normalize=0,volume=1.6,apad=whole_dur=${TOTAL},asplit=2[vo][key]`,
        bed,
        '[m][key]sidechaincompress=threshold=0.03:ratio=9:attack=15:release=350:makeup=1[md]',
        `[md][vo]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9,afade=t=out:st=${TOTAL - 1.2}:d=1.2,atrim=0:${TOTAL}[a]`,
      );
    } else {
      filters.push(bed.replace('[m]', ',loudnorm=I=-14:TP=-1.5[a]'));
    }
    await mkdir(join(root, 'site/public/media'), { recursive: true });
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      ...inputs,
      '-filter_complex',
      filters.join(';'),
      '-map',
      '0:v',
      '-map',
      '[a]',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
      out,
    ]);
    console.info(`Saved ${out} (${duration(out).toFixed(1)}s)`);

    // Captions from the clips' real lengths, and the still shown before it plays (the closing card).
    const lengths = Object.fromEntries(
      scenes.flatMap((s) =>
        s.vo && existsSync(voFile(s.vo.key)) ? [[s.vo.key, duration(voFile(s.vo.key))]] : [],
      ),
    );
    await writeFile(out.replace(/\.mp4$/, '.vtt'), captions(scenes, lengths));
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-ss',
      '52',
      '-i',
      out,
      '-frames:v',
      '1',
      '-q:v',
      '3',
      out.replace(/\.mp4$/, '.jpg'),
    ]);
  } finally {
    stop();
    await rm(work, { recursive: true, force: true });
  }
}

await main();
