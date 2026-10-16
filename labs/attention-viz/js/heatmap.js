// heatmap.js — Attention Matrix Heatmap Visualizer (High-DPI Retina)

class AttentionHeatmapCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tokens = [];
    this.matrix = null;
    this.rawScores = null;
    this.hoverRow = null;
    this.hoverCol = null;
    this.selectedRow = null;
    this.onSelectToken = null;

    this.dpr = window.devicePixelRatio || 1;
    this.logicalSize = 0;

    this._setupInteraction();
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const size = Math.max(220, Math.floor(Math.min(rect.width, rect.height)));

    this.dpr = window.devicePixelRatio || 1;
    this.logicalSize = size;

    this.canvas.width = Math.floor(size * this.dpr);
    this.canvas.height = Math.floor(size * this.dpr);
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = size + 'px';

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.render();
  }

  setData(tokens, matrix, rawScores) {
    this.tokens = tokens;
    this.matrix = matrix;
    this.rawScores = rawScores;
    this.render();
  }

  setSelectedRow(idx) {
    this.selectedRow = idx;
    this.render();
  }

  _setupInteraction() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const hit = this._hitTest(mx, my);
      if (hit) {
        if (this.hoverRow !== hit.r || this.hoverCol !== hit.c) {
          this.hoverRow = hit.r;
          this.hoverCol = hit.c;
          this.render();
        }
      } else {
        if (this.hoverRow !== null || this.hoverCol !== null) {
          this.hoverRow = null;
          this.hoverCol = null;
          this.render();
        }
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverRow = null;
      this.hoverCol = null;
      this.render();
    });

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const hit = this._hitTest(mx, my);
      if (hit && this.onSelectToken) {
        this.selectedRow = hit.r;
        this.onSelectToken(hit.r);
        this.render();
      }
    });
  }

  _hitTest(mx, my) {
    const L = this.tokens.length;
    if (L === 0 || !this.matrix) return null;

    const padLeft = 44;
    const padTop = 40;
    const W = this.logicalSize - padLeft - 12;
    const H = this.logicalSize - padTop - 24;
    const cellSize = Math.min(W / L, H / L);

    if (mx < padLeft || my < padTop) return null;
    const c = Math.floor((mx - padLeft) / cellSize);
    const r = Math.floor((my - padTop) / cellSize);

    if (r >= 0 && r < L && c >= 0 && c < L) {
      return { r, c };
    }
    return null;
  }

  render() {
    const ctx = this.ctx;
    const S = this.logicalSize;
    if (S <= 0) return;

    ctx.save();
    ctx.clearRect(0, 0, S, S);

    // Warm background
    ctx.fillStyle = '#f8f7f3';
    ctx.fillRect(0, 0, S, S);

    const L = this.tokens.length;
    if (L === 0 || !this.matrix) {
      ctx.fillStyle = '#77796e';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No attention data computed', S / 2, S / 2);
      ctx.restore();
      return;
    }

    const padLeft = 44;
    const padTop = 40;
    const availableW = S - padLeft - 12;
    const availableH = S - padTop - 26;
    const cellSize = Math.min(availableW / L, availableH / L);
    const gap = cellSize > 16 ? 1.5 : 0.5;

    // ── Crosshair Underlay ──────────────────────────────────────────────
    if (this.hoverRow !== null || this.selectedRow !== null) {
      const activeR = this.hoverRow !== null ? this.hoverRow : this.selectedRow;
      const y = padTop + activeR * cellSize;
      ctx.fillStyle = 'rgba(161, 67, 53, 0.07)';
      ctx.fillRect(padLeft, y, cellSize * L, cellSize);
    }
    if (this.hoverCol !== null) {
      const x = padLeft + this.hoverCol * cellSize;
      ctx.fillStyle = 'rgba(161, 67, 53, 0.07)';
      ctx.fillRect(x, padTop, cellSize, cellSize * L);
    }

    // ── 1. Draw Grid Cells ──────────────────────────────────────────────
    for (let i = 0; i < L; i++) {
      for (let j = 0; j < L; j++) {
        const x = padLeft + j * cellSize + gap / 2;
        const y = padTop + i * cellSize + gap / 2;
        const w = this.matrix[i][j];
        const sz = cellSize - gap;

        // Background color
        ctx.fillStyle = this._weightColor(w);

        if (sz >= 14) {
          this._roundRect(ctx, x, y, sz, sz, Math.min(3, sz * 0.15));
          ctx.fill();
        } else {
          ctx.fillRect(x, y, sz, sz);
        }

        // Active focus border
        const isHoverCell = (this.hoverRow === i && this.hoverCol === j);
        const isSelectedRow = (this.selectedRow === i);

        if (isHoverCell) {
          ctx.strokeStyle = '#2e2c2a';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (isSelectedRow) {
          ctx.strokeStyle = 'rgba(161, 67, 53, 0.5)';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

        // Numeric percentage in cell
        if (sz >= 22) {
          ctx.font = '600 9px monospace';
          ctx.fillStyle = w > 0.45 ? '#ffffff' : '#2e2c2a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((w * 100).toFixed(0), x + sz / 2, y + sz / 2);
        }
      }
    }

    // ── 2. Draw Row & Column Headers (Tokens) ───────────────────────────
    ctx.font = '10px system-ui, sans-serif';

    // Query Tokens (Rows on the left)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < L; i++) {
      const y = padTop + (i + 0.5) * cellSize;
      const isCur = (this.hoverRow === i || this.selectedRow === i);
      ctx.fillStyle = isCur ? '#a14335' : '#77796e';
      ctx.font = isCur ? 'bold 10px system-ui, sans-serif' : '10px system-ui, sans-serif';
      const tok = this.tokens[i];
      ctx.fillText(tok.length > 5 ? tok.slice(0, 4) + '…' : tok, padLeft - 6, y);
    }

    // Key Tokens (Columns on the top)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let j = 0; j < L; j++) {
      const x = padLeft + (j + 0.5) * cellSize;
      const isCur = (this.hoverCol === j);
      ctx.save();
      ctx.translate(x, padTop - 6);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = isCur ? '#a14335' : '#77796e';
      ctx.font = isCur ? 'bold 10px system-ui, sans-serif' : '10px system-ui, sans-serif';
      const tok = this.tokens[j];
      ctx.fillText(tok.length > 5 ? tok.slice(0, 4) + '…' : tok, 0, 0);
      ctx.restore();
    }

    // ── 3. Tooltip Pill on Hover ─────────────────────────────────────────
    if (this.hoverRow !== null && this.hoverCol !== null) {
      const qTok = this.tokens[this.hoverRow];
      const kTok = this.tokens[this.hoverCol];
      const p = this.matrix[this.hoverRow][this.hoverCol];
      const raw = this.rawScores ? this.rawScores[this.hoverRow][this.hoverCol] : 0;

      const tipText = `Q[${qTok}] → K[${kTok}] : ${(p * 100).toFixed(1)}% (raw logit: ${raw.toFixed(2)})`;
      ctx.save();
      ctx.font = '500 9.5px monospace';
      const textW = ctx.measureText(tipText).width;
      const pillW = textW + 16;
      const pillH = 18;
      const pillX = S / 2 - pillW / 2;
      const pillY = S - pillH - 4;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ddd9d0';
      ctx.lineWidth = 1;
      this._roundRect(ctx, pillX, pillY, pillW, pillH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#2e2c2a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tipText, S / 2, pillY + pillH / 2);
      ctx.restore();
    }

    ctx.restore();
  }

  _weightColor(w) {
    // Elegant warm ivory to terracotta to deep crimson colormap
    const t = Math.min(1.0, Math.max(0.0, w));
    if (t < 0.3) {
      // #f8f7f3 to #edd9cb
      const k = t / 0.3;
      const r = Math.round(248 + k * (237 - 248));
      const g = Math.round(247 + k * (217 - 247));
      const b = Math.round(243 + k * (203 - 243));
      return `rgb(${r}, ${g}, ${b})`;
    } else if (t < 0.7) {
      // #edd9cb to #a14335
      const k = (t - 0.3) / 0.4;
      const r = Math.round(237 + k * (161 - 237));
      const g = Math.round(217 + k * (67  - 217));
      const b = Math.round(203 + k * (53  - 203));
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // #a14335 to #631d14
      const k = (t - 0.7) / 0.3;
      const r = Math.round(161 + k * (99 - 161));
      const g = Math.round(67  + k * (29 - 67));
      const b = Math.round(53  + k * (20 - 53));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
