import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../dist/analytics.js', import.meta.url), 'utf8');
class Element {
  constructor(id) { this.id = id; this.hidden = true; this.listeners = {}; }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  fire(name, event = {}) { for (const callback of this.listeners[name] || []) callback(event); }
  querySelector() { return new Element('button'); }
  focus() {}
}
function boot({ config = {}, saved, href = 'https://example.com/', blockedStorage = false } = {}) {
  const elements = Object.fromEntries(['analytics-consent', 'analytics-settings', 'analytics-providers', 'analytics-accept', 'analytics-decline', 'booking-form', 'service'].map(id => [id, new Element(id)]));
  const document = new Element('document');
  const scripts = [];
  document.querySelector = selector => elements[selector.slice(1)] || null;
  document.querySelectorAll = () => [];
  document.createElement = () => ({});
  document.head = { append: script => scripts.push(script.src) };
  document.referrer = 'https://source.example/private?email=secret@example.com';
  document.title = 'FORMA';
  document.documentElement = { scrollHeight: 2000 };
  document.visibilityState = 'visible';
  const storage = new Map();
  if (saved) storage.set('forma.analytics.consent.v1', JSON.stringify(saved));
  const localStorage = {
    getItem: key => { if (blockedStorage) throw Error('blocked'); return storage.get(key) || null; },
    setItem: (key, value) => { if (blockedStorage) throw Error('blocked'); storage.set(key, value); },
    removeItem: key => storage.delete(key)
  };
  const sessionValues = new Map();
  const sessionStorage = { getItem: key => sessionValues.get(key) || null, setItem: (key, value) => sessionValues.set(key, value), removeItem: key => sessionValues.delete(key) };
  let reloaded = false;
  let interval;
  let now = 100;
  const window = new Element('window');
  Object.assign(window, { FORMA_ANALYTICS_CONFIG: config, location: Object.assign(new URL(href), { reload: () => { reloaded = true; } }), innerHeight: 1000, scrollY: 0, localStorage, sessionStorage, setInterval: callback => { interval = callback; } });
  vm.runInNewContext(source, { window, document, URL, URLSearchParams, performance: { now: () => now }, console: { info() {} } });
  return { window, document, elements, scripts, storage, sessionValues, api: window.FormaAnalytics, reloaded: () => reloaded, tick: () => { now += 1000; interval(); } };
}
const ids = { yandexMetrikaId: '12345678', googleAnalyticsId: 'G-TEST123', googleAdsId: 'AW-12345678', googleAdsLeadLabel: 'lead_label', webvisor: true };
const granted = { allowed: true, at: Date.now() };
const queue = window => Array.from(window.dataLayer || [], args => Array.from(args));

