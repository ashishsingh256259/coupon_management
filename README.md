# CouponDS V2

A responsive React + Vite educational coupon management workspace. Checkout simulator, searchable coupon catalog, hash buckets, LIFO undo, FIFO flash-sale queue and transaction history.

## Run locally

Use Node.js 22.12+.

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

Deploy the generated `dist/` directory to a static host. GitHub Pages needs a build/deploy workflow rather than serving raw source files. The existing production branch is unchanged by this upgrade branch.

## Scope

Browser-only educational simulation; data persists in localStorage. No server, payment handling, or real admin authorization. The catalog is a local sandbox. Minimum order, duplicate redemption, expiry, usage limits, and the additive 100% discount cap are enforced. The hash visualizer is instructional; actual lookup is a JS dictionary. React immutable updates and array history have copying costs; see complexity notes in the UI.
