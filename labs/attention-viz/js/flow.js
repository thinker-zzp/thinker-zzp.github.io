// flow.js — Interactive Bipartite Attention Flow & Ribbon Diagram on HTML5 Canvas (High-DPI Retina)

class AttentionFlowCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tokens = [];
    this.matrix = null; // L x L weight matrix
    this.hoverQueryIdx = null;
    this.hoverKeyIdx = null;
    this.selectedTokenIdx = null;
    this.onSelectToken = null;

    this.dpr = window.devicePixelRatio || 1;
    this.logicalW = 0;
    this.logicalH = 0;

    this._setupInteraction();
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.max(300, Math.floor(rect.height));

    this.dpr = window.devicePixelRatio || 1;
    this.logicalW = w;
    this.logicalH = h;

    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.render();
  }

  setData(tokens, matrix) {
    this.tokens = tokens;
    this.matrix = matrix;
    this.render();
  }

  setSelectedToken(idx) {
    this.selectedTokenIdx = idx;
    this.render();
  }

  _setupInteraction() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const hit = this._hitTest(mx, my);
      let changed = false;

      if (hit && hit.type === 'query') {
        if (this.hoverQueryIdx !== hit.idx) {
          this.hoverQueryIdx = hit.idx;
          this.hoverKeyIdx = null;
          changed = true;
        }
      } else if (hit && hit.type === 'key') {
        if (this.hoverKeyIdx !== hit.idx) {
          this.hoverKeyIdx = hit.idx;
          this.hoverQueryIdx = null;
          changed = true;
        }
      } else {
        if (this.hoverQueryIdx !== null || this.hoverKeyIdx !== null) {
          this.hoverQueryIdx = null;
          this.hoverKeyIdx = null;
          changed = true;
        }
      }

      this.canvas.style.cursor = hit ? 'pointer' : 'default';
      if (changed) this.render();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverQueryIdx = null;
      this.hoverKeyIdx = null;
      this.render();
    });

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const hit = this._hitTest(mx, my);
      if (hit) {
        this.selectedTokenIdx = hit.idx;
        if (this.onSelectToken) this.onSelectToken(hit.idx);
        this.render();
      }
    });
  }

  _hitTest(mx, my) {
    const L = this.tokens.length;
    if (L === 0) return null;

    const W = this.logicalW;
    const H = this.logicalH;
    const padTop = 32;
    const padBottom = 24;
    const spacing = (H - padTop - padBottom) / Math.max(1, L - 1);
    const leftX = Math.min(95, W * 0.18);
    const rightX = Math.max(W - 95, W * 0.82);

    for (let i = 0; i < L; i++) {
      const y = padTop + i * spacing;
      // Left Query token pill hit
      if (Math.abs(mx - leftX) <= 46 && Math.abs(my - y) <= 13) {
        return { type: 'query', idx: i };
      }
      // Right Key token pill hit
      if (Math.abs(mx - rightX) <= 46 && Math.abs(my - y) <= 13) {
        return { type: 'key', idx: i };
      }
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

    // Warm paper canvas background
    ctx.fillStyle = '#f8f7f3';
    ctx.fillRect(0, 0, W, H);

    // Delicate subtle dot grid
    ctx.fillStyle = 'rgba(215, 212, 204, 0.55)';
    const gridStep = 24;
    for (let x = 12; x < W; x += gridStep) {
      for (let y = 12; y < H; y += gridStep) {
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const L = this.tokens.length;
    if (L === 0 || !this.matrix) {
      ctx.fillStyle = '#77796e';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Enter a sentence above to compute self-attention patterns', W / 2, H / 2);
      ctx.restore();
      return;
    }

    const padTop = 32;
    const padBottom = 24;
    const spacing = (H - padTop - padBottom) / Math.max(1, L - 1);
    const leftX = Math.min(95, W * 0.18);
    const rightX = Math.max(W - 95, W * 0.82);

    const activeQuery = this.hoverQueryIdx !== null ? this.hoverQueryIdx : this.selectedTokenIdx;
    const activeKey = this.hoverKeyIdx;

    // ── 1. Draw Attention Flow Ribbons ──────────────────────────────────
    for (let i = 0; i < L; i++) {
      const y1 = padTop + i * spacing;
      for (let j = 0; j < L; j++) {
        const y2 = padTop + j * spacing;
        const weight = this.matrix[i][j];
        if (weight < 0.008) continue;

        const isHighlighted = (activeQuery === i) || (activeKey === j);
        const isDimmed = (activeQuery !== null && activeQuery !== i) ||
                         (activeKey !== null && activeKey !== j);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(leftX + 44, y1);

        const dist = rightX - leftX - 88;
        const cp1X = leftX + 44 + dist * 0.45;
        const cp2X = leftX + 44 + dist * 0.55;
        ctx.bezierCurveTo(cp1X, y1, cp2X, y2, rightX - 44, y2);

        if (isHighlighted) {
          ctx.strokeStyle = '#a14335';
          ctx.lineWidth = Math.max(1.6, Math.min(8.5, weight * 13));
          ctx.globalAlpha = Math.max(0.4, Math.min(0.96, weight * 1.6));
          ctx.shadowColor = 'rgba(161, 67, 53, 0.35)';
          ctx.shadowBlur = 6;
        } else if (isDimmed) {
          ctx.strokeStyle = 'rgba(180, 175, 165, 0.2)';
          ctx.lineWidth = Math.max(0.5, weight * 3);
          ctx.globalAlpha = 0.07;
        } else {
          ctx.strokeStyle = 'rgba(130, 125, 115, 0.45)';
          ctx.lineWidth = Math.max(0.7, weight * 5.5);
          ctx.globalAlpha = Math.max(0.12, Math.min(0.65, weight));
        }

        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── 2. Draw Query Tokens (Left Column) ──────────────────────────────
    for (let i = 0; i < L; i++) {
      const y = padTop + i * spacing;
      const isSelected = (activeQuery === i);
      const isHover = (this.hoverQueryIdx === i);

      this._drawPill(ctx, leftX, y, this.tokens[i], isSelected, isHover, 'Query');
    }

    // ── 3. Draw Key Tokens (Right Column) ───────────────────────────────
    for (let j = 0; j < L; j++) {
      const y = padTop + j * spacing;
      const isSelected = (activeKey === j) || (activeQuery !== null && this.matrix[activeQuery][j] >= 0.25);
      const isHover = (this.hoverKeyIdx === j);

      let badgeProb = null;
      if (activeQuery !== null) {
        badgeProb = (this.matrix[activeQuery][j] * 100).toFixed(0) + '%';
      }

      this._drawPill(ctx, rightX, y, this.tokens[j], isSelected, isHover, 'Key', badgeProb);
    }

    // Column Headers
    ctx.save();
    ctx.fillStyle = '#77796e';
    ctx.font = '600 9px system-ui, sans-serif';
    ctx.letterSpacing = '0.08em';
    ctx.textAlign = 'center';
    ctx.fillText('QUERY TOKENS (Q)', leftX, 16);
    ctx.fillText('KEY TOKENS (K)', rightX, 16);
    ctx.restore();

    ctx.restore();
  }

  _drawPill(ctx, cx, cy, text, isSelected, isHover, role, badgeProb = null) {
    const pillW = 86;
    const pillH = 22;
    const x = cx - pillW / 2;
    const y = cy - pillH / 2;

    ctx.save();
    if (isSelected) {
      ctx.fillStyle = '#a14335';
      ctx.shadowColor = 'rgba(161, 67, 53, 0.35)';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = '#852d21';
      ctx.lineWidth = 1;
    } else if (isHover) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2e2c2a';
      ctx.lineWidth = 1.2;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
      ctx.shadowBlur = 4;
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ddd9d0';
      ctx.lineWidth = 1;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.02)';
      ctx.shadowBlur = 2;
    }

    this._drawRoundRect(ctx, x, y, pillW, pillH, 5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Subtle role dot indicator on the pill left
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + 7, cy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#ffffff' : (role === 'Query' ? '#a14335' : '#77796e');
    ctx.fill();
    ctx.restore();

    // Text Label
    ctx.save();
    ctx.fillStyle = isSelected ? '#ffffff' : '#2e2c2a';
    ctx.font = isSelected ? '600 11px system-ui, sans-serif' : '500 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const maxChars = badgeProb ? 5 : 8;
    const display = text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
    ctx.fillText(display, x + 14, cy);

    // Probability badge chip
    if (badgeProb) {
      ctx.font = '600 8.5px monospace';
      ctx.fillStyle = isSelected ? 'rgba(255,255,255,0.95)' : '#a14335';
      ctx.textAlign = 'right';
      ctx.fillText(badgeProb, x + pillW - 6, cy);
    }
    ctx.restore();
  }

  _drawRoundRect(ctx, x, y, w, h, r) {
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
