#!/usr/bin/env node
/*
 * MyNetPay ZW - static site generator.
 *   node tools/build.js
 * Writes every HTML page, sitemap.xml, robots.txt and the web manifest into /public.
 * Salary tables and example figures are produced by the SAME engine the calculators use,
 * so published numbers can never drift from calculator results.
 */
const fs = require('fs');
const path = require('path');
const E = require('../public/assets/js/engine.js');
const CFG = E.CONFIG;

const OUT = path.join(__dirname, '..', 'public');
const SITE = 'https://mynetpayzw.netlify.app';  // current live domain (used for canonical URLs)
const NAME = 'MyNetPay ZW';
const TAGLINE = 'Know what actually reaches your pocket';
const BUILD_DATE = '2026-11-18';
const VERIFIED = CFG.meta.lastVerified;
const YEAR = CFG.meta.taxYear;
const RATE = CFG.reference.rate;

const usd = (n) => E.fmt('USD', n);
const zig = (n) => E.fmt('ZWG', n);
const usd0 = (n) => E.fmt('USD', n, { decimals: 0 });
const zig0 = (n) => E.fmt('ZWG', n, { decimals: 0 });
const pct = (x, d) => E.pct(x, d);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripTags = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const written = [];
function write(rel, content) {
  const full = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  written.push(rel);
}

/* ------------------------------------------------------------------ nav */
const NAV = [
  { group: 'Calculators', items: [
    { href: '/', label: 'Take-home pay' },
    { href: '/paye-calculator/', label: 'PAYE' },
    { href: '/nssa-calculator/', label: 'NSSA', secondary: true },
    { href: '/salary-comparison/', label: 'Compare' },
    { href: '/reverse-salary-calculator/', label: 'Reverse' },
    { href: '/bonus-tax-calculator/', label: 'Bonus tax' },
    { href: '/employer-cost-calculator/', label: 'Employer cost' }
  ] },
  { group: 'Learn', items: [
    { href: '/payslip-explainer/', label: 'Payslip' },
    { href: '/salary-tables/', label: 'Salary tables', secondary: true },
    { href: '/tax-tables/', label: 'Tax tables' },
    { href: '/faq/', label: 'FAQ', secondary: true }
  ] },
  { group: 'About', secondary: true, items: [
    { href: '/about/', label: 'About and method' },
    { href: '/privacy/', label: 'Privacy' },
    { href: '/disclaimer/', label: 'Disclaimer' }
  ] }
];

const LOGO = '';

function header(current) {
  let nav = '';
  NAV.forEach((g) => {
    nav += '<div class="nav-group' + (g.secondary ? ' nav-secondary' : '') + '"><h2>' + g.group + '</h2><ul>';
    g.items.forEach((i) => {
      nav += '<li' + (i.secondary ? ' class="nav-secondary"' : '') + '><a href="' + i.href + '"' + (i.href === current ? ' aria-current="page"' : '') + '>' + i.label + '</a></li>';
    });
    nav += '</ul></div>';
  });
  return '<a class="skip" href="#main">Skip to content</a><header class="site-header"><div class="wrap">' +
    '<a class="brand" href="/" aria-label="' + NAME + ' home">' + LOGO + '<span>MyNetPay <b>ZW</b></span></a>' +
    '<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>' +
    '<nav id="site-nav" aria-label="Main">' + nav + '</nav></div></header>';
}

function footer() {
  return '<footer class="site-footer"><div class="wrap"><div class="foot-grid">' +
    '<div><a class="brand" href="/">' + LOGO + '<span>MyNetPay <b>ZW</b></span></a><p style="margin-top:12px">' + TAGLINE + '. Free Zimbabwe salary, PAYE and NSSA calculators in USD and ZiG.</p></div>' +
    '<div><h2>Calculators</h2><ul><li><a href="/">Take-home pay</a></li><li><a href="/paye-calculator/">PAYE calculator</a></li><li><a href="/nssa-calculator/">NSSA calculator</a></li><li><a href="/salary-comparison/">Salary comparison</a></li><li><a href="/reverse-salary-calculator/">Net to gross</a></li><li><a href="/bonus-tax-calculator/">Bonus tax</a></li><li><a href="/employer-cost-calculator/">Employer cost</a></li></ul></div>' +
    '<div><h2>Learn</h2><ul><li><a href="/payslip-explainer/">Payslip explainer</a></li><li><a href="/salary-tables/">Salary tables</a></li><li><a href="/tax-tables/">PAYE tax tables</a></li><li><a href="/faq/">FAQ</a></li></ul></div>' +
    '<div><h2>About</h2><ul><li><a href="/about/">About and method</a></li><li><a href="/privacy/">Privacy</a></li><li><a href="/disclaimer/">Disclaimer</a></li></ul></div>' +
    '</div><p class="legal">' + NAME + ' gives estimates only and is not tax, legal or payroll advice. It is not connected to ZIMRA, NSSA or the Government of Zimbabwe. Figures use the ' + CFG.meta.tablesBasis + ' and were last checked on ' + VERIFIED + '. &copy; ' + YEAR + ' ' + NAME + '.</p></div></footer>';
}

