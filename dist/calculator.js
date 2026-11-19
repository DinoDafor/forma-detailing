import { calculateEstimate, formatAmount } from './pricing.mjs';

const calculator = document.querySelector('#calculator');
const choices = [...calculator.querySelectorAll('input[type="checkbox"]')];
const list = calculator.querySelector('#calculator-items');
const total = calculator.querySelector('#calculator-total');
const empty = calculator.querySelector('#calculator-empty');
const applyButton = calculator.querySelector('#calculator-apply');
const resetButton = calculator.querySelector('#calculator-reset');
const form = document.querySelector('#booking-form');
const serviceSelect = document.querySelector('#service');
const bookingEstimate = document.querySelector('#booking-estimate');
let applied = false;
const language = () => window.FormaI18n?.language ?? 'ru';
const tr = text => window.FormaI18n?.t(text) ?? text;
const selectedIds = () => choices.filter(choice => choice.checked).map(choice => choice.value);

function getAppliedEstimate() {
  if (!applied) return null;
  const estimate = calculateEstimate(selectedIds(), language());
  return { ...estimate, ids: estimate.items.map(item => item.id), formatted: tr('от') + ' ' + formatAmount(estimate.total, language()) };
}

function clearApplied() {
  applied = false;
  bookingEstimate.hidden = true;
}

function syncBooking() {
  const estimate = getAppliedEstimate();
  if (!estimate?.items.length) { serviceSelect.selectedIndex = 0; clearApplied(); return; }
  const singleService = estimate.items.length === 1 ? estimate.items[0].name : '';
  serviceSelect.value = [...serviceSelect.options].some(option => option.value === singleService)
    ? singleService : 'Помогите выбрать уход';
  document.querySelector('#booking-estimate-text').textContent = tr('Ваш набор:') + ' ' + estimate.items.map(item => tr(item.name)).join(' + ') + ' — ' + estimate.formatted;
  bookingEstimate.hidden = false;
}

function render() {
  const estimate = calculateEstimate(selectedIds(), language());
  list.replaceChildren();
  for (const item of estimate.items) {
    const row = document.createElement('li');
    const label = document.createElement('span');
    const price = document.createElement('span');
    label.textContent = tr(item.name);
    price.textContent = formatAmount(item[language() === 'en' ? 'usd' : 'rub'], language());
    row.append(label, price);
    list.append(row);
  }
  empty.hidden = estimate.items.length > 0;
  total.textContent = estimate.items.length ? tr('от') + ' ' + formatAmount(estimate.total, language()) : '—';
  applyButton.disabled = !estimate.items.length;
  resetButton.disabled = !estimate.items.length;
  if (applied) syncBooking();
}

const zones = [...calculator.querySelectorAll('[data-zone]')];
function showZone(activeZone) {
  for (const button of zones) button.setAttribute('aria-pressed', String(button.dataset.zone === activeZone));
  for (const choice of choices) {
    const option = choice.closest('.calculator-option');
    option.hidden = activeZone !== 'all' && option.dataset.serviceZone !== activeZone;
  }
}
zones.forEach(button => button.addEventListener('click', () => showZone(button.dataset.zone)));
choices.forEach(choice => choice.addEventListener('change', render));
resetButton.addEventListener('click', () => {
  if (applied) serviceSelect.selectedIndex = 0;
  clearApplied();
  choices.forEach(choice => { choice.checked = false; });
  render();
});
document.querySelector('#booking-estimate-remove').addEventListener('click', () => {
  clearApplied();
  serviceSelect.selectedIndex = 0;
});
serviceSelect.addEventListener('change', clearApplied);
document.querySelectorAll('.service-pick, #recommendation-pick').forEach(button => button.addEventListener('click', clearApplied));
applyButton.addEventListener('click', () => {
  applied = true;
  syncBooking();
  form.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  const firstEmpty = [...form.querySelectorAll('[required]')].find(field => !field.value.trim());
  (firstEmpty ?? serviceSelect).focus({ preventScroll: true });
});
document.querySelectorAll('[data-care-package]').forEach(link => {
  link.addEventListener('click', () => {
    const ids = link.dataset.carePackage.split(' ');
    showZone('all');
    if (applied) serviceSelect.selectedIndex = 0;
    clearApplied();
    choices.forEach(choice => { choice.checked = ids.includes(choice.value); });
    render();
  });
});
window.addEventListener('forma:languagechange', render);
window.FormaCalculator = Object.freeze({ getAppliedEstimate, clearApplied });
render();
