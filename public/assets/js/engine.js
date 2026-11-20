/*!
 * MyNetPay ZW - calculation engine
 * Pure functions, no DOM. Runs in the browser and in Node (for tests and for
 * the build script that generates the salary tables).
 * All statutory figures come from config.js (TAX_CONFIG).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./config.js'));
  else root.MNP = factory(root.MNP_CONFIG);
})(typeof self !== 'undefined' ? self : this, function (CFG) {
  'use strict';

  var round2 = function (x) { return Math.round((x + Number.EPSILON) * 100) / 100; };
  var num = function (v) { v = parseFloat(v); return isFinite(v) && v > 0 ? v : 0; };

  /** ZIMRA method: tax = taxable x rate - deduct, using the band the income falls in. */
  function bandTax(taxable, bands) {
    if (!(taxable > 0)) return 0;
    for (var i = 0; i < bands.length; i++) {
      if (taxable <= bands[i].upTo) return Math.max(0, taxable * bands[i].rate - bands[i].deduct);
    }
    return 0;
  }
  function marginalRate(taxable, bands) {
    if (!(taxable > 0)) return 0;
    for (var i = 0; i < bands.length; i++) if (taxable <= bands[i].upTo) return bands[i].rate;
    return bands[bands.length - 1].rate;
  }

  function nssaCeiling(cur, rate) {
    return cur === 'USD' ? CFG.nssa.ceilingUSD : CFG.nssa.ceilingUSD * rate;
  }

  /**
   * Single-currency payroll (monthly). cur = 'USD' | 'ZWG'.
   * p: { gross, nssaApplies, pension, medical, elderly, other, rate, extraTaxable }
   * extraTaxable is added to taxable income only (used for bonus tax).
   */
  function calcSingle(cur, p) {
    var rate = num(p.rate) || CFG.reference.rate;
    var gross = num(p.gross);
    var nssaApplies = p.nssaApplies !== false;
    var ceiling = nssaCeiling(cur, rate);
    var insurable = Math.min(gross, ceiling);
    var nssaEmp = nssaApplies ? round2(insurable * CFG.nssa.employeeRate) : 0;
    var nssaEr = nssaApplies ? round2(insurable * CFG.nssa.employerRate) : 0;
    var pension = round2(num(p.pension));
    var extra = num(p.extraTaxable);
    var taxable = Math.max(0, round2(gross + extra - nssaEmp - pension));
    var bands = CFG.paye[cur];
    var taxBefore = round2(bandTax(taxable, bands));

    var medicalCredit = round2(num(p.medical) * CFG.credits.medicalRate);
    var elderlyMonthlyUSD = CFG.credits.elderlyBlindDisabledAnnualUSD / 12;
    var elderlyCredit = p.elderly ? round2(cur === 'USD' ? elderlyMonthlyUSD : elderlyMonthlyUSD * rate) : 0;
    var credits = Math.min(taxBefore, medicalCredit + elderlyCredit);
    var paye = round2(taxBefore - credits);
    var aids = round2(paye * CFG.aidsLevyRate);
    var totalTax = round2(paye + aids);
    var other = round2(num(p.other));
    var totalDeductions = round2(nssaEmp + pension + totalTax + other);
    var net = round2(gross - totalDeductions);

    return {
      cur: cur, rate: rate, gross: gross,
      nssaCeiling: ceiling, nssaInsurable: insurable, nssaApplies: nssaApplies,
      nssaEmployee: nssaEmp, nssaEmployer: nssaEr,
      pension: pension, taxable: taxable,
      taxBeforeCredits: taxBefore, medicalCredit: medicalCredit, elderlyCredit: elderlyCredit,
      creditsApplied: round2(credits),
      paye: paye, aidsLevy: aids, totalTax: totalTax,
      other: other, totalDeductions: totalDeductions, net: net,
      effectiveRate: gross > 0 ? (totalTax / gross) : 0,
      deductionRate: gross > 0 ? (totalDeductions / gross) : 0,
      marginalRate: marginalRate(taxable, bands) * (1 + CFG.aidsLevyRate)
    };
  }

  /**
   * Mixed USD + ZiG salary. ZIMRA: use the USD tables and apportion the tax.
   * p: { usdPart, zwgPart, rate, ... } - deductions given in USD.
   */
  function calcMixed(p) {
    var rate = num(p.rate) || CFG.reference.rate;
    var usdPart = num(p.usdPart), zwgPart = num(p.zwgPart);
    var zwgInUsd = zwgPart / rate;
    var grossUsd = usdPart + zwgInUsd;
    var r = calcSingle('USD', Object.assign({}, p, { gross: grossUsd, rate: rate }));
    var s = grossUsd > 0 ? zwgInUsd / grossUsd : 0; // ZiG share of pay
    var ded = r.totalDeductions;
    r.mixed = {
      rate: rate, usdPart: usdPart, zwgPart: zwgPart, zwgShare: s,
      netUSD: round2(usdPart - ded * (1 - s)),
      netZWG: round2(zwgPart - ded * s * rate),
      taxUSD: round2(r.totalTax * (1 - s)),
      taxZWG: round2(r.totalTax * s * rate),
      nssaUSD: round2(r.nssaEmployee * (1 - s)),
      nssaZWG: round2(r.nssaEmployee * s * rate)
    };
    return r;
  }

  function calc(p) {
    if (p.cur === 'MIXED') return calcMixed(p);
    return calcSingle(p.cur === 'ZWG' ? 'ZWG' : 'USD', p);
  }

  /** Net -> gross. Net pay rises with gross, so we can bisect. USD or ZWG only. */
  function reverse(cur, targetNet, p) {
    targetNet = num(targetNet);
    var f = function (g) { return calcSingle(cur, Object.assign({}, p, { gross: g })).net; };
    if (f(0) >= targetNet) return { gross: 0, result: calcSingle(cur, Object.assign({}, p, { gross: 0 })) };
    var lo = 0, hi = Math.max(targetNet * 2, 100);
    var guard = 0;
    while (f(hi) < targetNet && guard++ < 60) hi *= 2;
    for (var i = 0; i < 80; i++) {
      var mid = (lo + hi) / 2;
      if (f(mid) < targetNet) lo = mid; else hi = mid;
    }
    var g = round2(hi);
    // step to the lowest cent that reaches the target
    while (g > 0 && f(round2(g - 0.01)) >= targetNet) g = round2(g - 0.01);
    while (f(g) < targetNet) g = round2(g + 0.01);
    // prefer a tidy whole-number salary when it gives the same take-home to the cent
    var tidy = Math.ceil(g);
    if (tidy !== g && f(tidy) - targetNet < 0.005) g = tidy;
    return { gross: g, result: calcSingle(cur, Object.assign({}, p, { gross: g })) };
  }

  /** Bonus tax: taxable part is added to that month's taxable income. */
  function bonus(cur, p, bonusAmount, bonusAlready) {
    var rate = num(p.rate) || CFG.reference.rate;
    var exemptLimit = CFG.bonus.exemptAnnualUSD * (cur === 'USD' ? 1 : rate);
    var amount = num(bonusAmount), prior = num(bonusAlready);
    var exemptLeft = Math.max(0, exemptLimit - prior);
    var exemptPart = Math.min(amount, exemptLeft);
    var taxablePart = amount - exemptPart;
    var base = calcSingle(cur, p);
    var withB = calcSingle(cur, Object.assign({}, p, { extraTaxable: taxablePart }));
    var extraPaye = round2(withB.paye - base.paye);
    var extraAids = round2(withB.aidsLevy - base.aidsLevy);
    var extraTax = round2(extraPaye + extraAids);
    return {
      cur: cur, rate: rate, amount: amount, prior: prior, exemptLimit: round2(exemptLimit),
      exemptPart: round2(exemptPart), taxablePart: round2(taxablePart),
      extraPaye: extraPaye, extraAids: extraAids, extraTax: extraTax,
      netBonus: round2(amount - extraTax),
      effectiveRate: amount > 0 ? extraTax / amount : 0,
      base: base, withBonus: withB,
      monthNetBase: base.net, monthNetWithBonus: round2(base.net + amount - extraTax)
    };
  }

  /** What the employer really pays to employ one person. */
  function employer(cur, p, o) {
    var rate = num(p.rate) || CFG.reference.rate;
    var emp = calcSingle(cur, p);
    var gross = emp.gross;
    var L = CFG.employerLevies;
    var zimdef = o.zimdefApplies ? round2(gross * L.zimdefRate) : 0;
    var sdl = o.sdlApplies ? round2(gross * L.sdlRate) : 0; // only employers in specified classes are liable
    var apwcs = round2(gross * (num(o.apwcsPct) / 100));
    var other = round2(gross * (num(o.otherPct) / 100));
    var nssaEr = emp.nssaEmployer;
    var total = round2(gross + nssaEr + zimdef + sdl + apwcs + other);
    return {
      cur: cur, rate: rate, employee: emp, gross: gross,
      nssaEmployer: nssaEr, zimdef: zimdef, sdl: sdl, sdlApplies: !!o.sdlApplies, apwcs: apwcs, other: other,
      onTop: round2(total - gross), total: total,
      onTopRate: gross > 0 ? (total - gross) / gross : 0,
      costPerNet: emp.net > 0 ? total / emp.net : 0,
      zimdefExemptUSD: L.zimdefExemptAnnualWageBillUSD
    };
  }

  /** Compare a payslip with what the engine expects. */
  function checkPayslip(cur, p, shown) {
    var exp = calcSingle(cur, p);
    var tol = cur === 'USD' ? 0.06 : 1.0; // allow rounding differences
    var diffs = {
      nssa: round2(num(shown.nssa) - exp.nssaEmployee),
      paye: round2(num(shown.paye) - exp.paye),
      aids: round2(num(shown.aids) - exp.aidsLevy),
      net: round2(num(shown.net) - exp.net)
    };
    var shownTotal = round2(num(shown.nssa) + num(shown.paye) + num(shown.aids) + num(p.pension) + num(p.other));
    var arithmetic = round2(num(p.gross) - shownTotal - num(shown.net));
    return { expected: exp, diffs: diffs, tolerance: tol, arithmetic: arithmetic };
  }

  function fmt(cur, n, opts) {
    opts = opts || {};
    var d = opts.decimals === undefined ? 2 : opts.decimals;
    var s = (Math.abs(n)).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    var sign = n < 0 ? '-' : '';
    if (cur === 'USD') return sign + 'US$' + s;
    return sign + 'ZiG ' + s;
  }
  function pct(x, d) { return (x * 100).toFixed(d === undefined ? 1 : d) + '%'; }

  return {
    round2: round2, num: num, bandTax: bandTax, nssaCeiling: nssaCeiling,
    calcSingle: calcSingle, calcMixed: calcMixed, calc: calc,
    reverse: reverse, bonus: bonus, employer: employer, checkPayslip: checkPayslip,
    fmt: fmt, pct: pct, CONFIG: CFG
  };
});
