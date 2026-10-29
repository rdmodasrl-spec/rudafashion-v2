# RUDA application boundaries

RUDA keeps one repository and one business backend. The five business areas have six independently built browser targets because the platform admin area has separate desktop and mobile interfaces.

| Business area | Build target | Entry | Target-owned styles |
| --- | --- | --- | --- |
| Frontend Web | `frontend-web` | `src/apps/frontend-web/main.tsx` | `src/apps/frontend-web/styles.css` |
| Frontend mobile Web | `frontend-mobile` | `src/apps/frontend-mobile/main.tsx` | `src/apps/frontend-mobile/styles.css` |
| Merchant admin Web | `merchant-admin-web` | `src/apps/merchant-admin-web/main.tsx` | `src/apps/merchant-admin-web/styles.css` |
| Merchant admin mobile | `merchant-admin-mobile` | `src/apps/merchant-admin-mobile/main.tsx` | `src/apps/merchant-admin-mobile/styles.css` |
| Platform admin Web | `platform-admin-web` | `src/apps/platform-admin-web/main.tsx` | `src/apps/platform-admin-web/styles.css` |
| Platform admin mobile | `platform-admin-mobile` | `src/apps/platform-admin-mobile/main.tsx` | `src/apps/platform-admin-mobile/styles.css` |

Frontend Web and mobile use one shared public route/page implementation at `src/apps/shared/PublicFrontendApp.tsx`; their application entry modules, target styles, builds, releases, and deployment pointers are independent. This avoids maintaining two identical public page trees. Merchant Web and mobile page implementations live in their owning app modules. Platform admin Web and mobile page implementations also live in their owning app modules. API clients, types, session, tenant, permission logic, and reusable foundation components remain shared.

`src/apps/shared/foundation.css` keeps the existing Tailwind/base styles and design primitives shared. Reusable public/authentication/common components live under `src/apps/shared/components/`; merchant management components live under `src/apps/merchant-admin-common/components/`; platform management components live under `src/apps/platform-admin-common/components/`. Merchant portal styles are imported only by merchant targets; platform-admin navigation styles are imported only by platform-admin targets. Shared session, tenant, API, and permission behavior remains in the existing `B2BProvider` and server. The former `src/components/` tree has been migrated into these owners and is not an active source location.

## Target selection

The root entry `src/main.tsx` chooses an app target using the existing portal host map, the path, the viewport, and an optional `ruda-app` query parameter. Existing merchant and admin URLs remain in place. Merchant workspace hosts and employee routes select the mobile merchant target; `/admin` and `/super-admin` select the platform admin target. PWA manifests have separate start URLs for each build target.

## Build and publish

Each target build writes a versioned release under `dist/apps/<target>/releases/<release-id>/`. A single-target build does not clear `dist/`, rebuild the server, or activate the release:

```sh
npm run build:app:frontend-web
npm run build:app:frontend-mobile
npm run build:app:merchant-admin-web
npm run build:app:merchant-admin-mobile
npm run build:app:platform-admin-web
npm run build:app:platform-admin-mobile
```

After validating a release, activate just that target by using the release ID printed by its build:

```sh
npm run publish:app -- merchant-admin-mobile <release-id>
npm run rollback:app -- merchant-admin-mobile
```

The active release pointer is `dist/apps/<target>/current.json`; its previous value is retained in `current.previous.json` for one-step rollback. Release assets are immutable and versioned, while the pointer is served with `no-store`. The normal `npm run build` builds all targets, the root HTML shell, and the existing `dist/server.cjs`; it is not required for a one-target release.

No production release is performed as part of this change. Test builds write only versioned app files and do not restart PM2.
