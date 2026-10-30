import {execFileSync, spawnSync} from 'child_process';
import {createHash} from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Voice-over for a recorded video: every subtitle is also spoken, and the clips are laid onto
// the video at the moment their subtitle appeared. The caller waits for each clip to finish
// before acting again, so voice and picture never drift apart.
//
// The voice is Fish Audio's community model "POTUS 47 - Trump" (PW_VOICE=trump, the default),
// any other Fish model id (PW_VOICE=<id>), or a macOS `say` voice (PW_VOICE=say:<name>).
// Fish's key is FISH_API_KEY, else the `FISH_API_KEY=` line of ~/.claude/fish-audio.env — never
// the repository, which is public; with no key it falls back to `say`, offline. Fish clips are
// cached by (model, voice, text), so re-filming an unchanged script costs nothing.

const TRUMP = 'e58b0d7efca34eb38d5c4985e378abcb';
const FISH_MODEL = 's2.1-pro-free';
const FISH_CACHE = path.join(os.homedir(), 'Library', 'Caches', 'petclinic-narration', 'fish');

export interface Word {
  w: string;
  atMs: number;
}

export interface Spoken {
  durationMs: number;
  /** When each whitespace token of the subtitle starts being said, from the start of the clip. */
  words: Word[];
}

export class Narration {
  private readonly cues: {file: string; atMs: number}[] = [];

  constructor(private readonly dir: string, private readonly videoStartMs: number) {
    fs.mkdirSync(dir, {recursive: true});
  }

  /** Records `text` as a clip that starts playing when this resolves: show its subtitle right then. */
  async say(text: string): Promise<Spoken> {
    const file = path.join(this.dir, `cue-${this.cues.length}.wav`);
    await synthesize(spoken(text), file);
    this.cues.push({file, atMs: Date.now() - this.videoStartMs});
    return {durationMs: durationMs(file), words: estimateWords(text, voicedSpan(file))};
  }

  /** Ms into the video at this moment — e.g. once the first page is up, to pass to {@link muxOnto}. */
  elapsedMs(): number {
    return Date.now() - this.videoStartMs;
  }

  /**
   * Muxes the clips onto `webm` as an mp4 next to it, cutting the first `trimMs` (the blank page
   * before the first load); returns its path, or none when nothing was said.
   */
  muxOnto(webm: string, trimMs = 0): string | undefined {
    if (this.cues.length === 0) {
      fs.rmSync(this.dir, {recursive: true, force: true});
      return undefined;
    }
    const mp4 = webm.replace(/\.webm$/, '.mp4');
    const inputs = this.cues.flatMap(c => ['-i', c.file]);
    const delayed = this.cues.map((c, i) => {
      const at = Math.max(0, c.atMs - trimMs);
      return `[${i + 1}]adelay=${at}|${at}[a${i}]`;
    });
    const mix = `${this.cues.map((_, i) => `[a${i}]`).join('')}amix=inputs=${this.cues.length}:normalize=0[voice]`;
    try {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', `${trimMs}ms`, '-i', webm, ...inputs,
        '-filter_complex', [...delayed, mix].join(';'),
        '-map', '0:v', '-map', '[voice]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', mp4]);
    } finally {
      fs.rmSync(this.dir, {recursive: true, force: true});
    }
    return mp4;
  }
}

async function synthesize(text: string, wav: string): Promise<void> {
  const voice = process.env.PW_VOICE || 'trump';
  const key = fishKey();
  if (voice.startsWith('say:') || !key) {
    execFileSync('say', ['-v', voice.startsWith('say:') ? voice.slice(4) : 'Samantha', '-r', '190',
      '--file-format=WAVE', '--data-format=LEI16@44100', '-o', wav, text]);
    return;
  }
  const reference = voice === 'trump' ? TRUMP : voice;
  const cached = path.join(FISH_CACHE,
    createHash('sha256').update(`${FISH_MODEL}|${reference}|${text}`).digest('hex').slice(0, 16) + '.wav');
  if (!fs.existsSync(cached)) {
    const res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'model': FISH_MODEL},
      body: JSON.stringify({text, reference_id: reference, format: 'wav', sample_rate: 44100}),
    });
    if (!res.ok) {
      throw new Error(`Fish Audio TTS failed (${res.status}): ${await res.text()}`);
    }
    fs.mkdirSync(FISH_CACHE, {recursive: true});
    fs.writeFileSync(cached, Buffer.from(await res.arrayBuffer()));
  }
  fs.copyFileSync(cached, wav);
}

function fishKey(): string {
  if (process.env.FISH_API_KEY) return process.env.FISH_API_KEY.trim();
  const file = path.join(os.homedir(), '.claude', 'fish-audio.env');
  const match = fs.existsSync(file) && /^\s*FISH_API_KEY\s*=\s*['"]?([^'"\s]+)/m.exec(fs.readFileSync(file, 'utf8'));
  return match ? match[1] : '';
}

/** Read aloud, ISO dates become words and the verdict emojis disappear. */
function spoken(text: string): string {
  return text.replace(/[✅❌]/g, '').replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, y, m, d) =>
    new Date(`${y}-${m}-${d}T00:00:00`).toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'}));
}

function durationMs(file: string): number {
  const seconds = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1', file]).toString().trim();
  return Math.round(Number(seconds) * 1000);
}

/** [start, end] in ms of the part of the clip that is not silence. */
function voicedSpan(file: string): [number, number] {
  const log = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-35dB:d=0.15',
    '-f', 'null', '-']).stderr.toString();
  const total = durationMs(file);
  const starts = [...log.matchAll(/silence_start: (-?[\d.]+)/g)].map(m => Math.max(0, Number(m[1]) * 1000));
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map(m => Number(m[1]) * 1000);
  const silences = starts.map((from, i) => [from, ends[i] ?? total]);
  const leading = silences.find(([from]) => from < 50);
  const trailing = silences.find(([from, to]) => to > total - 50 && from > 50);
  return [leading ? leading[1] : 0, trailing ? trailing[0] : total];
}

/**
 * Fish returns audio without word marks, so each word's start is an estimate: the voiced stretch
 * shared out by word length, plus a breath after punctuation. It drifts by a few hundred ms at
 * most over one subtitle, which a karaoke highlight absorbs.
 */
function estimateWords(text: string, [start, end]: [number, number]): Word[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const cost = (t: string) => [...t].filter(c => /[\p{L}\p{N}]/u.test(c)).length + 1 +
    (/[.!?]$/.test(t) ? 5 : /[,;:]$/.test(t) ? 3 : 0);
  const total = tokens.reduce((sum, t) => sum + cost(t), 0) || 1;
  let at = start;
  return tokens.map(w => {
    const word = {w, atMs: Math.round(at)};
    at += (end - start) * cost(w) / total;
    return word;
  });
}
