/* ============================================================
   audio.js — เสียงประกอบสังเคราะห์ด้วย Web Audio API
   ระนาด/ขิมจำลอง, ระฆังวัด, เสียงพลิกหน้ากระดาษ, บรรยากาศสายน้ำ
   ============================================================ */
(function () {
  const AudioSys = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    muted: false,
    started: false,
    _musicTimer: null,
    _nextNoteTime: 0,
    _melodyStep: 0,

    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.42;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.8;
      this.sfxGain.connect(this.master);
      this.muted = localStorage.getItem("r5_muted") === "1";
      if (this.muted) this.master.gain.value = 0;
    },

    unlock() {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();
      if (!this.started) {
        this.started = true;
        this._startMusic();
        this._startWater();
      }
    },

    setMuted(m) {
      this.muted = m;
      localStorage.setItem("r5_muted", m ? "1" : "0");
      if (this.master) this.master.gain.linearRampToValueAtTime(m ? 0 : 0.9, this.ctx.currentTime + 0.2);
    },

    /* ---------- ตัวสร้างเสียงพื้นฐาน ---------- */
    _env(gainNode, t, a, peak, d) {
      gainNode.gain.setValueAtTime(0.0001, t);
      gainNode.gain.linearRampToValueAtTime(peak, t + a);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    },

    // เสียงคล้ายระนาด/ขิม: sine + harmonic สั้น
    _mallet(freq, t, vol = 0.3, dur = 1.4, dest = null) {
      const ctx = this.ctx;
      const out = dest || this.musicGain;
      const osc1 = ctx.createOscillator(); osc1.type = "sine"; osc1.frequency.value = freq;
      const osc2 = ctx.createOscillator(); osc2.type = "sine"; osc2.frequency.value = freq * 4.02;
      const g1 = ctx.createGain(), g2 = ctx.createGain();
      this._env(g1, t, 0.005, vol, dur);
      this._env(g2, t, 0.004, vol * 0.22, dur * 0.35);
      osc1.connect(g1).connect(out);
      osc2.connect(g2).connect(out);
      osc1.start(t); osc1.stop(t + dur + 0.1);
      osc2.start(t); osc2.stop(t + dur * 0.4 + 0.1);
    },

    _noise(t, vol, dur, filterFreq, dest = null, type = "bandpass") {
      const ctx = this.ctx;
      const out = dest || this.sfxGain;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq; f.Q.value = 0.8;
      const g = ctx.createGain();
      this._env(g, t, 0.01, vol, dur);
      src.connect(f).connect(g).connect(out);
      src.start(t);
    },

    /* ---------- SFX ---------- */
    sfx(name) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      switch (name) {
        case "click":  // คลิกเบา ๆ เหมือนเคาะไม้
          this._mallet(1180, t, 0.16, 0.12, this.sfxGain);
          break;
        case "page":   // พลิกหน้ากระดาษ
          this._noise(t, 0.25, 0.28, 2400, this.sfxGain);
          this._noise(t + 0.09, 0.15, 0.2, 3400, this.sfxGain);
          break;
        case "chime":  // เลือกการ์ด
          this._mallet(523.25, t, 0.22, 0.9, this.sfxGain);
          this._mallet(783.99, t + 0.09, 0.2, 1.1, this.sfxGain);
          break;
        case "good":   // ผลลัพธ์ดี — ทำนองขึ้นแบบเพนทาโทนิก
          [523.25, 587.33, 659.25, 783.99].forEach((f, i) => this._mallet(f, t + i * 0.1, 0.2, 1.2, this.sfxGain));
          break;
        case "bad":    // ผลลัพธ์ร้าย — ฆ้องต่ำ
          this._mallet(130.81, t, 0.34, 2.2, this.sfxGain);
          this._mallet(98, t + 0.05, 0.2, 2.6, this.sfxGain);
          break;
        case "coin":
          this._mallet(1567.98, t, 0.16, 0.35, this.sfxGain);
          this._mallet(2093, t + 0.07, 0.13, 0.5, this.sfxGain);
          break;
        case "bell":   // ระฆังวัด — ประกาศเหตุการณ์
          this._mallet(329.63, t, 0.3, 3.2, this.sfxGain);
          this._mallet(659.25, t, 0.1, 2.0, this.sfxGain);
          break;
        case "gong":   // ข่าวใหญ่/คร่ำครวญ
          this._mallet(146.83, t, 0.36, 3.4, this.sfxGain);
          this._mallet(220, t + 0.02, 0.18, 3.0, this.sfxGain);
          break;
        case "sigh":
          this._mallet(392, t, 0.16, 1.4, this.sfxGain);
          this._mallet(329.63, t + 0.35, 0.14, 1.8, this.sfxGain);
          break;
        case "birth":  // เกิดใหม่ — ทำนองอบอุ่น
          [392, 523.25, 587.33, 783.99, 1046.5].forEach((f, i) => this._mallet(f, t + i * 0.13, 0.2, 1.8, this.sfxGain));
          break;
        case "unlock": // ปลดล็อกตอนจบ
          [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this._mallet(f, t + i * 0.08, 0.18, 1.4, this.sfxGain));
          break;
      }
    },

    /* ---------- เพลงประกอบ: ทำนองเพนทาโทนิกสไตล์ไทย ---------- */
    // สเกล C หลัก: C D E G A สองอ็อกเทฟ
    _scale: [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99],
    _melodySeed: 7,
    _rand() { // mulberry32
      this._melodySeed |= 0; this._melodySeed = (this._melodySeed + 0x6D2B79F5) | 0;
      let z = Math.imul(this._melodySeed ^ (this._melodySeed >>> 15), 1 | this._melodySeed);
      z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    },

    _startMusic() {
      const ctx = this.ctx;
      this._nextNoteTime = ctx.currentTime + 0.2;
      const beat = 60 / 66; // 66 bpm ผ่อนคลาย
      let pos = 4; // ตำแหน่งบนสเกล
      const schedule = () => {
        if (!this.ctx) return;
        while (this._nextNoteTime < ctx.currentTime + 1.2) {
          const t = this._nextNoteTime;
          const r = this._rand();
          // ทำนองเดินแบบสุ่มมีทิศ (random walk)
          pos += [-2, -1, -1, 0, 1, 1, 2][Math.floor(r * 7)];
          pos = Math.max(0, Math.min(this._scale.length - 1, pos));
          if (this._rand() < 0.82) this._mallet(this._scale[pos], t, 0.12 + this._rand() * 0.07, 2.2);
          // เสียงตอบเบา ๆ เป็นพัก ๆ
          if (this._rand() < 0.28) this._mallet(this._scale[Math.max(0, pos - 3)] / 2, t + beat / 2, 0.08, 3.2);
          // พื้นเสียงยาวทุก 4 จังหวะ
          if (this._melodyStep % 8 === 0) this._mallet(this._scale[2] / 2, t, 0.07, 6.5);
          this._melodyStep++;
          this._nextNoteTime += beat * (this._rand() < 0.2 ? 1.5 : 1);
        }
        this._musicTimer = setTimeout(schedule, 350);
      };
      schedule();
    },

    // เสียงน้ำไหลเบา ๆ เป็นฉากหลัง
    _startWater() {
      const ctx = this.ctx;
      const len = ctx.sampleRate * 3;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let v = 0;
      for (let i = 0; i < len; i++) { v = v * 0.96 + (Math.random() * 2 - 1) * 0.04; data[i] = v * 2.2; }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 480;
      const g = ctx.createGain(); g.gain.value = 0.14;
      src.connect(f).connect(g).connect(this.musicGain);
      src.start();
    },
  };

  window.AudioSys = AudioSys;
})();
