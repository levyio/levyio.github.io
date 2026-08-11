/* roughness.html wiring: self-test, drawing, readouts. Computes nothing —
 * every number on screen comes from js/roughness.js, and the golden values
 * come from docs/verify_roughness.py (numpy).
 */
(function () {
  'use strict';

  var R = window.HFRough;
  var $ = function (id) { return document.getElementById(id); };

  /* Golden values from docs/verify_roughness.py — numpy, same pipeline.
   * Counts are asserted EXACTLY: measured agreement on this machine was
   * cell-for-cell, so tolerance would only hide a real divergence. */
  var GOLDEN = {
    line:    { counts: [31, 63, 127, 255, 511, 1023, 2047],        D: 1.006658 },
    sine:    { counts: [46, 94, 190, 382, 766, 1534, 3070],        D: 1.008918 },
    w0720:   { counts: [78, 209, 578, 1554, 4221, 11498, 31424],   D: 1.442659 },
    takagi:  { counts: [52, 116, 244, 528, 1096, 2332, 4804],      D: 1.086242 },
    riemann: { counts: [71, 172, 388, 908, 2080, 4889, 11313],     D: 1.215300 }
  };

  var FAULT = new URLSearchParams(location.search).get('fault');

  // ── fault injection (shipped, same reasoning as the drum) ───────────
  if (FAULT === 'counts') {
    var realBox = R.boxCounts;
    R.boxCounts = function (y, keep) {
      var r = realBox(y, keep);
      r.counts = r.counts.map(function (c) { return Math.round(c * 0.97); });
      return r;
    };
  } else if (FAULT === 'golden') {
    GOLDEN.takagi.counts[3] = 999;
  }
  // 'prediction' is applied in predict() below

  function predict(fn, a, b) {
    var base;
    if (fn === 'weier') base = R.predictWeierstrass(a, b);
    else if (fn === 'riemann') base = 1.25;
    else base = 1.0;
    return FAULT === 'prediction' ? base + 0.15 : base;
  }

  var PRED_HOW = {
    weier:   'max(1, 2 + ln a/ln b)',
    riemann: 'literature 5/4 — cited, not derived',
    takagi:  'theorem: exactly 1',
    sine:    'exact: smooth',
    line:    'exact: 2g−1 boxes, closed form'
  };

  var DEFS = {
    weier:   'Σ aᵏ cos(bᵏπx), 24 terms',
    takagi:  'Σ 2⁻ⁿ·dist(2ⁿx, ℤ), 22 terms',
    riemann: 'Σ sin(n²πx)/n², 599 terms',
    sine:    'sin 2πx',
    line:    'y = x'
  };

  // ── self-test ───────────────────────────────────────────────────────
  var lineBiasMeasured = null;

  function selfTest() {
    var tests = [];
    function check(name, pass, detail) { tests.push({ name: name, pass: !!pass, detail: detail }); }

    // 1. closed form first: a diagonal crosses exactly 2g−1 cells of a g×g
    //    grid. No numerics, no golden file — arithmetic.
    var line = R.boxCounts(R.fLine());
    var closedOK = R.BOXES.every(function (g, i) { return line.counts[i] === 2 * g - 1; });
    check('line: counts equal 2g−1 exactly (closed form, by hand)',
          closedOK, line.counts.join(', '));
    lineBiasMeasured = R.fitD(line.counts);

    // 2–5. exact agreement with numpy, counts cell-for-cell
    var cases = [
      ['line',   line.counts],
      ['sine',   R.boxCounts(R.fSine()).counts],
      ['w0720',  R.boxCounts(R.fWeierstrass(0.7, 2.0)).counts],
      ['takagi', R.boxCounts(R.fTakagi()).counts]
      // riemann is seconds of compute; checked lazily on first selection
    ];
    cases.forEach(function (c) {
      var name = c[0], counts = c[1], g = GOLDEN[name];
      var same = counts.length === g.counts.length &&
                 counts.every(function (v, i) { return v === g.counts[i]; });
      var D = R.fitD(counts);
      check(name + ': all 7 box counts match numpy exactly',
            same && Math.abs(D - g.D) < 1e-3,
            same ? 'D = ' + D.toFixed(6) + ' vs ' + g.D.toFixed(6)
                 : 'counts diverge: [' + counts + '] vs [' + g.counts + ']');
    });

    // 6. the prediction formula itself reproduces theory. If someone edits
    //    the formula (or ?fault=prediction does), this is what catches it.
    var pw = predict('weier', 0.7, 2.0);
    check('predicted D(0.7, 2.0) = 2 + ln 0.7/ln 2 = 1.485427',
          Math.abs(pw - 1.4854268271702415) < 1e-12, 'formula gives ' + pw.toFixed(6));

    // 7. the counter-example behaves as documented: Takagi's fitted D is
    //    biased high, but its local slope falls across the octaves while
    //    Weierstrass holds. Numbers from verify_roughness.py.
    var st = R.localSlopes(GOLDEN.takagi.counts);
    var sw = R.localSlopes(GOLDEN.w0720.counts);
    var takagiFalls = (st[st.length - 1] - st[0]) < -0.05;
    var weierHolds = Math.abs(sw[sw.length - 1] - sw[0]) < 0.05;
    check('Takagi\'s local slope decays (drift < −0.05); Weierstrass holds (|drift| < 0.05)',
          takagiFalls && weierHolds,
          'Takagi ' + (st[st.length - 1] - st[0]).toFixed(3) +
          ', Weierstrass ' + (sw[sw.length - 1] - sw[0]).toFixed(3));

    var passed = tests.filter(function (t) { return t.pass; }).length;
    return { tests: tests, passed: passed, total: tests.length, ok: passed === tests.length };
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

  // ── measurement of the current selection ────────────────────────────
  var cur = null;   // { fn, a, b, y, counts, grid, D, pred, ms }

  function compute() {
    var fn = $('fn').value;
    var a = +$('a').value, b = +$('b').value;
    var keep = +$('showg').value || 0;

    var t0 = performance.now();
    var y;
    if (fn === 'weier') y = R.fWeierstrass(a, b);
    else if (fn === 'takagi') y = R.fTakagi();
    else if (fn === 'riemann') y = R.fRiemann();
    else if (fn === 'sine') y = R.fSine();
    else y = R.fLine();

    var bc = R.boxCounts(y, keep);
    var ms = performance.now() - t0;

    cur = {
      fn: fn, a: a, b: b, y: y,
      counts: bc.counts, grid: bc.grid, gridSize: bc.gridSize,
      D: R.fitD(bc.counts), pred: predict(fn, a, b), ms: ms
    };

    // lazy golden check for Riemann, appended to the verdict on first compute
    if (fn === 'riemann' && !compute.riemannChecked) {
      compute.riemannChecked = true;
      var g = GOLDEN.riemann;
      var same = cur.counts.every(function (v, i) { return v === g.counts[i]; });
      var res = lastSelfTest;
      res.tests.push({
        name: 'riemann: all 7 box counts match numpy exactly (checked on first use)',
        pass: same, detail: same ? 'D = ' + cur.D.toFixed(6) + ' vs ' + g.D.toFixed(6)
                                 : 'counts diverge: [' + cur.counts + '] vs [' + g.counts + ']'
      });
      res.total++; if (same) res.passed++;
      res.ok = res.passed === res.total;
      reportSelfTest(res);
    }
  }

  // ── drawing ─────────────────────────────────────────────────────────
  function drawGraph() {
    var cv = $('graph'), ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height, pad = 10;
    ctx.clearRect(0, 0, W, H);

    var y = cur.y, n = R.NX;
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < n; i++) { if (y[i] < lo) lo = y[i]; if (y[i] > hi) hi = y[i]; }
    var span = hi - lo + 1e-15;
    var X = function (i) { return pad + (i / (n - 1)) * (W - 2 * pad); };
    var Y = function (v) { return H - pad - ((v - lo) / span) * (H - 2 * pad); };

    // occupied boxes underneath, if requested — the count, made visible
    if (cur.grid) {
      var g = cur.gridSize, cw = (W - 2 * pad) / g, ch = (H - 2 * pad) / g;
      ctx.fillStyle = 'rgba(255,180,84,0.13)';
      ctx.strokeStyle = 'rgba(255,180,84,0.25)';
      ctx.lineWidth = 0.5;
      for (var gi = 0; gi < g; gi++) {
        for (var gj = 0; gj < g; gj++) {
          if (cur.grid[gi * g + gj]) {
            var bx = pad + gi * cw, by = H - pad - (gj + 1) * ch;
            ctx.fillRect(bx, by, cw, ch);
            ctx.strokeRect(bx, by, cw, ch);
          }
        }
      }
    }

    ctx.strokeStyle = '#d7dee8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    var step = Math.max(1, Math.floor(n / (2 * W)));   // draw decimation only; the measurement used every point
    ctx.moveTo(X(0), Y(y[0]));
    for (i = step; i < n; i += step) ctx.lineTo(X(i), Y(y[i]));
    ctx.stroke();
  }

  function drawLogLog() {
    var cv = $('loglog'), ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height, padL = 56, padB = 34, padT = 14, padR = 16;
    ctx.clearRect(0, 0, W, H);

    var lg = R.BOXES.map(function (g) { return Math.log2(g); });
    var ln = cur.counts.map(function (c) { return Math.log2(Math.max(1, c)); });
    var x0 = lg[0], x1 = lg[lg.length - 1];
    var y0 = 0, y1 = Math.max.apply(null, ln) * 1.06;

    var X = function (v) { return padL + (v - x0) / (x1 - x0) * (W - padL - padR); };
    var Y = function (v) { return H - padB - (v - y0) / (y1 - y0) * (H - padB - padT); };

    // axes
    ctx.strokeStyle = '#202836'; ctx.fillStyle = '#7d8899';
    ctx.font = '11px ui-monospace, monospace';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();
    lg.forEach(function (v, i) {
      ctx.fillText(R.BOXES[i], X(v) - 10, H - padB + 16);
    });
    ctx.fillText('log₂ N(g)', padL - 48, padT + 10);
    ctx.fillText('g', W - padR - 10, H - padB + 16);

    // predicted slope, dashed, anchored at the first measured point
    ctx.strokeStyle = '#6fb3ff'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(X(lg[0]), Y(ln[0]));
    ctx.lineTo(X(lg[lg.length - 1]), Y(ln[0] + cur.pred * (x1 - x0)));
    ctx.stroke(); ctx.setLineDash([]);

    // least-squares fit
    var mx = 0, my = 0, k = lg.length;
    for (var i = 0; i < k; i++) { mx += lg[i]; my += ln[i]; }
    mx /= k; my /= k;
    ctx.strokeStyle = '#ffb454'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    // slope is base-independent, so the ln-space fit passes through the
    // log2-space means with the same D
    ctx.moveTo(X(x0), Y(my + cur.D * (x0 - mx)));
    ctx.lineTo(X(x1), Y(my + cur.D * (x1 - mx)));
    ctx.stroke();

    // the measured points on top
    ctx.fillStyle = '#ffb454';
    for (i = 0; i < k; i++) {
      ctx.beginPath(); ctx.arc(X(lg[i]), Y(ln[i]), 3.4, 0, 6.2832); ctx.fill();
    }

    ctx.fillStyle = '#ffb454';
    ctx.fillText('measured slope ' + cur.D.toFixed(4), W - padR - 190, padT + 12);
    ctx.fillStyle = '#6fb3ff';
    ctx.fillText('predicted ' + cur.pred.toFixed(4), W - padR - 190, padT + 28);
  }

  // ── readouts ────────────────────────────────────────────────────────
  function report() {
    var fn = cur.fn;
    $('fDef').textContent = fn === 'weier'
      ? 'Σ aᵏ cos(bᵏπx),  a=' + cur.a.toFixed(2) + '  b=' + cur.b.toFixed(1) +
        '  (ab = ' + (cur.a * cur.b).toFixed(2) + (cur.a * cur.b <= 1 ? ' ≤ 1: differentiable' : '') + ')'
      : DEFS[fn];
    $('fPred').textContent = cur.pred.toFixed(4);
    $('fPredHow').textContent = PRED_HOW[fn];
    $('fMeas').textContent = cur.D.toFixed(4);
    var d = cur.D - cur.pred;
    $('fDelta').textContent = (d >= 0 ? '+' : '') + d.toFixed(4);
    $('fTime').textContent = cur.ms.toFixed(0) + ' ms';

    var validated = (fn !== 'weier') || (cur.a === 0.7 && cur.b === 2.0);
    $('fDeltaNote').textContent = validated ? 'numpy-validated point' : 'validated method, unvalidated a,b';

    var verdict;
    if (fn === 'takagi') {
      verdict = 'Rough, nowhere differentiable — and the theorem says D = 1 ' +
        'exactly. The measured ' + cur.D.toFixed(3) + ' is finite-resolution ' +
        'bias (compare the smooth-line bias below), and the local slopes are ' +
        'falling. This is NOT a fractal. That is the whole point of this page.';
    } else if (fn === 'line' || fn === 'sine') {
      verdict = 'A smooth control. The gap between measured and 1.000 is the ' +
        'measurement\'s own bias, quantified — it applies to every other number here.';
    } else if (fn === 'weier' && cur.a * cur.b <= 1) {
      verdict = 'ab ≤ 1: the series converges to a differentiable function. ' +
        'Prediction drops to D = 1 — slide back across ab = 1 and watch it detach.';
    } else {
      verdict = 'Genuinely fractal: measured slope tracks the prediction and ' +
        'holds across scales. The measurement reads a few hundredths low, ' +
        'consistent with the bias shown below.';
    }
    $('fVerdict').textContent = verdict;

    // counts table with local slopes
    var slopes = R.localSlopes(cur.counts);
    var rows = ['<tr><td>g</td><td>N(g)</td><td class="pred">local slope</td></tr>'];
    for (var i = 0; i < R.BOXES.length; i++) {
      rows.push('<tr><td>' + R.BOXES[i] + '</td><td>' + cur.counts[i] + '</td><td class="pred">' +
                (i ? slopes[i - 1].toFixed(3) : '—') + '</td></tr>');
    }
    $('countTable').innerHTML = rows.join('');

    $('lineBias').textContent = lineBiasMeasured ? lineBiasMeasured.toFixed(4) : '—';
  }

  function refresh() {
    compute(); drawGraph(); drawLogLog(); report();
  }

  // ── boot ────────────────────────────────────────────────────────────
  var lastSelfTest = null;

  function boot() {
    if (FAULT) {
      var bbar = document.createElement('div');
      bbar.className = 'faultbar';
      bbar.innerHTML = 'FAULT INJECTED — <code>?fault=' + FAULT + '</code> — ' +
        'this page is deliberately broken so you can see the self-test fail. ' +
        '<a href="' + location.pathname + '">load it clean</a>';
      document.body.insertBefore(bbar, document.body.firstChild);
    }

    lastSelfTest = selfTest();
    reportSelfTest(lastSelfTest);

    $('fn').onchange = function () {
      var w = this.value === 'weier';
      $('aCtl').style.display = w ? '' : 'none';
      $('bCtl').style.display = w ? '' : 'none';
      if (this.value === 'riemann' && !compute.riemannChecked) {
        $('fVerdict').textContent = 'computing 599 terms over 400,000 points…';
        setTimeout(refresh, 30);
      } else refresh();
    };
    $('a').oninput = function () { $('aOut').textContent = (+this.value).toFixed(2); refresh(); };
    $('b').oninput = function () { $('bOut').textContent = (+this.value).toFixed(1); refresh(); };
    $('showg').onchange = refresh;

    refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
