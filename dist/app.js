const tr = text => window.FormaI18n?.t(text) ?? text;
const menuToggle = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('#mobile-nav');
function closeMenu() {
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', tr('Открыть меню'));
  mobileNav.hidden = true;
}
menuToggle.addEventListener('click', () => {
  const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!expanded));
  menuToggle.setAttribute('aria-label', tr(expanded ? 'Открыть меню' : 'Закрыть меню'));
  mobileNav.hidden = expanded;
});
mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
window.addEventListener('resize', () => { if (window.innerWidth > 760) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

const suggestions = {
  shine: { title: 'Полировка кузова', description: 'Для потускневшего лака и мелких следов от моек. Глубину коррекции мастер определяет после осмотра покрытия.', price: 'от 18 000 ₽' },
  protect: { title: 'Защитная плёнка', description: 'Для нового автомобиля и поездок по трассе. Начать можно с зон риска: бампера, капота, зеркал и передних крыльев.', price: 'от 65 000 ₽' },
  interior: { title: 'Детейлинг салона', description: 'Для свежести и комфорта внутри. Очистка текстиля, кожи и труднодоступных мест с учётом особенностей материалов.', price: 'от 15 000 ₽' }
};
let selectedGoal = 'shine';
function renderRecommendation() {
  const suggestion = suggestions[selectedGoal];
  document.querySelector('.recommendation').dataset.goal = selectedGoal;
  document.querySelector('#recommendation-title').textContent = tr(suggestion.title);
  document.querySelector('#recommendation-description').textContent = tr(suggestion.description);
  document.querySelector('#recommendation-price').textContent = tr(suggestion.price);
  document.querySelector('#recommendation-pick').setAttribute('aria-label', `${tr('Выбрать:')} ${tr(suggestion.title)}`);
}
document.querySelectorAll('[data-goal]').forEach(button => {
  button.addEventListener('click', () => {
    selectedGoal = button.dataset.goal;
    document.querySelectorAll('[data-goal]').forEach(option => {
      if (option.tagName === 'BUTTON') option.setAttribute('aria-pressed', String(option === button));
    });
    renderRecommendation();
  });
});

function chooseService(service) {
  document.querySelector('#service').value = service;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelector('#booking').scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
  document.querySelector('#car').focus({ preventScroll: true });
}
document.querySelectorAll('.service-pick').forEach(button => {
  button.addEventListener('click', () => chooseService(button.dataset.service));
});
document.querySelector('#recommendation-pick').addEventListener('click', () => chooseService(suggestions[selectedGoal].title));

document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
});
document.querySelector('.dialog-done').addEventListener('click', () => document.querySelector('#result-dialog').close());
const bookingForm = document.querySelector('#booking-form');
const carInput = document.querySelector('#car');
let preparedRequestText = '';
document.querySelector('#request-copy').addEventListener('click', async () => {
  const status = document.querySelector('#request-copy-status');
  try {
    await navigator.clipboard.writeText(preparedRequestText);
    status.textContent = tr('Текст скопирован. Вставьте его в чат Telegram.');
  } catch {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector('#request-summary'));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    status.textContent = tr('Текст выделен. Скопируйте его вручную и вставьте в Telegram.');
  }
});
const requestedService = new URLSearchParams(window.location.search).get('service');
const serviceSelect = document.querySelector('#service');
if ([...serviceSelect.options].some(option => option.value === requestedService)) serviceSelect.value = requestedService;
carInput.addEventListener('input', () => carInput.setCustomValidity(''));
carInput.addEventListener('invalid', () => {
  if (!carInput.value.trim()) carInput.setCustomValidity(tr('Укажите марку или модель автомобиля.'));
});
function renderRequest() {
  const car = carInput.value.trim();
  const summary = document.querySelector('#request-summary');
  summary.replaceChildren();
  const fields = [ [tr('Автомобиль'), car], [tr('Услуга'), tr(serviceSelect.value)] ];
  const packageEstimate = window.FormaCalculator?.getAppliedEstimate();
  if (packageEstimate) {
    const serviceField = fields.find(([label]) => label === tr('Услуга'));
    serviceField[1] = packageEstimate.items.map(item => tr(item.name)).join(' + ');
    fields.push([tr('Предварительная стоимость'), packageEstimate.formatted]);
  }
  const task = document.querySelector('#task').value.trim();
  if (task) fields.push([tr('Задача'), task]);
  fields.forEach(([label, value]) => {
    const paragraph = document.createElement('p');
    const title = document.createElement('strong');
    title.textContent = `${label}: `;
    paragraph.append(title, document.createTextNode(value));
    summary.append(paragraph);
  });
  preparedRequestText = [tr('Здравствуйте! Хочу обсудить уход за автомобилем в FORMA.'), '', ...fields.map(([label, value]) => `${label}: ${value}`)].join('\n');
  const telegramUrl = new URL('https://t.me/DinoDafor');
  telegramUrl.search = `?text=${encodeURIComponent(preparedRequestText)}`;
  document.querySelector('#request-telegram').href = telegramUrl.href;
  document.querySelector('#request-copy-status').textContent = '';
}
bookingForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!carInput.value.trim()) {
    window.FormaAnalytics?.track('form_error', {field:'car', reason:'blank'});
    carInput.setCustomValidity(tr('Укажите марку или модель автомобиля.'));
    carInput.reportValidity();
    return;
  }
  renderRequest();
  document.querySelector('#result-dialog').showModal();
  window.FormaAnalytics?.track('request_prepared', { service: serviceSelect.value, position: 'booking' });
});
window.addEventListener('forma:languagechange', () => {
  renderRecommendation();
  menuToggle.setAttribute('aria-label', tr(menuToggle.getAttribute('aria-expanded') === 'true' ? 'Закрыть меню' : 'Открыть меню'));
  if (carInput.validity.customError) carInput.setCustomValidity(tr('Укажите марку или модель автомобиля.'));
  if (document.querySelector('#result-dialog').open) renderRequest();
});
renderRecommendation();
