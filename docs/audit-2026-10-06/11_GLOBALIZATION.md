# 11 Globalization Architecture

**Snapshot:** 2026-10-06. Multi-language code/config is not equivalent to a localized, legally compliant multi-region product.

## Current Evidence

- Web has an i18n directory, translation resources and a server UI translation module.
- Prisma includes currency on selected commerce/quote/billing records and migration history for quote currency.
- Flutter has localization packages, country/code picker and multiple regional payment SDK dependencies.
- No evidence in this repository inventory establishes complete locale coverage, multi-region tax, FX, address/shipping, legal text or region-specific production acceptance.

## Locale and Market Matrix (To Be Maintained)

| Concern | Required market key | Current status |
| --- | --- | --- |
| UI locale and fallback | BCP 47 locale; account/user preference | PARTIAL; coverage and fallback consistency not audited |
| Product title/description | locale + source/version + translation provenance | PARTIAL; product localization workflow not established |
| Money | ISO currency, minor-unit exponent and transaction snapshot | PARTIAL; fields exist in selected flows |
| Time/date/number | user locale + UTC storage + explicit business timezone | UNKNOWN by route/domain |
| Address/contact | country schema and validation per market | PARTIAL / UNKNOWN |
| Shipping/tax | origin/destination, service area, tax jurisdiction and rule version | NOT ESTABLISHED as a full engine |
| Payment method | market eligibility, currency, settlement and fallback | PARTIAL; provider-specific acceptance unknown |
| Consent/marketing | local purpose, language, retention and quiet hours | NOT FULLY ESTABLISHED |
| Content rights | territory, duration, channel, sublicensing, takedown | PARTIAL in ingestion provenance fields |
| Support/legal | localized policies, consumer rights, accessibility | UNKNOWN |
| Data residency | region, processor, backup and deletion boundary | UNKNOWN |

## Internationalization Invariants

- Store timestamps in UTC; render according to explicitly selected/user and merchant business timezones.
- Store currency code and minor units, rounding policy, FX provider/time/rate snapshot and source currency separately.
- Never recalculate historical invoice, commission or settlement using current FX/tax rates.
- Keep display translation separate from canonical product/contract/financial records.
- Resolve legal/marketing consent with purpose, jurisdiction, locale, timestamp and policy version.
- Store measurement units and sizing standards with market/brand context; fashion size labels are not universal.
- Confirm Unicode, right-to-left layout, locale-aware validation and accessibility in actual Web and Flutter journeys.

## Implementation Gates

1. Name launch markets, languages, currencies, tax/legal entities, shipping origin and supported payment methods.
2. Build a route/domain locale coverage report and translation completeness CI gate.
3. Add deterministic currency/rounding test vectors, cross-border order/refund/commission test cases.
4. Introduce market policy registry with effective dates and owner; avoid scattering country conditionals.
5. Complete privacy/data-residency/retention assessment with counsel and infrastructure owner before new market launch.
6. Validate Web, Android and iOS UX at real narrow/wide viewports and with locale/RTL settings.
