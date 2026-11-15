# Restaurant menu workflow evidence — 2A.2

These captures show the shared Restaurant menu workspace at 1440, 820, and 390 CSS-pixel widths using an in-memory mock API. The browser check exercised ingredient creation, recipe-version creation, activation confirmation, and menu publication confirmation. It reported no browser errors or horizontal overflow.

The screenshots are UI evidence only. They do not prove merchant authentication, database persistence, cross-device reads, or WeChat runtime behavior. The API persistence, tenant, permission, idempotency, and version rules are covered separately by `npm run test:restaurant-catalog:integration`.

- [1440 desktop](./menu-workspace-1440-mock-api.png)
- [820 tablet](./menu-workspace-820-mock-api.png)
- [390 mobile viewport](./menu-workspace-390-mock-api.png)
