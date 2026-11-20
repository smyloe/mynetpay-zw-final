# MyNetPay ZW

Zimbabwe salary, PAYE and NSSA take-home pay calculators (USD and ZiG). A plain HTML, CSS and JavaScript site: no framework, no build step needed on Netlify.

**Status: ready for your review. Not published anywhere.**

## What is in this folder

```
mynetpay-zw/
  netlify.toml            Netlify settings (publishes the "public" folder)
  .gitignore
  package.json            only used for the test/build shortcuts below
  README.md
  public/                 <- THE WEBSITE (this is what Netlify publishes)
    index.html            home page + main take-home calculator
    404.html
    robots.txt
    sitemap.xml
    favicon.svg, site.webmanifest
    paye-calculator/  nssa-calculator/  salary-comparison/
    reverse-salary-calculator/  bonus-tax-calculator/
    employer-cost-calculator/  payslip-explainer/
    salary-tables/  tax-tables/  faq/  about/  privacy/  disclaimer/
    salary/usd-1000/ ... salary/zig-20000/   (22 salary landing pages)
    assets/css/styles.css
    assets/js/config.js   ALL tax rates and limits live here (TAX_CONFIG)
    assets/js/engine.js   the calculation logic
    assets/js/ui.js       forms, results, menu
    assets/img/           icons and social share image
  tools/
    build.js              regenerates every page from the engine
    make-icons.js         regenerates the PNG icons (needs: npm i sharp)
  tests/
    engine.test.js        54 calculation tests
    site-check.js         checks every page, link, asset and the sitemap
```

## Look at it on your own computer (before publishing anything)

You need Python or Node installed. From this folder:

    python3 -m http.server 8080 --directory public

then open http://localhost:8080 in your browser. (Double-clicking index.html will not work because the pages use root-relative links such as /assets/css/styles.css.)

## Checking the numbers

    node tests/engine.test.js     # 54 tests: pinned 2026 PAYE tables, ZIMRA worked examples, NSSA, bonus, employer cost
    node tests/site-check.js      # every page, link, image and sitemap entry

## The tax figures (and how to update them)

Everything statutory is in `public/assets/js/config.js` with its source written beside it:

| Item | Figure | Source |
|---|---|---|
| PAYE USD monthly table | 0% to US$100, 20%, 25%, 30%, 35%, 40% above US$3,000 | ZIMRA 2026 USD PAYE table |
| PAYE ZWG monthly table | 0% to ZiG 2,800, then 20% to 40% above ZiG 84,000 | ZIMRA 2026 ZWG PAYE table |
| AIDS levy | 3% of PAYE payable | ZIMRA |
| NSSA | 4.5% employee + 4.5% employer, ceiling US$700/month, under 65 | NSSA |
| Bonus tax-free limit | US$700 a year | Finance Act (No. 2) of 2024 (see note below) |
| Medical credit | US$1 per US$2 paid | ZIMRA |
| Elderly/blind/disabled credit | US$900 a year | ZIMRA |
| ZIMDEF levy | 1% (employer), exemption below US$6,000 annual wage bill | M&J Consultants, Sept 2026 |
| Standards Development Levy | up to 0.5% (employer), **optional in the calculator, off by default** | Standards Development Fund Act [Chapter 14:19], s.3 |

Important points to know:

- The PAYE tables used are ZIMRA's PAYE tables for 1 January to 31 December 2026 (USD and ZWG). The monthly rates and deduct amounts are unchanged from the 2025 tables. They are pinned in `tests/engine.test.js` ("ZIMRA 2026 PAYE tables"). Tip: when you add direct links to the 2026 PDFs, put them in the header comment of `config.js` and on the tax-tables page (in `tools/build.js`).
- **Bonus limit.** The calculators use US$700, which the Finance Act (No. 2) of 2024 introduced (raised from US$400), as reported by a law firm and payroll-software notices. ZIMRA's "PAYE Explained" web page still shows US$400 for foreign-currency bonuses from 1 January 2024. The bonus page explains this to visitors. The limit is one value (`bonus.exemptAnnualUSD`) in `config.js`.
- **Standards Development Levy.** Under the Standards Development Fund Act, the Minister of Industry and Commerce may impose it on *specified classes of employers* (up to 0.5% of remuneration). The employer calculator therefore leaves it switched off until the user ticks "applies", and tells employers to confirm whether they are liable.
- USD pay uses the USD table and ZiG pay uses the ZWG table. One is never converted into the other. Only where the law itself is written in US$ (NSSA ceiling, bonus limit, elderly credit, mixed USD+ZiG pay) is an exchange rate used. The default is the RBZ rate of ZiG 26.56 per US$ (11 Nov 2026) and users can change it in every tool.
- Several popular calculator websites quote a "US$1,200 tax credit". ZIMRA's official tables do not contain one, so it is not used here.
- Please double-check the ZIMDEF exemption (annual wage bill below US$6,000) and the APWCS/NEC levies with the relevant bodies before relying on the employer cost tool for payroll.

When ZIMRA, NSSA or a Finance Act changes a figure: edit `config.js`, update `lastVerified`, run `node tests/engine.test.js`, then `node tools/build.js` (this refreshes the salary tables), and commit.

## Publishing on Netlify (when you have approved the site)

Nothing here publishes by itself, and nothing needs a purchased domain or paid plan.

1. Put the whole folder on GitHub (new repository, then Add file > Upload files; drag in the *contents* of this folder so `netlify.toml` and `public` sit at the top level).
2. On netlify.com sign up with GitHub, choose Add new project > Import an existing project > GitHub > your repository. Leave Build command empty. Publish directory is read from netlify.toml (`public`). Click Deploy.
3. Rename the address under Domain management > Edit project name to get `your-name.netlify.app`.
4. From then on, every change committed to the main branch redeploys automatically.

While on a `.netlify.app` address, `netlify.toml` sends a **noindex** header so Google does not list your test site. When you connect your own domain later, delete the block marked TEMPORARY in `netlify.toml`.

Canonical links and the sitemap already point at https://mynetpay.co.zw/. If you end up with a different final domain, search-and-replace that address in `tools/build.js` (the `SITE` constant), run `node tools/build.js`, and update `robots.txt` accordingly.

## Colours and icons (keep these together)

The palette is the set of variables at the top of `public/assets/css/styles.css` (`:root`). If you ever change it, update these together so nothing is left in the old colours:

- `styles.css` (the `:root` variables, plus the few literal colours further down)
- `theme-color` and the manifest colours in `tools/build.js`, then run `node tools/build.js`
- the icons and share image: edit the colours in `tools/make-icons.js` and `public/favicon.svg`, then run `npm i sharp` and `node tools/make-icons.js`

`tests/site-check.js` fails if a colour from the earlier green/yellow palette appears anywhere in the site, or if the browser theme colour no longer matches the header.

## Privacy

All calculations run in the visitor's browser. No analytics, no cookies, no third-party scripts, fonts or images. The security policy in netlify.toml only allows files from the site itself.
