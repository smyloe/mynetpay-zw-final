// Run with:  node tests/engine.test.js     (or: npm test)
const assert = require('assert');
const E = require('../public/assets/js/engine.js');
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; } };
const near = (a, b, tol = 0.011, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' expected ' + b + ' got ' + a);

console.log('ZIMRA 2026 PAYE tables (1 January - 31 December 2026): figures pinned');
const C = E.CONFIG;
const T26 = {
  USD: { monthlyUpTo: [100, 300, 1000, 2000, 3000, Infinity], rates: [0, 0.20, 0.25, 0.30, 0.35, 0.40], monthlyDeduct: [0, 20, 35, 85, 185, 335],
         annualUpTo: [1200, 3600, 12000, 24000, 36000, Infinity], annualDeduct: [0, 240, 420, 1020, 2220, 4020] },
  ZWG: { monthlyUpTo: [2800, 8400, 28000, 56000, 84000, Infinity], rates: [0, 0.20, 0.25, 0.30, 0.35, 0.40], monthlyDeduct: [0, 560, 980, 2380, 5180, 9380],
         annualUpTo: [33600, 100800, 336000, 672000, 1008000, Infinity], annualDeduct: [0, 6720, 11760, 28560, 62160, 112560] }
};
t('config states that it uses the 2026 tables, not the 2025 ones', () => {
  assert.ok(/2026/.test(C.meta.tablesBasis), C.meta.tablesBasis);
  assert.ok(!/2025/.test(C.meta.tablesBasis), C.meta.tablesBasis);
  assert.strictEqual(C.meta.taxYear, 2026);
});
['USD', 'ZWG'].forEach((cur) => {
  t('2026 ' + cur + ' monthly table: band limits, rates and deduct amounts', () => {
    const b = C.paye[cur], x = T26[cur];
    assert.deepStrictEqual(b.map((r) => r.upTo), x.monthlyUpTo);
    assert.deepStrictEqual(b.map((r) => r.rate), x.rates);
    assert.deepStrictEqual(b.map((r) => r.deduct), x.monthlyDeduct);
  });
  t('2026 ' + cur + ' annual table = 12 x the monthly table (limits and deduct amounts)', () => {
    const b = C.paye[cur], x = T26[cur];
    assert.deepStrictEqual(b.map((r) => r.upTo * 12), x.annualUpTo);
    assert.deepStrictEqual(b.map((r) => r.deduct * 12), x.annualDeduct);
  });
  t('2026 ' + cur + ': "rate x income minus deduct" equals tax worked slice by slice (independent check)', () => {
    const b = C.paye[cur];
    const slices = (inc) => { let tax = 0, lo = 0; for (const r of b) { const hi = Math.min(inc, r.upTo); if (hi > lo) tax += (hi - lo) * r.rate; lo = r.upTo; if (inc <= r.upTo) break; } return tax; };
    const top = cur === 'USD' ? 12000 : 300000;
    for (let inc = 0; inc <= top; inc += top / 997) near(E.bandTax(inc, b), slices(inc), 0.0001, cur + ' at ' + inc);
  });
});
t('2026 USD: US$100 a month is the 0% band; ZWG: ZiG 2,800 a month', () => { assert.strictEqual(E.bandTax(100, C.paye.USD), 0); assert.strictEqual(E.bandTax(2800, C.paye.ZWG), 0); });
t('2026 USD: top rate 40% starts above US$3,000 a month (annual US$36,000)', () => near(E.bandTax(3100, C.paye.USD) - E.bandTax(3000, C.paye.USD), 40, 0.0001));
t('2026 ZWG: top rate 40% starts above ZiG 84,000 a month', () => near(E.bandTax(84100, C.paye.ZWG) - E.bandTax(84000, C.paye.ZWG), 40, 0.0001));
t('2026 USD payslip, US$1,000 gross: PAYE 207.13', () => near(E.calc({ cur: 'USD', gross: 1000 }).paye, 207.13));
t('2026 ZWG payslip, ZiG 20,000 gross: NSSA capped at 4.5% x (700 x 26.56) = 836.64, PAYE per 2026 ZWG table', () => {
  const r = E.calc({ cur: 'ZWG', gross: 20000, rate: 26.56 });
  near(r.nssaEmployee, 836.64); near(r.taxBeforeCredits, (20000 - 836.64) * 0.25 - 980, 0.01);
});

