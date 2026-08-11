/* Radix-2 FFT and the radial-spectrum wavelength measurement.
 *
 * Here rather than a library for the usual reason: this page must still run
 * in ten years with no toolchain. Only power-of-two sizes are needed (the
 * simulation grid is 256).
 *
 * The measurement the instrument reports:
 *   2-D FFT of (field - mean)  ->  power  ->  average over annuli of |k|
 *   -> peak bin, refined by a parabola through its three neighbours
 *   -> lambda = n / k_peak, in grid cells.
 *
 * Confidence is peak / median of the radial spectrum. White noise gives about
 * 1.8 (verified in docs/verify_grayscott.py); the instrument treats anything
 * below 3.0 as "no characteristic wavelength" and says so instead of quoting
 * a number. Calibrated on synthetic stripes: exact to <0.01% (same script).
 */
(function (root) {
  'use strict';

  /* In-place iterative complex FFT, split arrays. n a power of two. */
  function fft(re, im, n, inverse) {
    for (var i = 1, j = 0; i < n; i++) {          // bit reversal
      var bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        var t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (var len = 2; len <= n; len <<= 1) {
      var ang = (inverse ? 2 : -2) * Math.PI / len;
      var wr = Math.cos(ang), wi = Math.sin(ang);
      for (var s = 0; s < n; s += len) {
        var cr = 1, ci = 0;
        for (var m = 0; m < len / 2; m++) {
          var a = s + m, b = s + m + len / 2;
          var xr = re[b] * cr - im[b] * ci;
          var xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
          var ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }

  /* Radial power spectrum of an n x n field (any typed array, row-major).
   * Returns { radial: Float64Array(n/2), lambda, kPeak, confidence }. */
  function radialPeak(field, n) {
    var re = new Float64Array(n * n), im = new Float64Array(n * n);
    var mean = 0, i;
    for (i = 0; i < n * n; i++) mean += field[i];
    mean /= n * n;
    for (i = 0; i < n * n; i++) re[i] = field[i] - mean;

    var rowR = new Float64Array(n), rowI = new Float64Array(n), r, c;
    for (r = 0; r < n; r++) {                     // rows
      for (c = 0; c < n; c++) { rowR[c] = re[r * n + c]; rowI[c] = im[r * n + c]; }
      fft(rowR, rowI, n, false);
      for (c = 0; c < n; c++) { re[r * n + c] = rowR[c]; im[r * n + c] = rowI[c]; }
    }
    for (c = 0; c < n; c++) {                     // columns
      for (r = 0; r < n; r++) { rowR[r] = re[r * n + c]; rowI[r] = im[r * n + c]; }
      fft(rowR, rowI, n, false);
      for (r = 0; r < n; r++) { re[r * n + c] = rowR[r]; im[r * n + c] = rowI[r]; }
    }

    var half = n >> 1;
    var radial = new Float64Array(half), counts = new Float64Array(half);
    for (r = 0; r < n; r++) {
      var kr = r <= half ? r : r - n;
      for (c = 0; c < n; c++) {
        var kc = c <= half ? c : c - n;
        var idx = Math.floor(Math.sqrt(kr * kr + kc * kc));
        if (idx >= half) idx = half - 1;
        radial[idx] += re[r * n + c] * re[r * n + c] + im[r * n + c] * im[r * n + c];
        counts[idx]++;
      }
    }
    for (i = 0; i < half; i++) if (counts[i] > 0) radial[i] /= counts[i];
    radial[0] = 0;                                // the mean is not a scale

    var peak = 1;
    for (i = 1; i < half; i++) if (radial[i] > radial[peak]) peak = i;
    var kRef = peak;
    if (peak > 0 && peak < half - 1) {            // parabolic refinement
      var y0 = radial[peak - 1], y1 = radial[peak], y2 = radial[peak + 1];
      var den = y0 - 2 * y1 + y2;
      if (den !== 0) kRef = peak + 0.5 * (y0 - y2) / den;
    }

    var sorted = Array.prototype.slice.call(radial, 1).sort(function (a, b) { return a - b; });
    var median = sorted[Math.floor(sorted.length / 2)];
    return {
      radial: radial,
      kPeak: kRef,
      lambda: kRef > 0 ? n / kRef : Infinity,
      confidence: median > 0 ? radial[peak] / median : Infinity
    };
  }

  root.HFFFT = { fft: fft, radialPeak: radialPeak };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.HFFFT;
})(typeof globalThis !== 'undefined' ? globalThis : this);
