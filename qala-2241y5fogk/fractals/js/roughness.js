/* Box-counting dimension of function graphs — the measurement engine for
 * roughness.html.
 *
 * This is a deliberate, line-for-line replica of docs/verify_roughness.py:
 * same sampling (400,000 points on [0,1]), same box grids (16..1024), same
 * vertical fill-in between consecutive samples, same least-squares fit. It has
 * to be a replica, because the page asserts its integer box counts against
 * numpy's. Two implementations that agree cell-for-cell are one pipeline
 * computed twice; two that agree "roughly" prove nothing.
 *
 * Anticipated caveat, then measured: numpy's libm and JS Math.cos may round
 * differently in the last ulp, which could flip a sample sitting exactly on a
 * cell boundary. Measured on this machine (node 25 vs numpy): all 49 integer
 * counts across seven test functions agree EXACTLY, so the self-test asserts
 * exact counts. If some browser's Math.cos disagrees in a way that flips a
 * cell, the self-test will say so — which is the correct behaviour, not a
 * flakiness to be papered over with tolerance.
 */
(function (root) {
  'use strict';

  var NX = 400000;
  var BOXES = [16, 32, 64, 128, 256, 512, 1024];

  var x = new Float64Array(NX);
  for (var i = 0; i < NX; i++) x[i] = i / (NX - 1);

  // ── the functions ────────────────────────────────────────────────────
  function fLine() { return Float64Array.from(x); }

  function fSine() {
    var y = new Float64Array(NX);
    for (var i = 0; i < NX; i++) y[i] = Math.sin(2 * Math.PI * x[i]);
    return y;
  }

  function fWeierstrass(a, b, terms) {
    terms = terms || 24;
    var y = new Float64Array(NX), amp = 1.0;
    for (var k = 0; k < terms; k++) {
      if (amp < 1e-9) break;
      var f = Math.pow(b, k) * Math.PI;
      for (var i = 0; i < NX; i++) y[i] += amp * Math.cos(f * x[i]);
      amp *= a;
    }
    return y;
  }

  function fTakagi(terms) {
    terms = terms || 22;
    var y = new Float64Array(NX);
    for (var n = 0; n < terms; n++) {
      var s = Math.pow(2, n);
      for (var i = 0; i < NX; i++) {
        var t = s * x[i];
        y[i] += Math.abs(t - Math.round(t)) / s;
      }
    }
    return y;
  }

  function fRiemann(terms) {
    terms = terms || 600;                 // ~240M sin calls; seconds, not ms
    var y = new Float64Array(NX);
    for (var n = 1; n < terms; n++) {
      var f = n * n * Math.PI, w = 1 / (n * n);
      for (var i = 0; i < NX; i++) y[i] += w * Math.sin(f * x[i]);
    }
    return y;
  }

  // ── the measurement ──────────────────────────────────────────────────
  /* Occupied-cell counts of the graph at every grid, curve filled in
   * vertically between consecutive samples. Also returns the occupancy grid
   * for one requested box size so the page can DRAW the cells being counted —
   * the measurement made visible, not just its result. */
  function boxCounts(y, keepGrid) {
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < NX; i++) { if (y[i] < lo) lo = y[i]; if (y[i] > hi) hi = y[i]; }
    var scale = 1 / (hi - lo + 1e-15);

    var counts = [], kept = null;
    for (var gI = 0; gI < BOXES.length; gI++) {
      var g = BOXES[gI];
      var occ = new Uint8Array(g * g);
      var giPrev = 0, gjPrev = 0;
      for (i = 0; i < NX; i++) {
        var gi = Math.floor(x[i] * g);      if (gi > g - 1) gi = g - 1;
        var gj = Math.floor((y[i] - lo) * scale * g); if (gj > g - 1) gj = g - 1; if (gj < 0) gj = 0;
        if (i > 0) {
          var a = gjPrev < gj ? gjPrev : gj, b = gjPrev < gj ? gj : gjPrev;
          var base = giPrev * g;            // python uses the LEFT point's column
          for (var j = a; j <= b; j++) occ[base + j] = 1;
        }
        giPrev = gi; gjPrev = gj;
      }
      var n = 0;
      for (i = 0; i < g * g; i++) n += occ[i];
      counts.push(n);
      if (g === keepGrid) kept = occ;
    }
    return { counts: counts, grid: kept, gridSize: keepGrid };
  }

  function fitD(counts) {
    var lg = [], ln = [], k = counts.length;
    for (var i = 0; i < k; i++) {
      lg.push(Math.log(BOXES[i]));
      ln.push(Math.log(Math.max(1, counts[i])));
    }
    var mx = 0, my = 0;
    for (i = 0; i < k; i++) { mx += lg[i]; my += ln[i]; }
    mx /= k; my /= k;
    var num = 0, den = 0;
    for (i = 0; i < k; i++) { num += (lg[i] - mx) * (ln[i] - my); den += (lg[i] - mx) * (lg[i] - mx); }
    return num / den;
  }

  function localSlopes(counts) {
    var s = [];
    for (var i = 0; i < counts.length - 1; i++) {
      s.push(Math.log(counts[i + 1] / counts[i]) / Math.log(2));
    }
    return s;
  }

  /* Predicted dimension of the Weierstrass graph. The formula 2 + ln a/ln b
   * applies for ab > 1; at ab = 1 it equals 1 exactly, and below that the sum
   * is differentiable, so the prediction is 1. max() states both cases. */
  function predictWeierstrass(a, b) {
    return Math.max(1, 2 + Math.log(a) / Math.log(b));
  }

  root.HFRough = {
    NX: NX, BOXES: BOXES, x: x,
    fLine: fLine, fSine: fSine, fWeierstrass: fWeierstrass,
    fTakagi: fTakagi, fRiemann: fRiemann,
    boxCounts: boxCounts, fitD: fitD, localSlopes: localSlopes,
    predictWeierstrass: predictWeierstrass
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.HFRough;
})(typeof globalThis !== 'undefined' ? globalThis : this);
