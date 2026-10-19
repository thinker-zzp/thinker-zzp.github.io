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
    document.getElementById('lang-zh')?.setAttribute('aria-pressed', String(language === 'zh'));
    document.getElementById('lang-en')?.setAttribute('aria-pressed', String(language === 'en'));
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
    refreshGiscusLanguage();
  }
  // GitHub Discussions comments via giscus. The widget is loaded only when the
  // reader approaches the section, so visitors who never reach it send no
  // request to giscus.app. The CSP in index.html allows only giscus.app.
  const giscusContainer = document.getElementById('giscus-comments');
  const giscusStatus = document.getElementById('comments-status');
  const giscusConfig = {
    repo: 'thinker-zzp/thinker-zzp.github.io',
    repoId: 'R_kgDOVMbtQA',
    category: 'Announcements',
    categoryId: 'DIC_kwDOVMbtQM4DI-b2',
    mapping: 'pathname',
    strict: '0',
    reactionsEnabled: '1',
    emitMetadata: '0',
    inputPosition: 'top',
    theme: 'light',
    loading: 'lazy'
  };
  let giscusMounted = false;
  const giscusLanguage = () => language === 'en' ? 'en' : 'zh-CN';
  function mountGiscus() {
    if (!giscusContainer || giscusMounted || !/^https?:$/.test(location.protocol)) return;
    giscusMounted = true;
    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    const attributes = {
      'data-repo': giscusConfig.repo,
      'data-repo-id': giscusConfig.repoId,
      'data-category': giscusConfig.category,
      'data-category-id': giscusConfig.categoryId,
      'data-mapping': giscusConfig.mapping,
      'data-strict': giscusConfig.strict,
      'data-reactions-enabled': giscusConfig.reactionsEnabled,
      'data-emit-metadata': giscusConfig.emitMetadata,
      'data-input-position': giscusConfig.inputPosition,
      'data-theme': giscusConfig.theme,
      'data-loading': giscusConfig.loading,
      'data-lang': giscusLanguage() === 'en' ? '' : 'zh-CN'
    };
    Object.entries(attributes).forEach(([name, value]) => script.setAttribute(name, value));
    let giscusTimer;
    let giscusObserver;
    const markLoaded = () => {
      clearTimeout(giscusTimer);
      giscusObserver?.disconnect();
      if (giscusStatus) giscusStatus.hidden = true;
    };
    const fail = () => {
      clearTimeout(giscusTimer);
      giscusObserver?.disconnect();
      giscusMounted = false;
      giscusContainer.replaceChildren();
      giscusContainer.classList.add('giscus-unavailable');
      if (giscusStatus) giscusStatus.hidden = false;
    };
    giscusTimer = setTimeout(() => {
      const frame = giscusContainer.querySelector('iframe');
      if (!frame) fail();
      else if (giscusStatus) giscusStatus.hidden = false;
    }, 20000);
    giscusObserver = new MutationObserver(() => {
      const frame = giscusContainer.querySelector('iframe');
      if (!frame) return;
      frame.title = giscusLanguage() === 'en' ? 'Comments' : '留言与讨论';
      frame.addEventListener('load', markLoaded, { once: true });
      if (!frame.classList.contains('giscus-frame--loading')) markLoaded();
    });
    giscusObserver.observe(giscusContainer, { childList: true, subtree: true });
    script.addEventListener('error', fail, { once: true });
    giscusContainer.replaceChildren(script);
  }
  function refreshGiscusLanguage() {
    if (!giscusMounted || !giscusContainer) return;
    const frame = giscusContainer.querySelector('iframe.giscus-frame');
    if (!frame) return;
    try {
      const url = new URL(frame.src);
      const lang = giscusLanguage();
      url.pathname = lang === 'en' ? '/widget' : `/${lang}/widget`;
      url.searchParams.delete('lang');
      frame.src = url.toString();
      frame.title = lang === 'en' ? 'Comments' : '留言与讨论';
    } catch { /* Keep the current widget if its URL cannot be parsed. */ }
  }
  const commentsSection = document.getElementById('comments');
  if (commentsSection && 'IntersectionObserver' in window) {
    const commentsObserver = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      commentsObserver.disconnect();
      mountGiscus();
    }, { rootMargin: '600px 0px' });
    commentsObserver.observe(commentsSection);
  }
  document.getElementById('lang-zh')?.addEventListener('click', () => setLanguage('zh', true));
  document.getElementById('lang-en')?.addEventListener('click', () => setLanguage('en', true));
  document.getElementById('language-toggle')?.addEventListener('click', () => setLanguage(language === 'en' ? 'zh' : 'en', true));
  setLanguage(requestedLanguage === 'en' || requestedLanguage === 'zh' ? requestedLanguage : storedLanguage || 'en');
  if (commentsSection && !('IntersectionObserver' in window)) mountGiscus();

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
