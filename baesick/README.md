# BAESICK Clothing — storefront

Static site, no build step. Open `index.html` in a browser, or serve the folder:

```bash
npx serve baesick   # or: python3 -m http.server -d baesick
```

- `index.html` — page structure and the garment SVG sprite
- `styles.css` — design tokens (six shades on `:root`) and layout
- `app.js` — product catalog (`PRODUCTS`), filters, quick view, bag (saved to localStorage)

Product images are tinted SVG placeholders. To use real photos, add an `img` field to each
product in `app.js` and render it in `renderGrid()` in place of `garment()`.
Checkout is a stub. Connect Shopify (Storefront API / Buy Button) or Stripe Checkout to take payments.
