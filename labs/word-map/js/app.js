// app.js — Main UI controller for word-map

let wordCanvas = null;
let currentCoords = {};

const ANALOGY_PRESETS = [
  { label: "king - man + woman = queen", a: "king", b: "man", c: "woman" },
  { label: "paris - france + china = beijing", a: "paris", b: "france", c: "china" },
  { label: "puppy - dog + cat = kitten", a: "puppy", b: "dog", c: "cat" },
  { label: "emperor - man + woman = empress", a: "emperor", b: "man", c: "woman" },
  { label: "berlin - germany + italy = rome", a: "berlin", b: "germany", c: "italy" },
  { label: "happy - joy + fear = angry", a: "happy", b: "joyful", c: "fear" }
];

// DOM references
const canvasEl = document.getElementById('map-canvas');
const projModeSelect = document.getElementById('proj-mode');
const customAxesGroup = document.getElementById('custom-axes-group');
const axisXPos = document.getElementById('axis-x-pos');
const axisXNeg = document.getElementById('axis-x-neg');
const axisYPos = document.getElementById('axis-y-pos');
const axisYNeg = document.getElementById('axis-y-neg');

const analogyPresetSelect = document.getElementById('analogy-preset');
const inputA = document.getElementById('input-a');
const inputB = document.getElementById('input-b');
const inputC = document.getElementById('input-c');
const btnComputeAnalogy = document.getElementById('btn-compute-analogy');
const analogyResultTable = document.getElementById('analogy-tbody');

const searchInput = document.getElementById('word-search');
const btnResetView = document.getElementById('btn-reset-view');

const inspectorWord = document.getElementById('inspector-word');
const inspectorCat = document.getElementById('inspector-cat');
const inspectorTable = document.getElementById('inspector-tbody');
const categoryToggles = document.getElementById('category-toggles');

function init() {
  wordCanvas = new WordMapCanvas(canvasEl);
  window.addEventListener('resize', () => {
    wordCanvas.resize();
  });

  populateWordSelects();
  renderCategoryToggles();
  bindEvents();

  // Initial Projection
  recalculateProjection();
  wordCanvas.resize();

  // Run first analogy preset
  loadAnalogyPreset(0);

  // Select "king" by default in inspector
  inspectWord("king");
}

function populateWordSelects() {
  const words = Object.keys(VOCAB_VECTORS).sort();
  [axisXPos, axisXNeg, axisYPos, axisYNeg, inputA, inputB, inputC].forEach(sel => {
    sel.innerHTML = '';
    for (const w of words) {
      const opt = document.createElement('option');
      opt.value = w;
      opt.textContent = w;
      sel.appendChild(opt);
    }
  });

  // Defaults for custom axes
  axisXPos.value = "woman";
  axisXNeg.value = "man";
  axisYPos.value = "king";
  axisYNeg.value = "man";

  // Analogy presets dropdown
  analogyPresetSelect.innerHTML = '';
  ANALOGY_PRESETS.forEach((p, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = p.label;
    analogyPresetSelect.appendChild(opt);
  });
}

function renderCategoryToggles() {
  categoryToggles.innerHTML = '';
  for (const [key, data] of Object.entries(CATEGORIES)) {
    const label = document.createElement('label');
    label.className = 'cat-checkbox';
    label.innerHTML = `
      <input type="checkbox" value="${key}" checked />
      <span class="cat-dot" style="background:${data.color}"></span>
      <span>${data.name}</span>
    `;
    label.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) {
        wordCanvas.filterCategories.add(key);
      } else {
        wordCanvas.filterCategories.delete(key);
      }
      wordCanvas.render();
    });
    categoryToggles.appendChild(label);
  }
}

function recalculateProjection() {
  const mode = projModeSelect.value;
  if (mode === 'pca') {
    currentCoords = SemanticProjector.runPCA(VOCAB_VECTORS);
  } else {
    currentCoords = SemanticProjector.runCustomAxes(
      VOCAB_VECTORS,
      axisXPos.value, axisXNeg.value,
      axisYPos.value, axisYNeg.value
    );
  }
  wordCanvas.setCoords(currentCoords);
}

