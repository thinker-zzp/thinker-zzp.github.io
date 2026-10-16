// app.js — Main application logic for markov-text

let model = null;
let graph = null;
let isGenerating = false;
let genTimer = null;
let generatedTokens = [];
let currentContext = [];

// DOM references
const corpusInput = document.getElementById('corpus-text');
const presetSelect = document.getElementById('preset-select');
const orderInput = document.getElementById('param-order');
const orderVal = document.getElementById('val-order');
const tokenModeSelect = document.getElementById('param-mode');
const tempInput = document.getElementById('param-temp');
const tempVal = document.getElementById('val-temp');
const stratSelect = document.getElementById('param-strategy');
const topkGroup = document.getElementById('group-topk');
const topkInput = document.getElementById('param-topk');
const topkVal = document.getElementById('val-topk');
const toppGroup = document.getElementById('group-topp');
const toppInput = document.getElementById('param-topp');
const toppVal = document.getElementById('val-topp');
const speedInput = document.getElementById('param-speed');
const speedVal = document.getElementById('val-speed');

const btnGenerate = document.getElementById('btn-generate');
const btnStep = document.getElementById('btn-step');
const btnClear = document.getElementById('btn-clear');
const btnTrain = document.getElementById('btn-train');

const outputArea = document.getElementById('output-tokens');
const graphCanvas = document.getElementById('graph-canvas');

const statTokens = document.getElementById('stat-tokens');
const statVocab = document.getElementById('stat-vocab');
const statPerplexity = document.getElementById('stat-perplexity');
const statEntropy = document.getElementById('stat-entropy');

const probeInput = document.getElementById('probe-input');
const probeTable = document.getElementById('probe-tbody');

// Initialize
function init() {
  graph = new MarkovGraph(graphCanvas);
  window.addEventListener('resize', () => {
    graph.resize();
    graph.render();
  });

  // Load default preset
  loadPreset('search_poem');

  bindEvents();
  trainModel();
  graph.resize();
  graph.render();
}

function loadPreset(key) {
  const p = CORPUS_PRESETS[key];
  if (!p) return;
  corpusInput.value = p.text;
  if (p.lang === 'zh') {
    tokenModeSelect.value = 'char';
  } else {
    tokenModeSelect.value = 'word';
  }
}

function trainModel() {
  const n = parseInt(orderInput.value, 10);
  const mode = tokenModeSelect.value;
  model = new NGramModel({ n, mode });
  model.train(corpusInput.value);

  // Update stats
  statTokens.textContent = model.tokenCount;
  statVocab.textContent = model.vocab.size;

  const evalRes = model.evaluateSequence(corpusInput.value);
  statPerplexity.textContent = evalRes.perplexity.toFixed(2);
  statEntropy.textContent = evalRes.entropy.toFixed(2) + ' bits';

  updateProbe();
}

function bindEvents() {
  presetSelect.addEventListener('change', () => {
    loadPreset(presetSelect.value);
    trainModel();
    clearOutput();
  });

  btnTrain.addEventListener('click', () => {
    trainModel();
  });

  orderInput.addEventListener('input', () => {
    orderVal.textContent = orderInput.value;
    trainModel();
  });

  tokenModeSelect.addEventListener('change', () => {
    trainModel();
    clearOutput();
  });

  tempInput.addEventListener('input', () => {
    tempVal.textContent = parseFloat(tempInput.value).toFixed(2);
  });

  speedInput.addEventListener('input', () => {
    speedVal.textContent = speedInput.value;
    if (isGenerating) {
      stopGeneration();
      startGeneration();
    }
  });

  topkInput.addEventListener('input', () => {
    topkVal.textContent = topkInput.value;
  });

  toppInput.addEventListener('input', () => {
    toppVal.textContent = parseFloat(toppInput.value).toFixed(2);
  });

  stratSelect.addEventListener('change', () => {
    const strat = stratSelect.value;
    topkGroup.classList.toggle('hidden', strat !== 'top_k');
    toppGroup.classList.toggle('hidden', strat !== 'top_p');
  });

  btnGenerate.addEventListener('click', () => {
    if (isGenerating) {
      stopGeneration();
    } else {
      startGeneration();
    }
  });

  btnStep.addEventListener('click', () => {
    stopGeneration();
    stepOnce();
  });

  btnClear.addEventListener('click', () => {
    clearOutput();
  });

  probeInput.addEventListener('input', () => {
    updateProbe();
  });

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') {
      e.preventDefault();
      btnGenerate.click();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      btnStep.click();
    }
  });
}

function clearOutput() {
  stopGeneration();
  generatedTokens = [];
  currentContext = [];
  outputArea.innerHTML = '<span class="placeholder-text">Generated tokens will appear here...</span>';
  graph.update([], [], null);
}

