/* The instrument checking itself, out loud, every time it loads.
 *
 * A tool that cannot report failure is decoration. These assertions run before
 * anything is drawn or played, and a red panel is a valid outcome.
 *
 * GOLDEN values come from docs/verify_gasket.py -- numpy, LAPACK, a completely
 * separate implementation. If the browser and numpy ever disagree, one of them
 * is wrong and the page says so rather than playing the wrong overtones.
 */
(function (root) {
  'use strict';

  var GOLDEN_L5 = {
    n: 363,
    lambdaMin: 0.003586769658,
    lambdaMax: 6.0,
    trace: 1452,
    first8: [0.003586769658, 0.011915204195, 0.011915204195, 0.036703533457,
             0.036703533457, 0.051104823036, 0.059434048886, 0.059434048886]
  };

  function run(levels) {
    var G = root.HFGasket, P = G.predict, tests = [];
    function check(name, pass, detail) { tests.push({ name: name, pass: !!pass, detail: detail }); }

    // 1. Level 1 has a closed form: the three midpoints form a triangle, so
    //    M = 5I - J and the spectrum is exactly {2, 5, 5}. No numerics needed.
    var s1 = levels[1];
    if (s1) {
      var v = s1.values, want = [2, 5, 5], dev = 0;
      for (var i = 0; i < 3; i++) dev = Math.max(dev, Math.abs(v[i] - want[i]));
      check('level 1 spectrum = {2, 5, 5} (closed form, by hand)',
            v.length === 3 && dev < 1e-12, 'max deviation ' + dev.toExponential(2));
    }

    // 2. Counting: vertices (3^(m+1)+3)/2, interior three fewer.
    var countOK = true, countDetail = [];
    Object.keys(levels).forEach(function (m) {
      m = +m;
      var s = levels[m], ok = (s.n === P.interior(m) && s.nVerts === P.verts(m));
      countOK = countOK && ok;
      countDetail.push('L' + m + ':' + s.nVerts + '/' + s.n);
    });
    check('vertex counts = (3^(m+1)+3)/2, interior = that minus 3',
          countOK, countDetail.join('  '));

    // 3. trace(M) = 4n, because every interior vertex has degree exactly 4.
    //    Cheap, and it catches a mis-assembled operator instantly.
    var traceOK = true, traceDetail = [];
    Object.keys(levels).forEach(function (m) {
      var s = levels[+m], tr = 0;
      for (var i = 0; i < s.values.length; i++) tr += s.values[i];
      var ok = Math.abs(tr - 4 * s.n) < 1e-6 * s.n;
      traceOK = traceOK && ok;
      traceDetail.push('L' + m + ' ' + tr.toFixed(3) + '/' + (4 * s.n));
    });
    check('trace(M) = 4n  (every interior vertex has degree 4)',
          traceOK, traceDetail.join('  '));

    // 4. Eigenvectors orthonormal -- otherwise the strike amplitudes are junk.
    var top = Math.max.apply(null, Object.keys(levels).map(Number));
    var s = levels[top], n = s.n, V = s.vectors;
    var worstDot = 0, worstNorm = 0;
    for (var a = 0; a < Math.min(n, 12); a++) {
      var nn = 0;
      for (i = 0; i < n; i++) nn += V[a * n + i] * V[a * n + i];
      worstNorm = Math.max(worstNorm, Math.abs(nn - 1));
      for (var b = a + 1; b < Math.min(n, 12); b++) {
        var d = 0;
        for (i = 0; i < n; i++) d += V[a * n + i] * V[b * n + i];
        worstDot = Math.max(worstDot, Math.abs(d));
      }
    }
    check('eigenvectors orthonormal (first 12 at level ' + top + ')',
          worstNorm < 1e-9 && worstDot < 1e-9,
          'max |u·v| ' + worstDot.toExponential(2) +
          ',  max abs(‖u‖−1) ' + worstNorm.toExponential(2));

    // 5. The decimation itself, level by level: every eigenvalue must either
    //    descend through lambda(5-lambda) or be born at 5 or 6.
    var decOK = true, decDetail = [], worstResid = 0;
    Object.keys(levels).map(Number).sort(function (x, y) { return x - y; }).forEach(function (m) {
      if (!levels[m - 1]) return;
      var c = G.classify(Array.from(levels[m].values), Array.from(levels[m - 1].values));
      var n5 = c.born.filter(function (x) { return Math.abs(x - 5) < 1e-6; }).length;
      var n6 = c.born.filter(function (x) { return Math.abs(x - 6) < 1e-6; }).length;
      var ok = c.ok
            && c.matched === 2 * P.interior(m - 1) - P.mult6(m - 1)
            && c.born.length === P.born(m)
            && n5 === P.mult5(m) && n6 === P.mult6(m)
            && c.residual < 1e-6;
      decOK = decOK && ok;
      worstResid = Math.max(worstResid, c.residual);
      decDetail.push('L' + m + ' ' + c.matched + '+' + c.born.length + (ok ? '' : ' FAIL'));
      levels[m].classification = c;
    });
    check('decimation λₘ₋₁ = λₘ(5−λₘ): all modes descend or are born at {5, 6}',
          decOK, decDetail.join('  ') + '   max residual ' + worstResid.toExponential(2));

    // 6. Against numpy. Different language, different eigensolver, same answer.
    if (levels[5]) {
      var g = GOLDEN_L5, v5 = levels[5].values, tr5 = 0;
      for (i = 0; i < v5.length; i++) tr5 += v5[i];
      var w = 0;
      for (i = 0; i < 8; i++) w = Math.max(w, Math.abs(v5[i] - g.first8[i]));
      var sub = [
        ['n', levels[5].n === g.n, levels[5].n + ' vs ' + g.n],
        ['λ₁', Math.abs(v5[0] - g.lambdaMin) < 1e-10, v5[0].toFixed(12)],
        ['λ_max', Math.abs(v5[v5.length - 1] - g.lambdaMax) < 1e-9, v5[v5.length - 1].toFixed(9)],
        ['trace', Math.abs(tr5 - g.trace) < 1e-6, tr5.toFixed(3) + ' vs ' + g.trace],
        ['first 8', w < 1e-10, 'max deviation ' + w.toExponential(2)]
      ];
      var bad = sub.filter(function (x) { return !x[1]; });
      check('level 5 matches numpy/LAPACK (docs/verify_gasket.py)',
            bad.length === 0,
            bad.length === 0
              ? 'n, λ₁, λ_max, trace and the first eight all agree; max deviation ' + w.toExponential(2)
              : 'disagrees on ' + bad.map(function (x) { return x[0] + ' (' + x[2] + ')'; }).join(', '));
    }

    // 7. The audio itself. Rendering a buffer proves nothing -- measure it back
    //    and confirm the energy sits on the eigenfrequencies. A synthesiser
    //    that is merely non-silent is not evidence of anything.
    if (root.HFAudio && levels[3]) {
      var sol = levels[Math.min(4, top)];
      var site = Math.min(40, sol.n - 1);
      var sel = root.HFAudio.strikeModes(sol, site, { f0: 110, tau0: 2.5, p: 1, modes: 24 });
      var sig = root.HFAudio.renderSamples(sel, 1.0, 48000);
      var worstRatio = Infinity, silent = true, probed = 0;
      for (i = 0; i < sig.samples.length; i++) if (sig.samples[i] !== 0) { silent = false; break; }

      // The probe frequencies are derived HERE, from the eigenvalues, and not
      // read off the mode list that was handed to the renderer. Deriving them
      // from that list would only prove the renderer renders what it is told:
      // a uniform detuning would sail through. Fault-injected and confirmed.
      for (var q = 0; q < Math.min(5, sel.modes.length); q++) {
        var kk = sel.modes[q].k;
        if (Math.abs(sol.values[kk]) < 1e-12) continue;
        var fExpected = 110 * Math.sqrt(sol.values[kk] / sol.values[0]);
        var on = root.HFAudio.powerAt(sig.samples, 48000, fExpected);
        var off = root.HFAudio.powerAt(sig.samples, 48000, fExpected * 1.031);
        if (off > 0) { worstRatio = Math.min(worstRatio, on / off); probed++; }
      }
      check('rendered audio peaks where the eigenvalues say it should',
            !silent && probed > 0 && worstRatio > 4,
            'weakest on/off-peak ratio over ' + probed +
            ' modes, probed at f₀√(λₖ/λ₁): ' +
            (isFinite(worstRatio) ? worstRatio.toFixed(1) + '×' : 'n/a'));
    }

    var passed = tests.filter(function (t) { return t.pass; }).length;
    return { tests: tests, passed: passed, total: tests.length, ok: passed === tests.length };
  }

  root.HFSelfTest = { run: run, GOLDEN_L5: GOLDEN_L5 };
})(typeof globalThis !== 'undefined' ? globalThis : this);
