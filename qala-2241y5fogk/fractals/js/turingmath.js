/* Gray-Scott linear theory: steady states, Turing verdict, predicted wavelength.
 *
 *     du/dt = Du lap(u) - u v^2 + F (1 - u)
 *     dv/dt = Dv lap(v) + u v^2 - (F + k) v
 *
 * Pearson's non-dimensionalisation (Science 261:189, 1993): Du = 2e-5,
 * Dv = 1e-5, domain a periodic square of side L = 2.5. Every number this file
 * produces is recomputed independently by docs/verify_grayscott.py; the
 * agreement is asserted on page load by js/gs-selftest.js.
 *
 * The central honest fact, verified there and displayed by the instrument:
 * the famous Gray-Scott regimes are NOT Turing instabilities. The uniform
 * state (1,0) is linearly stable everywhere at every wavenumber, non-trivial
 * uniform states exist only above the fold F >= 4(F+k)^2, and the band of
 * (F,k) where diffusion genuinely destabilises a stable state -- Turing's
 * mechanism, verdict TURING below -- is a thin sliver hugging that fold.
 * Everywhere else linear theory predicts no pattern and no wavelength, so the
 * instrument must say "no prediction" there rather than inventing one.
 */
(function (root) {
  'use strict';

  var DU = 2e-5, DV = 1e-5, L = 2.5;

  /* Largest stable explicit-Euler dt for the 5-point Laplacian at grid n:
   * dt <= dx^2 / (4 Du), from the checkerboard mode's symbol -8/dx^2. */
  function dtMax(n) {
    var dx = L / n;
    return dx * dx / (4 * DU);
  }

  /* Fold curve: non-trivial homogeneous states exist iff F >= 4 (F+k)^2. */
  function fold(F, k) { return 4 * (F + k) * (F + k); }

  /* All spatially uniform solutions. (1,0) always; two more above the fold,
   * roots of s v^2 - F v + F s = 0 with s = F + k, u = s / v. */
  function steadyStates(F, k) {
    var s = F + k;
    var disc = F * F - 4 * s * s * F;
    var out = [{ u: 1, v: 0 }];
    if (disc >= 0) {
      var r = Math.sqrt(disc);
      var v1 = (F + r) / (2 * s), v2 = (F - r) / (2 * s);
      if (v1 > 0) out.push({ u: s / v1, v: v1 });
      if (v2 > 0) out.push({ u: s / v2, v: v2 });
    }
    return out;
  }

  /* Jacobian of the reaction terms at (u, v). */
  function jacobian(F, k, u, v) {
    return {
      fu: -v * v - F, fv: -2 * u * v,
      gu: v * v, gv: 2 * u * v - (F + k)
    };
  }

  /* Turing analysis of the upper (largest-v) non-trivial branch.
   *
   * verdict: 'no-state' | 'tr>0' | 'det<0' | 'no-band' | 'TURING'
   * When TURING: qStar (rad / domain unit), sigmaMax (1 / time unit),
   * lambdaCells(n) -- the wavelength 2 pi / qStar in grid cells at size n.
   *
   * The fastest-growing mode is the argmax of Re sigma(q), found by scanning
   * exactly as verify_grayscott.py does (identical grid, so the self-test can
   * demand equality rather than closeness).
   */
  function turing(F, k, refine) {
    var out = { F: F, k: k, verdict: 'no-state', state: null,
                qStar: null, sigmaMax: null };
    var st = steadyStates(F, k);
    if (st.length < 2) return out;
    var best = st[1];
    for (var i = 2; i < st.length; i++) if (st[i].v > best.v) best = st[i];
    out.state = best;
    var J = jacobian(F, k, best.u, best.v);
    var tr = J.fu + J.gv, det = J.fu * J.gv - J.fv * J.gu;
    out.trace = tr; out.det = det;
    if (tr >= 0) { out.verdict = 'tr>0'; return out; }
    if (det <= 0) { out.verdict = 'det<0'; return out; }

    /* h(q^2) = Du Dv q^4 - (Du gv + Dv fu) q^2 + det dips negative iff
     * b > 0 and b^2 > 4 Du Dv det. */
    var b = DU * J.gv + DV * J.fu;
    if (b <= 0 || b * b <= 4 * DU * DV * det) { out.verdict = 'no-band'; return out; }
    out.verdict = 'TURING';
    var q2h = b / (2 * DU * DV);
    if (!refine) return out;

    var qHi = 4 * Math.sqrt(q2h), NPTS = 20000;
    var bestSig = -Infinity, bestQ = 0;
    for (var j = 0; j < NPTS; j++) {
      var q = 1 + (qHi - 1) * j / (NPTS - 1);
      var q2 = q * q;
      var a = J.fu - DU * q2, d = J.gv - DV * q2;
      var trq = a + d, detq = a * d - J.fv * J.gu;
      var disc = trq * trq - 4 * detq;
      var sig = disc >= 0 ? 0.5 * (trq + Math.sqrt(disc)) : 0.5 * trq;
      if (sig > bestSig) { bestSig = sig; bestQ = q; }
    }
    if (bestSig <= 0) { out.verdict = 'no-band'; return out; }
    out.qStar = bestQ;
    out.sigmaMax = bestSig;
    return out;
  }

  function lambdaCells(qStar, n) {
    return (2 * Math.PI / qStar) / (L / n);
  }

  /* Intrinsic diffusion lengths in grid cells -- scales, NOT predictions:
   * how far u is replenished before being eaten, how far v travels before
   * being killed. The instrument labels them exactly that way. */
  function diffusionLengths(F, k, n) {
    var dx = L / n;
    return { lu: Math.sqrt(DU / F) / dx, lv: Math.sqrt(DV / (F + k)) / dx };
  }

  root.HFTuring = {
    DU: DU, DV: DV, L: L,
    dtMax: dtMax, fold: fold, steadyStates: steadyStates,
    jacobian: jacobian, turing: turing, lambdaCells: lambdaCells,
    diffusionLengths: diffusionLengths
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.HFTuring;
})(typeof globalThis !== 'undefined' ? globalThis : this);