function stepOnce() {
  if (!model || model.tokenCount === 0) return;

  // If start of generation, pick a seed context from corpus if currentContext is empty
  if (currentContext.length === 0) {
    const sampleContextLen = Math.max(1, model.n - 1);
    const corpusTokens = model.tokenize(corpusInput.value);
    if (corpusTokens.length > sampleContextLen) {
      const startIdx = Math.floor(Math.random() * (corpusTokens.length - sampleContextLen));
      currentContext = corpusTokens.slice(startIdx, startIdx + sampleContextLen);
      for (const tok of currentContext) {
        appendTokenBadge(tok, 1.0, 0, model.n);
      }
    }
  }

  const sampleOpts = {
    strategy: stratSelect.value,
    temperature: parseFloat(tempInput.value),
    topK: parseInt(topkInput.value, 10),
    topP: parseFloat(toppInput.value),
    smoothing: 'mle'
  };

  const result = model.sampleNextToken(currentContext, sampleOpts);
  if (!result || !result.token) return;

  // Append token to output
  appendTokenBadge(result.token, result.prob, result.surprisal, result.orderUsed, result.candidates);

  // Update Markov graph visualization
  graph.update(result.prefix, result.candidates, result.token);

  // Update current context
  currentContext.push(result.token);
  if (currentContext.length > model.n - 1) {
    currentContext.shift();
  }
}

function appendTokenBadge(token, prob, surprisal, orderUsed, candidates = []) {
  if (outputArea.querySelector('.placeholder-text')) {
    outputArea.innerHTML = '';
  }

  const badge = document.createElement('span');
  badge.className = 'tok-badge';

  // Confidence color coding
  if (prob >= 0.5) {
    badge.classList.add('tok-high');
  } else if (prob >= 0.15) {
    badge.classList.add('tok-med');
  } else {
    badge.classList.add('tok-low');
  }

  if (token === '\n') {
    badge.innerHTML = '↵<br/>';
    badge.classList.add('tok-newline');
  } else {
    badge.textContent = token;
  }

  // Tooltip with statistics
  const candList = candidates.slice(0, 4)
    .map(c => `${c.token === '\n' ? '↵' : c.token} (${(c.prob * 100).toFixed(0)}%)`)
    .join(', ');

  badge.title = `P(token) = ${(prob * 100).toFixed(1)}%\nSurprisal = ${surprisal.toFixed(2)} bits\nOrder used = ${orderUsed}-gram\nAlternatives: ${candList || 'none'}`;

  badge.addEventListener('click', () => {
    // Clicking badge sets probe to this token
    probeInput.value = token;
    updateProbe();
  });

  outputArea.appendChild(badge);
  outputArea.scrollTop = outputArea.scrollHeight;
  generatedTokens.push(token);
}

function startGeneration() {
  isGenerating = true;
  btnGenerate.textContent = '⏸ Pause';
  btnGenerate.classList.add('is-running');

  const intervalMs = Math.max(30, Math.floor(1000 / parseInt(speedInput.value, 10)));
  genTimer = setInterval(() => {
    stepOnce();
  }, intervalMs);
}

function stopGeneration() {
  isGenerating = false;
  btnGenerate.textContent = '▶ Generate';
  btnGenerate.classList.remove('is-running');
  if (genTimer) {
    clearInterval(genTimer);
    genTimer = null;
  }
}

function updateProbe() {
  if (!model) return;
  const rawText = probeInput.value;
  const probeTokens = model.tokenize(rawText);
  const dist = model.getNextDistribution(probeTokens, { smoothing: 'mle' });

  // Update probe table
  probeTable.innerHTML = '';
  const topCands = dist.candidates.slice(0, 6);

  if (topCands.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="4" style="text-align:center;color:var(--muted)">No transitions found</td>`;
    probeTable.appendChild(row);
  } else {
    for (const c of topCands) {
      const row = document.createElement('tr');
      const pct = (c.prob * 100).toFixed(1);
      const displayTok = (c.token === '\n' ? '↵ [newline]' : c.token).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
      row.innerHTML = `
        <td><code>${displayTok}</code></td>
        <td>${pct}%</td>
        <td>${c.surprisal.toFixed(2)}</td>
        <td>
          <div class="prob-bar-track">
            <div class="prob-bar-fill" style="width: ${pct}%"></div>
          </div>
        </td>
      `;
      probeTable.appendChild(row);
    }
  }

  // Also reflect in graph if not running
  if (!isGenerating) {
    graph.update(dist.prefix, topCands, topCands.length > 0 ? topCands[0].token : null);
  }
}

window.addEventListener('load', init);
