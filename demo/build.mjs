// Cuts the recorded scenes to the narration and mixes voice + a quiet bed. Usage: node demo/build.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIPS = path.join(HERE, 'clips'), AUDIO = path.join(HERE, 'audio'), OUT = path.join(HERE, 'out'), TMP = path.join(CLIPS, '_build');
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
const M = (n) => JSON.parse(fs.readFileSync(path.join(CLIPS, `${n}.json`), 'utf8'));
const mk = Object.fromEntries(['a1', 'a2', 'a3', 'b1', 'onb', 'c1', 'c2a', 'c2b'].map((n) => [n, M(n)]));
const run = (bin, args) => execFileSync(bin, args, { stdio: ['ignore', 'pipe', 'inherit'] }).toString();
const ff = (args) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);

// Calmer, warmer voice: slow ~7% (pitch preserved), a touch of low warmth, soften the top end.
const TEMPO = 0.93, PAD = 0.3, LEAD = 0.12, CAP = 59.9;
const ids = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3'];
const dur = {};
for (const id of ids) {
  const f = path.join(TMP, `${id}.wav`);
  ff(['-i', path.join(AUDIO, `${id}.wav`), '-af', `atempo=${TEMPO},equalizer=f=170:t=q:w=1:g=2,equalizer=f=5000:t=q:w=1.5:g=-2.5`, '-ar', '44100', f]);
  dur[id] = +run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim();
}
const L = (id) => dur[id] + PAD;
const seg = (clip, from, to, out) => ({ clip, from, to, out });
const A = mk.a1, A2 = mk.a2, A3 = mk.a3, B1 = mk.b1, O = mk.onb, C1 = mk.c1, W1 = mk.c2a, W2 = mk.c2b;

// Each scene: its voice line (or none) and the footage under it. Every range is used once; nothing repeats.
const scenes = [
  { id: 'a1', segs: [seg('a1', A.go, A.end, L('a1'))] },                                   // landing page, slow scroll
  { id: 'a2', segs: [seg('a2', A2.go, A2.end, L('a2'))] },                                 // "More than a chatbot" section
  { id: 'a3', segs: [seg('a3', A3.go, A3.end, L('a3'))] },                                 // How it works, slow scroll
  { id: 'b1', segs: [seg('b1', B1.go, B1.end, L('b1'))] },                                 // click Start, two modes
  { id: 'b2', segs: [seg('onb', O.go, O.p2, L('b2'))] },                                   // plot
  { id: 'b3', segs: [seg('onb', O.p2, O.p3, L('b3'))] },                                   // optional extras + note to the AI
  { id: null, segs: [seg('onb', O.p3, O.p4, 3.0)] },                                       // style + Generate (silent beat)
  { id: 'c1', segs: [seg('c1', C1.go, C1.p1 + 0.2, 2.0), seg('c1', C1.p1 + 0.6, C1.end, 4.4)] }, // finished plan (saved edition), compliance report
  { id: 'c2', segs: [seg('c2a', W1.go + 0.2, W1.sent, 3.4), seg('c2b', W2.go + 0.3, W2.res, 2.0), seg('c2b', W2.d0 - 0.3, W2.eve + 0.3, 5.4)] }, // ask for a change -> Version 2 -> 3D
  { id: 'c3', segs: [seg('c2b', W2.eve + 0.3, W2.x1, L('c3') - 0.1)] },                           // export menu + close
];

let t = 0; const files = [], starts = {}, ratios = [];
scenes.forEach((s, si) => {
  if (s.id) starts[s.id] = t;
  s.segs.forEach((g, gi) => {
    const f = path.join(TMP, `s${si}_${gi}.mp4`); const src = g.to - g.from, k = g.out / src;
    ratios.push(`${g.clip}[${s.id || 'silent'}] ${(src / g.out).toFixed(2)}x`);
    ff(['-ss', Math.max(0, g.from).toFixed(3), '-t', src.toFixed(3), '-i', path.join(CLIPS, `${g.clip}.webm`),
      '-vf', `setpts=PTS*${k.toFixed(5)},fps=30,scale=1920:1080:flags=lanczos,unsharp=5:5:0.45,format=yuv420p`,
      '-t', g.out.toFixed(3), '-r', '30', '-c:v', 'libx264', '-crf', '15', '-preset', 'medium', '-an', f]);
    files.push(f); t += g.out;
  });
});
const total = t;
console.log('playback speed per segment:', ratios.join(' | '));
if (total > CAP) throw new Error(`Video is ${total.toFixed(1)}s, over the ${CAP}s cap`);
fs.writeFileSync(path.join(TMP, 'list.txt'), files.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
const vid = path.join(TMP, 'video.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', path.join(TMP, 'list.txt'), '-c', 'copy', vid]);

const inputs = ids.flatMap((id) => ['-i', path.join(TMP, `${id}.wav`)]);
const fc = ids.map((id, i) => `[${i + 1}:a]acompressor=threshold=-21dB:ratio=2:attack=10:release=160,adelay=${Math.round((starts[id] + LEAD) * 1000)}:all=1[v${i}]`);
fc.push(`${ids.map((_, i) => `[v${i}]`).join('')}amix=inputs=${ids.length}:normalize=0,apad=whole_dur=${total.toFixed(2)},atrim=0:${total.toFixed(2)},loudnorm=I=-16:TP=-1.5:LRA=9[voice]`);
fc.push(`[${ids.length + 1}:a]lowpass=f=1100,volume=0.16,afade=t=in:d=2,afade=t=out:st=${(total - 3).toFixed(2)}:d=3[bed]`);
fc.push('[voice][bed]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]');
const bed = ['-f', 'lavfi', '-t', total.toFixed(2), '-i', "aevalsrc='(0.50*sin(2*PI*110*t)+0.34*sin(2*PI*164.81*t)+0.24*sin(2*PI*220*t)+0.16*sin(2*PI*277.18*t))*(0.72+0.28*sin(2*PI*0.11*t))*0.5|(0.50*sin(2*PI*110.4*t)+0.34*sin(2*PI*164.4*t)+0.24*sin(2*PI*220.6*t)+0.16*sin(2*PI*276.8*t))*(0.72+0.28*sin(2*PI*0.09*t+1))*0.5':s=44100:c=stereo"];
const out = path.join(OUT, 'archadapt-investor-demo.mp4');
ff(['-i', vid, ...inputs, ...bed, '-filter_complex', fc.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', total.toFixed(2), out]);
console.log('done', total.toFixed(2) + 's', out);
