// model.js — N-gram Language Model with backoff & modern sampling

class NGramModel {
  /**
   * @param {object} options { n: number, mode: 'word'|'char' }
   */
  constructor(options = {}) {
    this.n = options.n ?? 3;
    this.mode = options.mode ?? 'word';
    this.vocab = new Set();
    this.vocabList = [];
    this.tokenCount = 0;

    // countsByOrder[order][prefixKey] = { [nextTok]: count, _total: totalCount }
    this.countsByOrder = [];
    for (let i = 1; i <= 5; i++) {
      this.countsByOrder[i] = new Map();
    }
    this.unigramCounts = new Map();
  }

  /** Tokenize input string based on selected mode */
  tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    if (this.mode === 'char') {
      return Array.from(text);
    }

    // Word mode: splits into words, punctuation, and explicit newlines
    // Supports English words, Chinese characters/words, numbers, punctuation
    const tokens = [];
    const regex = /[\u4e00-\u9fa5]|[\w']+|[^\s\w\u4e00-\u9fa5]|\n/gu;
    let match;
    while ((match = regex.exec(text)) !== null) {
      tokens.push(match[0]);
    }
    return tokens;
  }

  /** Detokenize tokens back to readable text */
  detokenize(tokens) {
    if (this.mode === 'char') {
      return tokens.join('');
    }
    let res = '';
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok === '\n') {
        res += '\n';
        continue;
      }
      const isChinese = /[\u4e00-\u9fa5]/.test(tok);
      const isPunct = /^[.,!?;:'"）】》、，。？！；：“”‘’]$/.test(tok);
      const prevTok = i > 0 ? tokens[i - 1] : null;
      const prevIsChinese = prevTok && /[\u4e00-\u9fa5]/.test(prevTok);

      if (i === 0 || res.endsWith('\n') || isPunct || isChinese || prevIsChinese) {
        res += tok;
      } else {
        res += ' ' + tok;
      }
    }
    return res;
  }

  /** Train the model on raw text */
  train(text) {
    const tokens = this.tokenize(text);
    this.tokenCount = tokens.length;
    this.vocab.clear();
    this.unigramCounts.clear();

    for (let i = 1; i <= 5; i++) {
      this.countsByOrder[i].clear();
    }

    if (tokens.length === 0) return;

    for (const tok of tokens) {
      this.vocab.add(tok);
      this.unigramCounts.set(tok, (this.unigramCounts.get(tok) || 0) + 1);
    }
    this.vocabList = Array.from(this.vocab);

    // Build n-gram counts for all orders up to this.n
    for (let order = 1; order <= this.n; order++) {
      const orderMap = this.countsByOrder[order];
      const contextLen = order - 1;

      for (let i = contextLen; i < tokens.length; i++) {
        const nextTok = tokens[i];
        const prefix = tokens.slice(i - contextLen, i);
        const prefixKey = this._makeKey(prefix);

        let table = orderMap.get(prefixKey);
        if (!table) {
          table = { _total: 0 };
          orderMap.set(prefixKey, table);
        }
        table[nextTok] = (table[nextTok] || 0) + 1;
        table._total++;
      }
    }
  }

  _makeKey(tokens) {
    return tokens.join('\u001f');
  }

  /**
   * Get candidate next-token distribution given context tokens.
   * Employs Katz/Stupid backoff if highest-order context is unseen.
   */
  getNextDistribution(contextTokens, options = {}) {
    const smoothing = options.smoothing ?? 'laplace'; // 'mle' | 'laplace'
    const alpha = options.alpha ?? 0.1;
    const V = Math.max(1, this.vocab.size);

    // Try from current this.n down to 1
    let effectiveOrder = Math.min(this.n, contextTokens.length + 1);
    let matchedTable = null;
    let actualPrefix = [];

    while (effectiveOrder >= 1) {
      const contextLen = effectiveOrder - 1;
      const prefix = contextTokens.slice(contextTokens.length - contextLen);
      const prefixKey = this._makeKey(prefix);
      const table = this.countsByOrder[effectiveOrder].get(prefixKey);

      if (table && table._total > 0) {
        matchedTable = table;
        actualPrefix = prefix;
        break;
      }
      effectiveOrder--;
    }

    const distribution = [];

    if (!matchedTable) {
      // Fallback to unigram distribution
      const total = this.tokenCount || 1;
      for (const [tok, count] of this.unigramCounts.entries()) {
        const prob = count / total;
        distribution.push({
          token: tok,
          count,
          prob,
          surprisal: -Math.log2(Math.max(1e-12, prob)),
          orderUsed: 0
        });
      }
    } else {
      const total = matchedTable._total;
      const seenTokens = Object.keys(matchedTable).filter(k => k !== '_total');

      if (smoothing === 'mle') {
        for (const tok of seenTokens) {
          const count = matchedTable[tok];
          const prob = count / total;
          distribution.push({
            token: tok,
            count,
            prob,
            surprisal: -Math.log2(Math.max(1e-12, prob)),
            orderUsed: effectiveOrder
          });
        }
      } else {
        // Laplace / additive smoothing
        const denom = total + alpha * V;
        for (const tok of seenTokens) {
          const count = matchedTable[tok];
          const prob = (count + alpha) / denom;
          distribution.push({
            token: tok,
            count,
            prob,
            surprisal: -Math.log2(Math.max(1e-12, prob)),
            orderUsed: effectiveOrder
          });
        }
      }
    }

    // Sort descending by probability
    distribution.sort((a, b) => b.prob - a.prob);

    // Normalize probabilities so sum = 1
    const sumP = distribution.reduce((acc, d) => acc + d.prob, 0);
    if (sumP > 0) {
      for (const d of distribution) d.prob /= sumP;
    }

    return {
      prefix: actualPrefix,
      orderUsed: effectiveOrder,
      candidates: distribution
    };
  }

  /**
   * Sample the next token using modern decoding strategies:
   * - greedy: argmax
   * - temperature: P_i proportional to (P_i)^(1/T)
   * - top_k: truncate to top K candidates before sampling
   * - top_p: nucleus sampling, truncate to smallest set with cumsum >= p
   */
  sampleNextToken(contextTokens, sampleOpts = {}) {
    const { strategy = 'temperature', temperature = 0.8, topK = 40, topP = 0.9, smoothing = 'mle' } = sampleOpts;
    const { candidates, orderUsed, prefix } = this.getNextDistribution(contextTokens, { smoothing });

    if (candidates.length === 0) {
      return { token: '', prob: 0, surprisal: 0, orderUsed: 0, candidates: [] };
    }

    // 1. Greedy
    if (strategy === 'greedy' || temperature <= 0.01) {
      const best = candidates[0];
      return { ...best, prefix, candidates: candidates.slice(0, 10) };
    }

    // 2. Filter candidates (Top-K / Top-P)
    let filtered = [...candidates];

    if (strategy === 'top_k' && topK > 0) {
      filtered = filtered.slice(0, Math.min(topK, filtered.length));
    } else if (strategy === 'top_p' && topP > 0 && topP < 1.0) {
      let cumsum = 0;
      const nucleus = [];
      for (const c of filtered) {
        nucleus.push(c);
        cumsum += c.prob;
        if (cumsum >= topP) break;
      }
      filtered = nucleus;
    }

    // 3. Apply Temperature
    const T = Math.max(0.05, temperature);
    const logits = filtered.map(c => Math.log(Math.max(1e-12, c.prob)) / T);
    const maxLogit = Math.max(...logits);
    const exps = logits.map(l => Math.exp(l - maxLogit));
    const expSum = exps.reduce((a, b) => a + b, 0);
    const adjustedProbs = exps.map(e => e / expSum);

    // 4. Roulette Wheel Selection
    const r = Math.random();
    let acc = 0;
    let chosenIdx = filtered.length - 1;
    for (let i = 0; i < filtered.length; i++) {
      acc += adjustedProbs[i];
      if (r <= acc) {
        chosenIdx = i;
        break;
      }
    }

    const chosen = filtered[chosenIdx];
    return {
      token: chosen.token,
      count: chosen.count,
      prob: chosen.prob,
      sampledProb: adjustedProbs[chosenIdx],
      surprisal: chosen.surprisal,
      orderUsed,
      prefix,
      candidates: candidates.slice(0, 8)
    };
  }

  /** Calculate entropy and perplexity for a given text */
  evaluateSequence(text) {
    const tokens = this.tokenize(text);
    if (tokens.length <= 1) return { entropy: 0, perplexity: 1, count: tokens.length };

    let totalLogP = 0;
    let counted = 0;

    for (let i = 1; i < tokens.length; i++) {
      const ctx = tokens.slice(Math.max(0, i - (this.n - 1)), i);
      const target = tokens[i];
      const dist = this.getNextDistribution(ctx, { smoothing: 'laplace', alpha: 0.05 });
      const match = dist.candidates.find(c => c.token === target);
      const p = match ? match.prob : (1e-6);
      totalLogP += Math.log2(p);
      counted++;
    }

    const avgNegLogP = counted > 0 ? -totalLogP / counted : 0;
    return {
      entropy: avgNegLogP,
      perplexity: Math.pow(2, avgNegLogP),
      count: tokens.length
    };
  }
}
