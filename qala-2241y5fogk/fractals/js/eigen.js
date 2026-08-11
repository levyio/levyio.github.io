/* Symmetric eigensolver: Householder tridiagonalisation + implicit-shift QL.
 *
 * This is the classical two-stage algorithm (Householder 1958; Bowdler, Martin,
 * Reinsch & Wilkinson's tred2/tql2). It is here rather than a library because
 * this project has to still run in ten years with no toolchain.
 *
 * Only symmetric input is valid, which is why the drum is posed with Dirichlet
 * boundary conditions: M = 4I - A on interior vertices is symmetric, so the
 * eigenvalues are real and the eigenvectors are genuinely orthogonal. An
 * eigenvector is a displacement field; a complex one would be meaningless.
 *
 * Cost is O(n^3). n = 363 (level 5) runs in well under a second; n = 1092
 * (level 6) takes a few seconds, which is why the UI warns before going there.
 *
 * eigSym(A, n) -> { values: Float64Array (ascending), vectors: Float64Array }
 *   vectors[k*n + i] is component i of eigenvector k.
 *   A is a flat Float64Array of length n*n and IS DESTROYED.
 */
(function (root) {
  'use strict';

  function hypot2(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    if (a > b) { const r = b / a; return a * Math.sqrt(1 + r * r); }
    if (b === 0) return 0;
    const r = a / b; return b * Math.sqrt(1 + r * r);
  }

  /* Reduce symmetric z to tridiagonal (d, e), leaving the accumulated
   * orthogonal transform in z. */
  function tred2(z, n, d, e) {
    for (let i = n - 1; i >= 1; i--) {
      const l = i - 1;
      let h = 0, scale = 0;
      if (l > 0) {
        for (let k = 0; k <= l; k++) scale += Math.abs(z[i * n + k]);
        if (scale === 0) {
          e[i] = z[i * n + l];
        } else {
          for (let k = 0; k <= l; k++) {
            z[i * n + k] /= scale;
            h += z[i * n + k] * z[i * n + k];
          }
          let f = z[i * n + l];
          let g = f >= 0 ? -Math.sqrt(h) : Math.sqrt(h);
          e[i] = scale * g;
          h -= f * g;
          z[i * n + l] = f - g;
          f = 0;
          for (let j = 0; j <= l; j++) {
            z[j * n + i] = z[i * n + j] / h;
            g = 0;
            for (let k = 0; k <= j; k++) g += z[j * n + k] * z[i * n + k];
            for (let k = j + 1; k <= l; k++) g += z[k * n + j] * z[i * n + k];
            e[j] = g / h;
            f += e[j] * z[i * n + j];
          }
          const hh = f / (h + h);
          for (let j = 0; j <= l; j++) {
            f = z[i * n + j];
            e[j] = g = e[j] - hh * f;
            for (let k = 0; k <= j; k++) {
              z[j * n + k] -= f * e[k] + g * z[i * n + k];
            }
          }
        }
      } else {
        e[i] = z[i * n + l];
      }
      d[i] = h;
    }
    d[0] = 0; e[0] = 0;
    for (let i = 0; i < n; i++) {
      const l = i - 1;
      if (d[i] !== 0) {
        for (let j = 0; j <= l; j++) {
          let g = 0;
          for (let k = 0; k <= l; k++) g += z[i * n + k] * z[k * n + j];
          for (let k = 0; k <= l; k++) z[k * n + j] -= g * z[k * n + i];
        }
      }
      d[i] = z[i * n + i];
      z[i * n + i] = 1;
      for (let j = 0; j <= l; j++) z[j * n + i] = z[i * n + j] = 0;
    }
  }

  /* QL with implicit shifts on the tridiagonal (d, e); z accumulates vectors. */
  function tql2(z, n, d, e) {
    for (let i = 1; i < n; i++) e[i - 1] = e[i];
    e[n - 1] = 0;
    for (let l = 0; l < n; l++) {
      let iter = 0, m;
      do {
        for (m = l; m < n - 1; m++) {
          const dd = Math.abs(d[m]) + Math.abs(d[m + 1]);
          if (Math.abs(e[m]) <= Number.EPSILON * dd) break;
        }
        if (m !== l) {
          if (iter++ === 50) throw new Error('tql2: no convergence after 50 iterations');
          let g = (d[l + 1] - d[l]) / (2 * e[l]);
          let r = hypot2(g, 1);
          g = d[m] - d[l] + e[l] / (g + (g >= 0 ? Math.abs(r) : -Math.abs(r)));
          let s = 1, c = 1, p = 0;
          let i;
          for (i = m - 1; i >= l; i--) {
            let f = s * e[i];
            const b = c * e[i];
            r = hypot2(f, g);
            e[i + 1] = r;
            if (r === 0) { d[i + 1] -= p; e[m] = 0; break; }
            s = f / r; c = g / r;
            g = d[i + 1] - p;
            r = (d[i] - g) * s + 2 * c * b;
            p = s * r;
            d[i + 1] = g + p;
            g = c * r - b;
            for (let k = 0; k < n; k++) {
              f = z[k * n + i + 1];
              z[k * n + i + 1] = s * z[k * n + i] + c * f;
              z[k * n + i] = c * z[k * n + i] - s * f;
            }
          }
          if (r === 0 && i >= l) continue;
          d[l] -= p; e[l] = g; e[m] = 0;
        }
      } while (m !== l);
    }
  }

  function eigSym(A, n) {
    const d = new Float64Array(n), e = new Float64Array(n);
    tred2(A, n, d, e);
    tql2(A, n, d, e);

    // sort ascending, repacking eigenvectors row-major by mode
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => d[a] - d[b]);
    const values = new Float64Array(n);
    const vectors = new Float64Array(n * n);
    for (let k = 0; k < n; k++) {
      const src = order[k];
      values[k] = d[src];
      for (let i = 0; i < n; i++) vectors[k * n + i] = A[i * n + src];
    }
    return { values: values, vectors: vectors };
  }

  root.HFEigen = { eigSym: eigSym };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.HFEigen;
})(typeof globalThis !== 'undefined' ? globalThis : this);
