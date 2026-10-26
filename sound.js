// sound.js - Efecte sonore generate procedural cu Web Audio API
// Nu necesită descărcarea de fișiere audio externe.

class SoundFX {
    constructor() {
        this.ctx = null;
        this.muted = localStorage.getItem('sound_muted') === 'true';
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('sound_muted', this.muted);
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
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.25);
    }

    playClick() {
        this.vibrate(20);
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    playShotLaunch() {
        this.vibrate(35);
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        // Fâșâit și fluierat rachetă
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(500, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.35);

        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.35);
    }

    playMiss() {
        this.vibrate(15);
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        // Picătură / stropire în apă
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.25);

        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playHit() {
        this.vibrate([40, 30, 50]);
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        // Explozie scurtă / impact
        const now = this.ctx.currentTime;
        
        // Zgomot alb (white noise) pentru explozie
        const bufferSize = this.ctx.sampleRate * 0.25;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(80, now + 0.25);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(now);
    }

    playPlaneDestroyed() {
        this.vibrate([120, 50, 150, 50, 200]);
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        // Explozie masivă combinată cu sirenă de alertă
        const now = this.ctx.currentTime;

        // Explozie joasă
        const bufferSize = this.ctx.sampleRate * 0.6;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(40, now + 0.6);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(now);

        // Sunet de alarmă cădere avion
        const siren = this.ctx.createOscillator();
        const sirenGain = this.ctx.createGain();

        siren.type = 'sawtooth';
        siren.frequency.setValueAtTime(400, now);
        siren.frequency.linearRampToValueAtTime(200, now + 0.3);
        siren.frequency.linearRampToValueAtTime(350, now + 0.5);
        siren.frequency.linearRampToValueAtTime(100, now + 0.8);

        sirenGain.gain.setValueAtTime(0.12, now);
        sirenGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        siren.connect(sirenGain);
        sirenGain.connect(this.ctx.destination);

        siren.start(now);
        siren.stop(now + 0.8);
    }

    playVictory() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        // Fanfară triumfătoare
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

            gain.gain.setValueAtTime(0.18, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + note.d);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + offset);
            osc.stop(now + offset + note.d);

            offset += note.d * 0.85;
        });
    }

    playDefeat() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        // Sunet trist descendent
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

            gain.gain.setValueAtTime(0.12, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + note.d);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + offset);
            osc.stop(now + offset + note.d);

            offset += note.d * 0.9;
        });
    }
}

window.soundFX = new SoundFX();
