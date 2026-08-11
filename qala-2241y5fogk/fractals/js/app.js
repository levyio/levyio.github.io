/* Wiring. Nothing computed here -- this file only draws and reports what
 * gasket.js measured and audio.js rendered.
 *
 * House rule for the display: measured numbers are amber, stated ones blue,
 * predictions grey and to the right of what they predicted. If a number has no
 * prediction next to it, it is because none exists, not because it was skipped.
 */
(function () {
  'use strict';

  var G = window.HFGasket, A = window.HFAudio, T = window.HFSelfTest;

  var $ = function (id) { return document.getElementById(id); };
  var levels = {};           // m -> { n, nVerts, values, vectors, graph, ... }
  var cur = null;            // current level solution
  var selMode = 0;           // eigenmode on display
  var strikeSite = null;     // interior index last struck
  var lastStrike = null;     // amplitudes from that strike

  function stated() {
    return {
      f0: +$('f0').value || 110,
      tau0: +$('tau0').value || 2.5,
      p: +$('pexp').value,
      modes: +$('nmodes').value
    };
  }

  /* Fault injection, kept in the shipped page on purpose.
   *
   * A self-test nobody has ever seen fail is a green light with no bulb behind
   * it. Load index.html?fault=<name> to break something deliberately and watch
   * the panel go red. Each of these was used to find a real hole: `detune`
   * originally PASSED, because the audio check was probing the same frequency
   * list it had handed the renderer. It now derives its probes from the
   * eigenvalues instead.
   *
   *   ?fault=detune    every partial shifted 3.1% -- ratios silently wrong
   *   ?fault=harmonic  a plain harmonic series instead of the gasket's spectrum
   *   ?fault=silent    renderer outputs nothing
   *   ?fault=spectrum  one eigenvalue nudged by 0.017
   *   ?fault=golden    disagree with numpy
   */
  var FAULT = new URLSearchParams(location.search).get('fault');

  function injectFault(name) {
    var A0 = window.HFAudio;
    if (name === 'detune' || name === 'harmonic') {
      var real = A0.strikeModes;
      A0.strikeModes = function (sol, site, o) {
        var s = real(sol, site, o);
        s.modes = s.modes.map(function (m, i) {
          return { k: m.k, lambda: m.lambda, amp: m.amp, tau: m.tau,
                   f: name === 'detune' ? m.f * 1.031 : 110 * (i + 1) };
        });
        return s;
      };
    } else if (name === 'silent') {
      var realR = A0.renderSamples;
      A0.renderSamples = function (sel, sec, sr) {
        var x = realR(sel, sec, sr); x.samples.fill(0); return x;
      };
    } else if (name === 'golden') {
      window.HFSelfTest.GOLDEN_L5.lambdaMin = 0.0035;
    }
    // 'spectrum' is applied after solving, in solveUpTo
  }

  // ── compute ──────────────────────────────────────────────────────────
  function solveUpTo(top) {
    for (var m = 1; m <= top; m++) {
      if (levels[m]) continue;
      var t0 = performance.now();
      var g = G.build(m);
      var s = G.solve(g);
      s.graph = g;
      s.level = m;
      s.nVerts = g.verts.length;
      s.ms = performance.now() - t0;
      if (FAULT === 'spectrum' && m === 5) s.values[10] += 0.017;
      levels[m] = s;
    }
    return levels[top];
  }

  // ── draw ─────────────────────────────────────────────────────────────
  function draw() {
    var cv = $('drum'), ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    if (!cur) return;

    var g = cur.graph, pad = 46;
    var sc = Math.min((W - 2 * pad), (H - 2 * pad) / (Math.sqrt(3) / 2));
    var ox = (W - sc) / 2, oy = H - pad;
    var X = function (p) { return ox + p[0] * sc; };
    var Y = function (p) { return oy - p[1] * sc; };

    // edges
    ctx.strokeStyle = 'rgba(120,140,170,0.17)';
    ctx.lineWidth = cur.level >= 6 ? 0.4 : 0.7;
    ctx.beginPath();
    for (var e = 0; e < g.edges.length; e++) {
      var a = g.verts[g.edges[e][0]], b = g.verts[g.edges[e][1]];
      ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b));
    }
    ctx.stroke();

    // eigenmode amplitudes at interior vertices
    var n = cur.n, V = cur.vectors, k = selMode;
    var peak = 0;
    for (var i = 0; i < n; i++) peak = Math.max(peak, Math.abs(V[k * n + i]));
    if (peak === 0) peak = 1;

    var r = cur.level >= 6 ? 2.1 : (cur.level >= 5 ? 3.4 : 5.6);
    for (i = 0; i < n; i++) {
      var u = V[k * n + i] / peak;
      var p = g.verts[cur.interior[i]];
      var mag = Math.abs(u);
      var rad = r * (0.42 + 0.95 * Math.sqrt(mag));
      ctx.fillStyle = u >= 0
        ? 'rgba(255,122,89,' + (0.13 + 0.87 * mag) + ')'
        : 'rgba(74,168,255,' + (0.13 + 0.87 * mag) + ')';
      ctx.beginPath();
      ctx.arc(X(p), Y(p), rad, 0, 6.2832);
      ctx.fill();
    }

    // clamped corners -- shown, but explicitly not part of the problem
    ctx.strokeStyle = 'rgba(150,165,190,0.55)';
    ctx.lineWidth = 1.2;
    for (var c = 0; c < g.corners.length; c++) {
      var q = g.verts[g.corners[c]];
      ctx.beginPath(); ctx.arc(X(q), Y(q), 4.5, 0, 6.2832); ctx.stroke();
    }

    // strike marker
    if (strikeSite !== null) {
      var sp = g.verts[cur.interior[strikeSite]];
      ctx.strokeStyle = 'rgba(255,180,84,0.9)';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(X(sp), Y(sp), 11, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(X(sp), Y(sp), 17, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ── report ───────────────────────────────────────────────────────────
  function fmt(x, d) { return x.toFixed(d === undefined ? 6 : d); }

  function reportLevel() {
    var m = cur.level, P = G.predict;
    $('mLevel').textContent = m;
    $('mVerts').textContent = cur.nVerts;   $('pVerts').textContent = P.verts(m);
    $('mInt').textContent = cur.n;          $('pInt').textContent = P.interior(m);
    $('mLmin').textContent = fmt(cur.values[0], 9);
    $('mLmax').textContent = fmt(cur.values[cur.n - 1], 9);
    $('mTime').textContent = cur.ms.toFixed(0) + ' ms';

    var c = cur.classification;
    if (c) {
      var n5 = c.born.filter(function (x) { return Math.abs(x - 5) < 1e-6; }).length;
      var n6 = c.born.filter(function (x) { return Math.abs(x - 6) < 1e-6; }).length;
      $('mDesc').textContent = c.matched;  $('pDesc').textContent = 2 * P.interior(m - 1) - P.mult6(m - 1);
      $('mBorn').textContent = c.born.length; $('pBorn').textContent = P.born(m);
      $('mB5').textContent = n5;           $('pB5').textContent = P.mult5(m);
      $('mB6').textContent = n6;           $('pB6').textContent = P.mult6(m);
      $('mBoff').textContent = c.offExceptional.length;
      $('mResid').textContent = c.residual.toExponential(2);
    }

    // convergence of the overtone ratios across levels
    var rows = ['<tr><td>mode</td>' +
      [m - 2, m - 1, m].filter(function (x) { return x >= 1; })
        .map(function (x) { return '<td class="pred">m=' + x + '</td>'; }).join('') +
      '<td class="pred">&Delta; last</td></tr>'];
    var ls = [m - 2, m - 1, m].filter(function (x) { return x >= 1 && levels[x]; });
    for (var k = 1; k < Math.min(6, cur.n); k++) {
      var vals = ls.map(function (x) {
        var v = levels[x].values;
        return k < v.length ? Math.sqrt(v[k] / v[0]) : NaN;
      });
      var d = vals.length > 1 ? Math.abs(vals[vals.length - 1] - vals[vals.length - 2]) : NaN;
      rows.push('<tr><td>' + (k + 1) + '</td>' +
        vals.map(function (v) { return '<td>' + (isNaN(v) ? '&mdash;' : fmt(v, 6)) + '</td>'; }).join('') +
        '<td class="pred">' + (isNaN(d) ? '&mdash;' : d.toExponential(1)) + '</td></tr>');
    }
    $('convTable').innerHTML = rows.join('');

    $('mRenorm').textContent = levels[m - 1]
      ? fmt(levels[m - 1].values[0] / cur.values[0], 9) : '—';
  }

  function reportSpectrum() {
    var s = stated(), lam = cur.values, lam1 = lam[0], n = cur.n;
    var c = cur.classification;
    var rows = [], limit = Math.min(n, 240);
    for (var k = 0; k < limit; k++) {
      var f = s.f0 * Math.sqrt(lam[k] / lam1);
      var u = strikeSite !== null ? cur.vectors[k * n + strikeSite] : null;
      var org = c && c.origin[k] !== undefined
        ? '<td class="desc">descended</td>'
        : (c ? '<td class="born">born</td>' : '<td class="desc">&mdash;</td>');
      rows.push('<tr data-k="' + k + '"' + (k === selMode ? ' class="sel"' : '') + '>' +
        '<td class="k">' + (k + 1) + '</td>' +
        '<td>' + fmt(lam[k], 6) + '</td>' +
        '<td>' + f.toFixed(1) + '</td>' +
        '<td>' + fmt(Math.sqrt(lam[k] / lam1), 4) + '</td>' + org +
        '<td>' + (u === null ? '&mdash;' : (u * u).toExponential(1)) + '</td></tr>');
    }
    if (n > limit) {
      rows.push('<tr><td colspan="6" class="k">… ' + (n - limit) +
                ' further modes not listed (all are rendered if selected)</td></tr>');
    }
    var tb = $('spectrum').querySelector('tbody');
    tb.innerHTML = rows.join('');
    tb.onclick = function (ev) {
      var tr = ev.target.closest('tr[data-k]');
      if (!tr) return;
      selMode = +tr.dataset.k;
      draw(); reportSpectrum();
      var st = stated();
      A.playSingle(st.f0 * Math.sqrt(cur.values[selMode] / cur.values[0]), 2.0, st.tau0 * 0.7);
    };
  }

  function reportStrike(sel) {
    $('sSite').textContent = strikeSite === null ? '—' : ('#' + strikeSite);
    $('sRendered').textContent = sel.rendered;
    $('sTotal').textContent = sel.total;
    $('sEnergy').textContent = (100 * sel.energy).toFixed(2) + ' %';
    $('sRange').textContent = sel.fMin.toFixed(1) + ' – ' + sel.fMax.toFixed(0) + ' Hz';
    $('sAliased').textContent = sel.aliased;
  }

  function reportSelfTest(res) {
    var v = $('verdict');
    v.className = 'card verdict ' + (res.ok ? 'pass' : 'fail');
    $('verdictMark').textContent = res.ok ? '✓' : '✗';
    $('verdictLine').textContent = res.ok
      ? 'self-test passed — ' + res.passed + '/' + res.total
      : 'SELF-TEST FAILED — ' + (res.total - res.passed) + ' of ' + res.total +
        ' checks did not hold. The numbers below cannot be trusted.';
    $('testList').innerHTML = res.tests.map(function (t) {
      return '<li class="' + (t.pass ? 'pass' : 'fail') + '">' + t.name +
             (t.detail ? '<span class="detail">' + t.detail + '</span>' : '') + '</li>';
    }).join('');
  }

  // ── interaction ──────────────────────────────────────────────────────
  function strike(site) {
    strikeSite = site;
    var sel = A.strikeModes(cur, site, stated());
    lastStrike = sel;
    var longest = 0;
    for (var i = 0; i < sel.modes.length; i++) longest = Math.max(longest, sel.modes[i].tau);
    A.play(A.render(sel, Math.min(6, longest * 1.6 + 0.3)).buffer);
    reportStrike(sel); reportSpectrum(); draw();
  }

  function nearestInterior(mx, my) {
    var cv = $('drum'), g = cur.graph, pad = 46;
    var W = cv.width, H = cv.height;
    var sc = Math.min((W - 2 * pad), (H - 2 * pad) / (Math.sqrt(3) / 2));
    var ox = (W - sc) / 2, oy = H - pad;
    var best = 0, bd = Infinity;
    for (var i = 0; i < cur.n; i++) {
      var p = g.verts[cur.interior[i]];
      var dx = ox + p[0] * sc - mx, dy = oy - p[1] * sc - my;
      var d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function rebuild(showBusy) {
    var m = +$('level').value;
    if (showBusy) $('verdictLine').textContent = 'solving level ' + m + '…';
    cur = solveUpTo(m);
    selMode = 0;
    strikeSite = null;
    $('nmodes').max = cur.n;
    if (+$('nmodes').value > cur.n) { $('nmodes').value = cur.n; $('nmodesOut').textContent = cur.n; }
    reportSelfTest(T.run(levels));
    reportLevel(); reportSpectrum(); draw();
  }

  // ── boot ─────────────────────────────────────────────────────────────
  function boot() {
    if (FAULT) {
      injectFault(FAULT);
      var b = document.createElement('div');
      b.className = 'faultbar';
      b.innerHTML = 'FAULT INJECTED — <code>?fault=' + FAULT + '</code> — ' +
        'this page is deliberately broken so you can see the self-test fail. ' +
        '<a href="' + location.pathname + '">load it clean</a>';
      document.body.insertBefore(b, document.body.firstChild);
    }

    $('drum').addEventListener('click', function (ev) {
      var cv = $('drum'), r = cv.getBoundingClientRect();
      var mx = (ev.clientX - r.left) * cv.width / r.width;
      var my = (ev.clientY - r.top) * cv.height / r.height;
      $('hint').classList.add('gone');
      strike(nearestInterior(mx, my));
    });

    $('strikeRandom').onclick = function () {
      $('hint').classList.add('gone');
      strike(Math.floor(Math.random() * cur.n));
    };

    $('stopAll').onclick = function () { A.stop(); };

    $('sweep').onclick = function () {
      var st = stated(), i = 0;
      A.context();
      (function next() {
        if (i >= Math.min(12, cur.n)) return;
        selMode = i;
        draw(); reportSpectrum();
        A.playSingle(st.f0 * Math.sqrt(cur.values[i] / cur.values[0]), 0.75, 0.5);
        i++;
        setTimeout(next, 620);
      })();
    };

    $('level').onchange = function () {
      var m = +$('level').value;
      if (m >= 6 && !levels[6] &&
          !confirm('Level 6 diagonalises a 1092×1092 matrix in the browser.\n' +
                   'That takes a few seconds and the page will freeze while it runs.\n\nGo ahead?')) {
        $('level').value = cur ? cur.level : 5;
        return;
      }
      setTimeout(function () { rebuild(true); }, 10);
    };

    $('nmodes').oninput = function () { $('nmodesOut').textContent = this.value; };
    $('nmodes').onchange = function () { if (strikeSite !== null) strike(strikeSite); };
    ['f0', 'tau0', 'pexp'].forEach(function (id) {
      $(id).onchange = function () { reportSpectrum(); if (strikeSite !== null) strike(strikeSite); };
    });

    rebuild(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
