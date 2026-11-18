import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEstimate, formatAmount } from '../dist/pricing.mjs';

test('an empty selection has no paid services', () => {
  assert.deepEqual(calculateEstimate([]), { items: [], currency: 'RUB', total: 0 });
});
test('a paint correction and ceramic package totals the published starting prices', () => {
  assert.equal(calculateEstimate(['polish', 'ceramic']).total, 42000);
  assert.equal(calculateEstimate(['polish', 'ceramic'], 'en').total, 700);
});
test('all four services use the separate rounded dollar price list', () => {
  const ids = ['polish', 'ceramic', 'film', 'interior'];
  assert.equal(calculateEstimate(ids).total, 122000);
  const dollars = calculateEstimate(ids, 'en');
  assert.equal(dollars.total, 1950);
  assert.equal(dollars.currency, 'USD');
  assert.equal(formatAmount(dollars.total, 'en'), '$1,950');
});
test('duplicate selections are counted once and unknown services are rejected', () => {
  assert.equal(calculateEstimate(['polish', 'polish']).total, 18000);
  assert.throws(() => calculateEstimate(['invented']), TypeError);
  assert.throws(() => calculateEstimate('polish'), TypeError);
});
