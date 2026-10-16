// math.js — Vector algebra & distance metrics

class VectorMath {
  static dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  static norm(a) {
    return Math.sqrt(VectorMath.dot(a, a));
  }

  static normalize(a) {
    const n = VectorMath.norm(a);
    if (n === 0) return [...a];
    return a.map(x => x / n);
  }

  static add(a, b) {
    return a.map((x, i) => x + b[i]);
  }

  static sub(a, b) {
    return a.map((x, i) => x - b[i]);
  }

  static scale(a, s) {
    return a.map(x => x * s);
  }

  static cosineSimilarity(a, b) {
    const na = VectorMath.norm(a);
    const nb = VectorMath.norm(b);
    if (na === 0 || nb === 0) return 0;
    return VectorMath.dot(a, b) / (na * nb);
  }

  static euclideanDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      sum += d * d;
    }
    return Math.sqrt(sum);
  }

  /**
   * Find top K nearest neighbors in a dictionary of vectors
   * @param {number[]} targetVec
   * @param {Object.<string, number[]>} vocabMap
   * @param {number} topK
   * @param {string[]} excludeWords
   */
  static findNearest(targetVec, vocabMap, topK = 6, excludeWords = []) {
    const excludeSet = new Set(excludeWords.map(w => w.toLowerCase()));
    const scores = [];

    for (const [word, vec] of Object.entries(vocabMap)) {
      if (excludeSet.has(word.toLowerCase())) continue;
      const sim = VectorMath.cosineSimilarity(targetVec, vec);
      scores.push({ word, similarity: sim, vector: vec });
    }

    scores.sort((a, b) => b.similarity - a.similarity);
    return scores.slice(0, topK);
  }
}
