'use strict';
(() => {
  const english = window.HOMEPAGE_EN || {};
  const chineseText = new Map();
  const chineseAria = new Map();
  const textElements = [...document.querySelectorAll('[data-i18n]')];
  const ariaElements = [...document.querySelectorAll('[data-i18n-aria]')];
  const readOriginal = el => [...el.childNodes].map(node => node.nodeName === 'BR' ? '\n' : node.textContent).join('');
  textElements.forEach(el => chineseText.set(el, readOriginal(el)));
  ariaElements.forEach(el => chineseAria.set(el, el.getAttribute('aria-label')));
  const imageAlts = new Map([...document.querySelectorAll('[data-i18n-alt]')].map(el => [el, el.alt]));
  const initialTitle = document.title;
  const metaDescription = document.querySelector('meta[name="description"]');
  const initialDescription = metaDescription?.content || '';
  let language = 'zh';
  let toastTimer;
  let storedLanguage;
  try { storedLanguage = localStorage.getItem('zzp-home-language'); } catch { /* Private browsing can block storage. */ }
  const requestedLanguage = new URLSearchParams(location.search).get('lang');
  const cvPage = document.body.classList.contains('cv-page');
  const announce = message => {
    const toast = document.getElementById('toast');
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
  };
  const messages = {
    zh: {email: '邮箱已复制', citation: '引用已复制', failed: '暂时无法自动复制，请选中文字复制。'},
    en: {email: english.toastEmail, citation: english.toastCitation, failed: english.toastFailed}
  };
  function setLanguage(next, notify = false) {
    language = next === 'en' ? 'en' : 'zh';
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    textElements.forEach(el => {
      const key = el.dataset.i18n;
      el.textContent = language === 'en' ? (english[key] ?? chineseText.get(el)) : chineseText.get(el);
    });
    ariaElements.forEach(el => el.setAttribute('aria-label', language === 'en' ? (english[el.dataset.i18nAria] ?? chineseAria.get(el)) : chineseAria.get(el)));
    imageAlts.forEach((original, el) => { el.alt = language === 'en' ? (english[el.dataset.i18nAlt] ?? original) : original; });
    document.title = language === 'en' ? (cvPage ? english.cvPageTitle : english.pageTitle) : initialTitle;
    if (metaDescription) metaDescription.content = language === 'en' ? english.description : initialDescription;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogTitle) ogTitle.content = document.title;
    if (ogDescription && metaDescription) ogDescription.content = metaDescription.content;
    document.getElementById('lang-zh')?.classList.toggle('selected', language === 'zh');
    document.getElementById('lang-en')?.classList.toggle('selected', language === 'en');
    const toggle = document.getElementById('language-toggle');
    if (toggle) toggle.setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换为中文');
    document.querySelectorAll('a[href*="cv.html"], a[data-home-link]').forEach(link => {
      const target = new URL(link.getAttribute('href'), location.href);
      target.searchParams.set('lang', language);
      link.setAttribute('href', target.pathname.split('/').pop() + target.search + target.hash);
    });
    try { localStorage.setItem('zzp-home-language', language); } catch { /* Language still works without persistence. */ }
    const url = new URL(location.href);
    url.searchParams.set('lang', language);
    try { history.replaceState(null, '', url); } catch { /* file:// previews can restrict history. */ }
    if (notify) announce(language === 'en' ? english.toastEnglish : english.toastChinese);
  }
  document.getElementById('language-toggle')?.addEventListener('click', () => setLanguage(language === 'en' ? 'zh' : 'en', true));
  setLanguage(requestedLanguage === 'en' || requestedLanguage === 'zh' ? requestedLanguage : storedLanguage || 'zh');

  // A deterministic conceptual contour illustration. These are decorative curves, not results.
  const contours = document.getElementById('contour-lines');
  if (contours) {
    for (let ring = 1; ring <= 18; ring += 1) {
      const points = [];
      for (let step = 0; step <= 160; step += 1) {
        const theta = step / 160 * 2 * Math.PI;
        const warp = 1 + .12 * Math.sin(theta * 3 + ring * .05) + .08 * Math.cos(theta * 2 - .8);
        const x = 267 + Math.cos(theta) * ring * 10.5 * warp + 8 * Math.sin(ring * .3) - 13 * ring / 18;
        const y = 154 + Math.sin(theta) * ring * 6.5 * warp + Math.cos(theta) * ring * 2.4;
        points.push(`${step ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`);
      }
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', points.join(' ') + 'Z');
      contours.appendChild(path);
    }
  }

  // A small generative sculpture: visual play, unrelated to experimental results.
  const sculpture = document.getElementById('search-art');
  const artCanvas = document.getElementById('search-art-canvas');
  const artContext = artCanvas?.getContext('2d');
  if (sculpture && artContext) {
    const changeShape = document.getElementById('art-shape');
    const pauseArt = document.getElementById('art-pause');
    const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    const rows = 68;
    const columns = 12;
    const tau = Math.PI * 2;
    const shapes = Array.from({length: 3}, (_, shape) => Array.from({length: rows * columns}, (_, i) => {
      const u = Math.floor(i / columns) / rows * tau;
      const v = i % columns / columns * tau;
      if (shape === 0) {
        const radius = 1 + .16 * Math.cos(3 * u);
        return [(radius + .27 * Math.cos(v)) * Math.cos(u), .32 * Math.sin(v) + .15 * Math.sin(3 * u), (radius + .27 * Math.cos(v)) * Math.sin(u)];
      }
      if (shape === 1) {
        const ribbon = (i % columns / (columns - 1) - .5) * .85;
        return [(1 + ribbon * Math.cos(u / 2)) * Math.cos(u), ribbon * Math.sin(u / 2), (1 + ribbon * Math.cos(u / 2)) * Math.sin(u)];
      }
      const radius = .85 + .19 * Math.cos(3 * u);
      return [radius * Math.cos(2 * u) + .13 * Math.cos(v), .52 * Math.sin(3 * u) + .13 * Math.sin(v), radius * Math.sin(2 * u)];
    }));
    let variant = 0;
    const points = shapes[0].map(point => point.slice());
    let width = 0, height = 0, frame = 0, lastTime = 0, clock = 0;
    let inView = false;
    let paused = motionPreference.matches;
    let pointer = null;
    let turn = 0;
    let targetTurn = 0;

    function render(delta = 0) {
      clock += delta;
      const scale = Math.min(width / 4.3, height / 2.65);
      const centerX = width * .5, centerY = height * .5;
      const rotation = -.42 + clock * .13;
      const tilt = .73 + .12 * Math.sin(clock * .2);
      turn += (targetTurn - turn) * .07;
      const cosY = Math.cos(rotation + turn), sinY = Math.sin(rotation + turn);
      const cosX = Math.cos(tilt), sinX = Math.sin(tilt);
      const projected = points.map((point, i) => {
        for (let axis = 0; axis < 3; axis++) point[axis] += (shapes[variant][i][axis] - point[axis]) * (paused ? 1 : .045);
        const x = point[0] * cosY + point[2] * sinY;
        const z = -point[0] * sinY + point[2] * cosY;
        const y = point[1] * cosX - z * sinX;
        const depth = point[1] * sinX + z * cosX;
        const perspective = 4.8 / (4.8 - depth);
        let px = centerX + x * scale * perspective * 1.5;
        let py = centerY + y * scale * perspective * .9;
        if (pointer) {
          const dx = px - pointer.x, dy = py - pointer.y;
          const distance = Math.hypot(dx, dy);
          const push = Math.max(0, 1 - distance / 110) ** 2 * 22;
          px += dx / (distance || 1) * push;
          py += dy / (distance || 1) * push;
        }
        return {x: px, y: py, depth, i};
      });
      artContext.clearRect(0, 0, width, height);
      artContext.lineWidth = .5;
      projected.forEach((point, i) => {
        if (i % columns !== 0) return;
        const row = Math.floor(i / columns);
        // Thin strands give the point cloud its volume without turning it into a diagram.
        for (let column = 0; column < columns; column += 2) {
          const a = projected[row * columns + column];
          const b = projected[((row + 1) % rows) * columns + column];
          if (variant === 1 && row === rows - 1) continue;
          artContext.strokeStyle = column === 0 ? 'rgba(151,62,50,.38)' : 'rgba(104,122,87,.15)';
          artContext.beginPath(); artContext.moveTo(a.x, a.y); artContext.lineTo(b.x, b.y); artContext.stroke();
        }
      });
      projected.sort((a, b) => a.depth - b.depth).forEach(point => {
        const alpha = .22 + (point.depth + 1.6) / 3.2 * .5;
        artContext.fillStyle = point.i % columns === 0 ? `rgba(151,62,50,${alpha + .12})` : `rgba(93,112,77,${alpha})`;
        const size = .65 + (point.depth + 1.6) / 3.2 * .6;
        artContext.beginPath(); artContext.arc(point.x, point.y, size, 0, tau); artContext.fill();
      });
    }
    function animate(time) {
      frame = 0;
      if (!inView || paused || document.hidden) return;
      if (!lastTime || time - lastTime >= 32) {
        const delta = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0;
        lastTime = time;
        render(delta);
      }
      frame = requestAnimationFrame(animate);
    }
    function syncMotion() {
      cancelAnimationFrame(frame); frame = 0; lastTime = 0;
      pauseArt.setAttribute('aria-pressed', String(paused));
      if (inView && !paused && !document.hidden) frame = requestAnimationFrame(animate);
    }
    function resizeArt() {
      const box = artCanvas.getBoundingClientRect();
      width = box.width; height = box.height;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      artCanvas.width = Math.round(width * ratio); artCanvas.height = Math.round(height * ratio);
      artContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      render();
    }
    function nextShape() {
      variant = (variant + 1) % shapes.length;
      sculpture.querySelector('.art-index').textContent = `0${variant + 1} / 03`;
      targetTurn += .3;
      render();
    }
    changeShape.hidden = false; pauseArt.hidden = false;
    sculpture.classList.add('is-ready');
    changeShape.addEventListener('click', nextShape);
    pauseArt.addEventListener('click', () => { paused = !paused; pointer = null; syncMotion(); render(); });
    artCanvas.addEventListener('pointermove', event => {
      if (paused || event.pointerType === 'touch') return;
      const box = artCanvas.getBoundingClientRect();
      pointer = {x: event.clientX - box.left, y: event.clientY - box.top};
    });
    artCanvas.addEventListener('pointerleave', () => { pointer = null; });
    artCanvas.addEventListener('click', nextShape);
    motionPreference.addEventListener('change', event => { paused = event.matches; syncMotion(); render(); });
    document.addEventListener('visibilitychange', syncMotion);
    new ResizeObserver(resizeArt).observe(artCanvas);
    new IntersectionObserver(entries => { inView = entries[0].isIntersecting; syncMotion(); }, {rootMargin: '60px'}).observe(sculpture);
    resizeArt(); syncMotion();
  }

  async function copyText(value, success) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(value);
      announce(messages[language][success]);
    } catch {
      const citation = document.getElementById('citation-text');
      if (success === 'citation' && citation) {
        const range = document.createRange();
        range.selectNodeContents(citation);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
      announce(messages[language].failed);
    }
  }
  document.getElementById('copy-email')?.addEventListener('click', () => copyText('zhangzhipeng520ai@gmail.com', 'email'));
  const citationDialog = document.getElementById('citation-dialog');
  document.getElementById('citation-open')?.addEventListener('click', () => citationDialog?.showModal());
  document.getElementById('citation-close')?.addEventListener('click', () => citationDialog?.close());
  citationDialog?.addEventListener('click', event => {
    if (event.target !== citationDialog) return;
    const bounds = citationDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) citationDialog.close();
  });
  document.getElementById('copy-citation')?.addEventListener('click', () => copyText(document.getElementById('citation-text').textContent.trim(), 'citation'));
  document.getElementById('print-cv')?.addEventListener('click', () => window.print());
  document.querySelectorAll('[data-current-year]').forEach(el => el.textContent = new Date().getFullYear());

  // Only mark navigation when the corresponding chapter actually occupies the reading area.
  const sections = [...document.querySelectorAll('section.chapter')];
  const navLinks = [...document.querySelectorAll('.top-nav a')];
  if (sections.length && 'IntersectionObserver' in window) {
    const visibleSections = new Set();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.isIntersecting ? visibleSections.add(entry.target.id) : visibleSections.delete(entry.target.id));
      const current = sections.find(section => visibleSections.has(section.id))?.id;
      navLinks.forEach(link => {
        if (link.getAttribute('href') === `#${current}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, {rootMargin: '-22% 0px -45% 0px', threshold: 0});
    sections.forEach(section => observer.observe(section));
  }
})();
