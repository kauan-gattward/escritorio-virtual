let ctx = null;
let nodes = [];

export function setMusic(on) {
  if (!on) {
    for (const node of nodes) {
      try { node.stop?.(); } catch { /* já parou */ }
      try { node.disconnect?.(); } catch { /* já solto */ }
    }
    nodes = [];
    if (ctx) ctx.suspend?.();
    return;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!ctx) ctx = new AudioCtx();
  ctx.resume?.();
  if (nodes.length) return;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < data.length; i += 1) {
    brown = (brown + (Math.random() * 2 - 1) * 0.02) * 0.98;
    data[i] = brown * 0.4;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  const gain = ctx.createGain();
  gain.gain.value = 0.08;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  nodes = [source, filter, gain];
}