console.log('Arithmetic checks against worked examples published by ZIMRA (same monthly rates in 2026)');
t('USD monthly: 1,800 -> 455.00 (ZIMRA published example)', () => near(E.bandTax(1800, E.CONFIG.paye.USD), 455.00, 0.0001));
t('ZWG monthly: 18,000 -> 3,520.00 (ZIMRA published example)', () => near(E.bandTax(18000, E.CONFIG.paye.ZWG), 3520.00, 0.0001));
t('USD daily-equivalent check: 9 per day style, 300 -> 40', () => near(E.bandTax(300, E.CONFIG.paye.USD), 40, 0.0001));
t('USD annual table equals 12 x monthly (32,000/yr -> 8,980; 2,666.67/m)', () => near(E.bandTax(32000 / 12, E.CONFIG.paye.USD) * 12, 8980, 0.01));
t('ZWG annual equivalent (320,000/yr -> 68,240)', () => near(E.bandTax(320000 / 12, E.CONFIG.paye.ZWG) * 12, 68240, 0.01));
t('Tax is continuous at every USD band edge', () => {
  const b = E.CONFIG.paye.USD;
  for (let i = 0; i < b.length - 1; i++) near(E.bandTax(b[i].upTo, b), E.bandTax(b[i].upTo + 0.0001, b), 0.001, 'edge ' + b[i].upTo);
});
t('Tax is continuous at every ZWG band edge', () => {
  const b = E.CONFIG.paye.ZWG;
  for (let i = 0; i < b.length - 1; i++) near(E.bandTax(b[i].upTo, b), E.bandTax(b[i].upTo + 0.0001, b), 0.001, 'edge ' + b[i].upTo);
});
t('Nothing taxed up to the 0% threshold (USD 100 / ZWG 2,800)', () => {
  assert.strictEqual(E.bandTax(100, E.CONFIG.paye.USD), 0);
  assert.strictEqual(E.bandTax(2800, E.CONFIG.paye.ZWG), 0);
});

console.log('Full payslips (USD)');
t('USD 100 with NSSA: NSSA 4.50, no PAYE', () => {
  const r = E.calc({ cur: 'USD', gross: 100 });
  near(r.nssaEmployee, 4.5); near(r.paye, 0); near(r.net, 95.5);
});
t('USD 500: NSSA 22.50, PAYE 84.38, AIDS 2.53, net 390.59', () => {
  const r = E.calc({ cur: 'USD', gross: 500 });
  near(r.nssaEmployee, 22.5); near(r.paye, 84.38); near(r.aidsLevy, 2.53); near(r.net, 390.59);
});
t('USD 1,000: NSSA capped at 31.50, PAYE 207.13, AIDS 6.21, net 755.16', () => {
  const r = E.calc({ cur: 'USD', gross: 1000 });
  near(r.nssaEmployee, 31.5); near(r.paye, 207.13); near(r.aidsLevy, 6.21); near(r.net, 755.16);
});
t('USD 5,000: PAYE 1,652.40, AIDS 49.57, net 3,266.53', () => {
  const r = E.calc({ cur: 'USD', gross: 5000 });
  near(r.paye, 1652.40); near(r.aidsLevy, 49.57); near(r.net, 3266.53);
});
t('NSSA never exceeds US$31.50 for USD earners', () => {
  for (const g of [700, 701, 2500, 20000, 1e6]) near(E.calc({ cur: 'USD', gross: g }).nssaEmployee, 31.5);
});
t('Over-65 pays no NSSA', () => near(E.calc({ cur: 'USD', gross: 900, nssaApplies: false }).nssaEmployee, 0));
t('Medical credit = 50% of contributions, cannot exceed tax', () => {
  const a = E.calc({ cur: 'USD', gross: 1000, medical: 40 });
  near(a.medicalCredit, 20); near(a.paye, 207.13 - 20);
  const b = E.calc({ cur: 'USD', gross: 200, medical: 1000 });
  near(b.paye, 0);
});
t('Elderly/blind/disabled credit = US$75 a month', () => near(E.calc({ cur: 'USD', gross: 1000, elderly: true }).paye, 207.13 - 75));
t('Pre-tax pension lowers taxable income, not the NSSA base', () => {
  const r = E.calc({ cur: 'USD', gross: 1000, pension: 100 });
  near(r.taxable, 1000 - 31.5 - 100);
});
t('Net never exceeds gross and never negative tax', () => {
  for (let g = 0; g <= 30000; g += 137.37) { const r = E.calc({ cur: 'USD', gross: g }); assert.ok(r.net <= g + 1e-9 && r.paye >= 0); }
});
t('Net pay rises with gross (monotonic)', () => {
  let prev = -1; for (let g = 0; g <= 20000; g += 7.77) { const n = E.calc({ cur: 'USD', gross: g }).net; assert.ok(n >= prev - 1e-9, 'at ' + g); prev = n; }
});

console.log('ZiG');
t('ZiG NSSA ceiling = 700 x rate', () => near(E.nssaCeiling('ZWG', 26.56), 700 * 26.56, 0.001));
t('ZiG 10,000: NSSA 450, PAYE per ZWG table', () => {
  const r = E.calc({ cur: 'ZWG', gross: 10000, rate: 26.56 });
  near(r.nssaEmployee, 450); near(r.taxable, 9550);
  near(r.taxBeforeCredits, 9550 * 0.25 - 980, 0.01);
});
t('ZiG 2,800 gross: only NSSA comes off', () => {
  const r = E.calc({ cur: 'ZWG', gross: 2800, rate: 26.56 });
  near(r.paye, 0); near(r.nssaEmployee, 126);
});