/* ----------------------------------------------------------- form pieces */
function seg(name, opts, checked) {
  return '<div class="seg-control" role="radiogroup">' + opts.map((o) =>
    '<label><input type="radio" name="' + name + '" value="' + o[0] + '"' + (o[0] === checked ? ' checked' : '') + '><span>' + o[1] + '</span></label>').join('') + '</div>';
}
function money(id, name, label, hint, ph, opts) {
  opts = opts || {};
  return '<div class="field"' + (opts.only ? ' data-only="' + opts.only + '"' + (opts.hidden ? ' hidden' : '') : '') + '><label for="' + id + '">' + label + '</label><div class="input-wrap"><span class="pre"' +
    (opts.fixed ? '>' + opts.fixed : ' data-cur-label' + (opts.curKey ? '="' + opts.curKey + '"' : '') + '>US$') + '</span><input id="' + id + '" name="' + name + '" type="number" inputmode="decimal" min="0" step="any" placeholder="' + (ph || '') + '" autocomplete="off"></div>' +
    (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
}
function rateField(only) {
  return '<div class="field"' + (only ? ' data-only="' + only + '" hidden' : '') + '><label for="rate">Exchange rate (ZiG per US$1)</label><div class="input-wrap"><span class="pre">ZiG</span><input id="rate" name="rate" type="number" inputmode="decimal" min="0" step="any" value="' + RATE + '" autocomplete="off"></div>' +
    '<span class="hint">Needed because the law sets the NSSA ceiling, bonus limit and some credits in US$. Default is the RBZ average interbank rate on ' + CFG.reference.rateDate + '. Change it to match your payslip or today\'s rate.</span></div>';
}
function advanced(o) {
  o = o || {};
  let h = '<details class="adv"><summary>More options (credits, pension, other deductions)</summary>';
  h += '<label class="check"><input type="checkbox" name="over65"><span>Aged 65 or over<small>NSSA contributions are not deducted from employees aged 65 or over.</small></span></label>';
  if (!o.noPension) h += money('pension', 'pension', 'Pension or retirement fund (per month)', 'Contributions to an approved fund reduce taxable income. Any legal limits are not modelled.', '0');
  if (!o.noCredits) {
    h += money('medical', 'medical', 'Medical aid contributions you pay (per month)', 'ZIMRA gives a tax credit of US$1 for every US$2 paid.', '0');
    h += '<label class="check"><input type="checkbox" name="elderly"><span>Elderly, blind or disabled credit<small>A US$900 a year credit (ZiG equivalent for ZiG pay). Tick only if it applies to you.</small></span></label>';
  }
  if (!o.noOther) h += money('other', 'other', 'Other deductions after tax (per month)', 'Loans, union dues, funeral policy and so on. They reduce take-home pay but not tax.', '0');
  return h + '</details>';
}
const RESET = '<button type="button" class="btn btn-ghost" data-act="reset">Clear</button>';
const CUR2 = [['USD', 'US$'], ['ZWG', 'ZiG']];
const CUR3 = [['USD', 'US$'], ['ZWG', 'ZiG'], ['MIXED', 'Both']];

const FORMS = {
  net: () => '<div class="card green tool-form"><h2>Your pay</h2><form novalidate autocomplete="off"><fieldset><legend>Paid in</legend>' + seg('cur', CUR3, 'USD') + '</fieldset>' +
    money('gross', 'gross', 'Monthly gross pay', 'Basic salary plus taxable allowances, before any deductions.', 'e.g. 800', { only: 'USD,ZWG' }) +
    '<div data-only="MIXED" hidden>' + money('usd', 'usd', 'USD part of your monthly pay', '', 'e.g. 600', { fixed: 'US$' }) + money('zwg', 'zwg', 'ZiG part of your monthly pay', '', 'e.g. 5000', { fixed: 'ZiG' }) + '</div>' +
    rateField('ZWG,MIXED') + advanced() + RESET + '</form></div><div class="card result" aria-live="polite"></div>',

  reverse: () => '<div class="card green tool-form"><h2>The pay you want</h2><form novalidate autocomplete="off"><fieldset><legend>Paid in</legend>' + seg('cur', CUR2, 'USD') + '</fieldset>' +
    money('net', 'net', 'Monthly take-home pay you want', 'The amount that should land in your account each month.', 'e.g. 1000') +
    rateField('ZWG') + advanced({ noOther: false }) + RESET + '</form></div><div class="card result" aria-live="polite"></div>',

  bonus: () => '<div class="card green tool-form"><h2>Your bonus</h2><form novalidate autocomplete="off"><fieldset><legend>Paid in</legend>' + seg('cur', CUR2, 'USD') + '</fieldset>' +
    money('bonus', 'bonus', 'Bonus amount', 'Before tax.', 'e.g. 1000') +
    money('gross', 'gross', 'Your monthly gross pay', 'Needed because a bonus is taxed on top of that month\'s pay.', 'e.g. 1000') +
    money('prior', 'prior', 'Bonuses already received this year', 'The tax-free limit is shared across the whole year. Leave blank if none.', '0') +
    rateField('ZWG') + advanced({ noOther: true }) + RESET + '</form></div><div class="card result" aria-live="polite"></div>',

  employer: () => '<div class="card green tool-form"><h2>The employee</h2><form novalidate autocomplete="off"><fieldset><legend>Paid in</legend>' + seg('cur', CUR2, 'USD') + '</fieldset>' +
    money('gross', 'gross', 'Employee monthly gross pay', 'Basic salary plus taxable allowances.', 'e.g. 800') +
    rateField('ZWG') +
    '<label class="check"><input type="checkbox" name="zimdef" checked><span>ZIMDEF levy applies (1%)<small>Untick if your total annual wage bill is below US$6,000, which is reported to be exempt from 16 January 2026.</small></span></label>' +
    '<label class="check"><input type="checkbox" name="sdl"><span>Standards Development Levy applies (0.5%)<small>Only for employers in classes specified by the Minister of Industry and Commerce. Confirm whether you are liable before ticking.</small></span></label>' +
    '<div class="row2"><div class="field"><label for="apwcs">APWCS %</label><input id="apwcs" name="apwcs" type="number" inputmode="decimal" min="0" step="any" placeholder="0"><span class="hint">Risk-rated. Ask NSSA.</span></div><div class="field"><label for="otherPct">Other levies %</label><input id="otherPct" name="otherPct" type="number" inputmode="decimal" min="0" step="any" placeholder="0"><span class="hint">e.g. NEC levy.</span></div></div>' +
    advanced({ noPension: false, noOther: true }) + RESET + '</form></div><div class="card result" aria-live="polite"></div>',

  nssa: () => '<div class="card green tool-form"><h2>Your pay</h2><form novalidate autocomplete="off"><fieldset><legend>Paid in</legend>' + seg('cur', CUR2, 'USD') + '</fieldset>' +
    money('gross', 'gross', 'Monthly gross pay', 'NSSA is worked out on insurable earnings up to the ceiling.', 'e.g. 800') +
    rateField('ZWG') + '<label class="check"><input type="checkbox" name="over65"><span>Aged 65 or over<small>No NSSA contributions are deducted.</small></span></label>' + RESET + '</form></div><div class="card result" aria-live="polite"></div>',

  payslip: () => '<div class="card green tool-form"><h2>Check my payslip</h2><form novalidate autocomplete="off"><fieldset><legend>Paid in</legend>' + seg('cur', CUR2, 'USD') + '</fieldset>' +
    money('gross', 'gross', 'Gross pay on the payslip', 'Total taxable pay before any deductions.', 'e.g. 1000') +
    '<p class="lbl" style="font-weight:800;margin:6px 0 8px">Figures printed on your payslip</p>' +
    money('sNssa', 'sNssa', 'NSSA (employee)', '', '0') + money('sPaye', 'sPaye', 'PAYE', '', '0') + money('sAids', 'sAids', 'AIDS levy', '', '0') + money('sNet', 'sNet', 'Net pay', '', '0') +
    rateField('ZWG') + advanced() + RESET + '</form></div><div class="card result" aria-live="polite"></div>',

  compare: () => '<div class="card green tool-form"><h2>Two options</h2><form novalidate autocomplete="off">' +
    '<fieldset><legend>Option A currency</legend>' + seg('curA', CUR2, 'USD') + '</fieldset>' + money('grossA', 'grossA', 'Option A monthly gross pay', '', 'e.g. 800', { curKey: 'A' }) +
    '<fieldset><legend>Option B currency</legend>' + seg('curB', CUR2, 'USD') + '</fieldset>' + money('grossB', 'grossB', 'Option B monthly gross pay', '', 'e.g. 1000', { curKey: 'B' }) +
    '<details class="adv"><summary>More options</summary>' + rateField() + '<label class="check"><input type="checkbox" name="over65"><span>Aged 65 or over<small>No NSSA deducted.</small></span></label>' + '</details>' + RESET + '</form></div><div class="card result" aria-live="polite"></div>'
};

/* ------------------------------------------------------------ content bits */
function faqHTML(items) {
  if (!items || !items.length) return '';
  return '<div class="faq">' + items.map((q) => '<details><summary>' + q[0] + '</summary><p>' + q[1] + '</p></details>').join('') + '</div>';
}
function tiles(list) {
  return '<ul class="tiles">' + list.map((t) => '<li><a class="tile" href="' + t[0] + '"><h3>' + t[1] + '</h3><p>' + t[2] + '</p></a></li>').join('') + '</ul>';
}
const TOOLS = [
  ['/', 'Take-home pay', 'Gross salary to net pay in USD, ZiG or both.'],
  ['/paye-calculator/', 'PAYE calculator', 'See your PAYE and AIDS levy and exactly how the bands apply.'],
  ['/nssa-calculator/', 'NSSA calculator', 'Employee and employer pension contributions and the US$700 ceiling.'],
  ['/salary-comparison/', 'Salary comparison', 'Put two salaries or job offers side by side.'],
  ['/reverse-salary-calculator/', 'Net to gross', 'Work out the salary you need to take home a target amount.'],
  ['/bonus-tax-calculator/', 'Bonus tax', 'What a bonus is worth after the US$700 tax-free limit and PAYE.'],
  ['/employer-cost-calculator/', 'Employer cost', 'The real cost of an employee with NSSA, ZIMDEF and levies.'],
  ['/payslip-explainer/', 'Payslip explainer', 'Every line explained, with a tool that checks your payslip.'],
  ['/salary-tables/', 'Salary tables', 'Take-home pay at common salaries in USD and ZiG.'],
  ['/tax-tables/', 'PAYE tax tables', 'The ZIMRA monthly and annual tables in USD and ZWG.']
];
function related(currentPath, n) {
  const others = TOOLS.filter((t) => t[0] !== currentPath).slice(0, 12);
  return '<ul class="related">' + others.slice(0, n || 6).map((t) => '<li><a href="' + t[0] + '">' + t[1] + '</a></li>').join('') + '</ul>';
}
function bandRows(bands, cur, annual) {
  const m = annual ? 12 : 1;
  let prev = 0, rows = '';
  const f = (n) => (cur === 'USD' ? usd(n) : zig(n));
  bands.forEach((b, i) => {
    const from = i === 0 ? 0 : prev + (annual ? 1 : 0.01);
    const to = b.upTo === Infinity ? 'and above' : f(b.upTo * m);
    rows += '<tr><td>' + (i === 0 ? f(0) : f(from * (annual ? 1 : 1))) + (b.upTo === Infinity ? ' ' + to : ' to ' + to) + '</td><td class="num">' + Math.round(b.rate * 100) + '%</td><td class="num">' + (b.deduct ? f(b.deduct * m) : '&ndash;') + '</td></tr>';
    prev = b.upTo === Infinity ? prev : b.upTo * m;
  });
  return rows;
}
function bandTable(bands, cur, annual, caption) {
  const head = annual ? 'Annual taxable income' : 'Monthly taxable income';
  return '<div class="tablewrap"><table class="band-table"><caption class="fine" style="text-align:left;caption-side:top;padding:0 0 6px">' + caption + '</caption><thead><tr><th scope="col">' + head + '</th><th scope="col" class="num">Rate</th><th scope="col" class="num">Deduct</th></tr></thead><tbody>' + bandRows(bands, cur, annual) + '</tbody></table></div>';
}

/* ------------------------------------------------------ master FAQ answers */
const Q = {
  paye: ['How is PAYE calculated in Zimbabwe?', 'Your employer takes your gross pay, subtracts allowable deductions such as your NSSA contribution and any approved pension contribution, and gets your taxable income. That figure is run through the ZIMRA table by multiplying by the rate for your band and deducting the fixed amount shown for that band. Tax credits (for example for medical aid) are then taken off, and the 3% AIDS levy is added to the result. Employers pay PAYE to ZIMRA by the 10th of the following month.'],
  threshold: ['What is the tax-free threshold in Zimbabwe?', 'The first US$100 of monthly taxable income (US$1,200 a year) is taxed at 0% in the USD table, and the first ZiG 2,800 a month (ZiG 33,600 a year) is taxed at 0% in the ZWG table. This is simply the 0% band. It is not an extra credit on top, so a worker earning a little over US$100 a month does pay some PAYE.'],
  tables: ['Are the PAYE tables on this site the 2026 ones?', 'Yes. The calculators use ZIMRA\'s PAYE tables for 1 January to 31 December 2026, in USD and in ZWG (ZiG). The monthly rates and deduct amounts are unchanged from ZIMRA\'s 2025 tables. If ZIMRA issues new tables, the figures in this site\'s TAX_CONFIG file are updated and the "last checked" date at the bottom of every page changes.'],
  nssa: ['How much is NSSA in Zimbabwe?', 'Under the Pension and Other Benefits Scheme the employee pays 4.5% and the employer pays 4.5% of insurable earnings. Earnings are capped at a ceiling of US$700 a month (or the ZiG equivalent), so the most an employee pays is US$31.50 a month. NSSA says the ceiling is gazetted quarterly, and contributions are deducted for employees below age 65.'],
  aids: ['What is the AIDS levy on payslips?', 'The AIDS levy is 3% of the PAYE you actually owe after credits. It is shown as a separate line on your payslip. For example, PAYE of US$200 carries an AIDS levy of US$6.'],
  nssaBeforeTax: ['Is NSSA taken off before or after tax?', 'Before. Your employee NSSA contribution is an allowable deduction, so it reduces the income on which PAYE is worked out. That is why a calculator that skips NSSA will show slightly too much PAYE.'],
  mixed: ['How is a salary paid partly in USD and partly in ZiG taxed?', 'ZIMRA\'s guidance for salaries with both USD and ZWG parts is to use the USD tax tables and to apportion the tax between the currencies. Our "Both" option does exactly that: it converts the ZiG part to US$ at the exchange rate in the rate box, taxes the total with the USD table, then splits the tax and NSSA between your USD and ZiG pay in proportion.'],
  bonus: ['How much of my bonus is tax free?', 'The first US$700 of bonuses or performance-related awards in a year is exempt from income tax (the ZiG equivalent for ZiG pay). If you receive more than one bonus in a year the amounts are added together for the limit. Anything above it is added to that month\'s taxable income and taxed at your normal rates. The US$700 limit comes from the Finance Act (No. 2) of 2024; the bonus tax calculator page explains why it differs from the figure on one ZIMRA web page.'],
  medical: ['Do I get a tax credit for medical aid?', 'Yes. ZIMRA\'s PAYE guidance gives a medical tax credit of US$1 for every US$2 paid in medical aid contributions. Enter your monthly contribution under "More options" and it is taken off your PAYE (it cannot take your PAYE below zero).'],
  employer: ['What does an employee really cost an employer in Zimbabwe?', 'On top of gross pay the employer pays its 4.5% NSSA share (capped at the ceiling), the ZIMDEF training levy of 1% of the wage bill, and APWCS workers\' compensation, whose percentage depends on the employer\'s risk class. Some industries also pay an NEC levy. The Standards Development Levy (up to 0.5% of remuneration) is charged only to employers in classes specified by the Minister of Industry and Commerce, so confirm whether your business is liable before including it. PAYE and the AIDS levy are not employer costs, because they come out of the employee\'s pay.'],
  rate: ['Which exchange rate do you use for ZiG?', 'ZiG pay is taxed with the ZiG tables, so no conversion is needed for ordinary ZiG salaries. A rate is used only where the law is written in US$: the NSSA ceiling, the bonus limit, the elderly credit and mixed USD and ZiG pay. The default is the Reserve Bank of Zimbabwe average interbank rate (' + RATE + ' on ' + CFG.reference.rateDate + '). You can change it in any calculator.'],
  data: ['Do you store my salary details?', 'No. Every calculation runs in your own browser. Nothing you type is sent to a server, saved in a database or shared. When you copy a link to your results, the numbers are inside the link itself, so only share it if you are happy for the other person to see them.'],
  differ: ['Why is my payslip different from your result?', 'Common reasons: taxable allowances or benefits that are in or out of gross pay, a different NSSA ceiling, medical or other tax credits, pension contributions, a bonus or back pay in the same month, or part of your pay in ZiG. Use the payslip checker on the payslip explainer page to see which line differs.'],
  advice: ['Is this tax advice?', 'No. This is an estimator based on published ZIMRA and NSSA rules. Your employer\'s payroll and ZIMRA decide what is actually deducted. For anything unusual, such as share options, car benefits, retrenchment packages or foreign income, speak to a tax practitioner or ZIMRA.'],
  reverse: ['How do I work out the gross salary for a target net pay?', 'Tax is progressive, so there is no single percentage that converts net to gross. The net-to-gross calculator tries gross salaries until the take-home pay equals your target, using the same NSSA, PAYE and AIDS levy rules as the take-home calculator, and gives the lowest gross that reaches it.']
};
const pick = (...k) => k.map((x) => Q[x]);

/* ----------------------------------------------------------- page layout */
function jsonld(obj) { return '<script type="application/ld+json">' + JSON.stringify(obj).replace(/</g, '\\u003c') + '</script>'; }

function layout(p) {
  const url = SITE + p.path;
  const title = p.title;
  const desc = p.desc;
  const crumbs = p.path === '/' ? [] : (p.crumbs || [[p.crumbLabel || p.h1Text, p.path]]);
  const bc = [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' }].concat(crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 2, name: stripTags(c[0]), item: SITE + c[1] })));
  const graph = [
    { '@type': 'WebPage', '@id': url + '#webpage', url: url, name: title, description: desc, inLanguage: 'en-ZW', isPartOf: { '@id': SITE + '/#website' }, dateModified: BUILD_DATE },
    { '@type': 'BreadcrumbList', itemListElement: bc }
  ];
  if (p.path === '/') {
    graph.push({ '@type': 'WebSite', '@id': SITE + '/#website', url: SITE + '/', name: NAME, description: TAGLINE, inLanguage: 'en-ZW' });
    graph.push({ '@type': 'Organization', '@id': SITE + '/#org', name: NAME, url: SITE + '/', logo: SITE + '/assets/img/icon-512.png' });
  } else {
    graph.push({ '@type': 'WebSite', '@id': SITE + '/#website', url: SITE + '/', name: NAME });
  }
  if (p.tool) graph.push({ '@type': 'WebApplication', name: stripTags(p.appName || p.h1Text), url: url, applicationCategory: 'FinanceApplication', operatingSystem: 'Any (web browser)', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, description: desc, inLanguage: 'en-ZW', areaServed: { '@type': 'Country', name: 'Zimbabwe' } });
  if (p.faq && p.faq.length) graph.push({ '@type': 'FAQPage', mainEntity: p.faq.map((q) => ({ '@type': 'Question', name: stripTags(q[0]), acceptedAnswer: { '@type': 'Answer', text: stripTags(q[1]) } })) });

  const crumbHtml = p.path === '/' ? '' : '<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; ' + crumbs.map((c) => (c[1] === p.path ? stripTags(c[0]) : '<a href="' + c[1] + '">' + c[0] + '</a>')).join(' &rsaquo; ') + '</nav>';
  const chips = p.chips ? '<ul class="chips">' + p.chips.map((c) => '<li>' + c + '</li>').join('') + '</ul>' : '';

  let main = '<section class="hero' + (p.tool ? ' page-hero' : ' plain') + '"><div class="wrap">' + crumbHtml + '<h1>' + p.h1 + '</h1><p class="lede">' + p.lede + '</p>' + chips + '</div></section>';
  if (p.tool) {
    main += '<section class="tool-shell print-ok"><div class="wrap"><noscript><div class="card coral"><p><strong>JavaScript is switched off.</strong> The calculators need JavaScript to run in your browser. Please turn it on, or see the <a href="/salary-tables/">salary tables</a> for ready-made results.</p></div></noscript><div class="tool" data-tool="' + p.tool + '">' + FORMS[p.tool]() + '</div></div></section>';
  }
  main += p.body || '';
  if (p.faq && p.faq.length) main += '<section class="band mint"><div class="wrap"><h2 style="margin-top:0">Frequently asked questions</h2>' + faqHTML(p.faq) + '</div></section>';
  if (p.showRelated !== false) main += '<section class="band"><div class="wrap"><h2 style="margin-top:0">More free Zimbabwe pay tools</h2>' + related(p.path, 7) + '</div></section>';

  const ogImg = SITE + '/assets/img/og-image.png';
  return '<!doctype html>\n<html lang="en-ZW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + esc(title) + '</title><meta name="description" content="' + esc(desc) + '">' +
    '<link rel="canonical" href="' + url + '"><meta name="theme-color" content="#292521">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="' + NAME + '"><meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '"><meta property="og:url" content="' + url + '"><meta property="og:image" content="' + ogImg + '"><meta property="og:locale" content="en_ZW">' +
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + esc(title) + '"><meta name="twitter:description" content="' + esc(desc) + '"><meta name="twitter:image" content="' + ogImg + '">' +
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/assets/img/icon-32.png" sizes="32x32" type="image/png"><link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">' +
    '<link rel="stylesheet" href="/assets/css/styles.css">' + jsonld({ '@context': 'https://schema.org', '@graph': graph }) +
    '</head><body>' + header(p.path) + '<main id="main">' + main + '</main>' + footer() +
    '<script src="/assets/js/config.js" defer></script><script src="/assets/js/engine.js" defer></script><script src="/assets/js/ui.js" defer></script></body></html>';
}

const PAGES = [];
function page(p) { PAGES.push(p); }

/* ------------------------------------------------------------- examples */
const ex1000 = E.calc({ cur: 'USD', gross: 1000 });
const ex500 = E.calc({ cur: 'USD', gross: 500 });
const ex3000 = E.calc({ cur: 'USD', gross: 3000 });
const exZ = E.calc({ cur: 'ZWG', gross: 20000, rate: RATE });

function stepsList(items) { return '<ol class="steps-list">' + items.map((i) => '<li>' + i + '</li>').join('') + '</ol>'; }

const SOURCES_BAND = '<section class="band dark"><div class="wrap"><h2 style="margin-top:0">Where the numbers come from</h2><p style="max-width:44em">Every rate in these calculators is taken from official sources, not copied from other calculators: the <a href="https://www.zimra.co.zw/domestic-taxes/tax-tables" rel="noopener" style="color:var(--sun)">ZIMRA PAYE tax tables</a>, ZIMRA\'s <a href="https://www.zimra.co.zw/domestic-taxes/individual/pay-as-you-earn-paye" rel="noopener" style="color:var(--sun)">PAYE guidance</a> and <a href="https://www.nssa.org.zw/contributions/" rel="noopener" style="color:var(--sun)">NSSA\'s contributions page</a>. USD and ZiG each use their own official table. See <a href="/about/" style="color:var(--sun)">how it works</a>. Last checked ' + VERIFIED + '.</p></div></section>';

/* ================================================================== HOME */
page({
  path: '/', tool: 'net', appName: 'Zimbabwe Take-Home Pay Calculator',
  title: 'Zimbabwe Salary Calculator 2026: Take-Home Pay, PAYE and NSSA | ' + NAME,
  desc: 'Free Zimbabwe salary calculator. Enter your gross pay in USD, ZiG or both and see PAYE, AIDS levy, NSSA and your take-home pay, using official ZIMRA and NSSA figures.',
  h1: 'Know what <em>actually</em> reaches your pocket',
  h1Text: 'Zimbabwe take-home pay calculator',
  lede: 'Type in your gross salary and see your PAYE, AIDS levy, NSSA and take-home pay in seconds, in US$, ZiG or both.',
  chips: ['USD and ZiG', 'Official ZIMRA tables', 'NSSA included', 'Free, no sign-up', 'Private: runs in your browser'],
  body:
    '<section class="band"><div class="wrap prose"><h2 style="margin-top:0">How your take-home pay is worked out in Zimbabwe</h2><p>Your payslip is a short sum, but each line has its own rule. This calculator follows the same order your employer\'s payroll does:</p>' +
    stepsList([
      '<b>Start with gross pay.</b> Your basic salary plus any taxable allowances for the month.',
      '<b>Take off NSSA.</b> You pay 4.5% of insurable earnings, capped at US$700 a month, so the most you pay is US$31.50.',
      '<b>Work out taxable income.</b> Gross pay minus NSSA (and any approved pension contribution).',
      '<b>Apply the ZIMRA PAYE table.</b> Multiply taxable income by the rate for its band, then deduct the fixed amount shown for that band. USD pay uses the USD table and ZiG pay uses the ZWG table.',
      '<b>Add the 3% AIDS levy</b> on the PAYE, and subtract any tax credits first (for example medical aid).',
      '<b>What is left is your take-home pay.</b>'
    ]) +
    '<div class="callout green"><b>Worked example.</b> On a gross salary of ' + usd(1000) + ' a month: NSSA is ' + usd(ex1000.nssaEmployee) + ', taxable income is ' + usd(ex1000.taxable) + ', PAYE is ' + usd(ex1000.paye) + ' and the AIDS levy is ' + usd(ex1000.aidsLevy) + '. Take-home pay is <b>' + usd(ex1000.net) + '</b>, or ' + pct(ex1000.net / 1000) + ' of gross. See more in the <a href="/salary-tables/">salary tables</a>.</div>' +
    '<h2>US$ pay, ZiG pay, or both</h2><p>ZIMRA publishes a separate PAYE table for each currency, so this site does not simply convert one into the other. Choose <b>US$</b> to use the USD table, <b>ZiG</b> to use the ZWG table, or <b>Both</b> if you are paid part in each. For mixed pay ZIMRA\'s rule is to use the USD table and split the tax between the two currencies, which is what the calculator does.</p></div></section>' +
    '<section class="band butter"><div class="wrap"><h2 style="margin-top:0">Every pay tool in one place</h2>' + tiles(TOOLS) + '</div></section>' +
    SOURCES_BAND,
  faq: pick('paye', 'nssa', 'threshold', 'tables', 'mixed', 'differ'),
  showRelated: false
});

/* ============================================================ PAYE page */
page({
  path: '/paye-calculator/', tool: 'net', crumbLabel: 'PAYE calculator', appName: 'Zimbabwe PAYE Calculator',
  title: 'PAYE Calculator Zimbabwe 2026 (USD and ZiG) | ' + NAME,
  desc: 'Calculate PAYE and the 3% AIDS levy in Zimbabwe using the official ZIMRA USD and ZWG tax tables. See which band applies and how much tax you pay each month.',
  h1: 'PAYE calculator <em>Zimbabwe</em>',
  h1Text: 'PAYE calculator Zimbabwe',
  lede: 'See your monthly PAYE and AIDS levy using the official ZIMRA tables, with every step of the working shown.',
  chips: ['USD table', 'ZWG table', 'AIDS levy 3%', 'Tax credits supported'],
  body:
    '<section class="band"><div class="wrap prose"><h2 style="margin-top:0">How PAYE works</h2><p>PAYE (Pay As You Earn) is the income tax your employer deducts from your pay each month and pays to ZIMRA. It is progressive: the more you earn, the higher the rate on the top slice. ZIMRA publishes the monthly tables as a rate and a fixed amount to deduct, so the sum is simple:</p><div class="callout"><b>PAYE = taxable income &times; band rate &minus; band deduct</b></div>' +
    '<p>Using a ' + usd(1000) + ' salary as an example, taxable income after NSSA is ' + usd(ex1000.taxable) + '. That falls in the 25% band, so the tax is ' + usd(ex1000.taxable) + ' &times; 25% &minus; US$35.00 = ' + usd(ex1000.paye) + '. The AIDS levy of 3% adds ' + usd(ex1000.aidsLevy) + ', making ' + usd(ex1000.totalTax) + ' in total.</p>' +
    '<h2>Monthly PAYE bands (USD)</h2>' + bandTable(CFG.paye.USD, 'USD', false, 'ZIMRA foreign currency tax tables, monthly table, applied in ' + YEAR + '.') +
    '<h2>Monthly PAYE bands (ZiG)</h2>' + bandTable(CFG.paye.ZWG, 'ZWG', false, 'ZIMRA ZWG tax tables, monthly table, applied in ' + YEAR + '.') +
    '<p>The yearly versions of these tables are on the <a href="/tax-tables/">PAYE tax tables</a> page.</p>' +
    '<h2>What reduces your PAYE</h2><ul><li><b>NSSA contributions</b> reduce taxable income before the table is applied.</li><li><b>Approved pension or retirement fund contributions</b> also reduce taxable income (add them under "More options").</li><li><b>Medical aid:</b> a credit of US$1 for every US$2 you pay.</li><li><b>Elderly, blind or disabled credit:</b> US$900 a year.</li></ul></div></section>' + SOURCES_BAND,
  faq: pick('paye', 'threshold', 'aids', 'nssaBeforeTax', 'medical')
});

/* ============================================================ NSSA page */
page({
  path: '/nssa-calculator/', tool: 'nssa', crumbLabel: 'NSSA calculator', appName: 'Zimbabwe NSSA Calculator',
  title: 'NSSA Contribution Calculator Zimbabwe 2026 | ' + NAME,
  desc: 'Work out your NSSA pension contribution in Zimbabwe: 4.5% for the employee and 4.5% for the employer, capped at the US$700 monthly insurable earnings ceiling.',
  h1: 'NSSA <em>contribution</em> calculator',
  h1Text: 'NSSA contribution calculator',
  lede: 'Find out what you and your employer pay into the NSSA Pension and Other Benefits Scheme each month.',
  chips: ['4.5% employee', '4.5% employer', 'US$700 ceiling'],
  body:
    '<section class="band"><div class="wrap prose"><h2 style="margin-top:0">NSSA contributions in plain English</h2><p>NSSA, the National Social Security Authority, runs the Pension and Other Benefits Scheme. Both you and your employer pay in. Each side pays <b>4.5%</b> of your insurable earnings, which makes 9% in total going to NSSA on your behalf.</p>' +
    '<p>Insurable earnings are capped at <b>US$700 a month</b> (or the ZiG equivalent). That means the most an employee can pay is 4.5% &times; US$700 = <b>US$31.50 a month</b>, and the employer pays the same. NSSA says the ceiling is gazetted quarterly, so it can change. Contributions are deducted for employees below age 65.</p>' +
    '<table class="band-table"><thead><tr><th scope="col">Monthly gross pay</th><th scope="col" class="num">You pay</th><th scope="col" class="num">Employer pays</th><th scope="col" class="num">Total to NSSA</th></tr></thead><tbody>' +
    [200, 400, 700, 1000, 3000].map((g) => { const r = E.calc({ cur: 'USD', gross: g }); return '<tr><td>' + usd0(g) + '</td><td class="num">' + usd(r.nssaEmployee) + '</td><td class="num">' + usd(r.nssaEmployer) + '</td><td class="num">' + usd(r.nssaEmployee + r.nssaEmployer) + '</td></tr>'; }).join('') + '</tbody></table>' +
    '<h2>NSSA and your tax</h2><p>Your NSSA contribution comes off your pay <i>before</i> PAYE is worked out, so it lowers your taxable income a little. The <a href="/">take-home pay calculator</a> does this for you.</p></div></section>' + SOURCES_BAND,
  faq: pick('nssa', 'nssaBeforeTax', 'rate')
});

/* ======================================================= comparison page */
page({
  path: '/salary-comparison/', tool: 'compare', crumbLabel: 'Salary comparison', appName: 'Zimbabwe Salary Comparison Calculator',
  title: 'Salary Comparison Calculator Zimbabwe: Compare Two Pay Offers | ' + NAME,
  desc: 'Compare two Zimbabwe salaries or job offers by take-home pay after PAYE, AIDS levy and NSSA. Works for USD and ZiG, even side by side.',
  h1: 'Salary <em>comparison</em> calculator',
  h1Text: 'Salary comparison calculator Zimbabwe',
  lede: 'A bigger gross salary is not always a bigger bank deposit. Compare two options by what you actually take home.',
  chips: ['USD vs ZiG', 'After tax and NSSA', 'Monthly and yearly'],
  body:
    '<section class="band"><div class="wrap prose"><h2 style="margin-top:0">Why compare take-home pay, not gross</h2><p>Tax is progressive, so each extra dollar of gross pay is taxed at a higher rate than the one before. A US$200 raise at a low salary keeps far more of its value than the same raise at a high salary. Comparing take-home pay shows the real difference between two offers.</p>' +
    '<p>For example, ' + usd(800) + ' gross gives ' + usd(E.calc({ cur: 'USD', gross: 800 }).net) + ' take-home and ' + usd(1000) + ' gross gives ' + usd(ex1000.net) + ', so the extra ' + usd(200) + ' of gross is worth ' + usd(ex1000.net - E.calc({ cur: 'USD', gross: 800 }).net) + ' in the hand.</p>' +
    '<h2>Comparing a US$ job with a ZiG job</h2><p>Each option is taxed with the right currency table first. Then, so you can compare like with like, the ZiG take-home is converted to US$ at the exchange rate in the rate box (open "More options" to change it). The rate you use matters a lot, so check it against the current RBZ rate.</p></div></section>' + SOURCES_BAND,
  faq: pick('rate', 'paye', 'differ')
});

/* ========================================================== reverse page */
page({
  path: '/reverse-salary-calculator/', tool: 'reverse', crumbLabel: 'Net to gross', appName: 'Zimbabwe Net to Gross Salary Calculator',
  title: 'Reverse Salary Calculator Zimbabwe: Net to Gross | ' + NAME,
  desc: 'Know the take-home pay you want? Find the gross salary you need in Zimbabwe after PAYE, AIDS levy and NSSA, in USD or ZiG.',
  h1: 'Net to gross <em>salary</em> calculator',
  h1Text: 'Net to gross salary calculator Zimbabwe',
  lede: 'Enter the monthly amount you want to receive and find the gross salary to ask for.',
  chips: ['Target take-home', 'Negotiation ready', 'USD and ZiG'],
  body:
    '<section class="band"><div class="wrap prose"><h2 style="margin-top:0">Negotiating a net salary</h2><p>Many offers are agreed as a take-home figure ("I need US$1,000 in my account"). Because PAYE is progressive and NSSA is capped, there is no single percentage that turns net into gross. This tool searches for the lowest gross salary whose take-home pay reaches your target, using exactly the same rules as the take-home calculator.</p>' +
    '<p>For instance, to take home ' + usd(ex1000.net) + ' a month you need a gross salary of ' + usd(1000) + '. To take home ' + usd(ex3000.net) + ' you need ' + usd(3000) + '.</p>' +
    '<div class="callout"><b>Tip:</b> if your employer also pays you taxable allowances, work out the total gross first, then split it between basic pay and allowances.</div></div></section>' + SOURCES_BAND,
  faq: pick('reverse', 'paye', 'nssa')
});

/* =========================================================== bonus page */
page({
  path: '/bonus-tax-calculator/', tool: 'bonus', crumbLabel: 'Bonus tax', appName: 'Zimbabwe Bonus Tax Calculator',
  title: 'Bonus Tax Calculator Zimbabwe 2026: US$700 Tax-Free Limit | ' + NAME,
  desc: 'Find out how much tax you pay on a bonus in Zimbabwe. Includes the US$700 tax-free bonus exemption, PAYE and AIDS levy, in USD or ZiG.',
  h1: 'Bonus tax <em>calculator</em>',
  h1Text: 'Bonus tax calculator Zimbabwe',
  lede: 'See what your bonus is worth after the tax-free allowance, PAYE and the AIDS levy.',
  chips: ['US$700 tax-free', 'Multiple bonuses', 'USD and ZiG'],
  body:
    '<section class="band"><div class="wrap prose"><h2 style="margin-top:0">How bonuses are taxed</h2><p>Bonuses and performance-related awards are exempt from income tax up to <b>US$700 a year</b> (or the ZiG equivalent at the rate on the payment date). The Finance Act (No. 2) of 2024 raised this from US$400 to US$700. If you get several bonuses in one year they share the same US$700.</p>' +
    '<p>The part above the limit is added to your taxable income for the month it is paid, so it is taxed at the top of your normal bands. The tax on the bonus is the extra PAYE (plus 3% AIDS levy) that the bonus causes. For a ' + usd(1000) + ' salary and a ' + usd(1000) + ' bonus, ' + usd(700) + ' is tax free, ' + usd(300) + ' is taxable and the tax is ' + usd(E.bonus('USD', { gross: 1000 }, 1000, 0).extraTax) + ', leaving ' + usd(E.bonus('USD', { gross: 1000 }, 1000, 0).netBonus) + '.</p>' +
    '<div class="callout green"><b>Why US$700 and not US$400?</b> The exemption is set by legislation, not by a web page. The Finance Act (No. 2) of 2024, which amended the bonus exemption in the Income Tax Act [Chapter 23:06], raised the tax-free limit from US$400 to US$700 (reported by <a href="https://www.mmmlawfirm.co.zw/key-amendments-to-zimbabwes-tax-laws-under-the-finance-act-2024/" rel="noopener">MMM Law Firm</a> and in payroll-software notices). ZIMRA\'s explanatory page <a href="https://www.zimra.co.zw/domestic-taxes/individual/paye-explained" rel="noopener">PAYE Explained</a> still shows US$400 for foreign-currency bonuses from 1 January 2024. We follow the Act, and this site has not checked it against the gazetted text. If your employer\'s payroll uses a different limit, ask which one it applies and why.</div><div class="callout coral"><b>Good to know:</b> your payslip for the bonus month will show a higher PAYE because the bonus sits on top of that month\'s salary. Payroll systems can time bonus tax slightly differently, so treat this as an estimate.</div></div></section>' + SOURCES_BAND,
  faq: pick('bonus', 'paye', 'aids')
});

/* ========================================================= employer page */
page({
  path: '/employer-cost-calculator/', tool: 'employer', crumbLabel: 'Employer cost', appName: 'Zimbabwe Employer Cost Calculator',
  title: 'Employer Cost Calculator Zimbabwe: NSSA, ZIMDEF and Levies | ' + NAME,
  desc: 'Calculate what an employee really costs you in Zimbabwe: gross pay plus employer NSSA, ZIMDEF, the Standards Development Levy and APWCS.',
  h1: 'Employer <em>cost</em> calculator',
  h1Text: 'Employer cost calculator Zimbabwe',
  lede: 'Gross salary is not the whole bill. See the full monthly and yearly cost of employing someone.',
  chips: ['Employer NSSA', 'ZIMDEF 1%', 'Standards levy (optional)', 'APWCS'],
  body:
    '<section class="band"><div class="wrap prose"><h2 style="margin-top:0">What employers pay on top of salary</h2>' +
    '<table class="band-table"><thead><tr><th scope="col">Cost</th><th scope="col">Rate</th><th scope="col">Basis</th></tr></thead><tbody>' +
    '<tr><td>NSSA (employer share)</td><td>4.5%</td><td>Insurable earnings, capped at US$700 a month</td></tr>' +
    '<tr><td>ZIMDEF levy</td><td>1%</td><td>Gross wage bill, including directors. Registered employers with an annual wage bill below US$6,000 are reported to be exempt from 16 January 2026</td></tr>' +
    '<tr><td>Standards Development Levy</td><td>Up to 0.5%</td><td>Total remuneration, paid quarterly in arrears. <b>Only for employers in classes specified by the Minister of Industry and Commerce.</b> Confirm whether you are liable. Optional in the calculator</td></tr>' +
    '<tr><td>APWCS (workers\' compensation)</td><td>Varies</td><td>Risk-rated by industry. Confirm your rate with NSSA</td></tr></tbody></table>' +
    '<p>For a ' + usd(1000) + ' monthly salary the employer\'s statutory costs are ' + usd(E.employer('USD', { gross: 1000 }, { zimdefApplies: true }).onTop) + ' (NSSA and ZIMDEF) before APWCS, so the real monthly cost is ' + usd(E.employer('USD', { gross: 1000 }, { zimdefApplies: true }).total) + '. If your business is liable for the Standards Development Levy, add ' + usd(E.employer('USD', { gross: 1000 }, { zimdefApplies: true, sdlApplies: true }).sdl) + ' (0.5%) for a total of ' + usd(E.employer('USD', { gross: 1000 }, { zimdefApplies: true, sdlApplies: true }).total) + '. Employee PAYE and the AIDS levy are paid out of the employee\'s salary, not on top of it.</p>' +
    '<div class="callout coral"><b>Check your liability for the Standards Development Levy.</b> Under the Standards Development Fund Act [Chapter 14:19] the Minister of Industry and Commerce may impose this levy, by statutory instrument, on specified classes of employers. It does not automatically apply to every employer, so the calculator leaves it switched off. Confirm with the Ministry of Industry and Commerce whether your business is liable (<a href="https://faolex.fao.org/docs/pdf/zim93557.pdf" rel="noopener">Act text</a>).</div><div class="callout"><b>Not included:</b> APWCS and industry levies such as an NEC levy depend on your risk class and industry, so you enter those percentages yourself. Check current rates with NSSA and your industry body.</div></div></section>' + SOURCES_BAND,
  faq: pick('employer', 'nssa', 'advice')
});

/* ======================================================== payslip page */
const PAYSLIP_EX = E.calc({ cur: 'USD', gross: 1000 });
page({
  path: '/payslip-explainer/', tool: 'payslip', crumbLabel: 'Payslip explainer', appName: 'Zimbabwe Payslip Checker',
  title: 'Zimbabwe Payslip Explained: PAYE, NSSA, AIDS Levy and Net Pay | ' + NAME,
  desc: 'Every line on a Zimbabwe payslip explained in plain English, plus a free checker that compares your PAYE, NSSA and net pay with the official rules.',
  h1: 'Your payslip, <em>explained</em>',
  h1Text: 'Zimbabwe payslip explained',
  lede: 'Understand each line of your payslip, then check your own figures against the official rules.',
  chips: ['Line-by-line guide', 'Payslip checker', 'Spot mistakes'],
  body:
    '<section class="band"><div class="wrap prose"><h2 style="margin-top:0">A sample payslip, line by line</h2><p>This is a US$1,000 monthly salary. Open the checker above and type these numbers in to see how the tool works.</p>' +
    '<div class="tablewrap"><table class="band-table"><thead><tr><th scope="col">Line</th><th scope="col" class="num">Amount</th><th scope="col">What it means</th></tr></thead><tbody>' +
    '<tr><td><b>Gross pay</b></td><td class="num">' + usd(PAYSLIP_EX.gross) + '</td><td>Basic salary plus taxable allowances, before anything is taken off.</td></tr>' +
    '<tr><td>NSSA</td><td class="num">-' + usd(PAYSLIP_EX.nssaEmployee) + '</td><td>Your 4.5% pension contribution. Capped at US$31.50 because pay is above the US$700 ceiling.</td></tr>' +
    '<tr><td>Taxable income</td><td class="num">' + usd(PAYSLIP_EX.taxable) + '</td><td>Gross minus NSSA. This is the figure the PAYE table is applied to.</td></tr>' +
    '<tr><td>PAYE</td><td class="num">-' + usd(PAYSLIP_EX.paye) + '</td><td>Income tax: ' + usd(PAYSLIP_EX.taxable) + ' &times; 25% &minus; US$35.00.</td></tr>' +
    '<tr><td>AIDS levy</td><td class="num">-' + usd(PAYSLIP_EX.aidsLevy) + '</td><td>3% of the PAYE.</td></tr>' +
    '<tr><td><b>Net pay</b></td><td class="num"><b>' + usd(PAYSLIP_EX.net) + '</b></td><td>What reaches your account, before any loans or other deductions.</td></tr></tbody></table></div>' +
    '<h2>Other lines you may see</h2><ul><li><b>Pension or retirement fund:</b> reduces taxable income.</li><li><b>Medical aid:</b> your contribution, which also earns a PAYE credit.</li><li><b>Loan or salary advance repayments, funeral policy, union dues:</b> deducted after tax.</li><li><b>Employer NSSA, ZIMDEF and levies:</b> paid by your employer on top, not taken from you. See the <a href="/employer-cost-calculator/">employer cost calculator</a>.</li></ul>' +
    '<div class="callout coral"><b>If something looks wrong:</b> ask your payroll or HR team to explain the line first. PAYE questions can also go to ZIMRA.</div></div></section>' + SOURCES_BAND,
  faq: pick('differ', 'aids', 'nssaBeforeTax', 'medical')
});

/* ==================================================== salary tables page */
const USD_LIST = [150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500, 1800, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 7500, 10000];
const ZIG_LIST = [3000, 5000, 7500, 10000, 15000, 20000, 25000, 30000, 40000, 50000, 75000, 100000, 150000, 250000];
const USD_PAGES = [200, 300, 400, 500, 600, 800, 1000, 1200, 1500, 2000, 2500, 3000, 4000, 5000];
const ZIG_PAGES = [5000, 10000, 15000, 20000, 30000, 50000, 75000, 100000];
const slugU = (g) => '/salary/usd-' + g + '/';
const slugZ = (g) => '/salary/zig-' + g + '/';

function salaryTable(list, cur, pages, slug) {
  let h = '<div class="tablewrap"><table class="band-table"><thead><tr><th scope="col">Gross (monthly)</th><th scope="col" class="num">NSSA</th><th scope="col" class="num">PAYE</th><th scope="col" class="num">AIDS levy</th><th scope="col" class="num">Take-home</th><th scope="col" class="num">You keep</th></tr></thead><tbody>';
  list.forEach((g) => {
    const r = E.calc({ cur: cur, gross: g, rate: RATE });
    const lab = cur === 'USD' ? usd0(g) : zig0(g);
    const cell = pages.indexOf(g) > -1 ? '<a href="' + slug(g) + '">' + lab + '</a>' : lab;
    h += '<tr><td>' + cell + '</td><td class="num">' + E.fmt(cur, r.nssaEmployee) + '</td><td class="num">' + E.fmt(cur, r.paye) + '</td><td class="num">' + E.fmt(cur, r.aidsLevy) + '</td><td class="num"><b>' + E.fmt(cur, r.net) + '</b></td><td class="num">' + pct(r.net / g) + '</td></tr>';
  });
  return h + '</tbody></table></div>';
}
page({
  path: '/salary-tables/', crumbLabel: 'Salary tables',
  title: 'Zimbabwe Salary Tables ' + YEAR + ': Take-Home Pay at Common Salaries | ' + NAME,
  desc: 'Quick reference tables of Zimbabwe take-home pay after PAYE, AIDS levy and NSSA for common monthly salaries in USD and ZiG.',
  h1: 'Zimbabwe salary <em>tables</em>',
  h1Text: 'Zimbabwe salary tables',
  lede: 'What common monthly salaries are worth after PAYE, the AIDS levy and NSSA. Click a salary for the full breakdown.',
  chips: ['USD', 'ZiG', 'Updated ' + VERIFIED],
  body:
    '<section class="band"><div class="wrap"><div class="prose"><h2 style="margin-top:0">US$ salaries (monthly)</h2><p>Assumes you are under 65, NSSA is deducted, and there are no pension contributions, medical credits or other deductions. Use the <a href="/">calculator</a> for your own situation.</p></div>' +
    salaryTable(USD_LIST, 'USD', USD_PAGES, slugU) +
    '<div class="prose"><h2>ZiG salaries (monthly)</h2><p>Calculated with the ZWG table. The NSSA ceiling in ZiG is US$700 converted at ZiG ' + RATE + ' per US$1 (the RBZ average rate on ' + CFG.reference.rateDate + '), which is ' + zig(700 * RATE) + '.</p></div>' +
    salaryTable(ZIG_LIST, 'ZWG', ZIG_PAGES, slugZ) +
    '</div></section>' + SOURCES_BAND,
  faq: pick('differ', 'rate', 'threshold')
});

/* ==================================================== tax tables page */
page({
  path: '/tax-tables/', crumbLabel: 'PAYE tax tables',
  title: 'Zimbabwe PAYE Tax Tables ' + YEAR + ' (USD and ZWG): Monthly and Annual | ' + NAME,
  desc: 'The official ZIMRA PAYE tax tables for Zimbabwe in USD and ZWG, monthly and annual, with the rate and deduct amounts, the AIDS levy and credits.',
  h1: 'Zimbabwe PAYE <em>tax tables</em> ' + YEAR,
  h1Text: 'Zimbabwe PAYE tax tables',
  lede: 'The ZIMRA monthly and annual tables in USD and ZWG, exactly as the calculators use them.',
  chips: ['ZIMRA official', 'Monthly + annual', 'Checked ' + VERIFIED],
  body:
    '<section class="band"><div class="wrap prose"><div class="callout"><b>Which tables are these?</b> ZIMRA\'s PAYE tables for 1 January to 31 December 2026, in USD and in ZWG. The monthly rates and deduct amounts are unchanged from the 2025 tables. The official PDFs are on the <a href="https://www.zimra.co.zw/domestic-taxes/tax-tables" rel="noopener">ZIMRA tax tables page</a>. Last checked ' + VERIFIED + '.</div>' +
    '<h2 style="margin-top:0">How to use the table</h2><p>Take your monthly taxable income, find its band, multiply by the rate, then subtract the "deduct" amount. Example (USD): ' + usd(1800) + ' &times; 30% &minus; ' + usd(85) + ' = ' + usd(455) + '. Then subtract tax credits and add the 3% AIDS levy.</p>' +
    '<h2>USD monthly table</h2>' + bandTable(CFG.paye.USD, 'USD', false, 'Foreign currency (USD) PAYE table, monthly.') +
    '<h2>USD annual table</h2>' + bandTable(CFG.paye.USD, 'USD', true, 'Foreign currency (USD) PAYE table, annual.') +
    '<h2>ZWG (ZiG) monthly table</h2>' + bandTable(CFG.paye.ZWG, 'ZWG', false, 'ZWG PAYE table, monthly.') +
    '<h2>ZWG (ZiG) annual table</h2>' + bandTable(CFG.paye.ZWG, 'ZWG', true, 'ZWG PAYE table, annual.') +
    '<h2>Other figures used</h2><table class="band-table"><thead><tr><th scope="col">Item</th><th scope="col">Figure</th></tr></thead><tbody>' +
    '<tr><td>AIDS levy</td><td>3% of PAYE payable</td></tr><tr><td>NSSA employee / employer</td><td>4.5% each, on insurable earnings up to US$700 a month</td></tr>' +
    '<tr><td>Tax-free bonus</td><td>US$700 a year (or ZiG equivalent), Finance Act (No. 2) of 2024</td></tr><tr><td>Medical credit</td><td>US$1 for every US$2 of medical aid contributions</td></tr>' +
    '<tr><td>Elderly, blind or disabled credit</td><td>US$900 a year (or ZiG equivalent)</td></tr><tr><td>PAYE payment due</td><td>10th of the following month</td></tr></tbody></table>' +
    '<p><a class="btn btn-primary" href="/">Calculate my take-home pay</a></p></div></section>' + SOURCES_BAND,
  faq: pick('tables', 'threshold', 'mixed')
});

/* ============================================================= FAQ page */
page({
  path: '/faq/', crumbLabel: 'FAQ',
  title: 'Zimbabwe Salary, PAYE and NSSA FAQ | ' + NAME,
  desc: 'Answers to common questions about PAYE, the AIDS levy, NSSA, bonus tax, medical credits, USD and ZiG pay and take-home pay in Zimbabwe.',
  h1: 'Zimbabwe pay and tax <em>questions</em>',
  h1Text: 'Zimbabwe pay and tax FAQ',
  lede: 'Straight answers on PAYE, NSSA, bonuses and your payslip.',
  body: '',
  faq: pick('paye', 'threshold', 'tables', 'nssa', 'aids', 'nssaBeforeTax', 'mixed', 'bonus', 'medical', 'employer', 'reverse', 'rate', 'differ', 'data', 'advice'),
  faqOnlySchema: true
});

/* ================================================================= About */
page({
  path: '/about/', crumbLabel: 'About and method',
  title: 'About ' + NAME + ' and How the Calculators Work',
  desc: 'How MyNetPay ZW calculates Zimbabwe PAYE, NSSA and take-home pay, which official sources it uses, and what the calculators do not cover.',
  h1: 'About ' + NAME + ' and <em>how it works</em>',
  h1Text: 'About MyNetPay ZW',
  lede: 'A free, independent Zimbabwe pay calculator built around official ZIMRA and NSSA figures.',
  body:
    '<section class="band"><div class="wrap prose"><h2 style="margin-top:0">Why this site exists</h2><p>Zimbabweans are paid in US$, in ZiG, or in a mix of both, and the rules for each are different. ' + NAME + ' exists to give a clear answer to a simple question: how much of my salary will I actually receive? It is free, needs no account and keeps your figures on your own device.</p>' +
    '<h2>How the calculation works</h2>' + stepsList([
      'Gross pay is the monthly figure you enter (basic salary plus taxable allowances).',
      'NSSA employee contribution = 4.5% of gross pay, capped at insurable earnings of US$700 a month (the ZiG ceiling is US$700 converted at the exchange rate shown). Not applied if you are 65 or over.',
      'Taxable income = gross pay minus NSSA minus any approved pension contribution.',
      'PAYE = taxable income &times; band rate &minus; band deduct, using ZIMRA\'s monthly USD table for US$ pay and ZIMRA\'s monthly ZWG table for ZiG pay. Each currency uses its own official table; one is never converted into the other.',
      'Tax credits (medical aid, elderly/blind/disabled) are subtracted from the PAYE, but cannot take it below zero.',
      'AIDS levy = 3% of the PAYE payable. Take-home pay = gross pay minus NSSA, pension, PAYE, AIDS levy and any other deductions you enter.'
    ]) +
    '<p>If you are paid in both currencies, ZIMRA\'s published rule is to use the USD tables and apportion the tax. We do that, converting the ZiG part at the exchange rate in the rate box.</p>' +
    '<h2>Official sources</h2><ul>' +
    '<li><a href="https://www.zimra.co.zw/domestic-taxes/tax-tables" rel="noopener">ZIMRA tax tables</a>: PAYE tables for 1 January to 31 December 2026 (USD and ZWG).</li>' +
    '<li><a href="https://www.zimra.co.zw/domestic-taxes/individual/pay-as-you-earn-paye" rel="noopener">ZIMRA PAYE guidance</a>: order of calculation, AIDS levy, credits, mixed-currency rule, payment by the 10th.</li>' +
    '<li><a href="https://www.nssa.org.zw/contributions/" rel="noopener">NSSA contributions</a>: 4.5% each, US$700 ceiling, gazetted quarterly, employees below 65.</li>' +
    '<li>Finance Act (No. 2) of 2024: raised the tax-free bonus limit from US$400 to US$700 (reported by <a href="https://www.mmmlawfirm.co.zw/key-amendments-to-zimbabwes-tax-laws-under-the-finance-act-2024/" rel="noopener">MMM Law Firm</a>). ZIMRA\'s <a href="https://www.zimra.co.zw/domestic-taxes/individual/paye-explained" rel="noopener">PAYE Explained</a> page still shows US$400, so ask your employer which limit it applies.</li>' +
    '<li>Standards Development Levy: <a href="https://faolex.fao.org/docs/pdf/zim93557.pdf" rel="noopener">Standards Development Fund Act [Chapter 14:19]</a>, section 3 (imposed on classes of employers specified by the Minister of Industry and Commerce, up to 0.5% of remuneration; optional in the employer calculator).</li><li>ZIMDEF rate and exemption (reported by <a href="https://mjconsultants.co.zw/insights/every-statutory-deduction-a-zimbabwean-employer-must-make-in-2026-nssa-zimdef-standards-levy-and-apwcs/" rel="noopener">M&amp;J Consultants</a>).</li>' +
    '<li>Reference exchange rate: Reserve Bank of Zimbabwe interbank rate (' + RATE + ' on ' + CFG.reference.rateDate + ').</li></ul>' +
    '<p>Every figure sits in one documented file, <code>config.js</code>, so it can be checked and updated quickly. The calculators are tested against the 2026 table figures and ZIMRA\'s published worked examples. Figures last verified: <b>' + VERIFIED + '</b>.</p>' +
    '<h2>What the calculators do not cover</h2><ul><li>Taxable benefits such as company cars, housing or loans.</li><li>Retrenchment and severance packages, share options, back pay or leave pay.</li><li>Part-year or mid-year changes of employer.</li><li>Legal limits on pension or retirement fund deductions, and the detail of the elderly concession.</li><li>APWCS and industry levies (NEC and similar), which depend on the employer, so you enter them yourself.</li><li>Pay periods other than monthly. Enter your monthly figure.</li></ul>' +
    '<div class="callout"><b>Spotted a number that looks out of date?</b> Tax rules change. Compare with the <a href="https://www.zimra.co.zw/domestic-taxes/tax-tables" rel="noopener">ZIMRA tax tables</a> and your payslip, and treat this site as an estimate.</div></div></section>',
  showRelated: true
});

/* =============================================================== Privacy */
page({
  path: '/privacy/', crumbLabel: 'Privacy',
  title: 'Privacy | ' + NAME,
  desc: 'MyNetPay ZW calculates everything in your browser. Your salary details are not sent to a server, stored or shared.',
  h1: 'Privacy <em>policy</em>',
  h1Text: 'Privacy policy',
  lede: 'Short version: your salary stays on your device.',
  showRelated: false,
  body:
    '<section class="band"><div class="wrap prose"><h2 style="margin-top:0">What happens to the numbers you enter</h2><p>All calculations run in your web browser using JavaScript that is downloaded with the page. The amounts you type are not sent to us, not stored in a database and not shared with anyone.</p>' +
    '<h2>Links that contain your figures</h2><p>As you type, the page address updates so you can bookmark or share your results. Those figures are in the link itself. If you copy the link and send it to someone, they will see the numbers. Do not share a link you want to keep private.</p>' +
    '<h2>Cookies, accounts and tracking</h2><p>This site does not use cookies, does not ask you to create an account and does not include advertising or analytics scripts.</p>' +
    '<h2>Hosting</h2><p>The website files are served by a hosting provider (currently Netlify). Like any web host, it may keep standard technical logs such as IP address and pages requested, for security and to keep the service running. That is separate from anything you enter into the calculators.</p>' +
    '<h2>Changes</h2><p>If this changes, for example if analytics are added later, this page will be updated first. Last updated ' + VERIFIED + '.</p></div></section>'
});

/* ============================================================ Disclaimer */
page({
  path: '/disclaimer/', crumbLabel: 'Disclaimer',
  title: 'Disclaimer | ' + NAME,
  desc: 'MyNetPay ZW provides estimates only. It is not tax advice and is not connected to ZIMRA, NSSA or the Government of Zimbabwe.',
  h1: '<em>Disclaimer</em>',
  h1Text: 'Disclaimer',
  lede: 'Please read this before relying on any result.',
  showRelated: false,
  body:
    '<section class="band"><div class="wrap prose"><h2 style="margin-top:0">Estimates only</h2><p>' + NAME + ' calculates estimates using published ZIMRA and NSSA figures. We work hard to keep them accurate and current, but we cannot promise that every result is correct for your circumstances or that the figures have not changed since we last checked (' + VERIFIED + ').</p>' +
    '<h2>Not advice</h2><p>Nothing on this site is tax, legal, accounting or payroll advice. Your employer\'s payroll and ZIMRA determine the tax actually due. For anything complex, speak to a qualified tax practitioner or ZIMRA.</p>' +
    '<h2>Independence</h2><p>This is an independent website. It is not operated by, endorsed by or connected to ZIMRA, NSSA, ZIMDEF, the Reserve Bank of Zimbabwe or the Government of Zimbabwe.</p>' +
    '<h2>Exchange rates</h2><p>Where a US$ amount has to be converted to ZiG (for example the NSSA ceiling), the calculators use the rate in the rate box. The default is a reference rate and may not match today\'s rate or the one your employer uses. Please check it.</p>' +
    '<h2>Liability</h2><p>To the fullest extent the law allows, ' + NAME + ' is not liable for losses arising from the use of, or reliance on, these calculators or the information on this website.</p></div></section>'
});

/* ===================================================== salary landing pages */
function salaryPage(cur, g) {
  const isU = cur === 'USD';
  const r = E.calc({ cur: cur, gross: g, rate: RATE });
  const f = (n) => E.fmt(cur, n);
  const label = isU ? usd0(g) : zig0(g);
  const list = isU ? USD_PAGES : ZIG_PAGES;
  const slug = isU ? slugU : slugZ;
  const idx = list.indexOf(g);
  const near = [list[idx - 1], list[idx + 1], list[idx - 2], list[idx + 2]].filter(Boolean).sort((a, b) => a - b);
  const calcUrl = '/?cur=' + cur + '&gross=' + g;
  const nssaLine = isU
    ? (g > 700 ? 'NSSA is 4.5% of the US$700 ceiling, so the most you pay: ' + f(r.nssaEmployee) + '.' : 'NSSA is 4.5% of your full pay: ' + f(r.nssaEmployee) + '.')
    : (g > r.nssaCeiling ? 'NSSA is 4.5% of the ceiling (US$700 at ZiG ' + RATE + ' = ' + zig(r.nssaCeiling) + '): ' + f(r.nssaEmployee) + '.' : 'NSSA is 4.5% of your full pay: ' + f(r.nssaEmployee) + '.');
  const band = (function () { const b = CFG.paye[cur]; for (let i = 0; i < b.length; i++) if (r.taxable <= b[i].upTo) return b[i]; return b[b.length - 1]; })();
  const faq = [
    ['What is the take-home pay on a ' + label + ' salary in Zimbabwe?', 'After NSSA, PAYE and the AIDS levy, a gross monthly salary of ' + label + ' leaves ' + f(r.net) + ' (' + pct(r.net / g) + ' of gross), or ' + f(r.net * 12) + ' a year. This assumes the employee is under 65, with no pension contributions, tax credits or other deductions.'],
    ['How much PAYE is paid on ' + label + ' a month?', 'Taxable income is ' + f(r.taxable) + ' after NSSA. In the ' + (isU ? 'USD' : 'ZWG') + ' table that falls in the ' + Math.round(band.rate * 100) + '% band, so PAYE is ' + f(r.paye) + ' and the 3% AIDS levy is ' + f(r.aidsLevy) + ', a total of ' + f(r.totalTax) + '.'],
    ['Can I change the assumptions?', 'Yes. Open the calculator with this salary filled in, then add medical aid, pension contributions, credits or other deductions under "More options".']
  ];
  return {
    path: cur === 'USD' ? slugU(g) : slugZ(g), crumbs: [['Salary tables', '/salary-tables/'], [label + ' salary', cur === 'USD' ? slugU(g) : slugZ(g)]],
    title: label + ' Salary in Zimbabwe: Take-Home Pay After PAYE and NSSA (' + YEAR + ') | ' + NAME,
    desc: 'A ' + label + ' monthly salary in Zimbabwe leaves ' + f(r.net) + ' after PAYE (' + f(r.paye) + '), AIDS levy (' + f(r.aidsLevy) + ') and NSSA (' + f(r.nssaEmployee) + '). Full breakdown.',
    h1: label + ' salary in Zimbabwe: <em>' + f(r.net) + '</em> take-home',
    h1Text: label + ' salary in Zimbabwe',
    lede: 'A gross monthly salary of ' + label + ' becomes ' + f(r.net) + ' after PAYE, the AIDS levy and NSSA. Here is the full working.',
    chips: [isU ? 'USD table' : 'ZWG table', 'You keep ' + pct(r.net / g), f(r.net * 12) + ' a year'],
    body:
      '<section class="band"><div class="wrap prose"><h2 style="margin-top:0">Breakdown of a ' + label + ' monthly salary</h2>' +
      '<div class="tablewrap"><table class="band-table"><thead><tr><th scope="col">Item</th><th scope="col" class="num">Per month</th><th scope="col" class="num">Per year</th></tr></thead><tbody>' +
      '<tr><td><b>Gross pay</b></td><td class="num">' + f(r.gross) + '</td><td class="num">' + f(r.gross * 12) + '</td></tr>' +
      '<tr><td>NSSA (4.5%)</td><td class="num">-' + f(r.nssaEmployee) + '</td><td class="num">-' + f(r.nssaEmployee * 12) + '</td></tr>' +
      '<tr><td>Taxable income</td><td class="num">' + f(r.taxable) + '</td><td class="num">' + f(r.taxable * 12) + '</td></tr>' +
      '<tr><td>PAYE</td><td class="num">-' + f(r.paye) + '</td><td class="num">-' + f(r.paye * 12) + '</td></tr>' +
      '<tr><td>AIDS levy (3%)</td><td class="num">-' + f(r.aidsLevy) + '</td><td class="num">-' + f(r.aidsLevy * 12) + '</td></tr>' +
      '<tr><td><b>Take-home pay</b></td><td class="num"><b>' + f(r.net) + '</b></td><td class="num"><b>' + f(r.net * 12) + '</b></td></tr></tbody></table></div>' +
      '<h2>How it is worked out</h2><ol><li>' + nssaLine + '</li><li>Taxable income: ' + f(r.gross) + ' &minus; ' + f(r.nssaEmployee) + ' = ' + f(r.taxable) + '.</li><li>PAYE: ' + f(r.taxable) + ' &times; ' + Math.round(band.rate * 100) + '% &minus; ' + f(band.deduct) + ' = ' + f(r.paye) + '.</li><li>AIDS levy: 3% &times; ' + f(r.paye) + ' = ' + f(r.aidsLevy) + '.</li><li>Take-home: ' + f(r.gross) + ' &minus; ' + f(r.nssaEmployee) + ' &minus; ' + f(r.paye) + ' &minus; ' + f(r.aidsLevy) + ' = <b>' + f(r.net) + '</b>.</li></ol>' +
      (isU ? '' : '<p class="fine">ZiG results use a reference exchange rate of ZiG ' + RATE + ' per US$1 only to convert the US$700 NSSA ceiling.</p>') +
      '<p><a class="btn btn-primary" href="' + calcUrl + '">Change these figures in the calculator</a></p>' +
      '<h2>Nearby salaries</h2><ul class="related">' + near.map((n) => '<li><a href="' + slug(n) + '">' + (isU ? usd0(n) : zig0(n)) + ' salary</a></li>').join('') + '<li><a href="/salary-tables/">All salary tables</a></li></ul></div></section>' + SOURCES_BAND,
    faq: faq, showRelated: false
  };
}
USD_PAGES.forEach((g) => page(salaryPage('USD', g)));
ZIG_PAGES.forEach((g) => page(salaryPage('ZWG', g)));

/* ================================================================== 404 */
function notFound() {
  const html = layout({
    path: '/404.html', title: 'Page not found | ' + NAME, desc: 'That page could not be found. Try the Zimbabwe take-home pay calculator.',
    h1: 'Page not found', h1Text: 'Page not found', lede: 'We could not find that page.', showRelated: false,
    body: '<section class="band"><div class="wrap"><div class="nf"><div class="big">4<span>0</span>4</div><p>The page you were looking for has moved or never existed. These might help:</p><p><a class="btn btn-primary" href="/">Take-home pay calculator</a> <a class="btn btn-dark" href="/salary-tables/">Salary tables</a></p></div>' + tiles(TOOLS.slice(0, 6)) + '</div></section>'
  });
  return html.replace('<link rel="canonical" href="' + SITE + '/404.html">', '<meta name="robots" content="noindex">').replace(/<script type="application\/ld\+json">.*?<\/script>/, '');
}

/* ================================================================ output */
PAGES.forEach((p) => {
  const rel = p.path === '/' ? 'index.html' : p.path.replace(/^\//, '') + 'index.html';
  if (p.faqOnlySchema) { /* FAQ page: schema already built from p.faq */ }
  write(rel, layout(p));
});
write('404.html', notFound());

// sitemap
const urls = PAGES.map((p) => {
  const depth = p.path === '/' ? 1.0 : p.path.indexOf('/salary/') === 0 ? 0.5 : ['/about/', '/privacy/', '/disclaimer/'].indexOf(p.path) > -1 ? 0.3 : 0.8;
  return '  <url><loc>' + SITE + p.path + '</loc><lastmod>' + BUILD_DATE + '</lastmod><changefreq>' + (depth >= 0.8 ? 'monthly' : 'yearly') + '</changefreq><priority>' + depth.toFixed(1) + '</priority></url>';
}).join('\n');
write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n');

write('robots.txt',
  '# MyNetPay ZW\n# While the site is on a .netlify.app address, netlify.toml also sends "noindex" so test pages stay out of Google.\nUser-agent: *\nAllow: /\n\nSitemap: ' + SITE + '/sitemap.xml\n');

write('site.webmanifest', JSON.stringify({
  name: NAME, short_name: 'MyNetPay', description: TAGLINE, start_url: '/', display: 'standalone',
  background_color: '#f7f5f0', theme_color: '#292521',
  icons: [{ src: '/assets/img/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/assets/img/icon-512.png', sizes: '512x512', type: 'image/png' }]
}, null, 2) + '\n');

write('favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><rect width="56" height="56" rx="12" fill="#292521"/><text x="28" y="36" font-family="Arial,sans-serif" font-size="25" font-weight="bold" text-anchor="middle" fill="#c3a77e">M</text></svg>\n');

console.log('Built ' + written.length + ' files, ' + (PAGES.length + 1) + ' HTML pages.');
