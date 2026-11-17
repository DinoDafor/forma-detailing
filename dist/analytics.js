(() => {
  'use strict';
  const config = window.FORMA_ANALYTICS_CONFIG || {};
  const metrikaId = /^[1-9]\d{3,}$/.test(String(config.yandexMetrikaId || '')) ? Number(config.yandexMetrikaId) : null;
  const gaId = /^G-[A-Z0-9]+$/.test(config.googleAnalyticsId || '') ? config.googleAnalyticsId : '';
  const adsId = /^AW-\d+$/.test(config.googleAdsId || '') ? config.googleAdsId : '';
  const configured = Boolean(metrikaId || gaId || adsId);
  const consentKey = 'forma.analytics.consent.v1';
  const attributionKey = 'forma.analytics.attribution.v1';
  const consentLifetime = 180 * 24 * 60 * 60 * 1000;
  const campaignKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const clickIdKeys = ['yclid', 'gclid', 'gbraid', 'wbraid'];
  const events = [];
  let enabled = false;
  let started = false;
  let attribution = {};
  let activeSeconds = 0;
  let lastTick = 0;
  let debug = config.debug === true;
  const once = new Set();
  const leadIds = new Set();
  const read = (storage, key) => { try { return JSON.parse(window[storage].getItem(key)); } catch { return null; } };
  const write = (storage, key, value) => { try { window[storage].setItem(key, JSON.stringify(value)); } catch { /* Storage can be blocked. */ } };
  const forget = (storage, key) => { try { window[storage].removeItem(key); } catch { /* Storage can be blocked. */ } };
  const savedConsent = read('localStorage', consentKey);
  let consent = savedConsent && typeof savedConsent.allowed === 'boolean' && savedConsent.at > Date.now() - consentLifetime && savedConsent.at <= Date.now() ? savedConsent : null;
  const pageLocation = () => {
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = '';
    const original = new URLSearchParams(window.location.search);
    for (const key of campaignKeys) {
      const value = original.get(key);
      // Campaign names must be labels, never visitor names, contacts or free text.
      if (value && /^[a-zA-Zа-яА-ЯёЁ0-9_.-]{1,100}$/.test(value) && !/\d{7,}/.test(value)) url.searchParams.set(key, value);
    }
    for (const key of clickIdKeys) {
      const value = original.get(key);
      if (value && /^[a-zA-Z0-9_-]{1,256}$/.test(value)) url.searchParams.set(key, value);
    }
    return url.href;
  };
  const referrerOrigin = () => { try { return new URL(document.referrer).origin; } catch { return ''; } };
  const getAttribution = () => {
    const url = new URL(pageLocation());
    const current = Object.fromEntries(campaignKeys.filter(key => url.searchParams.has(key)).map(key => [key, url.searchParams.get(key)]));
    const stored = read('sessionStorage', attributionKey);
    const first = stored && stored.first && typeof stored.first === 'object' ? stored.first : { ...current, referrer: referrerOrigin() };
    const last = Object.keys(current).length ? current : (stored && stored.last) || first;
    const result = { first, last };
    write('sessionStorage', attributionKey, result);
    return result;
  };
  const loadScript = (src) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    document.head.append(script);
  };
  function startProviders() {
    if (metrikaId) {
      window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
      window.ym.l = Date.now();
      window.ym(metrikaId, 'init', {
        defer: true, clickmap: true, trackLinks: false, accurateTrackBounce: true,
        webvisor: config.webvisor === true, disableYtm: true,
        params: { attribution }
      });
      window.ym(metrikaId, 'hit', pageLocation(), { referer: referrerOrigin(), title: document.title });
      loadScript('https://mc.yandex.ru/metrika/tag.js');
    }
    if (gaId || adsId) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
      window.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      window.gtag('consent', 'update', { analytics_storage: gaId ? 'granted' : 'denied', ad_storage: adsId ? 'granted' : 'denied', ad_user_data: adsId ? 'granted' : 'denied', ad_personalization: adsId ? 'granted' : 'denied' });
      window.gtag('js', new Date());
      const common = { send_page_view: false, page_location: pageLocation(), page_referrer: referrerOrigin(), allow_google_signals: Boolean(adsId), allow_ad_personalization_signals: Boolean(adsId) };
      if (gaId) window.gtag('config', gaId, common);
      if (adsId) window.gtag('config', adsId, common);
      loadScript(`https://www.googletagmanager.com/gtag/js?id=${gaId || adsId}`);
    }
  }
  // Allowlisted metadata only. No input values, contact details, link query strings or arbitrary payloads.
  const allowedParams = new Set(['section', 'target', 'service', 'goal', 'position', 'channel', 'percent', 'seconds', 'field', 'reason']);
  const eventNames = new Set(['page_view', 'section_view', 'navigation_click', 'cta_click', 'service_open', 'service_select', 'goal_select', 'faq_open', 'form_start', 'form_error', 'request_prepared', 'contact_click', 'outbound_click', 'scroll_depth', 'engaged_time', 'session_end', 'generate_lead']);
  function track(name, params = {}) {
    if ((!enabled && !debug) || !eventNames.has(name)) return false;
    const safe = Object.fromEntries(Object.entries(params).filter(([key, value]) => allowedParams.has(key) && (typeof value === 'number' || (typeof value === 'string' && /^[a-zA-Zа-яА-ЯёЁ0-9 _.-]{1,80}$/.test(value)))));
    if (debug) {
      events.push({ event: name, ...safe, sent: enabled, at: new Date().toISOString() });
      if (events.length > 100) events.shift();
      console.info('[FORMA analytics]', name, safe, enabled ? 'provider queue' : 'local debug only');
    }
    if (!enabled) return false;
    if (metrikaId && name !== 'page_view') window.ym(metrikaId, 'reachGoal', name, safe);
    if (gaId) window.gtag('event', name, { ...safe, send_to: gaId, page_location: pageLocation(), page_referrer: referrerOrigin(), ...attribution.last });
    return true;
  }
  function trackOnce(key, name, params) {
    if (once.has(key) || (!enabled && !debug)) return;
    once.add(key);
    track(name, params);
  }
  function start() {
    if (started || !configured) return;
    started = true;
    enabled = true;
    attribution = getAttribution();
    startProviders();
    track('page_view');
    observeSections();
    lastTick = performance.now();
    checkScroll();
  }
  const banner = document.querySelector('#analytics-consent');
  const settingsButton = document.querySelector('#analytics-settings');
  function showSettings() {
    if (!configured || !banner) return;
    banner.hidden = false;
    banner.querySelector('button').focus({ preventScroll: true });
  }
  function chooseConsent(allowed) {
    consent = { allowed, at: Date.now() };
    write('localStorage', consentKey, consent);
    banner.hidden = true;
    if (allowed) { start(); return; }
    forget('sessionStorage', attributionKey);
    if (enabled) {
      enabled = false;
      if (gaId) window[`ga-disable-${gaId}`] = true;
      if (window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      // Reload unloads third-party listeners, including Webvisor.
      window.location.reload();
    }
  }
  settingsButton?.addEventListener('click', showSettings);
  document.querySelector('#analytics-accept')?.addEventListener('click', () => chooseConsent(true));
  document.querySelector('#analytics-decline')?.addEventListener('click', () => chooseConsent(false));
  if (configured) {
    settingsButton.hidden = false;
    const providers = [metrikaId && 'Яндекс Метрика', gaId && 'Google Analytics', adsId && 'Google Ads'].filter(Boolean);
    document.querySelector('#analytics-providers').textContent = providers.join(', ');
    if (consent?.allowed) start();
    else if (!consent) banner.hidden = false;
  }
  const sectionOf = element => element.closest('section')?.id || (element.closest('header') ? 'header' : element.closest('footer') ? 'footer' : 'hero');
  document.addEventListener('click', event => {
    const control = event.target.closest('a, button');
    if (!control || control.closest('#analytics-consent') || control === settingsButton) return;
    const position = sectionOf(control);
    if (control.matches('button[data-goal]')) track('goal_select', { goal: control.dataset.goal, position });
    if (control.matches('.service-pick, #recommendation-pick')) track('service_select', { service: document.querySelector('#service').value, position });
    if (control.matches('.submit-button[type="submit"], .service-pick, #recommendation-pick')) track('cta_click', { position });
    if (control.tagName !== 'A') return;
    const raw = control.getAttribute('href') || '';
    if (raw.startsWith('#')) {
      track('navigation_click', { target: raw.slice(1) || 'top', position });
      if (raw === '#booking' || raw === '#selector') track('cta_click', { target: raw.slice(1), position });
      return;
    }
    let url;
    try { url = new URL(control.href); } catch { return; }
    const channel = url.protocol === 'tel:' ? 'phone' : url.protocol === 'mailto:' ? 'email' : /^(t\.me|telegram\.me)$/.test(url.hostname) || url.protocol === 'tg:' ? 'telegram' : /^(wa\.me|api\.whatsapp\.com)$/.test(url.hostname) || url.protocol === 'whatsapp:' ? 'whatsapp' : '';
    if (channel) track('contact_click', { channel, position });
    else if (/^https?:$/.test(url.protocol) && url.origin !== window.location.origin) track('outbound_click', { target: url.hostname, position });
  });
  document.querySelectorAll('.service, .faq-list details').forEach((details, index) => {
    let previousOpen = details.open;
    details.addEventListener('toggle', () => {
      if (details.open && !previousOpen) track(details.matches('.service') ? 'service_open' : 'faq_open', { target: `item_${index + 1}`, position: sectionOf(details) });
      previousOpen = details.open;
    });
  });
  const form = document.querySelector('#booking-form');
  form?.addEventListener('input', () => trackOnce('form_start', 'form_start', { position: 'booking' }));
  form?.addEventListener('change', () => trackOnce('form_start', 'form_start', { position: 'booking' }));
  form?.addEventListener('invalid', event => track('form_error', { field: event.target.id, reason: 'invalid' }), true);
  function observeSections() {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        trackOnce(`section_${entry.target.id}`, 'section_view', { section: entry.target.id });
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -15% 0px', threshold: 0 });
    document.querySelectorAll('main section[id]').forEach(section => observer.observe(section));
  }
  function checkScroll() {
    const height = document.documentElement.scrollHeight - window.innerHeight;
    if (height <= 0) return;
    const percent = Math.min(100, Math.round(window.scrollY / height * 100));
    for (const threshold of [25, 50, 75, 90, 100]) if (percent >= threshold) trackOnce(`scroll_${threshold}`, 'scroll_depth', { percent: threshold });
  }
  window.addEventListener('scroll', checkScroll, { passive: true });
  function tick() {
    const now = performance.now();
    if ((enabled || debug) && document.visibilityState === 'visible' && lastTick) activeSeconds += Math.min((now - lastTick) / 1000, 2);
    lastTick = now;
    for (const seconds of [15, 30, 60, 120]) if (activeSeconds >= seconds) trackOnce(`time_${seconds}`, 'engaged_time', { seconds });
  }
  window.setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => { lastTick = performance.now(); });
  window.addEventListener('pagehide', () => track('session_end', { seconds: Math.round(activeSeconds) }));
  // Call only from a future backend success handler with its opaque request ID.
  function confirmLead(requestId) {
    if (!enabled || typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(requestId) || leadIds.has(requestId)) return false;
    leadIds.add(requestId);
    track('generate_lead', { position: 'booking' });
    if (adsId && /^[a-zA-Z0-9_-]+$/.test(config.googleAdsLeadLabel || '')) window.gtag('event', 'conversion', { send_to: `${adsId}/${config.googleAdsLeadLabel}`, transaction_id: requestId });
    return true;
  }
  window.FormaAnalytics = Object.freeze({
    track, confirmLead, openSettings: showSettings,
    setDebug(value) { debug = value === true; if (debug) observeSections(); },
    getEvents: () => events.map(event => ({ ...event })),
    status: () => ({ configured, enabled, consent: consent?.allowed ?? null, debug })
  });
})();
