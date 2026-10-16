// canvas.js — High-DPI Interactive 2D Semantic Space Canvas with Pan/Zoom & Vector Paths

class WordMapCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.coords = {};         // word -> {x, y}
    this.selectedWord = null;
    this.hoverWord = null;
    this.searchWord = null;
    this.analogyData = null;  // { a, b, c, result, neighbors }
    this.filterCategories = new Set(Object.keys(CATEGORIES));

    // Pan & Zoom transform
    this.scale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };

    this._setupInteraction();
  }

  get logicalW() { return this.canvas.width / this.dpr; }
  get logicalH() { return this.canvas.height / this.dpr; }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();
    const w = Math.floor(rect.width) - 2;
    const h = Math.floor(rect.height) - 2;

    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (this.scale === 1.0) {
      this.resetView();
    } else {
      this.render();
    }
  }

  resetView() {
    this.scale = Math.min(this.logicalW, this.logicalH) * 0.44;
    this.panX = this.logicalW / 2;
    this.panY = this.logicalH / 2;
    this.render();
  }

  setCoords(coords) {
    this.coords = coords;
    this.render();
  }

  setSelectedWord(word) {
    this.selectedWord = word;
    this.render();
  }

  setSearchWord(word) {
    this.searchWord = word;
    this.render();
  }

  setAnalogy(data) {
    this.analogyData = data;
    this.render();
  }

  _setupInteraction() {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.panX = e.clientX - this.dragStart.x;
        this.panY = e.clientY - this.dragStart.y;
        this.render();
      } else {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const hit = this._hitTest(mx, my);
        if (hit !== this.hoverWord) {
          this.hoverWord = hit;
          this.canvas.style.cursor = hit ? 'pointer' : 'default';
          this.render();
        }
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      this.panX = mx - (mx - this.panX) * zoomFactor;
      this.panY = my - (my - this.panY) * zoomFactor;
      this.scale *= zoomFactor;
      this.render();
    });

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const hit = this._hitTest(mx, my);
      if (hit && this.onWordClick) {
        this.onWordClick(hit);
      }
    });
  }

  _toScreen(x, y) {
    return {
      px: this.panX + x * this.scale,
      py: this.panY - y * this.scale // invert Y
    };
  }

  _hitTest(mx, my) {
    for (const [w, pos] of Object.entries(this.coords)) {
      const data = WORD_EMBEDDINGS[w];
      if (data && !this.filterCategories.has(data.category)) continue;

      const { px, py } = this._toScreen(pos.x, pos.y);
      const d2 = (mx - px) ** 2 + (my - py) ** 2;
      if (d2 <= 225) return w; // 15px radius
    }
    return null;
  }

  render() {
    const ctx = this.ctx;
    const W = this.logicalW;
    const H = this.logicalH;
    if (W <= 0 || H <= 0) return;

    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // Warm paper background
    ctx.fillStyle = '#f8f7f3';
    ctx.fillRect(0, 0, W, H);

    // Delicate grid dots
    ctx.fillStyle = 'rgba(215, 212, 204, 0.6)';
    const gridSpacing = 28;
    for (let x = 14; x < W; x += gridSpacing) {
      for (let y = 14; y < H; y += gridSpacing) {
        ctx.fillRect(x, y, 1.2, 1.2);
      }
    }

    // Subtle coordinate origin axes
    ctx.strokeStyle = 'rgba(205, 200, 190, 0.65)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, this.panY); ctx.lineTo(W, this.panY);
    ctx.moveTo(this.panX, 0); ctx.lineTo(this.panX, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── 1. Draw Analogy Parallelogram Lines ─────────────────────────────
    if (this.analogyData) {
      const { a, b, c, result } = this.analogyData;
      const pA = this.coords[a], pB = this.coords[b], pC = this.coords[c], pD = this.coords[result];
      if (pA && pB && pC && pD) {
        const sA = this._toScreen(pA.x, pA.y);
        const sB = this._toScreen(pB.x, pB.y);
        const sC = this._toScreen(pC.x, pC.y);
        const sD = this._toScreen(pD.x, pD.y);

        // Vector B -> A (e.g. Man -> King)
        this._drawArrow(ctx, sB.px, sB.py, sA.px, sA.py, '#a14335', 2.4);
        // Vector C -> D (e.g. Woman -> Queen)
        this._drawArrow(ctx, sC.px, sC.py, sD.px, sD.py, '#a14335', 2.4);

        // Dashed connector B -> C and A -> D
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(161, 67, 53, 0.45)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(sB.px, sB.py); ctx.lineTo(sC.px, sC.py);
        ctx.moveTo(sA.px, sA.py); ctx.lineTo(sD.px, sD.py);
        ctx.stroke();
        ctx.restore();

        // Pulsing glowing beacon on target result
        ctx.save();
        ctx.beginPath();
        ctx.arc(sD.px, sD.py, 16, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(161, 67, 53, 0.18)';
        ctx.fill();
        ctx.strokeStyle = '#a14335';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── 2. Nearest Neighbor Connections for Selected Word ──────────────
    const targetWord = this.selectedWord || this.hoverWord;
    if (targetWord && this.coords[targetWord] && VOCAB_VECTORS[targetWord]) {
      const pT = this.coords[targetWord];
      const sT = this._toScreen(pT.x, pT.y);
      const topNeighbors = VectorMath.findNearest(VOCAB_VECTORS[targetWord], VOCAB_VECTORS, 4, [targetWord]);

      ctx.save();
      for (const n of topNeighbors) {
        const pN = this.coords[n.word];
        if (!pN) continue;
        const sN = this._toScreen(pN.x, pN.y);

        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(46, 44, 42, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sT.px, sT.py);
        ctx.lineTo(sN.px, sN.py);
        ctx.stroke();

        // Similarity Badge
        const midX = (sT.px + sN.px) / 2;
        const midY = (sT.py + sN.py) / 2;
        ctx.fillStyle = '#f0ece2';
        ctx.fillRect(midX - 18, midY - 8, 36, 16);
        ctx.strokeStyle = '#ddd9d0';
        ctx.strokeRect(midX - 18, midY - 8, 36, 16);
        ctx.fillStyle = '#77796e';
        ctx.font = '600 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.similarity.toFixed(2), midX, midY);
      }
      ctx.restore();
    }

    // ── 3. Draw Word Nodes & Halo Text Labels ───────────────────────────
    for (const [w, pos] of Object.entries(this.coords)) {
      const data = WORD_EMBEDDINGS[w];
      if (data && !this.filterCategories.has(data.category)) continue;

      const { px, py } = this._toScreen(pos.x, pos.y);
      const catColor = data ? CATEGORIES[data.category].color : '#2e2c2a';
      const isSelected = w === this.selectedWord;
      const isHover = w === this.hoverWord;
      const isSearch = w === this.searchWord;

      // Halo for active nodes
      if (isSelected || isHover || isSearch) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(161, 67, 53, 0.22)' : 'rgba(46, 44, 42, 0.12)';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#a14335' : '#2e2c2a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // Center dual-ring dot
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, isSelected ? 5.5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#a14335' : catColor;
      ctx.fill();

      // White perimeter
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      // Label with Background Text Halo for Crisp Legibility
      ctx.save();
      ctx.font = isSelected ? 'bold 12px system-ui, sans-serif' : '500 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Halo stroke
      ctx.strokeStyle = 'rgba(248, 247, 243, 0.92)';
      ctx.lineWidth = 3.5;
      ctx.strokeText(w, px, py + 6);

      // Label fill
      ctx.fillStyle = isSelected ? '#a14335' : '#2e2c2a';
      ctx.fillText(w, px, py + 6);
      ctx.restore();
    }

    ctx.restore();
  }

  _drawArrow(ctx, fromX, fromY, toX, toY, color, width) {
    const headLen = 10;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 5.5), toY - headLen * Math.sin(angle - Math.PI / 5.5));
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 5.5), toY - headLen * Math.sin(angle + Math.PI / 5.5));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
