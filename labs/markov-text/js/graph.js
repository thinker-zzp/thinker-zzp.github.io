// graph.js — High-DPI Interactive Markov Transition Graph on HTML5 Canvas

class MarkovGraph {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.currentState = [];
    this.candidates = [];
    this.selectedToken = null;
    this.animStartTime = 0;
    this.rafId = null;
    this._startLoop();
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();
    const w = Math.floor(rect.width) - 2;
    const h = Math.max(180, Math.floor(rect.height) - 2);

    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.render();
  }

  get logicalW() { return this.canvas.width / this.dpr; }
  get logicalH() { return this.canvas.height / this.dpr; }

  update(prefix, candidates, selectedToken) {
    this.currentState = prefix || [];
    this.candidates = (candidates || []).slice(0, 7);
    this.selectedToken = selectedToken;
    this.animStartTime = performance.now();
    this.render();
  }

  _startLoop() {
    const tick = () => {
      // Re-render if animation is recent (< 800ms) for traveling pulse
      if (performance.now() - this.animStartTime < 800) {
        this.render();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
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

    // Delicate dot grid
    ctx.fillStyle = 'rgba(213, 210, 201, 0.65)';
    const gridSpacing = 22;
    for (let x = 12; x < W; x += gridSpacing) {
      for (let y = 12; y < H; y += gridSpacing) {
        ctx.fillRect(x, y, 1.2, 1.2);
      }
    }

    if (!this.candidates || this.candidates.length === 0) {
      ctx.fillStyle = '#77796e';
      ctx.font = '500 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Ready · Step or generate to observe Markov state transitions', W / 2, H / 2);
      ctx.restore();
      return;
    }

    const leftX = Math.min(135, W * 0.24);
    const centerY = H / 2;
    const rightX = Math.max(W - 135, W * 0.76);

    // 1. Root Context Node
    const stateLabel = this.currentState.length > 0
      ? this.currentState.map(t => t === '\n' ? '↵' : t).join(' ')
      : '⟨START⟩';

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = '#2e2c2a';
    ctx.font = 'bold 11px monospace';
    const textW = ctx.measureText(stateLabel).width;
    const rootW = Math.min(150, Math.max(86, textW + 28));
    const rootH = 34;

    this._drawRoundRect(ctx, leftX - rootW / 2, centerY - rootH / 2, rootW, rootH, 6);
    ctx.fill();

    // Subtle hairline highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#f8f7f3';
    ctx.font = '600 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayState = stateLabel.length > 16 ? stateLabel.slice(-15) + '…' : stateLabel;
    ctx.fillText(displayState, leftX, centerY);

    // Over-title
    ctx.fillStyle = '#77796e';
    ctx.font = '700 8.5px system-ui, sans-serif';
    ctx.letterSpacing = '0.08em';
    ctx.fillText('CONDITIONING STATE P( · | s )', leftX, centerY - 25);

    // 2. Candidate Branches
    const count = this.candidates.length;
    const spacing = count > 1 ? (H - 52) / (count - 1) : 0;
    const startY = count > 1 ? 26 : centerY;

    const elapsed = performance.now() - this.animStartTime;
    const animProgress = Math.min(1.0, elapsed / 500); // 0..1 for pulse

    for (let i = 0; i < count; i++) {
      const cand = this.candidates[i];
      const targetY = startY + i * spacing;
      const isSelected = cand.token === this.selectedToken;
      const probPct = (cand.prob * 100).toFixed(1) + '%';
      const cleanToken = cand.token === '\n' ? '↵ [newline]' : cand.token;

      // Bézier curve connection
      const startPtX = leftX + rootW / 2;
      const endPtX = rightX - 54;
      const cp1X = startPtX + (endPtX - startPtX) * 0.45;
      const cp2X = startPtX + (endPtX - startPtX) * 0.55;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(startPtX, centerY);
      ctx.bezierCurveTo(cp1X, centerY, cp2X, targetY, endPtX, targetY);

      if (isSelected) {
        // Glowing terracotta active stroke
        ctx.strokeStyle = '#a14335';
        ctx.lineWidth = Math.max(2.8, Math.min(7, cand.prob * 11));
        ctx.shadowColor = 'rgba(161, 67, 53, 0.45)';
        ctx.shadowBlur = 8;
      } else {
        ctx.strokeStyle = 'rgba(120, 115, 105, 0.32)';
        ctx.lineWidth = Math.max(1, Math.min(4, cand.prob * 6));
      }
      ctx.stroke();
      ctx.restore();

      // Traveling pulse bead along chosen branch
      if (isSelected && animProgress < 1.0) {
        const t = animProgress;
        // Cubic bezier point calculation
        const bx = (1-t)**3 * startPtX + 3*(1-t)**2 * t * cp1X + 3*(1-t) * t**2 * cp2X + t**3 * endPtX;
        const by = (1-t)**3 * centerY + 3*(1-t)**2 * t * centerY + 3*(1-t) * t**2 * targetY + t**3 * targetY;

        ctx.save();
        ctx.beginPath();
        ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#a14335';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.strokeStyle = '#a14335';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // Candidate Target Pill
      const targetW = 108;
      const targetH = 26;
      const nodeX = rightX - 52;
      const nodeY = targetY - targetH / 2;

      ctx.save();
      if (isSelected) {
        ctx.fillStyle = '#a14335';
        ctx.shadowColor = 'rgba(161, 67, 53, 0.35)';
        ctx.shadowBlur = 8;
        this._drawRoundRect(ctx, nodeX, nodeY, targetW, targetH, 5);
        ctx.fill();
      } else {
        ctx.fillStyle = '#eeebe3';
        ctx.strokeStyle = '#ddd9d0';
        ctx.lineWidth = 1;
        this._drawRoundRect(ctx, nodeX, nodeY, targetW, targetH, 5);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      // Candidate Text
      ctx.fillStyle = isSelected ? '#ffffff' : '#2e2c2a';
      ctx.font = isSelected ? '600 11px system-ui, sans-serif' : '500 11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const textToDraw = cleanToken.length > 8 ? cleanToken.slice(0, 7) + '…' : cleanToken;
      ctx.fillText(textToDraw, nodeX + 9, targetY);

      // Probability Badge
      ctx.fillStyle = isSelected ? '#ffffff' : '#77796e';
      ctx.font = '600 9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(probPct, nodeX + targetW - 8, targetY);
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
