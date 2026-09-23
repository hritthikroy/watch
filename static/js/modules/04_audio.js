// ============================================================================
// Module: 04_audio.js
// ============================================================================

}

        // &#9472;&#9472; Pure Web Audio API High-Tech Sound Synthesizer &#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;
        let audioCtx = null;
        function getAudioContext() {
            if (!audioCtx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) audioCtx = new AudioContext();
            }
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            return audioCtx;
        }

        function playHapticTone(type) {
            if (!audioEnabled) return;
            try {
                const ctx = getAudioContext();
                if (!ctx) return;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                const now = ctx.currentTime;
                if (type === 'order' || type === 'BUY' || type === 'SELL') {
                    // High-speed 1200Hz tactical chirp
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(1100, now);
                    osc.frequency.exponentialRampToValueAtTime(1450, now + 0.035);
                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                    osc.start(now);
                    osc.stop(now + 0.04);
                } else if (type === 'close' || type === 'TP') {
                    // Dual tone chime
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(780, now);
                    osc.frequency.exponentialRampToValueAtTime(560, now + 0.06);
                    gain.gain.setValueAtTime(0.09, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
                    osc.start(now);
                    osc.stop(now + 0.07);
                } else if (type === 'click') {
                    // Subtle 18ms tactile click
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(1800, now);
                    gain.gain.setValueAtTime(0.03, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
                    osc.start(now);
                    osc.stop(now + 0.018);
                }
            } catch(e) { console.warn("Position refresh:", e.message); }
        }

        // &#9472;&#9472; 240Hz RAF Visual Engine & Telemetry Counter &#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;
        let lastRafTime = performance.now();
        let rafFps = 240;
        let rafFrames = 0;
