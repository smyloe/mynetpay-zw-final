/*!
 * MyNetPay ZW - TAX_CONFIG
 * ---------------------------------------------------------------------------
 * EVERY statutory figure used by the calculators lives in this one file.
 * Nothing is hard-coded anywhere else. When ZIMRA, NSSA or the Finance Act
 * change a figure, edit it here, update `lastVerified`, and run `npm test`.
 *
 * Sources (last checked 18 November 2026):
 *  - ZIMRA, PAYE tax tables for 1 January to 31 December 2026, USD (foreign
 *    currency) table and ZWG table, monthly and annual:
 *    https://www.zimra.co.zw/domestic-taxes/tax-tables
 *    The monthly rates and deduct amounts below are the 2026 table figures
 *    (they are unchanged from ZIMRA's 2025 tables).
 *  - ZIMRA, "Employees Tax - PAYE System"
 *    https://www.zimra.co.zw/domestic-taxes/individual/pay-as-you-earn-paye
 *    (order of calculation, 3% AIDS levy, medical credit, elderly/blind/disabled
 *     credit, rule for mixed USD + ZWG salaries, payment by the 10th)
 *  - NSSA, "Contributions"  https://www.nssa.org.zw/contributions/
 *    (4.5% employee + 4.5% employer, insurable earnings ceiling US$700,
 *     gazetted quarterly, deductions for employees below age 65)
 *  - Bonus exemption of US$700 a year: Finance Act (No. 2) of 2024, which
 *    raised the exemption from US$400 to US$700 (reported by MMM Law Firm and
 *    in payroll-software notices). NOTE: ZIMRA's explanatory page "PAYE Explained"
 *    still shows US$400 for foreign-currency bonuses from 1 January 2024. The
 *    calculators follow the Act. The figure is `bonus.exemptAnnualUSD` below.
 *  - ZIMDEF 1% (employer levy, reported by M&J Consultants, Sept 2026) and its
 *    exemption for annual wage bills below US$6,000 (reported as effective
 *    16 January 2026).
 *  - Standards Development Levy: Standards Development Fund Act [Chapter 14:19],
 *    section 3. The Minister of Industry and Commerce may impose it, by statutory
 *    instrument, on specified classes of employers, at up to 0.5% of remuneration.
 *    It is NOT charged on every employer, so the employer calculator leaves it
 *    switched off until the user says it applies.
 *
 * The monthly tables use ZIMRA's "multiply by rate, then deduct" method:
 *   tax = taxable income x rate - deduct
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MNP_CONFIG = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    meta: {
      taxYear: 2026,
      tablesBasis: 'ZIMRA PAYE tables for 1 January to 31 December 2026 (USD and ZWG)',
      tablesPage: 'https://www.zimra.co.zw/domestic-taxes/tax-tables',
      lastVerified: '18 November 2026',
      siteName: 'MyNetPay ZW'
    },

    // Reference exchange rate (ZiG per US$1). Used ONLY where the law itself
    // converts a USD amount into ZiG (NSSA ceiling, bonus exemption, elderly
    // credit, mixed-currency salaries). It is user-editable on every tool.
    // RBZ average interbank rate on 11 November 2026: 26.5631
    reference: { rate: 26.56, rateDate: '11 November 2026', rateSource: 'Reserve Bank of Zimbabwe' },

    // ---- PAYE monthly tables: [upTo (inclusive), rate, deduct] ----
    // USD: ZIMRA 2026 foreign currency (USD) PAYE table, monthly
    // ZWG: ZIMRA 2026 ZWG PAYE table, monthly
    paye: {
      USD: [
        { upTo: 100,      rate: 0.00, deduct: 0 },
        { upTo: 300,      rate: 0.20, deduct: 20 },
        { upTo: 1000,     rate: 0.25, deduct: 35 },
        { upTo: 2000,     rate: 0.30, deduct: 85 },
        { upTo: 3000,     rate: 0.35, deduct: 185 },
        { upTo: Infinity, rate: 0.40, deduct: 335 }
      ],
      ZWG: [
        { upTo: 2800,     rate: 0.00, deduct: 0 },
        { upTo: 8400,     rate: 0.20, deduct: 560 },
        { upTo: 28000,    rate: 0.25, deduct: 980 },
        { upTo: 56000,    rate: 0.30, deduct: 2380 },
        { upTo: 84000,    rate: 0.35, deduct: 5180 },
        { upTo: Infinity, rate: 0.40, deduct: 9380 }
      ]
    },

    aidsLevyRate: 0.03,   // 3% of the PAYE payable (after credits)

    credits: {
      medicalRate: 0.5,                  // US$1 credit for every US$2 of medical aid contributions
      elderlyBlindDisabledAnnualUSD: 900 // per year; ZWG equivalent used for ZiG
    },

    nssa: {
      employeeRate: 0.045,
      employerRate: 0.045,
      ceilingUSD: 700,                   // monthly insurable earnings ceiling (gazetted quarterly)
      exemptAge: 65                      // contributions apply to employees below 65
    },

    bonus: {
      exemptAnnualUSD: 700,              // tax-free bonus / performance award per year (aggregate)
      legalBasis: 'Finance Act (No. 2) of 2024'
    },

    employerLevies: {
      zimdefRate: 0.01,                  // 1% of gross wage bill
      zimdefExemptAnnualWageBillUSD: 6000,
      sdlRate: 0.005,                    // Standards Development Levy: up to 0.5% of remuneration, ONLY for employer classes
                                         // specified by the Minister (Chapter 14:19, s.3). Optional in the calculator.
      sdlAppliesByDefault: false
      // APWCS (workers' compensation) is risk-rated per employer: user supplies it.
    }
  };
});
