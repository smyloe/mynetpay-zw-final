/*! MyNetPay ZW - UI wiring. Needs config.js and engine.js loaded first. */
(function () {
  'use strict';
  var E = window.MNP, CFG = E && E.CONFIG;
  if (!E) return;

  /* ------------------------------------------------------------ helpers */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sym(cur) { return cur === 'ZWG' ? 'ZiG' : 'US$'; }
  function f(cur, n) { return E.fmt(cur, n); }

  function readForm(form) {
    var v = {};
    $$('input, select', form).forEach(function (el) {
      if (!el.name) return;
      if (el.type === 'radio') { if (el.checked) v[el.name] = el.value; }
      else if (el.type === 'checkbox') v[el.name] = el.checked;
      else v[el.name] = el.value;
    });
    return v;
  }
  function baseParams(v, rate) {
    return {
      nssaApplies: !v.over65, pension: v.pension, medical: v.medical,
      elderly: !!v.elderly, other: v.other, rate: rate
    };
  }
  function getRate(v) { var r = E.num(v.rate); return r > 0 ? r : CFG.reference.rate; }

  function bandFor(cur, taxable) {
    var b = CFG.paye[cur];
    for (var i = 0; i < b.length; i++) if (taxable <= b[i].upTo) return b[i];
    return b[b.length - 1];
  }

  /* ---------------------------------------------------- visibility rules */
  function applyVisibility(root, v) {
    $$('[data-only]', root).forEach(function (el) {
      var list = el.getAttribute('data-only').split(',');
      el.hidden = list.indexOf(v.cur) === -1;
    });
    $$('[data-cur-label]', root).forEach(function (el) {
      var key = el.getAttribute('data-cur-label');
      var c = key === 'A' ? v.curA : key === 'B' ? v.curB : v.cur;
      el.textContent = sym(c === 'ZWG' ? 'ZWG' : 'USD');
    });
  }

  /* ------------------------------------------------------- result pieces */
  function bar(parts, cur) {
    var total = parts.reduce(function (s, p) { return s + Math.max(0, p.v); }, 0);
    if (!(total > 0)) return '';
    var segs = '', legend = '';
    parts.forEach(function (p) {
      if (!(p.v > 0)) return;
      var w = (p.v / total * 100);
      segs += '<span class="seg ' + p.c + '" style="width:' + w.toFixed(2) + '%" title="' + esc(p.l) + '"></span>';
      legend += '<li><i class="dot ' + p.c + '"></i>' + esc(p.l) + ' <b>' + f(cur, p.v) + '</b></li>';
    });
    return '<div class="bar" role="img" aria-label="Where your pay goes">' + segs + '</div><ul class="legend">' + legend + '</ul>';
  }

  function breakdownTable(r, cur, opts) {
    opts = opts || {};
    var rows = [];
    rows.push(['Gross pay', r.gross, '', 'gross']);
    if (r.nssaApplies) rows.push(['NSSA pension (4.5%)', -r.nssaEmployee, 'nssa']);
    if (r.pension > 0) rows.push(['Pension / retirement fund', -r.pension, 'pen']);
    rows.push(['PAYE income tax', -r.paye, 'paye']);
    rows.push(['AIDS levy (3% of PAYE)', -r.aidsLevy, 'aids']);
    if (r.other > 0) rows.push(['Other deductions', -r.other, 'oth']);
    var h = '<div class="tablewrap"><table class="breakdown"><thead><tr><th scope="col">Item</th><th scope="col" class="num">Per month</th><th scope="col" class="num">Per year</th></tr></thead><tbody>';
    rows.forEach(function (x) {
      h += '<tr class="' + (x[3] || '') + '"><th scope="row"><i class="dot ' + (x[2] || 'net') + '"></i>' + x[0] + '</th><td class="num">' + f(cur, x[1]) + '</td><td class="num">' + f(cur, x[1] * 12) + '</td></tr>';
    });
    h += '</tbody><tfoot><tr><th scope="row">Take-home pay</th><td class="num">' + f(cur, r.net) + '</td><td class="num">' + f(cur, r.net * 12) + '</td></tr></tfoot></table></div>';
    return h;
  }

  function steps(r, cur) {
    var b = bandFor(cur, r.taxable);
    var s = '<details class="how"><summary>Show how this was worked out</summary><ol>';
    if (r.nssaApplies) {
      s += '<li><b>NSSA:</b> 4.5% of insurable earnings, capped at ' + f(cur, r.nssaCeiling) + ' a month. Insurable earnings here: ' + f(cur, r.nssaInsurable) + ' &rarr; <b>' + f(cur, r.nssaEmployee) + '</b>.</li>';
    } else {
      s += '<li><b>NSSA:</b> not deducted (employee aged 65 or over).</li>';
    }
    s += '<li><b>Taxable income:</b> ' + f(cur, r.gross) + ' &minus; NSSA ' + f(cur, r.nssaEmployee) + (r.pension > 0 ? ' &minus; pension ' + f(cur, r.pension) : '') + ' = <b>' + f(cur, r.taxable) + '</b>.</li>';
    if (r.taxable > 0) {
      s += '<li><b>PAYE (ZIMRA monthly table, ' + (cur === 'USD' ? 'USD' : 'ZWG') + '):</b> ' + f(cur, r.taxable) + ' &times; ' + Math.round(b.rate * 100) + '% &minus; ' + f(cur, b.deduct) + ' = <b>' + f(cur, r.taxBeforeCredits) + '</b>.</li>';
    } else {
      s += '<li><b>PAYE:</b> no taxable income, so no PAYE.</li>';
    }
    if (r.creditsApplied > 0) s += '<li><b>Tax credits:</b> &minus; ' + f(cur, r.creditsApplied) + ' &rarr; PAYE payable <b>' + f(cur, r.paye) + '</b>.</li>';
    s += '<li><b>AIDS levy:</b> 3% &times; ' + f(cur, r.paye) + ' = <b>' + f(cur, r.aidsLevy) + '</b>.</li>';
    s += '<li><b>Take-home:</b> ' + f(cur, r.gross) + ' &minus; ' + f(cur, r.totalDeductions) + ' = <b>' + f(cur, r.net) + '</b>.</li></ol></details>';
    return s;
  }

  function hero(label, amount, sub) {
    return '<div class="res-hero"><span class="res-label">' + label + '</span><strong class="res-net">' + amount + '</strong>' + (sub ? '<span class="res-sub">' + sub + '</span>' : '') + '</div>';
  }
  function actions() {
    return '<div class="res-actions no-print"><button type="button" class="btn btn-ghost" data-act="copy">Copy link to these figures</button><button type="button" class="btn btn-ghost" data-act="print">Print / save as PDF</button></div><p class="copied no-print" hidden>Link copied.</p>';
  }
  function note(cur, rate, usesRate) {
    return '<p class="fine">Based on the ' + CFG.meta.tablesBasis + '.' + (usesRate ? ' Exchange rate used where the law converts US$ to ZiG: ZiG ' + rate.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') + ' per US$1.' : '') + ' Estimate only; your payslip is what counts.</p>';
  }
  function empty(msg) { return '<div class="res-empty"><p>' + msg + '</p></div>'; }

  /* ------------------------------------------------------------- renderers */
  var R = {};

  R.net = function (v) {
    var rate = getRate(v), cur = v.cur, bp = baseParams(v, rate), r, disp;
    if (cur === 'MIXED') {
      var uP = E.num(v.usd), zP = E.num(v.zwg);
      if (!(uP + zP > 0)) return empty('Enter your USD and ZiG pay to see your take-home pay.');
      r = E.calc(Object.assign({ cur: 'MIXED', usdPart: uP, zwgPart: zP }, bp));
      var m = r.mixed;
      var h = hero('Your monthly take-home pay', f('USD', r.net) + ' <small>in US$ terms</small>',
        'Paid as <b>' + f('USD', m.netUSD) + '</b> + <b>' + f('ZWG', m.netZWG) + '</b>');
      h += bar([{ v: r.net, c: 'net', l: 'Take-home' }, { v: r.paye, c: 'paye', l: 'PAYE' }, { v: r.aidsLevy, c: 'aids', l: 'AIDS levy' }, { v: r.nssaEmployee, c: 'nssa', l: 'NSSA' }, { v: r.pension + r.other, c: 'oth', l: 'Other' }], 'USD');
      h += '<p class="mixed-note"><b>How mixed pay is taxed:</b> ZIMRA says salaries with both USD and ZiG parts use the <b>USD tables</b>, with the tax then split between the two currencies. Your ZiG pay of ' + f('ZWG', zP) + ' counts as ' + f('USD', zP / rate) + ' at ZiG ' + rate + ' per US$1 (total gross ' + f('USD', r.gross) + ').</p>';
      h += breakdownTable(r, 'USD');
      h += '<div class="split"><div><h4>Tax and NSSA taken from your USD pay</h4><p>' + f('USD', m.taxUSD + m.nssaUSD) + '</p></div><div><h4>Tax and NSSA taken from your ZiG pay</h4><p>' + f('ZWG', m.taxZWG + m.nssaZWG) + '</p></div></div>';
      h += steps(r, 'USD') + actions() + note('USD', rate, true);
      return h;
    }
    var g = E.num(v.gross);
    if (!(g > 0)) return empty('Enter your monthly gross pay to see your take-home pay.');
    r = E.calc(Object.assign({ cur: cur, gross: g }, bp));
    var share = r.gross > 0 ? (r.net / r.gross) : 0;
    var out = hero('Your monthly take-home pay', f(cur, r.net), 'You keep <b>' + E.pct(share) + '</b> of your gross pay &middot; ' + f(cur, r.net * 12) + ' a year');
    out += bar([{ v: r.net, c: 'net', l: 'Take-home' }, { v: r.paye, c: 'paye', l: 'PAYE' }, { v: r.aidsLevy, c: 'aids', l: 'AIDS levy' }, { v: r.nssaEmployee, c: 'nssa', l: 'NSSA' }, { v: r.pension + r.other, c: 'oth', l: 'Other' }], cur);
    out += '<div class="stats"><div><span>Tax (PAYE + AIDS levy)</span><b>' + f(cur, r.totalTax) + '</b></div><div><span>Average tax rate</span><b>' + E.pct(r.effectiveRate) + '</b></div><div><span>Tax on your next ' + sym(cur) + '1</span><b>' + E.pct(r.marginalRate, 0) + '</b></div></div>';
    out += breakdownTable(r, cur) + steps(r, cur) + actions() + note(cur, rate, cur === 'ZWG');
    return out;
  };

  R.reverse = function (v) {
    var rate = getRate(v), cur = v.cur, n = E.num(v.net);
    if (!(n > 0)) return empty('Enter the monthly take-home pay you want to receive.');
    var x = E.reverse(cur, n, baseParams(v, rate)), r = x.result;
    var out = hero('You need a monthly gross salary of', f(cur, x.gross), 'to take home <b>' + f(cur, r.net) + '</b> &middot; gross of ' + f(cur, x.gross * 12) + ' a year');
    out += bar([{ v: r.net, c: 'net', l: 'Take-home' }, { v: r.paye, c: 'paye', l: 'PAYE' }, { v: r.aidsLevy, c: 'aids', l: 'AIDS levy' }, { v: r.nssaEmployee, c: 'nssa', l: 'NSSA' }, { v: r.pension + r.other, c: 'oth', l: 'Other' }], cur);
    out += '<p class="lead-in">That gross works out to <b>' + f(cur, x.gross - r.net) + '</b> a month going to deductions (' + E.pct(1 - r.net / x.gross) + ' of gross).</p>';
    out += breakdownTable(r, cur) + steps(r, cur) + actions() + note(cur, rate, cur === 'ZWG');
    return out;
  };

  R.bonus = function (v) {
    var rate = getRate(v), cur = v.cur, g = E.num(v.gross), b = E.num(v.bonus);
    if (!(b > 0)) return empty('Enter the bonus amount to see the tax on it.');
    var x = E.bonus(cur, Object.assign({ gross: g }, baseParams(v, rate)), b, v.prior);
    var out = hero('Your bonus after tax', f(cur, x.netBonus), 'Tax on the bonus: <b>' + f(cur, x.extraTax) + '</b> (' + E.pct(x.effectiveRate) + ' of the bonus)');
    out += bar([{ v: x.netBonus, c: 'net', l: 'You keep' }, { v: x.extraPaye, c: 'paye', l: 'PAYE' }, { v: x.extraAids, c: 'aids', l: 'AIDS levy' }], cur);
    out += '<div class="tablewrap"><table class="breakdown"><tbody>' +
      '<tr class="gross"><th scope="row">Bonus before tax</th><td class="num">' + f(cur, x.amount) + '</td></tr>' +
      '<tr><th scope="row"><i class="dot net"></i>Tax-free part (annual limit ' + f(cur, x.exemptLimit) + (x.prior > 0 ? ', ' + f(cur, x.prior) + ' already used' : '') + ')</th><td class="num">' + f(cur, x.exemptPart) + '</td></tr>' +
      '<tr><th scope="row"><i class="dot aids"></i>Taxable part</th><td class="num">' + f(cur, x.taxablePart) + '</td></tr>' +
      '<tr><th scope="row"><i class="dot paye"></i>Extra PAYE caused by the bonus</th><td class="num">-' + f(cur, x.extraPaye) + '</td></tr>' +
      '<tr><th scope="row"><i class="dot aids"></i>Extra AIDS levy</th><td class="num">-' + f(cur, x.extraAids) + '</td></tr>' +
      '</tbody><tfoot><tr><th scope="row">Bonus you keep</th><td class="num">' + f(cur, x.netBonus) + '</td></tr></tfoot></table></div>';
    if (g > 0) {
      out += '<div class="split"><div><h4>Take-home in a normal month</h4><p>' + f(cur, x.monthNetBase) + '</p></div><div><h4>Take-home in the bonus month</h4><p>' + f(cur, x.monthNetWithBonus) + '</p></div></div>';
    }
    out += '<details class="how"><summary>How the bonus is taxed</summary><ol><li>The first ' + f(cur, x.exemptLimit) + ' of bonuses in a year is exempt from income tax (US$700, or the ZiG equivalent, under the Finance Act (No. 2) of 2024). Several bonuses in one year share that single limit.</li><li>Anything above the limit is added to that month\'s taxable income and taxed at your normal bands.</li><li>The tax on the bonus is the difference between your tax with the bonus and your tax without it, plus the 3% AIDS levy on that extra tax.</li></ol></details>';
    out += actions() + note(cur, rate, cur === 'ZWG') + '<p class="fine">Payroll systems may spread or time bonus tax slightly differently; the monthly method here is the standard approach. Bonuses are treated as not attracting NSSA.</p>';
    return out;
  };

  R.employer = function (v) {
    var rate = getRate(v), cur = v.cur, g = E.num(v.gross);
    if (!(g > 0)) return empty('Enter the employee\'s monthly gross pay to see what they cost you.');
    var x = E.employer(cur, Object.assign({ gross: g }, baseParams(v, rate)), { zimdefApplies: !!v.zimdef, sdlApplies: !!v.sdl, apwcsPct: v.apwcs, otherPct: v.otherPct });
    var out = hero('Real monthly cost to employ this person', f(cur, x.total), 'That is <b>' + f(cur, x.onTop) + '</b> (' + E.pct(x.onTopRate) + ') on top of gross pay &middot; ' + f(cur, x.total * 12) + ' a year');
    out += bar([{ v: x.gross, c: 'net', l: 'Gross pay' }, { v: x.nssaEmployer, c: 'nssa', l: 'NSSA (employer)' }, { v: x.zimdef, c: 'aids', l: 'ZIMDEF' }, { v: x.sdl, c: 'paye', l: 'Standards levy' }, { v: x.apwcs + x.other, c: 'oth', l: 'APWCS and other' }], cur);
    out += '<div class="tablewrap"><table class="breakdown"><thead><tr><th scope="col">Employer cost</th><th scope="col" class="num">Per month</th><th scope="col" class="num">Per year</th></tr></thead><tbody>';
    var rows = [['Gross pay', x.gross, 'net'], ['NSSA employer share (4.5%, capped)', x.nssaEmployer, 'nssa'], ['ZIMDEF levy (1%)', x.zimdef, 'aids'], ['Standards Development Levy (0.5%, you said you are liable)', x.sdl, 'paye'], ['APWCS (your risk-rated %)', x.apwcs, 'oth'], ['Other employer cost (your %)', x.other, 'oth']];
    rows.forEach(function (r) { if (r[1] > 0 || r[0] === 'Gross pay') out += '<tr><th scope="row"><i class="dot ' + r[2] + '"></i>' + r[0] + '</th><td class="num">' + f(cur, r[1]) + '</td><td class="num">' + f(cur, r[1] * 12) + '</td></tr>'; });
    out += '</tbody><tfoot><tr><th scope="row">Total employer cost</th><td class="num">' + f(cur, x.total) + '</td><td class="num">' + f(cur, x.total * 12) + '</td></tr></tfoot></table></div>';
    out += '<div class="split"><div><h4>Employee takes home</h4><p>' + f(cur, x.employee.net) + '</p></div><div><h4>You pay for every ' + sym(cur) + '1 they take home</h4><p>' + sym(cur) + (x.costPerNet ? x.costPerNet.toFixed(2) : '0.00') + '</p></div></div>';
    out += '<p class="fine">Employee PAYE and AIDS levy are deducted from the employee\'s pay, not added to your cost. APWCS is risk-rated per employer and ZIMDEF has an exemption for annual wage bills below US$6,000; check both with NSSA and ZIMDEF.' + (v.sdl ? '' : ' <b>The Standards Development Levy is not included</b>: it only applies to employers in classes specified by the Minister of Industry and Commerce, so tick the box if you are liable.') + '</p>';
    out += actions() + note(cur, rate, cur === 'ZWG');
    return out;
  };

  R.nssa = function (v) {
    var rate = getRate(v), cur = v.cur, g = E.num(v.gross);
    if (!(g > 0)) return empty('Enter monthly gross pay to see the NSSA contributions.');
    var r = E.calcSingle(cur, Object.assign({ gross: g }, baseParams(v, rate)));
    var capped = r.nssaApplies && g > r.nssaCeiling;
    var out = hero('Your NSSA pension contribution', f(cur, r.nssaEmployee), r.nssaApplies ? 'Your employer adds <b>' + f(cur, r.nssaEmployer) + '</b> &middot; total paid in <b>' + f(cur, r.nssaEmployee + r.nssaEmployer) + '</b> a month' : 'Employees aged 65 or over do not contribute');
    out += '<div class="stats"><div><span>Insurable earnings used</span><b>' + f(cur, r.nssaInsurable) + '</b></div><div><span>Monthly ceiling</span><b>' + f(cur, r.nssaCeiling) + '</b></div><div><span>Per year (you)</span><b>' + f(cur, r.nssaEmployee * 12) + '</b></div></div>';
    out += '<p class="lead-in">' + (r.nssaApplies ? (capped ? 'Your pay is above the ceiling, so contributions are calculated on ' + f(cur, r.nssaCeiling) + ' only. That is the most you can pay.' : 'Your pay is below the ceiling, so 4.5% applies to all of it.') : '') + '</p>';
    out += actions() + note(cur, rate, cur === 'ZWG') + '<p class="fine">NSSA reviews the ceiling regularly (it is gazetted quarterly). If your payslip differs, your employer may be applying a newer ceiling.</p>';
    return out;
  };

  R.payslip = function (v) {
    var rate = getRate(v), cur = v.cur, g = E.num(v.gross);
    if (!(g > 0)) return empty('Enter the gross pay and the figures from your payslip to check them.');
    var c = E.checkPayslip(cur, Object.assign({ gross: g }, baseParams(v, rate)), { nssa: v.sNssa, paye: v.sPaye, aids: v.sAids, net: v.sNet });
    var e = c.expected, tol = c.tolerance;
    function line(label, shown, exp, diff) {
      var ok = Math.abs(diff) <= tol;
      return '<tr class="' + (ok ? 'ok' : 'warn') + '"><th scope="row">' + label + '</th><td class="num">' + f(cur, E.num(shown)) + '</td><td class="num">' + f(cur, exp) + '</td><td class="num"><span class="pill ' + (ok ? 'pill-ok' : 'pill-warn') + '">' + (ok ? 'Matches' : (diff > 0 ? '+' : '') + f(cur, diff)) + '</span></td></tr>';
    }
    var allOk = ['nssa', 'paye', 'aids', 'net'].every(function (k) { return Math.abs(c.diffs[k]) <= tol; });
    var out = hero('Payslip check', allOk ? 'Looks right' : 'Worth a closer look', allOk ? 'Your figures match what we calculate from the ZIMRA tables and NSSA rules.' : 'Some figures differ from our calculation. See the table and the possible reasons below.');
    out += '<div class="tablewrap"><table class="breakdown payslip-check"><thead><tr><th scope="col">Line</th><th scope="col" class="num">Payslip</th><th scope="col" class="num">Expected</th><th scope="col" class="num">Difference</th></tr></thead><tbody>' +
      line('NSSA (employee)', v.sNssa, e.nssaEmployee, c.diffs.nssa) + line('PAYE', v.sPaye, e.paye, c.diffs.paye) + line('AIDS levy', v.sAids, e.aidsLevy, c.diffs.aids) + line('Net pay', v.sNet, e.net, c.diffs.net) + '</tbody></table></div>';
    if (Math.abs(c.arithmetic) > tol) out += '<p class="warnbox"><b>The payslip does not add up:</b> gross minus the deductions you entered is ' + f(cur, g - (E.num(v.sNssa) + E.num(v.sPaye) + E.num(v.sAids) + E.num(v.pension) + E.num(v.other))) + ', but the net pay you entered is ' + f(cur, E.num(v.sNet)) + ' (a difference of ' + f(cur, c.arithmetic) + '). Check whether other deductions (loans, medical aid, funeral policy) are missing from the boxes.</p>';
    if (!allOk) {
      out += '<div class="why"><h4>Common reasons a payslip differs</h4><ul><li>Taxable allowances or benefits are in your gross pay but you left them out (or the other way round).</li><li>Your employer applies a different NSSA ceiling than the one used here.</li><li>Medical aid, elderly, blind or disabled tax credits are applied (use the extra options above).</li><li>Part of your pay is in ZiG, so the USD tables apply to the combined pay.</li><li>Pension or retirement fund contributions reduce your taxable income.</li><li>A bonus, back pay or leave pay was paid in the same month.</li></ul><p>If it still looks wrong, ask your payroll or HR team to explain it, or contact ZIMRA.</p></div>';
    }
    out += steps(e, cur) + note(cur, rate, cur === 'ZWG');
    return out;
  };

  R.compare = function (v) {
    var rate = getRate(v);
    var gA = E.num(v.grossA), gB = E.num(v.grossB);
    if (!(gA > 0) || !(gB > 0)) return empty('Enter a salary for both options to compare them.');
    var base = { nssaApplies: !v.over65, rate: rate };
    var A = E.calc(Object.assign({ cur: v.curA, gross: gA }, base)), B = E.calc(Object.assign({ cur: v.curB, gross: gB }, base));
    var toUsd = function (cur, n) { return cur === 'USD' ? n : n / rate; };
    var nA = toUsd(v.curA, A.net), nB = toUsd(v.curB, B.net), diff = nB - nA;
    var winner = Math.abs(diff) < 0.005 ? 'Both options give the same take-home pay.' : (diff > 0 ? 'Option B' : 'Option A') + ' leaves you with <b>' + f('USD', Math.abs(diff)) + '</b> more a month (' + f('USD', Math.abs(diff) * 12) + ' a year)' + (v.curA !== v.curB ? ' <small>in US$ at ZiG ' + rate + ' per US$1</small>' : '') + '.';
    var out = hero('Which pays you more?', Math.abs(diff) < 0.005 ? 'It is a tie' : (diff > 0 ? 'Option B' : 'Option A'), winner);
    function card(label, r, cur) {
      return '<div class="cmp-card"><h3>' + label + '</h3><p class="cmp-net">' + f(cur, r.net) + '<small> / month</small></p><ul><li><span>Gross</span><b>' + f(cur, r.gross) + '</b></li><li><span>PAYE + AIDS levy</span><b>' + f(cur, r.totalTax) + '</b></li><li><span>NSSA</span><b>' + f(cur, r.nssaEmployee) + '</b></li><li><span>Keep</span><b>' + E.pct(r.net / r.gross) + '</b></li><li><span>Average tax rate</span><b>' + E.pct(r.effectiveRate) + '</b></li><li><span>Net per year</span><b>' + f(cur, r.net * 12) + '</b></li></ul></div>';
    }
    out += '<div class="cmp">' + card('Option A', A, v.curA) + card('Option B', B, v.curB) + '</div>';
    out += '<p class="lead-in">Gross difference: ' + (v.curA === v.curB ? f(v.curA, Math.abs(gB - gA)) : 'different currencies') + ' &middot; take-home difference: <b>' + f('USD', Math.abs(diff)) + '</b>. ' + (v.curA === v.curB && gA !== gB ? 'Out of every extra ' + sym(v.curA) + '1 of gross, you keep about ' + sym(v.curA) + (Math.abs((B.net - A.net) / (gB - gA))).toFixed(2) + '.' : '') + '</p>';
    out += actions() + note('USD', rate, true);
    return out;
  };

  /* -------------------------------------------------------------- wiring */
  var KEYS = ['cur', 'gross', 'usd', 'zwg', 'rate', 'net', 'bonus', 'prior', 'over65', 'pension', 'medical', 'elderly', 'other', 'zimdef', 'apwcs', 'otherPct', 'sdl', 'curA', 'grossA', 'curB', 'grossB', 'sNssa', 'sPaye', 'sAids', 'sNet'];

  function prefill(form) {
    var q;
    try { q = new URLSearchParams(window.location.search); } catch (e) { return; }
    KEYS.forEach(function (k) {
      if (!q.has(k)) return;
      var val = q.get(k);
      $$('[name="' + k + '"]', form).forEach(function (el) {
        if (el.type === 'radio') el.checked = (el.value === val);
        else if (el.type === 'checkbox') el.checked = (val === '1');
        else el.value = val;
      });
    });
  }
  function queryOf(form) {
    var v = readForm(form), parts = [];
    KEYS.forEach(function (k) {
      if (!(k in v)) return;
      var val = v[k];
      if (val === false && k === 'zimdef') { parts.push('zimdef=0'); return; } // default is ticked, so remember an untick
      if (val === false || val === '' || val === undefined) return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(val === true ? '1' : val));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  function init(root) {
    var tool = root.getAttribute('data-tool');
    var form = $('form', root), out = $('.result', root);
    if (!form || !out || !R[tool]) return;
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    prefill(form);

    function run() {
      var v = readForm(form);
      applyVisibility(root, v);
      var html;
      try { html = R[tool](v); } catch (err) { html = empty('Something went wrong with those numbers. Please check the amounts and try again.'); if (window.console) console.error(err); }
      out.innerHTML = html;
      try { window.history.replaceState(null, '', window.location.pathname + queryOf(form)); } catch (e) { /* ignore */ }
    }
    form.addEventListener('input', run);
    form.addEventListener('change', run);
    root.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'print') { window.print(); }
      if (act === 'copy') {
        var url = window.location.href, msg = $('.copied', root);
        var done = function () { if (msg) { msg.hidden = false; setTimeout(function () { msg.hidden = true; }, 2200); } };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done);
        else { var ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (er) { /* ignore */ } document.body.removeChild(ta); done(); }
      }
      if (act === 'reset') { form.reset(); run(); }
    });
    run();
  }

  function initNav() {
    var btn = $('.nav-toggle'), nav = $('#site-nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    $$('[data-tool]').forEach(init);
    initNav();
  });
})();
