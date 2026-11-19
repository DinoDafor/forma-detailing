export const SERVICE_CATALOG = Object.freeze([
  Object.freeze({ id: 'polish', name: 'Полировка кузова', rub: 18000, usd: 300 }),
  Object.freeze({ id: 'ceramic', name: 'Керамическое покрытие', rub: 24000, usd: 400 }),
  Object.freeze({ id: 'film', name: 'Защитная плёнка', rub: 65000, usd: 1000 }),
  Object.freeze({ id: 'interior', name: 'Детейлинг салона', rub: 15000, usd: 250 }),
  Object.freeze({ id: 'headlight-polish', name: 'Полировка фар', rub: 5000, usd: 80 }),
  Object.freeze({ id: 'headlight-film', name: 'Плёнка на фары', rub: 8000, usd: 130 }),
  Object.freeze({ id: 'glass-coating', name: 'Антидождь на лобовое', rub: 5000, usd: 80 }),
  Object.freeze({ id: 'leather-care', name: 'Чистка и уход за кожей', rub: 7000, usd: 120 }),
  Object.freeze({ id: 'wheel-clean', name: 'Глубокая очистка дисков', rub: 4500, usd: 75 }),
  Object.freeze({ id: 'wheel-coating', name: 'Керамика для дисков', rub: 9000, usd: 150 })
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
