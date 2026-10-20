let context;
const playing = new Set();
export const audioState = { volume: 0.7, muted: false, overlap: true };

function audioContext() {
  context ||= new (window.AudioContext || window.webkitAudioContext)();
  if (context.state === 'suspended') void context.resume();
  return context;
}
export function stopSounds() {
  for (const item of playing) { try { item.stop(); } catch {} }
  playing.clear();
  window.speechSynthesis?.cancel();
}
export function setVolume(volume, muted = audioState.muted) {
  audioState.volume = volume;
  audioState.muted = muted;
  if (muted || volume === 0) stopSounds();
}
export function speak(text) {
  if (!('speechSynthesis' in window)) throw new Error('Text-to-speech is not supported in this browser.');
  if (!audioState.overlap) stopSounds();
  if (audioState.muted || audioState.volume === 0) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.volume = audioState.volume;
  utterance.rate = .9;
  window.speechSynthesis.speak(utterance);
}
export function playSound(sound) {
  if (!audioState.overlap) stopSounds();
  if (audioState.muted || audioState.volume === 0) return;
  if (sound.type === 'voice') return speak(sound.speech);
  const ctx = audioContext();
  const start = ctx.currentTime;
  const output = ctx.createGain();
  output.gain.value = audioState.volume * .3;
  output.connect(ctx.destination);
  const tone = (frequency, endFrequency, duration, delay = 0, type = 'sine') => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start + delay);
    osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFrequency), start + delay + duration);
    gain.gain.setValueAtTime(.001, start + delay);
    gain.gain.exponentialRampToValueAtTime(.8, start + delay + .01);
    gain.gain.exponentialRampToValueAtTime(.001, start + delay + duration);
    osc.connect(gain); gain.connect(output);
    playing.add(osc);
    osc.onended = () => { playing.delete(osc); osc.disconnect(); gain.disconnect(); if (!playing.size) output.disconnect(); };
    osc.start(start + delay); osc.stop(start + delay + duration + .01);
  };
  const noise = (duration, frequency) => {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
    const source = ctx.createBufferSource(); source.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = frequency;
    source.connect(filter); filter.connect(output); playing.add(source);
    source.onended = () => { playing.delete(source); source.disconnect(); filter.disconnect(); };
    source.start();
  };
  switch (sound.type) {
    case 'boom': tone(140, 25, 1.3); tone(65, 20, 1.8); noise(.25, 250); break;
    case 'raspberry': tone(100, 45, .7, 0, 'sawtooth'); noise(.5, 200); break;
    case 'chime': [440, 554, 659, 880].forEach((f, i) => tone(f, f, .8, i * .12)); break;
    case 'alarm': [500, 700, 500, 700].forEach((f, i) => tone(f, f, .18, i * .2, 'square')); break;
    case 'ping': tone(1318, 1318, .22); tone(1760, 1760, .4, .15); break;
    case 'crack': noise(.17, 5000); break;
    case 'fail': [392, 370, 349, 261].forEach((f, i) => tone(f, f - 10, .28, i * .25, 'triangle')); break;
    case 'horn': tone(220, 220, .8, 0, 'sawtooth'); tone(277, 277, .8, 0, 'sawtooth'); break;
    case 'coin': tone(988, 988, .1, 0, 'square'); tone(1318, 1318, .35, .1, 'square'); break;
    case 'laser': tone(1300, 65, .45, 0, 'sawtooth'); break;
    case 'jump': tone(180, 700, .22, 0, 'triangle'); break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, f, .28, i * .13, 'triangle')); break;
    default: tone(170, 40, .3); noise(.15, 2000);
  }
}
