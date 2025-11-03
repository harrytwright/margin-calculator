# [0.3.0](https://github.com/harrytwright/margin-calculator/compare/v0.2.0...v0.3.0) (2025-11-03)


### Bug Fixes

* **api,ui:** prevent supplier changes on ingredient updates (immutable field) ([8c5ad5d](https://github.com/harrytwright/margin-calculator/commit/8c5ad5d24b0df7d600542d8bc677ea243869992f))
* **engine:** Adjust VAT ([05de3b8](https://github.com/harrytwright/margin-calculator/commit/05de3b818c41c4d9ffa702a0a1544183695d5fa1))
* **landing:** polish landing page for production ([14d930d](https://github.com/harrytwright/margin-calculator/commit/14d930df7373559b367b923f90b3bdbe421718d0))
* **landing:** update CTAs for pre-launch waitlist ([1e172d5](https://github.com/harrytwright/margin-calculator/commit/1e172d5fed55970f3504d7eabc892fbcc92d6ebb))
* **storage:** enable direct database persistence in database-only mode ([4c9dfa4](https://github.com/harrytwright/margin-calculator/commit/4c9dfa4b40f0499e021149eef7f6bbf0e71d501d))
* **ui:** fix filtering and navigation bugs ([908e8f4](https://github.com/harrytwright/margin-calculator/commit/908e8f49dded0005bb54bb2aabd99fddad6c69e5))
* **ui:** fix filtering and navigation bugs in web interface ([68f8223](https://github.com/harrytwright/margin-calculator/commit/68f8223d0023d5133c01e6c6b06cd68d4378d42b))
* **ui:** Fix for missing ingredients ([a107fd0](https://github.com/harrytwright/margin-calculator/commit/a107fd0fb83780a9580239a3536f528b00366f53))


### Features

* **cli:** Add bin entrypoint ([b45b82f](https://github.com/harrytwright/margin-calculator/commit/b45b82ffa9cd81945d60b1b4ab8abb18002d154d))
* **docker:** add containerized deployment with auto-initialization ([74c5f43](https://github.com/harrytwright/margin-calculator/commit/74c5f43abebd3a2d3b0c87e6e6af3bab9ad15543))
* **landing:** Add basic SEO fixes ([567a4d4](https://github.com/harrytwright/margin-calculator/commit/567a4d447056d003dbe20894b250d41f24d50e7d))
* **landing:** add blog system for building in public ([6b2649a](https://github.com/harrytwright/margin-calculator/commit/6b2649af3b7676f72055e8352c4289dc79401529))
* **landing:** add branded favicons and PWA manifest ([bfdb701](https://github.com/harrytwright/margin-calculator/commit/bfdb7013f4474ca69c6666626d640bb7b15c893c)), closes [#2563](https://github.com/harrytwright/margin-calculator/issues/2563) [#9333](https://github.com/harrytwright/margin-calculator/issues/9333) [#667](https://github.com/harrytwright/margin-calculator/issues/667)
* **landing:** add email capture and analytics ([8a75ada](https://github.com/harrytwright/margin-calculator/commit/8a75ada3934e874d66fc2f8efb5cf7934225d004))
* **landing:** add GDPR-compliant cookie consent banner ([ec68ac7](https://github.com/harrytwright/margin-calculator/commit/ec68ac7921819f4d4d63c3d96987270b822f3b3d))
* **landing:** add GDPR-compliant legal pages ([88ddbd2](https://github.com/harrytwright/margin-calculator/commit/88ddbd257f88fcd9c4b1018208799e14ca00a8e8))
* **landing:** add ingredient management to interactive demo ([27c44b6](https://github.com/harrytwright/margin-calculator/commit/27c44b611698b92f1ab02858ae47ee41c367e88e))
* **landing:** add interactive recipe cost calculator demo ([f3187b7](https://github.com/harrytwright/margin-calculator/commit/f3187b71e84827c8256f0afc81038bab0f486939))
* **landing:** add marketing landing page for early sign-ups ([9ada631](https://github.com/harrytwright/margin-calculator/commit/9ada631a59e4559f8eef3c3122a44322aee4854b))
* **landing:** add PostHog analytics tracking to demo interactions ([cdf08bf](https://github.com/harrytwright/margin-calculator/commit/cdf08bf906a4e16861173eb58d174503861bbc3d))
* **landing:** create production-ready landing page with Parcel + Tailwind ([13ea6e9](https://github.com/harrytwright/margin-calculator/commit/13ea6e9e44e6f86e9c7e78254e46f45bbe62341f))
* **landing:** improve SEO and update pricing ([be0132c](https://github.com/harrytwright/margin-calculator/commit/be0132c57d80223249653f9a250b1365bde392b1))
* **storage:** add pluggable storage abstraction layer ([303de3e](https://github.com/harrytwright/margin-calculator/commit/303de3ee03e24eb0a234c763a5964cdcc390dc26))
* **ui:** add dashboard charts with Chart.js ([52c03da](https://github.com/harrytwright/margin-calculator/commit/52c03dab053cdfe4415863d9dd3f9e5ca7b00f1f))
* **ui:** add empty state with call-to-action for margins page ([b03eddb](https://github.com/harrytwright/margin-calculator/commit/b03eddb5344b436fb0b226c90b5d0f1ea07a783b))
* **ui:** add quality-of-life improvements for production use ([6bd8e89](https://github.com/harrytwright/margin-calculator/commit/6bd8e89e11ccb4880d09b34863d22e01fc7315a3))
* **ui:** add search and filtering to management views ([35639be](https://github.com/harrytwright/margin-calculator/commit/35639be1890567b2c80c76018e52797ef4400671))
* **ui:** add sidebar navigation with dashboard and margins views ([9c30466](https://github.com/harrytwright/margin-calculator/commit/9c30466da47c884908c50d08fe11ff3358c835d4))
* **ui:** add standalone mode for containerized deployment ([22dbd3d](https://github.com/harrytwright/margin-calculator/commit/22dbd3db60816b0c3b9f171ac4ba5fd14da6c6b8))
* **validation:** add comprehensive backend and frontend validation ([5e3e890](https://github.com/harrytwright/margin-calculator/commit/5e3e8907450aa49c35c6363e8503e2e599e7c65f))



# [0.2.0](https://github.com/harrytwright/margin-calculator/compare/v0.1.0...v0.2.0) (2025-10-17)


### Bug Fixes

* **persistence:** retry importer on transient parse errors ([1d6ff45](https://github.com/harrytwright/margin-calculator/commit/1d6ff45aeec0b174a94b019a957de0908d321f1b))
* **ui:** Adjust `ingredient-row` overflow ([050282c](https://github.com/harrytwright/margin-calculator/commit/050282c771932d33597dbdf595752687a8339ab3))
* **ui:** enable proper scrolling in recipe modal ([1feb639](https://github.com/harrytwright/margin-calculator/commit/1feb6396a290c615e612a7b68775d3cf7df358a2))


### Features

* add file persistence infrastructure ([d0d30e7](https://github.com/harrytwright/margin-calculator/commit/d0d30e77004c36c933f8b2a93da3653126f59ae0))
* **api:** add create endpoints backed by file persistence ([9a427e1](https://github.com/harrytwright/margin-calculator/commit/9a427e18f3526c925a8a8d1c4ead9165427c213e))
* **api:** add delete endpoints ([9d17f0b](https://github.com/harrytwright/margin-calculator/commit/9d17f0bcf73f90e1ac5c5cfcbe16c162cfed2572))
* **api:** add update endpoints ([83f6842](https://github.com/harrytwright/margin-calculator/commit/83f684222922ccafc23974b04cd7559b5a13758c))
* **cli:** add --workspace flag for user data separation ([a961d30](https://github.com/harrytwright/margin-calculator/commit/a961d30428ba2a05663b1d552a27b1c312fb94a5))
* **file-writer:** add auto-generation warning header to YAML files ([6c67478](https://github.com/harrytwright/margin-calculator/commit/6c67478c76bc3b388324b10b603ac138f25e030e))
* **server:** Add custom logging ([fdb612b](https://github.com/harrytwright/margin-calculator/commit/fdb612be515a418466a4e9c6212e6912a00eef10))
* **server:** stream watcher events over SSE ([f331342](https://github.com/harrytwright/margin-calculator/commit/f331342ceecd7b8a415807fb6049c691af84fb68))
* **src:** Add slug to path map ([8d47e94](https://github.com/harrytwright/margin-calculator/commit/8d47e94b8031ae63f00eed0f493dc290611eed82))
* **src:** Adjust importer ([fd5de9d](https://github.com/harrytwright/margin-calculator/commit/fd5de9d573aadfa4fb398fc65d77fa68d4b92e46))
* **ui:** add custom delete confirmation modal (Phase 3B) ([fa9c5b1](https://github.com/harrytwright/margin-calculator/commit/fa9c5b1e32d1fe222cc6736a4fd2d64ad88bcf3f))
* **ui:** add floating labels and real-time validation ([776d856](https://github.com/harrytwright/margin-calculator/commit/776d856c2bfdddc6f6be15dd5a1e562e0bb1e95d))
* **ui:** add toast notifications and loading states (Phase 3A) ([bd3a22e](https://github.com/harrytwright/margin-calculator/commit/bd3a22e790d60e56a38de646c6b75636961d87df))
* **ui:** enable editing workflows ([fb92a0b](https://github.com/harrytwright/margin-calculator/commit/fb92a0bab8b56c3b2cd3aa0d9a9e4da0b20fea3f))
* **ui:** implement modal-based forms for create/edit operations ([1328be1](https://github.com/harrytwright/margin-calculator/commit/1328be1f75bf68b01f0f99a16ef0a0c7b7492fac))
* **ui:** scaffold management forms ([986fd0d](https://github.com/harrytwright/margin-calculator/commit/986fd0d85b7955576744461aeb9b939837ccb558))
* **ui:** wire management forms to API ([6c9dde9](https://github.com/harrytwright/margin-calculator/commit/6c9dde952278b4e451cfc8223a4996a0e3d94278))
* **watcher:** add hash service and file watching support ([a145d0f](https://github.com/harrytwright/margin-calculator/commit/a145d0fdfef4fdafb86d4c5e27aabd3c00cc16ae))



# [0.1.0](https://github.com/harrytwright/margin-calculator/compare/f403155dfc201cbfd3a985d7255c6fb393cf5794...v0.1.0) (2025-10-13)


### Bug Fixes

* **ci:** Fix ignore file ([d4efbf5](https://github.com/harrytwright/margin-calculator/commit/d4efbf58ef92d34928773c74788b2b38152129c2))
* **ci:** Fix ignore file ([f403155](https://github.com/harrytwright/margin-calculator/commit/f403155dfc201cbfd3a985d7255c6fb393cf5794))


### Features

* **cli:** Add global import ([924bd86](https://github.com/harrytwright/margin-calculator/commit/924bd86f22e2a32ddb97c275f9287c9e58f2e3f8))
* **src:** Added Importer ([c43d0dc](https://github.com/harrytwright/margin-calculator/commit/c43d0dc970e1d904ea4ea6c7426d540460aa9b60))
* **src:** Created basic calculator ([d8838ca](https://github.com/harrytwright/margin-calculator/commit/d8838ca17f52b5a50bfdcf7e7bd310d5a638f4db))
* **tests:** Add service tests ([c254bbc](https://github.com/harrytwright/margin-calculator/commit/c254bbcb1a609a490567f43b6615a749f58eaa1a))
* **ui:** Add web UI for viewing recipes and margins ([9226ea0](https://github.com/harrytwright/margin-calculator/commit/9226ea0365069ef819ca65326ec44ad568d18065))



