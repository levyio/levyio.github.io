/* Struck resonator for the gasket drum.
 *
 * What is MEASURED: the eigenvalues, and therefore every frequency ratio in
 * the sound. Nothing here retunes them.
 *
 * What is STATED (a choice, not a result -- and named on screen as such):
 *   f0    the pitch the fundamental is placed at. Only sets overall pitch.
 *   tau0  decay time of the fundamental.
 *   p     how much faster high modes die: tau_k = tau0 * (f_1/f_k)^p.
 *   N     how many modes get rendered, with the captured energy fraction
 *         reported so the truncation is a disclosed number, not a fudge.
 *
 * The model. Membrane wave equation with the drum struck at, and listened to
 * at, the same point x0 -- a contact pickup on the strike location:
 *
 *     omega_k = 2 pi f0 sqrt(lambda_k / lambda_1)
 *     s(t)    = sum_k  [u_k(x0)^2 / omega_k] * sin(omega_k t) * exp(-t/tau_k)
 *
 * The u_k(x0)^2 weight is the whole point of striking rather than strumming:
 * a mode that does not live at x0 is not excited. On a fractal drum many modes
 * are localised, so the timbre changes with where you hit it. That is
 * Sapoval's localisation, audible.
 *
 * Synthesis is a damped complex rotation per mode, 6 flops a sample, so all
 * 363 modes can be rendered without a Math.sin call in the inner loop.
 */
(function (root) {
  'use strict';

  var ctx = null;

  function context() {
    if (!ctx) {
      var C = root.AudioContext || root.webkitAudioContext;
      if (!C) throw new Error('Web Audio is not available in this browser');
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* Modal amplitudes for a strike at interior vertex `site`.
   * Returns per-mode { f, amp, tau } plus the truncation accounting. */
  function strikeModes(sol, site, opt) {
    var n = sol.n, V = sol.vectors, lam = sol.values;
    var f0 = opt.f0, tau0 = opt.tau0, p = opt.p, nMax = Math.min(opt.modes, n);
    var lam1 = lam[0];

    var all = [];
    for (var k = 0; k < n; k++) {
      var f = f0 * Math.sqrt(lam[k] / lam1);
      var u = V[k * n + site];
      var omega = 2 * Math.PI * f;
      all.push({ k: k, f: f, lambda: lam[k], amp: (u * u) / omega,
                 tau: tau0 * Math.pow(f0 / f, p) });
    }

    // rank by contribution so a truncation keeps the loudest modes, then say
    // exactly how much of the strike we kept
    var byAmp = all.slice().sort(function (a, b) { return b.amp - a.amp; });
    var kept = byAmp.slice(0, nMax);
    var eAll = 0, eKept = 0;
    for (var i = 0; i < all.length; i++) eAll += all[i].amp * all[i].amp;
    for (i = 0; i < kept.length; i++) eKept += kept[i].amp * kept[i].amp;

    var nyq = (ctx ? ctx.sampleRate : 48000) / 2;
    var aliased = kept.filter(function (m) { return m.f >= nyq; });
    kept = kept.filter(function (m) { return m.f < nyq; });

    kept.sort(function (a, b) { return a.k - b.k; });
    return {
      modes: kept, total: n, rendered: kept.length,
      energy: eAll > 0 ? eKept / eAll : 0,
      aliased: aliased.length,
      fMin: all[0].f, fMax: all[all.length - 1].f
    };
  }

  /* Additive render to plain samples. No Web Audio, no DOM -- so the audio
   * itself can be measured by the self-test (and in node) rather than merely
   * assumed to be correct. */
  function renderSamples(sel, seconds, sampleRate) {
    var sr = sampleRate || (ctx ? ctx.sampleRate : 48000);
    var len = Math.max(1, Math.floor(seconds * sr));
    var out = new Float32Array(len);
    var ms = sel.modes;

    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      var theta = 2 * Math.PI * m.f / sr;
      var r = Math.exp(-1 / Math.max(1, m.tau * sr));
      var mr = r * Math.cos(theta), mi = r * Math.sin(theta);
      var re = m.amp, im = 0;                     // a * e^(i0), we emit Im part
      for (var t = 0; t < len; t++) {
        var nre = re * mr - im * mi;
        im = re * mi + im * mr;
        re = nre;
        out[t] += im;
        if (t > 2000 && Math.abs(re) + Math.abs(im) < 1e-9) break;   // rung out
      }
    }

    // peak-normalise: a stated output gain, it changes no ratio
    var peak = 0;
    for (i = 0; i < len; i++) { var a = Math.abs(out[i]); if (a > peak) peak = a; }
    if (peak > 0) { var g = 0.85 / peak; for (i = 0; i < len; i++) out[i] *= g; }

    // 5 ms fade-out so stopping never clicks
    var fade = Math.min(len, Math.floor(0.005 * sr));
    for (i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
    return { samples: out, sampleRate: sr, peak: peak };
  }

  /* Same render, wrapped for playback. */
  function render(sel, seconds) {
    var c = context();
    var r = renderSamples(sel, seconds, c.sampleRate);
    var buf = c.createBuffer(1, r.samples.length, r.sampleRate);
    buf.getChannelData(0).set(r.samples);
    return { buffer: buf, peak: r.peak, samples: r.samples };
  }

  /* Power in a rendered signal at frequency f (Goertzel-style projection).
   * Used by the self-test to confirm the audio really lands on the measured
   * eigenfrequencies instead of merely being non-silent. */
  function powerAt(samples, sr, f, seconds) {
    var N = Math.min(samples.length, Math.floor((seconds || 0.5) * sr));
    var w = 2 * Math.PI * f / sr, re = 0, im = 0;
    for (var i = 0; i < N; i++) { re += samples[i] * Math.cos(w * i); im += samples[i] * Math.sin(w * i); }
    return Math.sqrt(re * re + im * im) / N;
  }

  var voice = null;

  function play(buf, gain) {
    var c = context();
    stop();
    var src = c.createBufferSource();
    src.buffer = buf;
    var g = c.createGain();
    g.gain.value = gain === undefined ? 0.9 : gain;
    src.connect(g); g.connect(c.destination);
    src.start();
    voice = src;
    return src;
  }

  function stop() {
    if (voice) { try { voice.stop(); } catch (e) { /* already ended */ } voice = null; }
  }

  /* One mode alone -- the audible catalogue entry for a single eigenvalue. */
  function playSingle(f, seconds, tau) {
    var sel = { modes: [{ f: f, amp: 1, tau: tau === undefined ? 1.6 : tau }] };
    return play(render(sel, seconds === undefined ? 2.0 : seconds).buffer);
  }

  root.HFAudio = {
    context: context, strikeModes: strikeModes,
    render: render, renderSamples: renderSamples, powerAt: powerAt,
    play: play, stop: stop, playSingle: playSingle,
    get sampleRate() { return ctx ? ctx.sampleRate : null; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
