// app.js — Main UI controller for attention-viz

let engine = null;
let flowCanvas = null;
let heatmapCanvas = null;
let currentAttentionData = null;
let activeHeadIdx = 0; // 0..3 for heads, -1 for ensemble average

const PRESET_SENTENCES = [
  { label: "Winograd: 'it' -> animal (tired)", text: "The animal didn't cross the street because it was too tired" },
  { label: "Winograd: 'it' -> street (wide)", text: "The animal didn't cross the street because it was too wide" },
  { label: "Reinforcement Learning & Search", text: "The agent searches the state space to find the optimal policy" },
  { label: "Shakespeare: Sonnet 18", text: "Shall I compare thee to a summer day" },
  { label: "Chinese: 强化学习与搜索", text: "智能体在探索与利用之间寻找最优解" }
];

// DOM references
const presetSelect = document.getElementById('sentence-preset');
const textInput = document.getElementById('sentence-input');
const btnCompute = document.getElementById('btn-compute');
const headSelect = document.getElementById('head-select');
const headDesc = document.getElementById('head-desc');
const causalCheck = document.getElementById('causal-check');
const scaleSlider = document.getElementById('scale-slider');
const scaleVal = document.getElementById('scale-val');

const flowCanvasEl = document.getElementById('flow-canvas');
const heatmapCanvasEl = document.getElementById('heatmap-canvas');

const inspectorToken = document.getElementById('inspector-token');
const inspectorEntropy = document.getElementById('inspector-entropy');
const inspectorTable = document.getElementById('inspector-tbody');

function init() {
  engine = new AttentionEngine();
  flowCanvas = new AttentionFlowCanvas(flowCanvasEl);
  heatmapCanvas = new AttentionHeatmapCanvas(heatmapCanvasEl);

  window.addEventListener('resize', () => {
    flowCanvas.resize();
    heatmapCanvas.resize();
  });

  populatePresets();
  bindEvents();

  // Load first preset
  loadPreset(0);
}

function populatePresets() {
  presetSelect.innerHTML = '';
  PRESET_SENTENCES.forEach((p, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = p.label;
    presetSelect.appendChild(opt);
  });
}

function bindEvents() {
  presetSelect.addEventListener('change', () => {
    const idx = parseInt(presetSelect.value, 10);
    loadPreset(idx);
  });

  btnCompute.addEventListener('click', () => {
    recalculateAttention();
  });

  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      recalculateAttention();
    }
  });

  headSelect.addEventListener('change', () => {
    activeHeadIdx = parseInt(headSelect.value, 10);
    updateHeadDescription();
    updateActiveMatrix();
  });

  causalCheck.addEventListener('change', () => {
    recalculateAttention();
  });

  scaleSlider.addEventListener('input', () => {
    scaleVal.textContent = parseFloat(scaleSlider.value).toFixed(2);
    recalculateAttention();
  });

  // Cross-component click sync
  flowCanvas.onSelectToken = (idx) => {
    heatmapCanvas.setSelectedRow(idx);
    inspectToken(idx);
  };

  heatmapCanvas.onSelectToken = (idx) => {
    flowCanvas.setSelectedToken(idx);
    inspectToken(idx);
  };
}

function loadPreset(idx) {
  const p = PRESET_SENTENCES[idx];
  if (!p) return;
  textInput.value = p.text;
  recalculateAttention();
}

function recalculateAttention() {
  const text = textInput.value.trim();
  const tokens = engine.tokenize(text);
  const causal = causalCheck.checked;
  const customScale = parseFloat(scaleSlider.value);

  currentAttentionData = engine.computeAttention(tokens, { causal, customScale });

  flowCanvas.resize();
  heatmapCanvas.resize();

  updateActiveMatrix();

  // Inspect first token or subject token by default
  const defaultIdx = tokens.findIndex(t => /^(it|agent|animal|shall|智能体)$/i.test(t));
  const inspectIdx = defaultIdx >= 0 ? defaultIdx : 0;
  flowCanvas.setSelectedToken(inspectIdx);
  heatmapCanvas.setSelectedRow(inspectIdx);
  inspectToken(inspectIdx);
}

function updateHeadDescription() {
  if (activeHeadIdx === -1) {
    headDesc.innerHTML = "<strong>Ensemble Head Average</strong> — uniform mean across all 4 specialized attention heads.";
  } else {
    const h = engine.heads[activeHeadIdx];
    headDesc.innerHTML = `<strong>${h.name}</strong> — ${h.description}`;
  }
}

function updateActiveMatrix() {
  if (!currentAttentionData) return;
  const { tokens, headMatrices, avgMatrix } = currentAttentionData;

  let mat = null;
  let raw = null;

  if (activeHeadIdx === -1) {
    mat = avgMatrix;
    raw = null;
  } else {
    mat = headMatrices[activeHeadIdx].weights;
    raw = headMatrices[activeHeadIdx].rawScores;
  }

  flowCanvas.setData(tokens, mat);
  heatmapCanvas.setData(tokens, mat, raw);
}

function inspectToken(idx) {
  if (!currentAttentionData || idx < 0 || idx >= currentAttentionData.tokens.length) return;
  const tokens = currentAttentionData.tokens;
  const qTok = tokens[idx];

  inspectorToken.textContent = `Q[${idx}]: "${qTok}"`;
  const ent = currentAttentionData.entropy[idx];
  const isSharp = ent < 1.5;
  inspectorEntropy.innerHTML = `
    <span class="entropy-badge entropy-${isSharp ? 'sharp' : 'diffuse'}">
      ${ent.toFixed(2)} bits · ${isSharp ? 'Sharp Focus' : 'Diffuse'}
    </span>
  `;

  // Get distribution for token idx under current head
  const mat = activeHeadIdx === -1 ? currentAttentionData.avgMatrix : currentAttentionData.headMatrices[activeHeadIdx].weights;
  const weights = mat[idx];

  const pairs = [];
  for (let j = 0; j < tokens.length; j++) {
    pairs.push({ key: tokens[j], idx: j, weight: weights[j] });
  }

  // Sort by weight descending
  pairs.sort((a, b) => b.weight - a.weight);

  inspectorTable.innerHTML = '';
  pairs.slice(0, 6).forEach((p, rank) => {
    const row = document.createElement('tr');
    if (rank === 0) row.className = 'top-attn';
    const pct = (p.weight * 100).toFixed(1);
    row.innerHTML = `
      <td>
        <span class="rank-num">${rank + 1}</span>
        <strong>${p.key}</strong>
        <span class="tok-idx">[${p.idx}]</span>
      </td>
      <td style="font-family:var(--mono);font-size:0.75rem">${pct}%</td>
      <td>
        <div class="attn-bar-track">
          <div class="attn-bar-fill" style="width: ${pct}%"></div>
        </div>
      </td>
    `;
    inspectorTable.appendChild(row);
  });
}

window.addEventListener('load', init);
