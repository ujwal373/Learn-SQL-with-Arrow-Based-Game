// Synthesised sound effects — no external packages, no audio files.
// AudioContext is created lazily on the first user gesture (browser autoplay policy).

const STORAGE_KEY = 'queryout_sound_off'

let ctx: AudioContext | null = null

let enabled: boolean
try {
  enabled = localStorage.getItem(STORAGE_KEY) !== 'true'
} catch {
  enabled = true
}

function getCtx(): AudioContext | null {
  if (!enabled) return null
  try {
    if (ctx === null) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

// One tone: linear attack (10 ms), exponential decay to near-silence at `duration` seconds.
// `delay` lets you schedule multiple beeps ahead of time to make chords and arpeggios.
function beep(
  ac: AudioContext,
  freq: number,
  endFreq: number,
  duration: number,
  type: OscillatorType = 'sine',
  peak = 0.22,
  delay = 0,
): void {
  const t = ac.currentTime + delay
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration * 0.85)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(peak, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
  osc.start(t)
  osc.stop(t + duration + 0.01)
}

export type SoundName = 'tap' | 'slide' | 'blocked' | 'correct' | 'wrong' | 'levelUp' | 'gameOver' | 'combo'

export function isSoundEnabled(): boolean {
  return enabled
}

export function setSoundEnabled(on: boolean): void {
  enabled = on
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'false' : 'true')
  } catch {}
}

export function playSound(name: SoundName, comboLevel = 1): void {
  const ac = getCtx()
  if (ac === null) return
  switch (name) {
    case 'tap':
      beep(ac, 880, 440, 0.04)
      break
    case 'slide':
      beep(ac, 1100, 280, 0.32, 'sine', 0.2)
      break
    case 'blocked':
      beep(ac, 120, 80, 0.2, 'square', 0.3)
      break
    case 'correct':
      // Two-note chime: C5 then E5
      beep(ac, 523, 523, 0.15)
      beep(ac, 659, 659, 0.2, 'sine', 0.22, 0.13)
      break
    case 'wrong':
      // Descending minor third
      beep(ac, 330, 220, 0.3, 'sine', 0.2)
      break
    case 'levelUp':
      // Ascending major arpeggio: C5 E5 G5 C6
      beep(ac, 523, 523, 0.14, 'sine', 0.22, 0)
      beep(ac, 659, 659, 0.14, 'sine', 0.22, 0.13)
      beep(ac, 784, 784, 0.14, 'sine', 0.22, 0.26)
      beep(ac, 1047, 1047, 0.22, 'sine', 0.28, 0.39)
      break
    case 'gameOver':
      // Falling tritone
      beep(ac, 440, 311, 0.8, 'sine', 0.18)
      break
    case 'combo': {
      const freq = 880 + comboLevel * 80
      beep(ac, freq, freq * 0.9, 0.12)
      break
    }
  }
}
