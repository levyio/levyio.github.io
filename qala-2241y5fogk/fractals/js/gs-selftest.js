/* Self-test: the browser must reproduce docs/verify_grayscott.py or say so.
 *
 * Every constant below is pasted from that script's CONSTANTS block (section
 * 7). If the page and the Python ever disagree, the footer goes red and names
 * the failing check -- that is the contract. Run in Node the same way:
 *
 *     node js/gs-selftest.js
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var T = isNode ? require('./turingmath.js') : root.HFTuring;
  var FFT = isNode ? require('./fft.js') : root.HFFFT;
  var GS = isNode ? require('./grayscott.js') : root.HFGrayScott;

  /* From docs/verify_grayscott.py, section 7. */
  var PY = {
    dtMax256: 1.192093,
    fold_mitosisRow: 0.037636,          // brief's F=0.037, k=0.060: above the fold
    turingF: 0.06755, turingK: 0.06240,
    turingU: 0.497286162, turingV: 0.261318351,
    turingQ: 41.008748,
    turingSigma: 1.893107855e-2,
    turingLambdaCells: 15.689291
  };

  function run() {
    var checks = [];
    function ok(name, pass, detail) {
      checks.push({ name: name, pass: !!pass, detail: detail || '' });
    }
    function close(a, b, tol) { return Math.abs(a - b) <= tol; }

    /* 1. Euler stability bound. */
    ok('dt=1 stable at n=256 (bound ' + PY.dtMax256 + ')',
       close(T.dtMax(256), PY.dtMax256, 1e-4) && T.dtMax(256) > 1.0);

    /* 2. Fold curve at the falsified "mitosis" row. */
    ok('fold(0.037, 0.060) = 0.037636 > F: no state there',
       close(T.fold(0.037, 0.060), PY.fold_mitosisRow, 1e-9) &&
       T.fold(0.037, 0.060) > 0.037);

    /* 3. Steady states satisfy the reaction equations to machine precision. */
    var worst = 0;
    [[0.0367, 0.0649], [0.0545, 0.062], [0.06755, 0.0624], [0.078, 0.061]]
      .forEach(function (p) {
        T.steadyStates(p[0], p[1]).forEach(function (s) {
          var sum = p[0] + p[1];
          worst = Math.max(worst,
            Math.abs(-s.u * s.v * s.v + p[0] * (1 - s.u)),
            Math.abs(s.u * s.v * s.v - sum * s.v));
        });
      });
    ok('steady-state residual < 1e-14', worst < 1e-14, worst.toExponential(2));

    /* 4. (1,0) is stable at every wavenumber -- so no pattern grows from
     * infinitesimal noise anywhere; Gray-Scott is seeded, not spontaneous. */
    var maxGrow = -Infinity;
    for (var F = 0.005; F <= 0.12; F += 0.005) {
      for (var k = 0.03; k <= 0.075; k += 0.005) {
        [0, 1e2, 1e4, 1e5].forEach(function (q2) {
          maxGrow = Math.max(maxGrow, -F - T.DU * q2, -(F + k) - T.DV * q2);
        });
      }
    }
    ok('(1,0) stable everywhere (max growth rate < 0)', maxGrow < 0,
       maxGrow.toExponential(2));

    /* 5. Verdicts at the presets: not one famous regime is a Turing
     * instability. The corrected coral point has a state but tr > 0. */
    ok('mitosis 0.0367/0.0649 verdict no-state',
       T.turing(0.0367, 0.0649).verdict === 'no-state');
    ok('solitons 0.030/0.062 verdict no-state',
       T.turing(0.030, 0.062).verdict === 'no-state');
    ok('coral 0.0545/0.062 verdict tr>0 (state exists, oscillator-unstable)',
       T.turing(0.0545, 0.062).verdict === 'tr>0');

    /* 6. The Turing point, against Python to tight tolerance. */
    var tp = T.turing(PY.turingF, PY.turingK, true);
    ok('Turing point verdict TURING', tp.verdict === 'TURING');
    if (tp.verdict === 'TURING') {
      ok('Turing state (u,v) matches Python',
         close(tp.state.u, PY.turingU, 1e-8) && close(tp.state.v, PY.turingV, 1e-8));
      ok('q* = ' + PY.turingQ, close(tp.qStar, PY.turingQ, 1e-3));
      ok('sigma_max = ' + PY.turingSigma.toExponential(3),
         close(tp.sigmaMax, PY.turingSigma, 1e-9));
      ok('predicted lambda = ' + PY.turingLambdaCells + ' cells',
         close(T.lambdaCells(tp.qStar, 256), PY.turingLambdaCells, 1e-3));
    }

    /* 7. FFT wavelength measurement, calibrated on known stripes. */
    var n = 256, f = new Float64Array(n * n), x, y;
    [16, 12.8, 21.3333].forEach(function (lam) {
      for (y = 0; y < n; y++) {
        for (x = 0; x < n; x++) {
          f[y * n + x] = Math.sin(2 * Math.PI * x / lam) + Math.sin(2 * Math.PI * y / lam);
        }
      }
      var m = FFT.radialPeak(f, n);
      ok('FFT: stripes lambda=' + lam + ' measured ' + m.lambda.toFixed(3),
         close(m.lambda, lam, lam * 0.001));
    });

    /* 8. FFT on white noise must NOT be confident. LCG noise. */
    var s = 987654321 >>> 0;
    for (var i = 0; i < n * n; i++) {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      f[i] = s / 4294967296 - 0.5;
    }
    var noise = FFT.radialPeak(f, n);
    ok('FFT: white noise confidence ' + noise.confidence.toFixed(2) + ' < 3 floor',
       noise.confidence < 3);

    /* 9. The integrator: uniform states are fixed points of the discrete map
     * too (Laplacian of a constant is zero), including the non-trivial one. */
    var g = new GS(64);
    g.F = PY.turingF; g.k = PY.turingK;
    var st = T.turing(PY.turingF, PY.turingK).state;
    for (i = 0; i < 64 * 64; i++) { g.u[i] = st.u; g.v[i] = st.v; }
    g.step(50);
    var drift = 0;
    for (i = 0; i < 64 * 64; i++) {
      drift = Math.max(drift, Math.abs(g.u[i] - st.u), Math.abs(g.v[i] - st.v));
    }
    ok('integrator holds the uniform steady state (50 steps, drift < 1e-12)',
       drift < 1e-12, drift.toExponential(2));

    var passed = checks.filter(function (c) { return c.pass; }).length;
    return { checks: checks, passed: passed, total: checks.length,
             ok: passed === checks.length };
  }

  root.HFGSSelfTest = { run: run };
  if (isNode) {
    var r = run();
    r.checks.forEach(function (c) {
      console.log((c.pass ? '  ok   ' : ' FAIL  ') + c.name +
                  (c.detail ? '   [' + c.detail + ']' : ''));
    });
    console.log(r.passed + '/' + r.total + (r.ok ? ' -- all good' : ' -- FAILURES'));
    process.exit(r.ok ? 0 : 1);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
