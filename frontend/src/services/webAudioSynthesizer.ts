import type { SynthPreset } from '../types';

/**
 * Gerador de paisagens sonoras relaxantes em tempo real via Web Audio API.
 * Funciona 100% no navegador (zero banda, sem CORS, funciona até no modo avião do PWA
 * e desbloqueia instantaneamente no gesto de clique do iOS Safari e Chrome Android).
 */
export class WebAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: AudioNode[] = [];
  private activeSources: Array<{ stop: () => void }> = [];
  private currentPreset: SynthPreset | null = null;
  private volume = 0.85;
  private muted = false;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  public async start(preset: SynthPreset, volume: number, muted: boolean): Promise<void> {
    this.stop();

    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    this.volume = volume;
    this.muted = muted;
    this.currentPreset = preset;

    const master = this.masterGain!;
    const now = ctx.currentTime;
    const targetGain = muted ? 0 : Math.max(0, Math.min(1, volume)) * 0.45;

    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(targetGain, now + 0.8);

    switch (preset) {
      case 'rain':
        this.buildRainSoundscape(ctx, master);
        break;
      case 'brown-noise':
        this.buildColoredNoise(ctx, master, 'brown', 380);
        break;
      case 'pink-noise':
        this.buildColoredNoise(ctx, master, 'pink', 1400);
        break;
      case 'white-noise':
        this.buildColoredNoise(ctx, master, 'white', 2400);
        break;
      case 'ocean':
        this.buildOceanSoundscape(ctx, master);
        break;
      case 'zen-pad':
        this.buildZenPad(ctx, master);
        break;
    }
  }

  public stop(): void {
    for (const src of this.activeSources) {
      try {
        src.stop();
      } catch {
        // Já parado
      }
    }
    for (const node of this.activeNodes) {
      try {
        node.disconnect();
      } catch {
        // Já desconectado
      }
    }
    this.activeSources = [];
    this.activeNodes = [];
    this.currentPreset = null;

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(0, now);
    }
  }

  public isRunning(): boolean {
    return this.currentPreset !== null && this.activeSources.length > 0;
  }

  public setVolume(nextVolume: number): void {
    this.volume = Math.max(0, Math.min(1, nextVolume));
    this.applyGain();
  }

  public setMuted(nextMuted: boolean): void {
    this.muted = nextMuted;
    this.applyGain();
  }

  private applyGain(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const target = this.muted ? 0 : this.volume * 0.45;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(target, now, 0.08);
  }

  private createNoiseBuffer(
    ctx: AudioContext,
    type: 'white' | 'pink' | 'brown',
    durationSeconds = 4
  ): AudioBuffer {
    const bufferSize = ctx.sampleRate * durationSeconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < bufferSize; i += 1) {
        output[i] = (Math.random() * 2 - 1) * 0.35;
      }
    } else if (type === 'pink') {
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      for (let i = 0; i < bufferSize; i += 1) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
      }
    } else {
      // Brown noise (integrador suave — ideal para crises de ansiedade)
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i += 1) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 2.4;
      }
    }

    return buffer;
  }

  private buildColoredNoise(
    ctx: AudioContext,
    destination: AudioNode,
    type: 'white' | 'pink' | 'brown',
    cutoffHz: number
  ): void {
    const source = ctx.createBufferSource();
    source.buffer = this.createNoiseBuffer(ctx, type, 5);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoffHz;
    filter.Q.value = 0.7;

    source.connect(filter);
    filter.connect(destination);
    source.start();

    this.activeSources.push(source);
    this.activeNodes.push(source, filter);
  }

  private buildRainSoundscape(ctx: AudioContext, destination: AudioNode): void {
    // Camada 1: chuva constante suave (pink noise filtrado)
    const rainSource = ctx.createBufferSource();
    rainSource.buffer = this.createNoiseBuffer(ctx, 'pink', 5);
    rainSource.loop = true;

    const rainBandpass = ctx.createBiquadFilter();
    rainBandpass.type = 'bandpass';
    rainBandpass.frequency.value = 950;
    rainBandpass.Q.value = 0.45;

    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.85;

    // Modulação orgânica lenta simulando variação da chuva
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.18;
    lfo.connect(lfoGain);
    lfoGain.connect(rainGain.gain);

    // Camada 2: fundo grave acolhedor (chuva abafada na janela)
    const rumbleSource = ctx.createBufferSource();
    rumbleSource.buffer = this.createNoiseBuffer(ctx, 'brown', 5);
    rumbleSource.loop = true;

    const rumbleLowpass = ctx.createBiquadFilter();
    rumbleLowpass.type = 'lowpass';
    rumbleLowpass.frequency.value = 240;

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.45;

    rainSource.connect(rainBandpass);
    rainBandpass.connect(rainGain);
    rainGain.connect(destination);

    rumbleSource.connect(rumbleLowpass);
    rumbleLowpass.connect(rumbleGain);
    rumbleGain.connect(destination);

    rainSource.start();
    rumbleSource.start();
    lfo.start();

    this.activeSources.push(rainSource, rumbleSource, lfo);
    this.activeNodes.push(
      rainSource,
      rainBandpass,
      rainGain,
      lfo,
      lfoGain,
      rumbleSource,
      rumbleLowpass,
      rumbleGain
    );
  }

  private buildOceanSoundscape(ctx: AudioContext, destination: AudioNode): void {
    const source = ctx.createBufferSource();
    source.buffer = this.createNoiseBuffer(ctx, 'pink', 6);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;

    const waveGain = ctx.createGain();
    waveGain.gain.value = 0.55;

    // LFO lento (~8.3s por ciclo) simulando ondas calmas na praia
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.35;

    const lfoFilterGain = ctx.createGain();
    lfoFilterGain.gain.value = 260;

    lfo.connect(lfoGain);
    lfoGain.connect(waveGain.gain);
    lfo.connect(lfoFilterGain);
    lfoFilterGain.connect(filter.frequency);

    source.connect(filter);
    filter.connect(waveGain);
    waveGain.connect(destination);

    source.start();
    lfo.start();

    this.activeSources.push(source, lfo);
    this.activeNodes.push(source, filter, waveGain, lfo, lfoGain, lfoFilterGain);
  }

  private buildZenPad(ctx: AudioContext, destination: AudioNode): void {
    // Acorde harmônico suave baseado em 432Hz (Lá 432 / Dó# / Mi) com respiração lenta
    const freqs = [108, 162, 216, 270, 324];
    const padGain = ctx.createGain();
    padGain.gain.value = 0.45;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.1; // Ciclo respiratório de 10s
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.14;
    lfo.connect(lfoGain);
    lfoGain.connect(padGain.gain);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 680;

    padGain.connect(lowpass);
    lowpass.connect(destination);

    for (let i = 0; i < freqs.length; i += 1) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freqs[i];

      const voiceGain = ctx.createGain();
      voiceGain.gain.value = 0.22 / (1 + i * 0.35);

      osc.connect(voiceGain);
      voiceGain.connect(padGain);
      osc.start();

      this.activeSources.push(osc);
      this.activeNodes.push(osc, voiceGain);
    }

    lfo.start();
    this.activeSources.push(lfo);
    this.activeNodes.push(padGain, lowpass, lfo, lfoGain);
  }
}

export const webAudioSynthesizer = new WebAudioSynthesizer();
