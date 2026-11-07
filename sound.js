// sound.js - Motor Audio Militar Realist (Web Audio API Multi-Layer Synthesis)
// Optimizat pentru iOS (iPhone PWA / Safari) și Android (Chrome PWA),
// cu compresor dinamic, sub-bas, filtre rezonante și deblocare automată după WhatsApp.

class SoundFX {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.compressor = null;
        this.unlocked = false;
        this.htmlAudioUnlocked = false;
        this.muted = localStorage.getItem('sound_muted') === 'true';
        this.setupMobileAudioUnlock();
    }

    configureAudioSession() {
        try {
            if (navigator.audioSession) {
                navigator.audioSession.type = 'playback';
            }
        } catch (e) {}
    }

    unlockHtmlAudioChannel() {
        if (this.htmlAudioUnlocked) return;
        try {
            const silentWav = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
            const audio = new Audio(silentWav);
            audio.volume = 0.01;
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.then(() => {
                    this.htmlAudioUnlocked = true;
                }).catch(() => {});
            }
        } catch (e) {}
    }

    setupMobileAudioUnlock() {
        const unlockHandler = () => {
            if (this.muted) return;
            this.configureAudioSession();
            this.unlockHtmlAudioChannel();
            this.init(() => {
                if (!this.unlocked && this.ctx && this.ctx.state === 'running') {
                    try {
                        const buffer = this.ctx.createBuffer(1, 1, 22050);
                        const source = this.ctx.createBufferSource();
                        source.buffer = buffer;
                        source.connect(this.ctx.destination);
                        source.start(0);
                        this.unlocked = true;
                    } catch (e) {}
                }
            });
        };

        ['touchstart', 'touchend', 'pointerdown', 'click', 'keydown'].forEach((evt) => {
            window.addEventListener(evt, unlockHandler, { passive: true, capture: true });
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !this.muted) {
                this.configureAudioSession();
                if (this.ctx && this.ctx.state !== 'running') {
                    this.ctx.resume().catch(() => {});
                }
            }
        });
    }

    buildMasterChain() {
        if (!this.ctx) return;
        try {
            this.compressor = this.ctx.createDynamicsCompressor();
            this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
            this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
            this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
            this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
            this.compressor.release.setValueAtTime(0.18, this.ctx.currentTime);

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(0.95, this.ctx.currentTime);

            this.masterGain.connect(this.compressor);
            this.compressor.connect(this.ctx.destination);
        } catch (e) {
            this.masterGain = null;
        }
    }

    getOutputNode() {
        return this.masterGain || (this.ctx ? this.ctx.destination : null);
    }

    init(onReady) {
        this.configureAudioSession();

        if (this.ctx && this.ctx.state === 'closed') {
            this.ctx = null;
            this.masterGain = null;
            this.compressor = null;
        }

        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                try {
                    this.ctx = new AudioContext();
                    this.buildMasterChain();
                } catch (e) {
                    console.warn('Nu s-a putut crea AudioContext:', e);
                }
            }
        }

        if (!this.ctx) return;

        if (this.ctx.state !== 'running') {
            this.ctx.resume().then(() => {
                if (typeof onReady === 'function') onReady();
            }).catch(() => {
                try {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (AudioContext) {
                        this.ctx = new AudioContext();
                        this.buildMasterChain();
                        this.ctx.resume().then(() => {
                            if (typeof onReady === 'function') onReady();
                        }).catch(() => {});
                    }
                } catch (e) {}
            });
        } else if (typeof onReady === 'function') {
            onReady();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('sound_muted', this.muted);
        if (!this.muted) {
            this.playClick();
        }
        return this.muted;
    }

    vibrate(pattern) {
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {}
        }
    }

    createNoiseBuffer(durationSec) {
        const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * durationSec));
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        // Zgomot roz/alb hibrid pentru textură militară mai plină
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.997 * b0 + white * 0.099;
            b1 = 0.963 * b1 + white * 0.296;
            b2 = 0.570 * b2 + white * 1.052;
            data[i] = (b0 + b1 + b2 + white * 0.4) * 0.35;
        }
        return buffer;
    }

    // 1. COMUTATOR TACTIC DE COCKPIT (Butoane & Selecție Celule)
    playClick() {
        this.vibrate(18);
        if (this.muted) return;
        this.init(() => {
            if (!this.ctx) return;
            const out = this.getOutputNode();
            const now = this.ctx.currentTime;

            // Stratul 1: Click mecanic scurt (impuls filtrat)
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.createNoiseBuffer(0.025);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2200, now);
            filter.Q.setValueAtTime(3.5, now);

            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.35, now);
            nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

            noise.connect(filter);
            filter.connect(nGain);
            nGain.connect(out);
            noise.start(now);

            // Stratul 2: Corp tactil scurt („thock” de comutator avionică)
            const osc = this.ctx.createOscillator();
            const oGain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(240, now);
            osc.frequency.exponentialRampToValueAtTime(75, now + 0.032);

            oGain.gain.setValueAtTime(0.28, now);
            oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

            osc.connect(oGain);
            oGain.connect(out);
            osc.start(now);
            osc.stop(now + 0.035);
        });
    }

    // 2. SONAR / RADAR MILITAR AWACS CU ECOU DUBLU
    playRadarPing() {
        this.vibrate(30);
        if (this.muted) return;
        this.init(() => {
            if (!this.ctx) return;
            const out = this.getOutputNode();
            const now = this.ctx.currentTime;

            const triggerPing = (startTime, peakGain, freq) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime);
                osc.frequency.exponentialRampToValueAtTime(freq * 0.985, startTime + 0.38);

                gain.gain.setValueAtTime(0.001, startTime);
                gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.008);
                gain.gain.exponentialRampToValueAtTime(0.0008, startTime + 0.38);

                osc.connect(gain);
                gain.connect(out);

                osc.start(startTime);
                osc.stop(startTime + 0.40);
            };

            // Ping principal + ecou radar la 160ms
            triggerPing(now, 0.32, 1320);
            triggerPing(now + 0.16, 0.11, 1320);
        });
    }

    // 3. LANSARE RACHETĂ AER-AER (Ignite + Jet Propulsion Whoosh)
    playShotLaunch() {
        this.vibrate(40);
        if (this.muted) return;
        this.init(() => {
            if (!this.ctx) return;
            const out = this.getOutputNode();
            const now = this.ctx.currentTime;

            // Stratul 1: Jetul de propulsie al rachetei (bandpass noise sweep)
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.createNoiseBuffer(0.48);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.Q.setValueAtTime(2.2, now);
            filter.frequency.setValueAtTime(350, now);
            filter.frequency.exponentialRampToValueAtTime(2400, now + 0.12);
            filter.frequency.exponentialRampToValueAtTime(520, now + 0.46);

            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.01, now);
            nGain.gain.linearRampToValueAtTime(0.55, now + 0.04);
            nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);

            noise.connect(filter);
            filter.connect(nGain);
            nGain.connect(out);
            noise.start(now);

            // Stratul 2: Șuieratul supersonic al focoasei
            const osc = this.ctx.createOscillator();
            const oGain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1150, now);
            osc.frequency.exponentialRampToValueAtTime(240, now + 0.38);

            oGain.gain.setValueAtTime(0.18, now);
            oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

            osc.connect(oGain);
            oGain.connect(out);
            osc.start(now);
            osc.stop(now + 0.40);
        });
    }

    // 4. RATARE — IMPACT ÎN APĂ / PROIECTIL SCUFUNDAT (Splash + Sub-acvatic)
    playMiss() {
        this.vibrate(20);
        if (this.muted) return;
        this.init(() => {
            if (!this.ctx) return;
            const out = this.getOutputNode();
            const now = this.ctx.currentTime;

            // Stratul 1: Impactul proiectilului în apă (low-pitched plop)
            const osc = this.ctx.createOscillator();
            const oGain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(260, now);
            osc.frequency.exponentialRampToValueAtTime(75, now + 0.11);
            osc.frequency.exponentialRampToValueAtTime(190, now + 0.24);

            oGain.gain.setValueAtTime(0.34, now);
            oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

            osc.connect(oGain);
            oGain.connect(out);
            osc.start(now);
            osc.stop(now + 0.28);

            // Stratul 2: Stropi de apă / spumă (filtered water splash)
            const splash = this.ctx.createBufferSource();
            splash.buffer = this.createNoiseBuffer(0.36);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.Q.setValueAtTime(1.8, now);
            filter.frequency.setValueAtTime(1400, now + 0.03);
            filter.frequency.exponentialRampToValueAtTime(420, now + 0.35);

            const sGain = this.ctx.createGain();
            sGain.gain.setValueAtTime(0.001, now);
            sGain.gain.linearRampToValueAtTime(0.32, now + 0.04);
            sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            splash.connect(filter);
            filter.connect(sGain);
            sGain.connect(out);
            splash.start(now);
        });
    }

    // 5. AVION LOVIT ÎN ARIPĂ/CORP (Tun Antiaerian + Impact Blindaj Metalic)
    playHit() {
        this.vibrate([50, 30, 70]);
        if (this.muted) return;
        this.init(() => {
            if (!this.ctx) return;
            const out = this.getOutputNode();
            const now = this.ctx.currentTime;

            // Stratul 1: Sub-bas puternic de explozie (Cannon Thud)
            const sub = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(150, now);
            sub.frequency.exponentialRampToValueAtTime(34, now + 0.38);

            subGain.gain.setValueAtTime(0.75, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.40);

            sub.connect(subGain);
            subGain.connect(out);
            sub.start(now);
            sub.stop(now + 0.42);

            // Stratul 2: Deflagrație + sfâșiere metalică fuzelaj
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.createNoiseBuffer(0.42);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1400, now);
            filter.frequency.exponentialRampToValueAtTime(110, now + 0.40);

            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.65, now);
            nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.40);

            noise.connect(filter);
            filter.connect(nGain);
            nGain.connect(out);
            noise.start(now);

            // Stratul 3: Rezonanță metalică scurtă la impact
            const metal = this.ctx.createOscillator();
            const mGain = this.ctx.createGain();
            metal.type = 'square';
            metal.frequency.setValueAtTime(310, now);
            metal.frequency.exponentialRampToValueAtTime(95, now + 0.14);

            mGain.gain.setValueAtTime(0.22, now);
            mGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

            metal.connect(mGain);
            mGain.connect(out);
            metal.start(now);
            metal.stop(now + 0.15);
        });
    }

    // 6. CAP DOBORÂT! (Lock-On Cockpit Beep + Dublă Explozie Catastrofală + Motor în Picaj)
    playPlaneDestroyed() {
        this.vibrate([120, 50, 160, 50, 220]);
        if (this.muted) return;
        this.init(() => {
            if (!this.ctx) return;
            const out = this.getOutputNode();
            const now = this.ctx.currentTime;

            // Stratul 1: Bip dublu scurt de confirmare țintă distrusă (F-16 Target Kill Confirm)
            [0, 0.085].forEach((delay, idx) => {
                const beep = this.ctx.createOscillator();
                const bGain = this.ctx.createGain();
                beep.type = 'sine';
                beep.frequency.setValueAtTime(idx === 0 ? 1760 : 2349.32, now + delay);

                bGain.gain.setValueAtTime(0.26, now + delay);
                bGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.065);

                beep.connect(bGain);
                bGain.connect(out);
                beep.start(now + delay);
                beep.stop(now + delay + 0.07);
            });

            // Stratul 2: Dublă explozie grea cu sub-bas (la t=0.05s și t=0.22s)
            [0.04, 0.22].forEach((offset, idx) => {
                const boom = this.ctx.createOscillator();
                const boomGain = this.ctx.createGain();
                boom.type = 'sine';
                boom.frequency.setValueAtTime(idx === 0 ? 160 : 125, now + offset);
                boom.frequency.exponentialRampToValueAtTime(26, now + offset + 0.55);

                boomGain.gain.setValueAtTime(0.80, now + offset);
                boomGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.58);

                boom.connect(boomGain);
                boomGain.connect(out);
                boom.start(now + offset);
                boom.stop(now + offset + 0.60);

                const blast = this.ctx.createBufferSource();
                blast.buffer = this.createNoiseBuffer(0.65);

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(idx === 0 ? 1600 : 1100, now + offset);
                filter.frequency.exponentialRampToValueAtTime(60, now + offset + 0.62);

                const nGain = this.ctx.createGain();
                nGain.gain.setValueAtTime(0.70, now + offset);
                nGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.62);

                blast.connect(filter);
                filter.connect(nGain);
                nGain.connect(out);
                blast.start(now + offset);
            });

            // Stratul 3: Turbină avion în picaj (descendent)
            const turbine = this.ctx.createOscillator();
            const tFilter = this.ctx.createBiquadFilter();
            const tGain = this.ctx.createGain();

            turbine.type = 'sawtooth';
            turbine.frequency.setValueAtTime(520, now + 0.12);
            turbine.frequency.exponentialRampToValueAtTime(75, now + 0.92);

            tFilter.type = 'lowpass';
            tFilter.frequency.setValueAtTime(900, now + 0.12);

            tGain.gain.setValueAtTime(0.18, now + 0.12);
            tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.92);

            turbine.connect(tFilter);
            tFilter.connect(tGain);
            tGain.connect(out);

            turbine.start(now + 0.12);
            turbine.stop(now + 0.95);
        });
    }

    // 7. VICTORIE! — Fanfară Militară Brass (Acorduri bogate de misiune îndeplinită)
    playVictory() {
        this.vibrate([80, 40, 80, 40, 200]);
        if (this.muted) return;
        this.init(() => {
            if (!this.ctx) return;
            const out = this.getOutputNode();
            const now = this.ctx.currentTime;

            const playBrassNote = (freq, start, duration, vol = 0.22) => {
                [-4, 4].forEach((detuneCents) => {
                    const osc = this.ctx.createOscillator();
                    const filter = this.ctx.createBiquadFilter();
                    const gain = this.ctx.createGain();

                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(freq, start);
                    osc.detune.setValueAtTime(detuneCents, start);

                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(freq * 3.2, start);
                    filter.frequency.exponentialRampToValueAtTime(freq * 1.5, start + duration);

                    gain.gain.setValueAtTime(0.001, start);
                    gain.gain.linearRampToValueAtTime(vol * 0.5, start + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(out);

                    osc.start(start);
                    osc.stop(start + duration + 0.02);
                });
            };

            // Fanfară eroică: C4 -> G4 -> C5 -> E5 -> Acord Major Final (C5 + E5 + G5)
            playBrassNote(523.25, now + 0.00, 0.16, 0.26); // C5
            playBrassNote(659.25, now + 0.14, 0.16, 0.26); // E5
            playBrassNote(783.99, now + 0.28, 0.18, 0.28); // G5
            // Acord final susținut
            playBrassNote(523.25, now + 0.46, 0.70, 0.22); // C5
            playBrassNote(659.25, now + 0.46, 0.70, 0.22); // E5
            playBrassNote(1046.50, now + 0.46, 0.75, 0.28); // C6
        });
    }

    // 8. ÎNFRÂNGERE — Semnal Grav de Misiune Pierdută
    playDefeat() {
        this.vibrate([150, 60, 250]);
        if (this.muted) return;
        this.init(() => {
            if (!this.ctx) return;
            const out = this.getOutputNode();
            const now = this.ctx.currentTime;

            const notes = [
                { f: 392.00, s: 0.00, d: 0.26 }, // G4
                { f: 349.23, s: 0.24, d: 0.26 }, // F4
                { f: 311.13, s: 0.48, d: 0.30 }, // Eb4
                { f: 261.63, s: 0.76, d: 0.65 }  // C4
            ];

            notes.forEach((n) => {
                const osc = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();
                const gain = this.ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(n.f, now + n.s);

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(900, now + n.s);
                filter.frequency.exponentialRampToValueAtTime(280, now + n.s + n.d);

                gain.gain.setValueAtTime(0.001, now + n.s);
                gain.gain.linearRampToValueAtTime(0.24, now + n.s + 0.025);
                gain.gain.exponentialRampToValueAtTime(0.001, now + n.s + n.d);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(out);

                osc.start(now + n.s);
                osc.stop(now + n.s + n.d + 0.02);
            });
        });
    }
}

window.soundFX = new SoundFX();
