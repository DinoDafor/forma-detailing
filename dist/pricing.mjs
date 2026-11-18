export const SERVICE_CATALOG = Object.freeze([
  Object.freeze({ id: 'polish', name: 'Полировка кузова', rub: 18000, usd: 300 }),
  Object.freeze({ id: 'ceramic', name: 'Керамическое покрытие', rub: 24000, usd: 400 }),
  Object.freeze({ id: 'film', name: 'Защитная плёнка', rub: 65000, usd: 1000 }),
  Object.freeze({ id: 'interior', name: 'Детейлинг салона', rub: 15000, usd: 250 })
]);

export function calculateEstimate(ids, language = 'ru') {
  if (!Array.isArray(ids) || ids.some(id => !SERVICE_CATALOG.some(service => service.id === id))) throw new TypeError('Unknown service');
  const items = SERVICE_CATALOG.filter(service => ids.includes(service.id));
  const currency = language === 'en' ? 'USD' : 'RUB';
  return { items, currency, total: items.reduce((sum, service) => sum + service[currency === 'USD' ? 'usd' : 'rub'], 0) };
}

export function formatAmount(amount, language = 'ru') {
  return language === 'en'
    ? '$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)
    : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(amount) + ' ₽';
}
