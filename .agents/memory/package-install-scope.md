---
name: Workspace package install scope
description: Limitation encountered when installing an npm dependency into one artifact package.
---

The package-install callback in this workspace attempted `pnpm add` at the monorepo root and rejected `--filter` tokens, so it could not add Chart.js to the tracker artifact. This app loads Chart.js from jsDelivr and shows a fallback when offline.

**Why:** Retrying the callback with a workspace filter failed; the app needed to keep its requested vanilla-JS build and Chart.js visualizations.

**How to apply:** For future artifact-local dependencies, check whether the package tool supports a target package before installing. Use a CDN only when the feature can reasonably require internet access; otherwise use a supported workspace-scoped installation route.