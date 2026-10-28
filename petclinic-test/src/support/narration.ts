import {execFileSync} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Voice-over for a recorded scenario (PW_NARRATE=on, on top of PW_VIDEO=on): every subtitle is
// also spoken, by macOS `say` (offline, free), and the clips are laid onto the scenario's video
// at the moment their subtitle appeared. The scenario waits for each clip to finish before
// moving on, so the voice and the picture never drift apart. PW_VOICE picks another `say` voice.

const VOICE = process.env.PW_VOICE || 'Samantha';

export interface Cue {
  file: string;
  atMs: number;
}

export class Narration {
  private readonly cues: Cue[] = [];

  constructor(private readonly dir: string, private readonly videoStartMs: number) {
    fs.mkdirSync(dir, {recursive: true});
  }

  /** Records `text` as a clip starting now; returns how long it speaks, in ms. */
  say(text: string): number {
    const file = path.join(this.dir, `cue-${this.cues.length}.aiff`);
    execFileSync('say', ['-v', VOICE, '-r', '190', '-o', file, spoken(text)]);
    this.cues.push({file, atMs: Date.now() - this.videoStartMs});
    return durationMs(file);
  }

  /** Muxes the clips onto `webm` as an mp4 next to it; returns the mp4's path. */
  muxOnto(webm: string): string {
    const mp4 = webm.replace(/\.webm$/, '.mp4');
    const inputs = this.cues.flatMap(c => ['-i', c.file]);
    const delayed = this.cues.map((c, i) => `[${i + 1}]adelay=${c.atMs}|${c.atMs}[a${i}]`);
    const mix = `${this.cues.map((_, i) => `[a${i}]`).join('')}amix=inputs=${this.cues.length}:normalize=0[voice]`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, ...inputs,
      '-filter_complex', [...delayed, mix].join(';'),
      '-map', '0:v', '-map', '[voice]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', mp4]);
    fs.rmSync(this.dir, {recursive: true, force: true});
    return mp4;
  }
}

/** Gherkin reads badly aloud: ISO dates become words. */
function spoken(text: string): string {
  return text.replace(/[✅❌]/g, '').replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, y, m, d) =>
    new Date(`${y}-${m}-${d}T00:00:00`).toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'}));
}

function durationMs(file: string): number {
  const seconds = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1', file]).toString().trim();
  return Math.round(Number(seconds) * 1000);
}
