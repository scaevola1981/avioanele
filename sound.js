// sound.js - Efecte sonore generate procedural cu Web Audio API
// Optimizat pentru iOS (iPhone PWA / Safari) și Android (Chrome PWA),
// inclusiv deblocare automată după comutarea în WhatsApp ('interrupted') și bypass Silent Switch.

class SoundFX {
    constructor() {
        this.ctx = null;
        this.unlocked = false;
        this.htmlAudioUnlocked = false;
        this.muted = localStorage.getItem('sound_muted') === 'true';
        this.setupMobileAudioUnlock();
    }

    configureAudioSession() {
        // Pe iOS 17+, setează sesiunea audio pe 'playback' astfel încât sunetul să se audă
        // chiar și atunci când comutatorul fizic lateral (Silent/Ring) de pe iPhone este pe Silent.
        try {
            if (navigator.audioSession) {
                navigator.audioSession.type = 'playback';
            }
        } catch (e) {}
    }

    unlockHtmlAudioChannel() {
        if (this.htmlAudioUnlocked) return;
        try {
            // Un fișier WAV gol (1 sample, silențios) redat prin <audio> forțează iOS WebKit
            // să comute canalul audio din 'ambient' în 'media playback'.
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
                        // Redă un buffer invizibil de 1 frame pentru a debloca hardware-ul audio pe iOS
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

        // Ascultă orice atingere pe ecran pentru a reactiva AudioContext-ul
        // (esențial după ce utilizatorul se întoarce din WhatsApp, când iOS pune AudioContext în starea 'interrupted')
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

    init(onReady) {
        this.configureAudioSession();

        if (this.ctx && this.ctx.state === 'closed') {
            this.ctx = null;
        }

        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                try {
                    this.ctx = new AudioContext();
                } catch (e) {
                    console.warn('Nu s-a putut crea AudioContext:', e);
                }
            }
        }

        if (!this.ctx) return;

        // Pe iOS/Android, după trecerea în WhatsApp, starea devine 'interrupted' sau 'suspended'
        if (this.ctx.state !== 'running') {
            this.ctx.resume().then(() => {
                if (typeof onReady === 'function') onReady();
            }).catch(() => {
                // Dacă contextul a rămas blocat după backgrounding pe iOS, îl recreăm curat
                try {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (AudioContext) {
                        this.ctx = new AudioContext();
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

    playRadarPing() {
        this.vibrate(35);
        if (this.muted) return;
        this.init(() => {
            if (!this.ctx) return;
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1760, now + 0.16);

            gain.gain.setValueAtTime(0.24, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.26);
        });
    }

    playClick() {
        this.vibrate(20);
        if (this.muted) return;
        this.init(() => {
            if (!this.ctx) return;
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(240, now + 0.06);

            gain.gain.setValueAtTime(0.20, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.06);
        });
    }

    playShotLaunch() {
        this.vibrate(35);
        if (this.muted) return;
        this.init(() => {
            if (!this.ctx) return;
            const now = this.ctx.currentTime;

            // Fâșâit și fluierat rachetă
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(580, now);
            osc.frequency.exponentialRampToValueAtTime(150, now + 0.35);

            gain.gain.setValueAtTime(0.28, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.35);
        });
    }

    playMiss() {
        this.vibrate(15);
        if (this.muted) return;
        this.init(() => {
            if (!this.ctx) return;
            const now = this.ctx.currentTime;

            // Picătură / stropire în apă
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(360, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.28);

            gain.gain.setValueAtTime(0.32, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.32);
        });
    }

    playHit() {
        this.vibrate([40, 30, 50]);
        if (this.muted) return;
        this.init(() => {
            if (!this.ctx) return;
            const now = this.ctx.currentTime;

            // Zgomot alb (white noise) pentru explozie
            const bufferSize = Math.floor(this.ctx.sampleRate * 0.28);
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(900, now);
            filter.frequency.exponentialRampToValueAtTime(90, now + 0.28);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.50, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            noise.start(now);
        });
    }

    playPlaneDestroyed() {
        this.vibrate([120, 50, 150, 50, 200]);
        if (this.muted) return;
        this.init(() => {
            if (!this.ctx) return;
            const now = this.ctx.currentTime;

            // Explozie joasă
            const bufferSize = Math.floor(this.ctx.sampleRate * 0.65);
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(700, now);
            filter.frequency.exponentialRampToValueAtTime(45, now + 0.65);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.65, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            noise.start(now);

            // Sunet de alarmă cădere avion
            const siren = this.ctx.createOscillator();
            const sirenGain = this.ctx.createGain();

            siren.type = 'sawtooth';
            siren.frequency.setValueAtTime(420, now);
            siren.frequency.linearRampToValueAtTime(200, now + 0.3);
            siren.frequency.linearRampToValueAtTime(360, now + 0.5);
            siren.frequency.linearRampToValueAtTime(100, now + 0.8);

            sirenGain.gain.setValueAtTime(0.28, now);
            sirenGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

            siren.connect(sirenGain);
            sirenGain.connect(this.ctx.destination);

            siren.start(now);
            siren.stop(now + 0.8);
        });
    }

    playVictory() {
        if (this.muted) return;
        this.init(() => {
            if (!this.ctx) return;
            const now = this.ctx.currentTime;
            const notes = [
                { f: 523.25, d: 0.15 }, // C5
                { f: 659.25, d: 0.15 }, // E5
                { f: 783.99, d: 0.20 }, // G5
                { f: 1046.50, d: 0.50 } // C6
            ];

            let offset = 0;
            notes.forEach(note => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(note.f, now + offset);

                gain.gain.setValueAtTime(0.32, now + offset);
                gain.gain.exponentialRampToValueAtTime(0.001, now + offset + note.d);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now + offset);
                osc.stop(now + offset + note.d);

                offset += note.d * 0.85;
            });
        });
    }

    playDefeat() {
        if (this.muted) return;
        this.init(() => {
            if (!this.ctx) return;
            const now = this.ctx.currentTime;
            const notes = [
                { f: 400, d: 0.25 },
                { f: 360, d: 0.25 },
                { f: 300, d: 0.40 },
                { f: 220, d: 0.60 }
            ];

            let offset = 0;
            notes.forEach(note => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(note.f, now + offset);

                gain.gain.setValueAtTime(0.26, now + offset);
                gain.gain.exponentialRampToValueAtTime(0.001, now + offset + note.d);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now + offset);
                osc.stop(now + offset + note.d);

                offset += note.d * 0.9;
            });
        });
    }
}

window.soundFX = new SoundFX();
