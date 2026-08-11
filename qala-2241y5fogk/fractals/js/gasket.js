/* The Sierpinski gasket as a drum.
 *
 * Convention, stated once and used everywhere (the literature carries at least
 * three, and mixing them silently is how wrong overtone ratios get published):
 *
 *   Every interior vertex of the level-m gasket graph has degree exactly 4.
 *   The three corners are clamped to zero -- a drum is held at its rim -- so
 *   they leave the problem entirely. The operator on the remaining vertices is
 *
 *       M = 4I - A          symmetric, positive definite, spectrum in [0, 6]
 *
 *   In this normalisation the Rammal-Toulouse / Fukushima-Shima decimation is
 *
 *       lambda_{m-1} = lambda_m (5 - lambda_m)
 *       lambda_m     = (5 +/- sqrt(25 - 4 lambda_{m-1})) / 2
 *
 *   Written lambda(5 - 4 lambda) elsewhere, for the normalised Laplacian
 *   I - D^-1 A, whose eigenvalues are these divided by four. Same relation.
 *
 * Cross-checked against docs/verify_gasket.py, which computes the same
 * spectrum with numpy. js/selftest.js asserts the agreement on page load.
 */
(function (root) {
  'use strict';

  var EXCEPTIONAL = [2, 5, 6];   // where the quadratic is singular; modes are born here

  /* Vertices, edges and corner indices of the level-m gasket graph. */
  function build(level) {
    var h = Math.sqrt(3) / 2;
    var tris = [[[0, 0], [1, 0], [0.5, h]]];
    for (var s = 0; s < level; s++) {
      var next = [];
      for (var t = 0; t < tris.length; t++) {
        var A = tris[t][0], B = tris[t][1], C = tris[t][2];
        var AB = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
        var BC = [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2];
        var CA = [(C[0] + A[0]) / 2, (C[1] + A[1]) / 2];
        next.push([A, AB, CA], [AB, B, BC], [CA, BC, C]);
      }
      tris = next;
    }

    var index = Object.create(null), verts = [];
    function vid(p) {
      var k = p[0].toFixed(9) + ',' + p[1].toFixed(9);
      if (!(k in index)) { index[k] = verts.length; verts.push([p[0], p[1]]); }
      return index[k];
    }

    var edgeSet = Object.create(null), edges = [];
    function edge(u, v) {
      var k = Math.min(u, v) + ',' + Math.max(u, v);
      if (!(k in edgeSet)) { edgeSet[k] = 1; edges.push([Math.min(u, v), Math.max(u, v)]); }
    }
    for (var i = 0; i < tris.length; i++) {
      var a = vid(tris[i][0]), b = vid(tris[i][1]), c = vid(tris[i][2]);
      edge(a, b); edge(b, c); edge(c, a);
    }
    var corners = [vid([0, 0]), vid([1, 0]), vid([0.5, h])];
    return { level: level, verts: verts, edges: edges, corners: corners };
  }

  /* Dirichlet problem: drop the corners, assemble M = 4I - A, diagonalise.
   * Returns eigenvalues ascending, eigenvectors, and the interior->vertex map. */
  function solve(g) {
    var isCorner = Object.create(null);
    for (var c = 0; c < g.corners.length; c++) isCorner[g.corners[c]] = 1;

    var interior = [], pos = Object.create(null);
    for (var v = 0; v < g.verts.length; v++) {
      if (!isCorner[v]) { pos[v] = interior.length; interior.push(v); }
    }
    var n = interior.length;

    // the whole convention rests on interior degree being 4 -- check, don't assume
    var deg = new Int32Array(g.verts.length);
    for (var e = 0; e < g.edges.length; e++) { deg[g.edges[e][0]]++; deg[g.edges[e][1]]++; }
    for (var i = 0; i < n; i++) {
      if (deg[interior[i]] !== 4) {
        throw new Error('interior vertex ' + interior[i] + ' has degree ' + deg[interior[i]] + ', expected 4');
      }
    }

    var M = new Float64Array(n * n);
    for (i = 0; i < n; i++) M[i * n + i] = 4;
    for (e = 0; e < g.edges.length; e++) {
      var u = g.edges[e][0], w = g.edges[e][1];
      if (u in pos && w in pos) {
        M[pos[u] * n + pos[w]] = -1;
        M[pos[w] * n + pos[u]] = -1;
      }
    }

    var res = root.HFEigen.eigSym(M, n);   // M is consumed
    return { n: n, interior: interior, pos: pos, values: res.values, vectors: res.vectors };
  }

  /* Branches of lambda(5-lambda) = mu that are legal lifts.
   *
   * Both roots solve the quadratic, but a root landing ON an exceptional value
   * is not a valid lift. The only case that bites is mu = 6, whose roots are
   * exactly {2, 3}: the 2 is forbidden, the 3 survives. So a coarse eigenvalue
   * at 6 has ONE descendant, not two -- which is the correction that made the
   * predicted born-counts match the measured ones. (No other collision is
   * reachable: a root of 5 needs mu = 0, a root of 6 needs mu = -6.) */
  function preimages(mu) {
    var d = 25 - 4 * mu;
    if (d < -1e-12) return [];
    d = Math.max(d, 0);
    var r = [(5 - Math.sqrt(d)) / 2, (5 + Math.sqrt(d)) / 2], out = [];
    for (var i = 0; i < r.length; i++) {
      var bad = false;
      for (var j = 0; j < EXCEPTIONAL.length; j++) {
        if (Math.abs(r[i] - EXCEPTIONAL[j]) < 1e-9) bad = true;
      }
      if (!bad) out.push(r[i]);
    }
    return out;
  }

  /* Classify a measured level-m spectrum against the decimation prediction
   * from level m-1. Every eigenvalue must either descend, or be born on an
   * exceptional value. Anything else is a failure and is reported as one. */
  function classify(fine, coarse) {
    var predicted = [];
    for (var i = 0; i < coarse.length; i++) {
      var p = preimages(coarse[i]);
      for (var j = 0; j < p.length; j++) predicted.push(p[j]);
    }
    predicted.sort(function (a, b) { return a - b; });

    // match on indices, not values -- eigenvalues are degenerate all over this
    // spectrum (lambda=6 has multiplicity 120 at level 5) and a value-based
    // lookup would silently pair the wrong modes.
    var remaining = [];
    for (i = 0; i < fine.length; i++) remaining.push(i);
    var origin = new Array(fine.length);      // predicted lambda for each matched mode
    var matched = 0, resid = 0;

    for (i = 0; i < predicted.length && remaining.length; i++) {
      var best = -1, bestD = Infinity;
      for (j = 0; j < remaining.length; j++) {
        var dd = Math.abs(fine[remaining[j]] - predicted[i]);
        if (dd < bestD) { bestD = dd; best = j; }
      }
      if (bestD < 1e-6) {
        resid = Math.max(resid, bestD);
        origin[remaining[best]] = predicted[i];
        remaining.splice(best, 1);
        matched++;
      }
    }

    var born = remaining.map(function (k) { return fine[k]; })
                        .sort(function (a, b) { return a - b; });
    var offExceptional = born.filter(function (b) {
      return !EXCEPTIONAL.some(function (x) { return Math.abs(b - x) < 1e-6; });
    });

    return {
      matched: matched, born: born, residual: resid, origin: origin,
      bornIndex: remaining, offExceptional: offExceptional,
      ok: offExceptional.length === 0 && matched + born.length === fine.length
    };
  }

  var N_VERTS    = function (m) { return (Math.pow(3, m + 1) + 3) / 2; };
  var N_INTERIOR = function (m) { return (Math.pow(3, m + 1) - 3) / 2; };
  var MULT_5     = function (m) { return (Math.pow(3, m - 1) + 3) / 2; };
  var MULT_6     = function (m) { return (Math.pow(3, m) - 3) / 2; };
  var N_BORN     = function (m) { return 2 * Math.pow(3, m - 1); };

  root.HFGasket = {
    build: build, solve: solve, preimages: preimages, classify: classify,
    EXCEPTIONAL: EXCEPTIONAL,
    predict: { verts: N_VERTS, interior: N_INTERIOR, mult5: MULT_5, mult6: MULT_6, born: N_BORN }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.HFGasket;
})(typeof globalThis !== 'undefined' ? globalThis : this);
