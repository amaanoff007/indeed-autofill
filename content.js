// Runs on every indeed.com page/frame.
//  - Search results: tags each job card as a match or a skip.
//  - Easy Apply steps: fills fields from profile.js (floating button or Alt+Shift+F).
//    It never clicks Continue/Submit; you do.

(() => {
  const isApply = /smartapply\.indeed\.com|\/indeedapply\//.test(location.href);
  const isTop = window === window.top;

  // ---------- search results ----------

  const PERIOD = { year: 1, month: 12, week: 52, day: 260, hour: 2080 };

  function annualMax(text) {
    const m = text.match(/₹[\d,.\s₹–-]+(?:a|an|per)\s+(year|month|week|day|hour)/i);
    if (!m) return null;
    const nums = (m[0].match(/[\d,]+(?:\.\d+)?/g) || []).map(s => parseFloat(s.replace(/,/g, ''))).filter(n => n > 0);
    if (!nums.length) return null;
    return Math.max(...nums) * PERIOD[m[1].toLowerCase()];
  }

  function tagCards() {
    document.querySelectorAll('.job_seen_beacon, [data-testid="slider_item"]').forEach(card => {
      const root = card.closest('li') || card;
      if (root.dataset.iafTagged) return;
      root.dataset.iafTagged = '1';
      const t = card.innerText;
      const loc = (card.querySelector('[data-testid="text-location"]') || {}).innerText || '';
      const remote = /remote/i.test(loc) || /\bremote\b/i.test(t);
      const easy = /easily apply/i.test(t);
      const sal = annualMax(t);
      const reasons = [];
      if (!remote) reasons.push('not remote');
      if (!easy) reasons.push('no Easy Apply');
      if (sal !== null && sal < MIN_ANNUAL_CTC) reasons.push(`₹${(sal / 100000).toFixed(1)}L < ${MIN_ANNUAL_CTC / 100000}L`);
      const badge = document.createElement('div');
      badge.style.cssText = 'font:600 12px system-ui;padding:3px 8px;border-radius:4px;margin:4px 0;display:inline-block;color:#fff;';
      if (reasons.length) {
        root.style.opacity = '0.4';
        badge.style.background = '#888';
        badge.textContent = 'SKIP: ' + reasons.join(', ');
      } else {
        card.style.outline = '3px solid #1a9e4b';
        card.style.borderRadius = '8px';
        badge.style.background = '#1a9e4b';
        badge.textContent = sal ? `MATCH · up to ₹${(sal / 100000).toFixed(1)}L/yr` : 'MATCH · salary not listed';
      }
      card.prepend(badge);
    });
  }

  // remember which job you opened so the log can name it on submit
  function rememberJob() {
    const title = (document.querySelector('h1, [data-testid="jobsearch-JobInfoHeader-title"], h2.jobsearch-JobInfoHeader-title') || {}).innerText;
    const company = (document.querySelector('[data-testid="inlineHeader-companyName"], [data-company-name]') || {}).innerText;
    if (title) chrome.storage.local.set({ pendingJob: { title: title.trim(), company: (company || '').trim(), url: location.href } });
  }

  // ---------- Easy Apply filling ----------

  const clean = s => (s || '').replace(/\s+/g, ' ').replace(/\*/g, '').trim();

  function questionFor(el) {
    const lb = el.getAttribute('aria-labelledby');
    if (lb) { const t = lb.split(' ').map(id => (document.getElementById(id) || {}).innerText || '').join(' '); if (clean(t)) return clean(t); }
    if (el.type === 'radio' || el.type === 'checkbox') {
      const fs = el.closest('fieldset');
      if (fs && fs.querySelector('legend')) return clean(fs.querySelector('legend').innerText);
      const grp = el.closest('[role="radiogroup"], [role="group"]');
      if (grp && grp.getAttribute('aria-label')) return clean(grp.getAttribute('aria-label'));
    }
    if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) return clean(l.innerText); }
    const wrap = el.closest('label');
    if (wrap) return clean(wrap.innerText);
    if (el.getAttribute('aria-label')) return clean(el.getAttribute('aria-label'));
    // fall back to nearest preceding text in the field's container
    let p = el.parentElement;
    for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
      const t = clean(p.innerText);
      if (t && t.length < 300) return t;
    }
    return clean(el.placeholder || el.name);
  }

  function optionLabel(el) {
    if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) return clean(l.innerText); }
    return clean((el.closest('label') || {}).innerText || el.value);
  }

  function findRule(q) { return RULES.find(r => r.q.test(q)); }

  function resolveText(rule, ctx) {
    if (!rule || rule.text == null) return null;
    return typeof rule.text === 'function' ? rule.text(ctx) : rule.text;
  }

  function setNative(el, v) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  const mark = (el, ok) => { el.style.outline = ok ? '2px solid #1a9e4b' : '3px solid #ff8c00'; el.style.outlineOffset = '2px'; };

  function fillPage() {
    let filled = 0;
    const review = [];
    const visible = el => el.offsetParent !== null || el.getClientRects().length > 0;

    // text, number, textarea
    document.querySelectorAll('input:not([type]), input[type=text], input[type=number], input[type=tel], input[type=email], input[type=url], textarea')
      .forEach(el => {
        if (!visible(el) || el.disabled || el.readOnly) return;
        const q = questionFor(el);
        if (el.value.trim()) { mark(el, true); return; } // never overwrite
        const numeric = el.type === 'number' || /numeric|decimal/.test(el.inputMode || '');
        const intOnly = (el.type === 'number' && el.step !== 'any' && (!el.step || Number.isInteger(+el.step)))
          || el.inputMode === 'numeric' || /^\^?\\d[+*]\$?$|^\[0-9\][+*]$/.test(el.pattern || '');
        const v = resolveText(findRule(q), { q, numeric, intOnly });
        if (v == null) { mark(el, false); review.push(q); return; }
        setNative(el, v);
        mark(el, true);
        filled++;
      });

    // selects
    document.querySelectorAll('select').forEach(el => {
      if (!visible(el) || el.disabled) return;
      const q = questionFor(el);
      const rule = findRule(q);
      const opts = Array.from(el.options).filter(o => o.value);
      let opt = rule && rule.pick && opts.find(o => rule.pick.test(o.text));
      if (!opt && rule) { const v = resolveText(rule, { q, numeric: false, intOnly: false }); if (v) opt = opts.find(o => clean(o.text).toLowerCase() === v.toLowerCase()); }
      if (!opt) { if (el.selectedIndex <= 0) { mark(el, false); review.push(q); } return; }
      setNative(el, opt.value);
      mark(el, true);
      filled++;
    });

    // radio groups
    const groups = {};
    document.querySelectorAll('input[type=radio]').forEach(r => { if (!r.disabled) (groups[r.name || r.id] ||= []).push(r); });
    Object.values(groups).forEach(radios => {
      const box = radios[0].closest('fieldset') || radios[0].parentElement;
      if (radios.some(r => r.checked)) { mark(box, true); return; }
      const q = questionFor(radios[0]);
      const rule = findRule(q);
      const pick = rule && rule.pick;
      const r = pick && radios.find(x => pick.test(optionLabel(x)));
      if (!r) { mark(box, false); review.push(q); return; }
      (document.querySelector(`label[for="${CSS.escape(r.id)}"]`) || r).click();
      mark(box, true);
      filled++;
    });

    // checkbox groups are left for you (often "select all that apply")
    document.querySelectorAll('input[type=checkbox]').forEach(c => {
      if (c.required && !c.checked) { const box = c.closest('fieldset') || c.parentElement; mark(box, false); review.push(questionFor(c)); }
    });

    toast(`Filled ${filled} field(s).` + (review.length ? ` ${review.length} need you (orange).` : ' Review, then click Continue.'));
    if (review.length) console.log('[Indeed Autofill] needs review:', review);
    return { filled, review: review.length };
  }

  function toast(msg) {
    const d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:2147483647;background:#222;color:#fff;font:14px system-ui;padding:10px 14px;border-radius:8px;box-shadow:0 4px 12px #0004;';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 4000);
  }

  function addButton() {
    if (document.getElementById('iaf-btn')) return;
    const b = document.createElement('button');
    b.id = 'iaf-btn';
    b.type = 'button';
    b.textContent = 'Autofill (Alt+Shift+F)';
    b.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;background:#2557a7;color:#fff;border:0;font:600 14px system-ui;padding:10px 16px;border-radius:8px;cursor:pointer;box-shadow:0 4px 12px #0004;';
    b.addEventListener('click', fillPage);
    document.body.appendChild(b);
  }

  // log the application when you press Submit
  document.addEventListener('click', e => {
    const btn = e.target.closest('button, [role=button], a');
    if (!btn) return;
    const t = clean(btn.innerText);
    if (/apply now|easily apply|^apply$/i.test(t)) rememberJob();
    if (isApply && /submit( your)? application/i.test(t)) {
      chrome.storage.local.get({ log: [], pendingJob: null }, ({ log, pendingJob }) => {
        const job = pendingJob || {};
        log.push({ date: new Date().toISOString(), title: job.title || document.title, company: job.company || '', url: job.url || location.href });
        chrome.storage.local.set({ log, pendingJob: null });
      });
    }
  }, true);

  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (msg.type === 'fill' && (isApply || document.querySelector('form input, form textarea, form select'))) reply(fillPage());
  });

  // ---------- auto mode: fill each step and press Continue, stop at Submit ----------

  const NEXT = /^(continue|next|review( your application)?)$/i;
  const SUBMIT = /submit/i;

  function visibleButtons() {
    return Array.from(document.querySelectorAll('button, [role=button]'))
      .filter(b => !b.disabled && (b.offsetParent !== null || b.getClientRects().length));
  }

  function autoStep() {
    chrome.storage.local.get({ autoMode: false }, ({ autoMode }) => {
      if (!autoMode) return;
      const { review } = fillPage();
      if (review) { toast('Auto mode paused: answer the orange fields, then click Continue.'); return; }
      const btns = visibleButtons();
      if (btns.some(b => SUBMIT.test(clean(b.innerText)))) {
        toast('Final step: check your answers, then click Submit yourself.');
        return;
      }
      const next = btns.find(b => NEXT.test(clean(b.innerText)));
      if (next) setTimeout(() => next.click(), 1200);
    });
  }

  // smartapply is a single-page app: run once per step (URL or heading change)
  function watchSteps() {
    let lastKey = '';
    setInterval(() => {
      const h = document.querySelector('h1, h2');
      const key = location.href + '|' + (h ? h.innerText : '');
      if (key === lastKey) return;
      lastKey = key;
      setTimeout(autoStep, 1500); // let the step finish rendering
    }, 1000);
  }

  // ---------- boot ----------

  if (isApply) {
    addButton();
    new MutationObserver(addButton).observe(document.body, { childList: true });
    if (isTop || document.querySelector('form')) watchSteps();
  } else if (isTop) {
    if (/\/viewjob/.test(location.pathname)) rememberJob();
    tagCards();
    let t;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(tagCards, 300); })
      .observe(document.body, { childList: true, subtree: true });
  }
})();
