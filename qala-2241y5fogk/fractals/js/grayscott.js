/* Gray-Scott on a periodic grid: explicit Euler, dt = 1, 5-point Laplacian.
 *
 * Same discretisation as Pearson (1993) and docs/verify_grayscott.py:
 * n = 256, Du = 2e-5, Dv = 1e-5, side L = 2.5, so Du/dx^2 = 0.2097 and the
 * Euler stability bound is dt <= 1.1921. dt = 1 sits under it; the page does
 * not offer finer grids without dropping dt, because at n = 384 the same dt
 * is unstable (the bound is 0.53) and a silently wrong integrator is exactly
 * what this project exists to not ship.
 *
 * Double-buffered: every step reads only the previous field, matching the
 * numpy-roll semantics of the verification script. In-place updating would be
 * a different (Gauss-Seidel-like) scheme and would not match it.
 *
 * The feed rate may be a field F(x,y) rather than a constant -- that is the
 * Chladni-feed extension. The kill rate stays uniform.
 *
 * Periodic boundaries, stated honestly: they make the FFT wavelength
 * measurement exact (no windowing bias), and they mean this dish has no
 * walls. A real Petri dish reflects at its rim; this domain wraps.
 */
(function (root) {
  'use strict';

  function GrayScott(n) {
    this.n = n;
    this.u = new Float64Array(n * n);
    this.v = new Float64Array(n * n);
    this.u2 = new Float64Array(n * n);
    this.v2 = new Float64Array(n * n);
    this.F = 0.0367;
    this.k = 0.0649;
    this.dt = 1.0;
    this.fField = null;            // Float64Array(n*n) when Chladni feed is on
    this.steps = 0;
    var T = root.HFTuring;
    var dx = T.L / n;
    this.cu = T.DU / (dx * dx);
    this.cv = T.DV / (dx * dx);
    this._seedRng = 12345;
    this.clear();
  }

  /* Deterministic LCG so a reload reproduces a run exactly. Numerical
   * Recipes constants; returns in [0, 1). */
  GrayScott.prototype.rand = function () {
    this._seedRng = (Math.imul(1664525, this._seedRng) + 1013904223) >>> 0;
    return this._seedRng / 4294967296;
  };

  GrayScott.prototype.clear = function () {
    this.u.fill(1);
    this.v.fill(0);
    this.steps = 0;
  };

  /* The standard seed: a square blob of (0.5, 0.25) plus 1% noise clipped to
   * [0,1] -- identical to the verification script's evolve_marks. */
  GrayScott.prototype.seedCentre = function () {
    var n = this.n, c = n >> 1, r = Math.floor(n / 20);
    this.clear();
    this.blob(c, c, r);
    for (var i = 0; i < n * n; i++) {
      var nu = this.u[i] + 0.01 * (2 * this.rand() - 1);
      var nv = this.v[i] + 0.01 * (2 * this.rand() - 1);
      this.u[i] = nu < 0 ? 0 : nu > 1 ? 1 : nu;
      this.v[i] = nv < 0 ? 0 : nv > 1 ? 1 : nv;
    }
  };

  /* Noise about the upper non-trivial state. Only meaningful where that
   * state exists (above the fold); inside the Turing sliver this is the seed
   * whose growth linear theory itself predicts. Returns false if no state. */
  GrayScott.prototype.seedTuringNoise = function () {
    var st = root.HFTuring.steadyStates(this.F, this.k);
    if (st.length < 2) return false;
    var best = st[1];
    for (var i = 2; i < st.length; i++) if (st[i].v > best.v) best = st[i];
    for (var j = 0; j < this.n * this.n; j++) {
      this.u[j] = best.u + 1e-3 * (2 * this.rand() - 1);
      this.v[j] = best.v + 1e-3 * (2 * this.rand() - 1);
    }
    this.steps = 0;
    return true;
  };

  /* Brush: a SQUARE blob of (u,v) = (0.5, 0.25), half-side r cells.
   *
   * Square deliberately, and it is physics rather than laziness: at the
   * mitosis parameters a perfectly round seed collapses and dies -- tested up
   * to radius 18, over twice the square's area -- because radial symmetry
   * has nothing to pinch on. The square's corners break the symmetry and
   * become the first division. Verified in docs/verify_grayscott.py. */
  GrayScott.prototype.blob = function (cx, cy, r) {
    var n = this.n;
    for (var dy = -r; dy < r; dy++) {
      for (var dx = -r; dx < r; dx++) {
        var x = ((cx + dx) % n + n) % n, y = ((cy + dy) % n + n) % n;
        this.u[y * n + x] = 0.5;
        this.v[y * n + x] = 0.25;
      }
    }
  };

  /* Chladni feed: F(x,y) = F0 + depth * sin(m pi x / n) sin(mn pi y / n),
   * the simply-supported plate mode (m, mn). The same idealisation Qala
   * states: real free-edge plates have different shapes. null turns it off. */
  GrayScott.prototype.setChladniFeed = function (m, mm, depth) {
    if (!depth) { this.fField = null; this.chladni = null; return; }
    var n = this.n;
    var f = new Float64Array(n * n);
    for (var y = 0; y < n; y++) {
      var sy = Math.sin(mm * Math.PI * y / n);
      for (var x = 0; x < n; x++) {
        f[y * n + x] = this.F + depth * Math.sin(m * Math.PI * x / n) * sy;
      }
    }
    this.fField = f;
    this.chladni = { m: m, n: mm, depth: depth };
  };

  GrayScott.prototype.step = function (nSteps) {
    var n = this.n, dt = this.dt, cu = this.cu, cv = this.cv;
    var k = this.k, F0 = this.F, fF = this.fField;
    for (var s = 0; s < nSteps; s++) {
      var u = this.u, v = this.v, u2 = this.u2, v2 = this.v2;
      for (var y = 0; y < n; y++) {
        var ym = ((y - 1 + n) % n) * n, yp = ((y + 1) % n) * n, y0 = y * n;
        for (var x = 0; x < n; x++) {
          var xm = (x - 1 + n) % n, xp = (x + 1) % n;
          var i = y0 + x;
          var uu = u[i], vv = v[i];
          var lapU = u[ym + x] + u[yp + x] + u[y0 + xm] + u[y0 + xp] - 4 * uu;
          var lapV = v[ym + x] + v[yp + x] + v[y0 + xm] + v[y0 + xp] - 4 * vv;
          var uvv = uu * vv * vv;
          var F = fF ? fF[i] : F0;
          u2[i] = uu + dt * (cu * lapU - uvv + F * (1 - uu));
          v2[i] = vv + dt * (cv * lapV + uvv - (F + k) * vv);
        }
      }
      this.u = u2; this.u2 = u;
      this.v = v2; this.v2 = v;
      this.steps++;
    }
  };

  /* Connected components of v > thresh, 4-connected, periodic -- the spot
   * count whose rise IS the division. Same flood fill as the verifier. */
  GrayScott.prototype.components = function (thresh) {
    var n = this.n, v = this.v;
    var seen = new Uint8Array(n * n);
    var stack = new Int32Array(n * n);
    var count = 0, cells = 0, i;
    for (i = 0; i < n * n; i++) {
      if (v[i] <= thresh || seen[i]) continue;
      count++;
      var top = 0;
      stack[top++] = i;
      seen[i] = 1;
      while (top > 0) {
        var p = stack[--top];
        cells++;
        var y = (p / n) | 0, x = p - y * n;
        var nb = [((y - 1 + n) % n) * n + x, ((y + 1) % n) * n + x,
                  y * n + ((x - 1 + n) % n), y * n + ((x + 1) % n)];
        for (var q = 0; q < 4; q++) {
          var j = nb[q];
          if (v[j] > thresh && !seen[j]) { seen[j] = 1; stack[top++] = j; }
        }
      }
    }
    return { count: count, area: cells / (n * n) };
  };

  root.HFGrayScott = GrayScott;
  if (typeof module !== 'undefined' && module.exports) module.exports = GrayScott;
})(typeof globalThis !== 'undefined' ? globalThis : this);