function bindEvents() {
  projModeSelect.addEventListener('change', () => {
    const isCustom = projModeSelect.value === 'custom';
    customAxesGroup.classList.toggle('hidden', !isCustom);
    recalculateProjection();
  });

  [axisXPos, axisXNeg, axisYPos, axisYNeg].forEach(sel => {
    sel.addEventListener('change', () => {
      if (projModeSelect.value === 'custom') recalculateProjection();
    });
  });

  analogyPresetSelect.addEventListener('change', () => {
    const idx = parseInt(analogyPresetSelect.value, 10);
    loadAnalogyPreset(idx);
  });

  btnComputeAnalogy.addEventListener('click', () => {
    runAnalogyComputation();
  });

  btnResetView.addEventListener('click', () => {
    wordCanvas.resetView();
  });

  searchInput.addEventListener('input', () => {
    const term = searchInput.value.trim().toLowerCase();
    if (VOCAB_VECTORS[term]) {
      wordCanvas.setSearchWord(term);
      inspectWord(term);
    } else {
      wordCanvas.setSearchWord(null);
    }
  });

  wordCanvas.onWordClick = (word) => {
    inspectWord(word);
  };
}

function loadAnalogyPreset(idx) {
  const p = ANALOGY_PRESETS[idx];
  if (!p) return;
  inputA.value = p.a;
  inputB.value = p.b;
  inputC.value = p.c;
  runAnalogyComputation();
}

function runAnalogyComputation() {
  const a = inputA.value;
  const b = inputB.value;
  const c = inputC.value;

  const vA = VOCAB_VECTORS[a];
  const vB = VOCAB_VECTORS[b];
  const vC = VOCAB_VECTORS[c];

  if (!vA || !vB || !vC) return;

  // vTarget = vA - vB + vC
  const vDiff = VectorMath.sub(vA, vB);
  const vTarget = VectorMath.add(vDiff, vC);

  // Exclude inputs a, b, c from ranking to find the analogical completion
  const neighbors = VectorMath.findNearest(vTarget, VOCAB_VECTORS, 5, [a, b, c]);
  const bestResult = neighbors.length > 0 ? neighbors[0].word : null;

  // Render Table
  analogyResultTable.innerHTML = '';
  neighbors.forEach((n, idx) => {
    const row = document.createElement('tr');
    if (idx === 0) row.className = 'top-match';
    const pct = (n.similarity * 100).toFixed(1);
    row.innerHTML = `
      <td><strong>${n.word}</strong></td>
      <td>${n.similarity.toFixed(3)}</td>
      <td>
        <div class="sim-bar-track">
          <div class="sim-bar-fill" style="width: ${pct}%"></div>
        </div>
      </td>
    `;
    row.addEventListener('click', () => inspectWord(n.word));
    analogyResultTable.appendChild(row);
  });

  // Update Canvas Parallelogram
  wordCanvas.setAnalogy({ a, b, c, result: bestResult, neighbors });
}

function inspectWord(word) {
  if (!VOCAB_VECTORS[word]) return;
  wordCanvas.setSelectedWord(word);

  inspectorWord.textContent = word;
  const data = WORD_EMBEDDINGS[word];
  const cat = data ? CATEGORIES[data.category] : null;
  inspectorCat.textContent = cat ? cat.name : "Word";
  inspectorCat.style.color = cat ? cat.color : "inherit";

  const neighbors = VectorMath.findNearest(VOCAB_VECTORS[word], VOCAB_VECTORS, 6, [word]);
  inspectorTable.innerHTML = '';

  neighbors.forEach(n => {
    const row = document.createElement('tr');
    const pct = (n.similarity * 100).toFixed(1);
    row.innerHTML = `
      <td><a href="#" class="neighbor-link">${n.word}</a></td>
      <td>${n.similarity.toFixed(3)}</td>
      <td>
        <div class="sim-bar-track">
          <div class="sim-bar-fill" style="width: ${pct}%"></div>
        </div>
      </td>
    `;
    row.querySelector('.neighbor-link').addEventListener('click', (e) => {
      e.preventDefault();
      inspectWord(n.word);
    });
    inspectorTable.appendChild(row);
  });
}

window.addEventListener('load', init);
