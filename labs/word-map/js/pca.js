// pca.js — Dimensionality reduction: PCA and Custom Semantic Axes

class SemanticProjector {
  /**
   * Run PCA on a dictionary of word vectors
   * @param {Object.<string, number[]>} vocabMap
   * @returns {Object.<string, {x: number, y: number}>}
   */
  static runPCA(vocabMap) {
    const words = Object.keys(vocabMap);
    const N = words.length;
    if (N === 0) return {};
    const D = vocabMap[words[0]].length;

    // 1. Calculate Mean Vector
    const mean = new Array(D).fill(0);
    for (const w of words) {
      const v = vocabMap[w];
      for (let j = 0; j < D; j++) mean[j] += v[j];
    }
    for (let j = 0; j < D; j++) mean[j] /= N;

    // 2. Center Data
    const centered = {};
    for (const w of words) {
      centered[w] = vocabMap[w].map((x, j) => x - mean[j]);
    }

    // 3. Compute D x D Covariance Matrix
    const cov = Array.from({ length: D }, () => new Float64Array(D));
    for (const w of words) {
      const v = centered[w];
      for (let i = 0; i < D; i++) {
        for (let j = 0; j < D; j++) {
          cov[i][j] += v[i] * v[j];
        }
      }
    }
    for (let i = 0; i < D; i++) {
      for (let j = 0; j < D; j++) {
        cov[i][j] /= (N - 1 || 1);
      }
    }

    // 4. Power Iteration to extract PC1
    let pc1 = SemanticProjector._powerIteration(cov, D, 60);

    // Deflate Covariance Matrix to find PC2 orthogonal to PC1
    const covDeflated = Array.from({ length: D }, () => new Float64Array(D));
    const lambda1 = SemanticProjector._rayleighQuotient(cov, pc1);
    for (let i = 0; i < D; i++) {
      for (let j = 0; j < D; j++) {
        covDeflated[i][j] = cov[i][j] - lambda1 * pc1[i] * pc1[j];
      }
    }

    // Power Iteration to extract PC2
    let pc2 = SemanticProjector._powerIteration(covDeflated, D, 60);

    // Ensure orthogonality
    pc2 = VectorMath.normalize(VectorMath.sub(pc2, VectorMath.scale(pc1, VectorMath.dot(pc2, pc1))));

    // 5. Project all vectors onto PC1 and PC2
    const coords = {};
    let maxX = 0, maxY = 0;
    for (const w of words) {
      const v = centered[w];
      const x = VectorMath.dot(v, pc1);
      const y = VectorMath.dot(v, pc2);
      coords[w] = { x, y };
      if (Math.abs(x) > maxX) maxX = Math.abs(x);
      if (Math.abs(y) > maxY) maxY = Math.abs(y);
    }

    // Normalize coordinates to [-1, 1] range
    const scaleX = maxX > 0 ? 1 / maxX : 1;
    const scaleY = maxY > 0 ? 1 / maxY : 1;
    for (const w of words) {
      coords[w].x *= scaleX * 0.88;
      coords[w].y *= scaleY * 0.88;
    }

    return coords;
  }

  /**
   * Project vectors onto two custom semantic difference axes (e.g. X: woman - man, Y: king - man)
   */
  static runCustomAxes(vocabMap, axisXPositive, axisXNegative, axisYPositive, axisYNegative) {
    const vXPos = vocabMap[axisXPositive];
    const vXNeg = vocabMap[axisXNegative];
    const vYPos = vocabMap[axisYPositive];
    const vYNeg = vocabMap[axisYNegative];

    if (!vXPos || !vXNeg || !vYPos || !vYNeg) {
      return SemanticProjector.runPCA(vocabMap);
    }

    // X axis: pos - neg
    let axisX = VectorMath.normalize(VectorMath.sub(vXPos, vXNeg));

    // Y axis: pos - neg, orthogonalized against X (Gram-Schmidt)
    let rawY = VectorMath.sub(vYPos, vYNeg);
    let proj = VectorMath.scale(axisX, VectorMath.dot(rawY, axisX));
    let axisY = VectorMath.normalize(VectorMath.sub(rawY, proj));

    const coords = {};
    let maxX = 0, maxY = 0;

    for (const [w, v] of Object.entries(vocabMap)) {
      const x = VectorMath.dot(v, axisX);
      const y = VectorMath.dot(v, axisY);
      coords[w] = { x, y };
      if (Math.abs(x) > maxX) maxX = Math.abs(x);
      if (Math.abs(y) > maxY) maxY = Math.abs(y);
    }

    const scaleX = maxX > 0 ? 1 / maxX : 1;
    const scaleY = maxY > 0 ? 1 / maxY : 1;
    for (const w of Object.keys(coords)) {
      coords[w].x *= scaleX * 0.88;
      coords[w].y *= scaleY * 0.88;
    }

    return coords;
  }

  static _powerIteration(mat, D, maxIter = 50) {
    let b = Array.from({ length: D }, () => Math.random() - 0.5);
    b = VectorMath.normalize(b);

    for (let it = 0; it < maxIter; it++) {
      const nextB = new Float64Array(D);
      for (let i = 0; i < D; i++) {
        let s = 0;
        for (let j = 0; j < D; j++) s += mat[i][j] * b[j];
        nextB[i] = s;
      }
      const norm = VectorMath.norm(nextB);
      if (norm === 0) break;
      for (let i = 0; i < D; i++) b[i] = nextB[i] / norm;
    }
    return Array.from(b);
  }

  static _rayleighQuotient(mat, v) {
    let num = 0, den = 0;
    const D = v.length;
    for (let i = 0; i < D; i++) {
      let s = 0;
      for (let j = 0; j < D; j++) s += mat[i][j] * v[j];
      num += v[i] * s;
      den += v[i] * v[i];
    }
    return den === 0 ? 0 : num / den;
  }
}