test('empty configuration stays inactive with no banner, scripts or attribution', () => {
  const app = boot();
  assert.equal(app.api.status().configured, false);
  assert.equal(app.api.status().enabled, false);
  assert.equal(app.elements['analytics-consent'].hidden, true);
  assert.equal(app.elements['analytics-settings'].hidden, true);
  assert.equal(app.scripts.length, 0);
  assert.equal(app.sessionValues.size, 0);
});
test('configured counters wait for consent and do not collect a pre-consent backlog', () => {
  const app = boot({ config: ids });
  assert.equal(app.elements['analytics-consent'].hidden, false);
  assert.equal(app.scripts.length, 0);
  app.api.track('request_prepared', { service: 'Полировка кузова' });
  app.elements['analytics-accept'].fire('click');
  assert.equal(app.api.status().enabled, true);
  assert.equal(app.scripts.length, 2);
  assert.equal(queue(app.window).filter(args => args[1] === 'page_view').length, 1);
  assert.equal(queue(app.window).filter(args => args[1] === 'request_prepared').length, 0);
  app.elements['analytics-accept'].fire('click');
  assert.equal(app.scripts.length, 2);
});
test('refusal persists without loading any providers', () => {
  const app = boot({ config: ids });
  app.elements['analytics-decline'].fire('click');
  assert.equal(app.api.status().consent, false);
  assert.equal(app.elements['analytics-consent'].hidden, true);
  assert.equal(app.scripts.length, 0);
  assert.equal(JSON.parse(app.storage.get('forma.analytics.consent.v1')).allowed, false);
});
test('saved refusal is respected; settings can reopen the choice', () => {
  const app = boot({ config: ids, saved: { allowed: false, at: Date.now() } });
  assert.equal(app.elements['analytics-consent'].hidden, true);
  assert.equal(app.scripts.length, 0);
  app.api.openSettings();
  assert.equal(app.elements['analytics-consent'].hidden, false);
});
test('saved permission expires after 180 days', () => {
  const app = boot({ config: ids, saved: { allowed: true, at: Date.now() - 181 * 86400000 } });
  assert.equal(app.scripts.length, 0);
  assert.equal(app.elements['analytics-consent'].hidden, false);
});
test('consent precedes Google initialization; Metrika uses one controlled page hit', () => {
  const app = boot({ config: ids, saved: granted });
  const google = queue(app.window);
  assert.deepEqual(google.slice(0, 3).map(args => args[0]), ['consent', 'consent', 'js']);
  assert.equal(google[0][2].ad_storage, 'denied');
  assert.equal(google[1][2].ad_storage, 'granted');
  const yandex = app.window.ym.a.map(args => Array.from(args));
  assert.equal(yandex.filter(args => args[1] === 'hit').length, 1);
  assert.equal(yandex[0][2].defer, true);
  assert.equal(yandex[0][2].webvisor, true);
});
test('query and referrer strip contacts but retain campaign and advertising click identifiers', () => {
  const app = boot({ config: ids, saved: granted, href: 'https://example.com/?utm_source=avito&utm_campaign=winter_2026&utm_term=secret%40example.com&phone=79991234567&gclid=Abc123&yclid=123456789#booking' });
  const hit = Array.from(app.window.ym.a.find(args => args[1] === 'hit'));
  assert.equal(hit[2].includes('phone'), false);
  assert.equal(hit[2].includes('secret'), false);
  assert.equal(hit[2].includes('#booking'), false);
  assert.equal(hit[2].includes('utm_source=avito'), true);
  assert.equal(hit[2].includes('gclid=Abc123'), true);
  assert.equal(hit[3].referer, 'https://source.example');
});
test('event payloads exclude free input and unknown keys', () => {
  const app = boot({ config: ids, saved: granted });
  app.api.track('request_prepared', { service: 'Полировка кузова', car: 'Secret', task: 'secret@example.com', phone: '79991234567' });
  const event = queue(app.window).find(args => args[1] === 'request_prepared');
  assert.equal(event[2].service, 'Полировка кузова');
  assert.equal('car' in event[2], false);
  assert.equal('task' in event[2], false);
  assert.equal('phone' in event[2], false);
  assert.equal(app.api.track('arbitrary_event'), false);
});
test('prepared text is not a lead or an advertising conversion', () => {
  const app = boot({ config: ids, saved: granted });
  app.api.track('request_prepared', { service: 'Полировка кузова' });
  assert.equal(queue(app.window).some(args => args[1] === 'generate_lead' || args[1] === 'conversion'), false);
  assert.equal(app.api.confirmLead('request_123'), true);
  assert.equal(app.api.confirmLead('request_123'), false);
  assert.equal(app.api.confirmLead('secret@example.com'), false);
  assert.equal(queue(app.window).filter(args => args[1] === 'conversion').length, 1);
  assert.equal(queue(app.window).find(args => args[1] === 'conversion')[2].transaction_id, 'request_123');
});
test('withdrawal stops event dispatch, forgets attribution and reloads third-party code', () => {
  const app = boot({ config: ids, saved: granted });
  app.elements['analytics-decline'].fire('click');
  const count = app.window.dataLayer.length;
  assert.equal(app.api.track('request_prepared'), false);
  assert.equal(app.window.dataLayer.length, count);
  assert.equal(app.api.status().enabled, false);
  assert.equal(app.sessionValues.size, 0);
  assert.equal(app.reloaded(), true);
});
test('debug mode works locally without activating trackers', () => {
  const app = boot();
  app.api.setDebug(true);
  app.api.track('request_prepared', { service: 'Полировка кузова' });
  assert.equal(app.api.getEvents().length, 1);
  assert.equal(app.api.getEvents()[0].sent, false);
  assert.equal(app.scripts.length, 0);
});
test('invalid account IDs never load remote code', () => {
  const app = boot({ config: { yandexMetrikaId: 'ID_HERE', googleAnalyticsId: 'G-<script>', googleAdsId: 'AW-example' }, saved: granted });
  assert.equal(app.api.status().configured, false);
  assert.equal(app.scripts.length, 0);
});
test('blocked storage does not break consent or page operation', () => {
  const app = boot({ config: ids, blockedStorage: true });
  app.elements['analytics-accept'].fire('click');
  assert.equal(app.api.status().enabled, true);
  assert.equal(app.scripts.length, 2);
});
test('scroll milestones are emitted once and hidden tabs do not accumulate engagement', () => {
  const app = boot({ config: ids, saved: granted });
  app.window.scrollY = 500;
  app.window.fire('scroll');
  app.window.fire('scroll');
  assert.equal(queue(app.window).filter(args => args[1] === 'scroll_depth').length, 2);
  app.document.visibilityState = 'hidden';
  for (let i = 0; i < 30; i++) app.tick();
  assert.equal(queue(app.window).some(args => args[1] === 'engaged_time'), false);
  app.document.visibilityState = 'visible';
  for (let i = 0; i < 16; i++) app.tick();
  assert.equal(queue(app.window).filter(args => args[1] === 'engaged_time').length, 1);
});
test('form inputs and rendered summary are masked for Webvisor', () => {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.match(html, /<input class="ym-disable-keys" id="car"/);
  assert.match(html, /<textarea class="ym-disable-keys" id="task"/);
  assert.match(html, /id="request-summary" class="ym-hide-content"/);
  assert.match(html, /id="booking-form" class="ym-disable-submit"/);
});
