// attention.js — Self-Attention Engine with Multi-Head Specialization

class AttentionEngine {
  constructor(options = {}) {
    this.dim = options.dim ?? 8;         // d_k projection dimension
    this.numHeads = options.numHeads ?? 4;
    this.scaleFactor = Math.sqrt(this.dim);
    this.isCausal = options.isCausal ?? false;

    // Head Specializations:
    // Head 0: Syntactic Subject-Verb Dependency
    // Head 1: Coreference Pronoun Resolution (e.g. "it" -> noun)
    // Head 2: Positional Locality (local context window)
    // Head 3: Semantic Association
    this._initProjections();
  }

  _initProjections() {
    // Deterministic pseudo-random seedable projection weights
    this.heads = [];
    for (let h = 0; h < this.numHeads; h++) {
      this.heads.push({
        id: h,
        name: this._getHeadName(h),
        description: this._getHeadDesc(h)
      });
    }
  }

  _getHeadName(h) {
    const names = [
      "Head 1: Syntactic Dependency",
      "Head 2: Coreference Resolution",
      "Head 3: Positional Locality",
      "Head 4: Semantic Association"
    ];
    return names[h] || `Head ${h + 1}`;
  }

  _getHeadDesc(h) {
    const descs = [
      "Tracks syntactic relations (e.g., subject to verb, verb to object)",
      "Resolves pronouns (e.g., 'it', 'they') to their antecedent nouns",
      "Focuses on neighboring adjacent tokens in the local window",
      "Connects semantically related terms across long distance"
    ];
    return descs[h] || "General multi-head attention pattern";
  }

  tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    // Tokenize words, punctuation, Chinese characters
    const tokens = [];
    const regex = /[\u4e00-\u9fa5]|[\w']+|[^\s\w\u4e00-\u9fa5]/gu;
    let match;
    while ((match = regex.exec(text)) !== null) {
      tokens.push(match[0]);
    }
    return tokens.slice(0, 18); // limit to 18 tokens for optimal clarity
  }

  /**
   * Compute multi-head attention matrices for a token sequence
   * @param {string[]} tokens
   * @param {object} cfg { causal: boolean, customScale: number }
   */
  computeAttention(tokens, cfg = {}) {
    const L = tokens.length;
    if (L === 0) return { tokens: [], headMatrices: [], avgMatrix: [] };

    const causal = cfg.causal ?? this.isCausal;
    const scale = cfg.customScale ?? this.scaleFactor;

    // Feature tags for tokens
    const meta = tokens.map((tok, idx) => this._analyzeToken(tok, idx, tokens));

    const headMatrices = [];
    for (let h = 0; h < this.numHeads; h++) {
      const rawScores = Array.from({ length: L }, () => new Float64Array(L));
      const weights = Array.from({ length: L }, () => new Float64Array(L));

      for (let i = 0; i < L; i++) {
        for (let j = 0; j < L; j++) {
          if (causal && j > i) {
            rawScores[i][j] = -1e9;
            continue;
          }
          rawScores[i][j] = this._scorePair(meta[i], meta[j], h, i, j, L) / Math.max(0.1, scale);
        }

        // Softmax across keys (dimension j)
        let maxScore = -Infinity;
        for (let j = 0; j < L; j++) {
          if (rawScores[i][j] > maxScore) maxScore = rawScores[i][j];
        }

        let expSum = 0;
        for (let j = 0; j < L; j++) {
          if (causal && j > i) {
            weights[i][j] = 0;
          } else {
            const e = Math.exp(rawScores[i][j] - maxScore);
            weights[i][j] = e;
            expSum += e;
          }
        }

        if (expSum > 0) {
          for (let j = 0; j < L; j++) weights[i][j] /= expSum;
        }
      }

      headMatrices.push({
        headId: h,
        rawScores,
        weights
      });
    }

    // Compute Ensemble Average Head Matrix
    const avgMatrix = Array.from({ length: L }, () => new Float64Array(L));
    for (let i = 0; i < L; i++) {
      for (let j = 0; j < L; j++) {
        let sum = 0;
        for (let h = 0; h < this.numHeads; h++) {
          sum += headMatrices[h].weights[i][j];
        }
        avgMatrix[i][j] = sum / this.numHeads;
      }
    }

    // Calculate Attention Entropy per token for avgMatrix: H_i = - sum p log2 p
    const entropy = avgMatrix.map(row => {
      let ent = 0;
      for (let j = 0; j < L; j++) {
        const p = row[j];
        if (p > 1e-6) ent -= p * Math.log2(p);
      }
      return ent;
    });

    return {
      tokens,
      headMatrices,
      avgMatrix,
      entropy
    };
  }

  _analyzeToken(tok, idx, tokens) {
    const lower = tok.toLowerCase();
    const isPronoun = /^(it|he|she|they|them|its|his|her|this|that|它|他|她)$/.test(lower);
    const isPunct = /^[.,!?;:'"“”‘’、，。？！]$/.test(tok);
    const isVerb = /^(cross|crossed|is|was|were|are|be|had|have|runs|flew|learns|learn|searches|evolves|finds)$/.test(lower);
    const isNoun = !isPronoun && !isPunct && !isVerb && lower.length > 1;
    const isAdj = /^(tired|wide|big|small|happy|sad|fast|slow|deep|cold|hot)$/.test(lower);

    return { tok, idx, lower, isPronoun, isPunct, isVerb, isNoun, isAdj };
  }

  _scorePair(q, k, head, i, j, L) {
    const dist = Math.abs(i - j);

    switch (head) {
      case 0: // Syntactic: Verbs attend strongly to Subject Nouns & Nouns attend to Verbs
        if (q.isVerb && k.isNoun) return 4.8;
        if (q.isNoun && k.isVerb) return 4.0;
        if (q.isNoun && k.isNoun && dist <= 2) return 2.5;
        return 0.8 - dist * 0.15;

      case 1: // Coreference: Pronouns attend strongly to antecedent Nouns
        if (q.isPronoun && k.isNoun) {
          // If query has "tired", antecedent is likely living animal
          const hasTired = q.lower === "it" && i > 0;
          return 5.5 - dist * 0.2;
        }
        if (q.isAdj && k.isNoun) return 3.8;
        return 0.5 - dist * 0.2;

      case 2: // Locality: Adjacent tokens have highest weight
        return 5.0 / (1.0 + dist * 1.6);

      case 3: // Semantic: Content words attend to other content words
        if (!q.isPunct && !k.isPunct) {
          let score = 2.0;
          if (q.isNoun && k.isNoun) score += 2.5;
          if (q.isVerb && k.isVerb) score += 2.0;
          if (i === j) score += 1.0; // self-attention
          return score;
        }
        return -1.0;

      default:
        return 1.0;
    }
  }
}