console.log('Mixed USD + ZiG (ZIMRA: USD tables, apportion)');
t('Mixed totals match the USD calculation on the converted gross', () => {
  const m = E.calc({ cur: 'MIXED', usdPart: 600, zwgPart: 10624, rate: 26.56 });
  const u = E.calc({ cur: 'USD', gross: 600 + 10624 / 26.56, rate: 26.56 });
  near(m.net, u.net); near(m.totalTax, u.totalTax);
});
t('Mixed: net USD + net ZiG/rate = total net', () => {
  const m = E.calc({ cur: 'MIXED', usdPart: 600, zwgPart: 10624, rate: 26.56 });
  near(m.mixed.netUSD + m.mixed.netZWG / 26.56, m.net, 0.02);
});
t('Mixed with only USD equals USD', () => near(E.calc({ cur: 'MIXED', usdPart: 800, zwgPart: 0 }).net, E.calc({ cur: 'USD', gross: 800 }).net));

console.log('Reverse (net -> gross)');
t('Round trip USD: net of gross(net) = net', () => {
  for (const n of [50, 250, 755.16, 1500, 3266.53, 9000]) {
    const r = E.reverse('USD', n, {}); near(r.result.net, n, 0.0051, 'target ' + n);
    assert.ok(E.calc({ cur: 'USD', gross: r.gross - 1.01 }).net < n, 'is (near-)minimal gross for ' + n);
  }
});
t('Round trip ZiG', () => { for (const n of [3000, 20000, 150000]) near(E.reverse('ZWG', n, { rate: 26.56 }).result.net, n, 0.0051); });
t('Reverse with other deductions and medical credit', () => {
  const p = { other: 25, medical: 30, pension: 20 };
  near(E.reverse('USD', 1000, p).result.net, 1000, 0.0051);
});

t('Reverse gives a tidy whole number when it can (755.16 -> 1,000)', () => assert.strictEqual(E.reverse('USD', 755.16, {}).gross, 1000));

console.log('Bonus');
t('Bonus 1,000 on salary 1,000: exempt 700, taxable 300', () => {
  const b = E.bonus('USD', { gross: 1000 }, 1000, 0);
  near(b.exemptPart, 700); near(b.taxablePart, 300);
  near(b.extraPaye, 88.42); near(b.extraAids, 2.66); near(b.netBonus, 908.92);
});
t('Bonus exemption is US$700, with the Finance Act (No. 2) of 2024 recorded as its basis', () => { assert.strictEqual(C.bonus.exemptAnnualUSD, 700); assert.strictEqual(C.bonus.legalBasis, 'Finance Act (No. 2) of 2024'); });
t('Bonus of 700 or less is tax free', () => near(E.bonus('USD', { gross: 3000 }, 700, 0).extraTax, 0));
t('Prior bonus uses up the exemption', () => {
  const b = E.bonus('USD', { gross: 1000 }, 500, 700); near(b.exemptPart, 0); near(b.taxablePart, 500);
});
t('ZiG bonus exemption = 700 x rate', () => near(E.bonus('ZWG', { gross: 20000, rate: 26.56 }, 100000, 0).exemptPart, 700 * 26.56, 0.01));

console.log('Employer cost');
t('USD 1,000: NSSA 31.50 + ZIMDEF 10 = 41.50 on top (Standards levy NOT applied by default)', () => {
  const r = E.employer('USD', { gross: 1000 }, { zimdefApplies: true });
  near(r.nssaEmployer, 31.5); near(r.zimdef, 10); near(r.sdl, 0); near(r.onTop, 41.5); near(r.total, 1041.5);
});
t('Standards Development Levy is optional: omitted flag means not applied', () => near(E.employer('USD', { gross: 1000 }, {}).sdl, 0));
t('Standards Development Levy applies only when switched on (0.5% = 5.00)', () => {
  const r = E.employer('USD', { gross: 1000 }, { zimdefApplies: true, sdlApplies: true });
  near(r.sdl, 5); near(r.onTop, 46.5); near(r.total, 1046.5);
});
t('Standards levy config: up to 0.5%, off by default', () => { assert.strictEqual(C.employerLevies.sdlRate, 0.005); assert.strictEqual(C.employerLevies.sdlAppliesByDefault, false); });
t('ZIMDEF switched off when exempt', () => near(E.employer('USD', { gross: 1000 }, { zimdefApplies: false }).zimdef, 0));
t('APWCS and other percentages are user-supplied', () => near(E.employer('USD', { gross: 1000 }, { zimdefApplies: true, apwcsPct: 2, otherPct: 1 }).onTop, 41.5 + 20 + 10));

console.log('Payslip checker');
t('A correct payslip shows zero differences', () => {
  const e = E.calc({ cur: 'USD', gross: 1000 });
  const c = E.checkPayslip('USD', { gross: 1000 }, { nssa: e.nssaEmployee, paye: e.paye, aids: e.aidsLevy, net: e.net });
  Object.values(c.diffs).forEach(d => near(d, 0)); near(c.arithmetic, 0);
});
t('Wrong PAYE is flagged', () => {
  const c = E.checkPayslip('USD', { gross: 1000 }, { nssa: 31.5, paye: 150, aids: 4.5, net: 814 });
  assert.ok(Math.abs(c.diffs.paye) > 50);
});

console.log('\n' + passed + ' tests passed' + (process.exitCode ? ' - SOME FAILED' : ''));
