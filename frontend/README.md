# Frontend

Minimal Vite + React + TypeScript application.

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to your backend URL (default: `http://localhost:3000`).

## Development

```bash
npm run dev
```

Opens at `http://localhost:5173` (or the next available port).

## Build

```bash
npm run build
```

Output is in `dist/`.

## Preview production build

```bash
npm run preview
```

## Structure

- `index.html` – entry HTML
- `src/main.tsx` – app entry
- `src/App.tsx` – root component
- `src/index.css` – global styles
- `src/vite-env.d.ts` – Vite type references
- `src/api/url.ts` – helper to build API URLs from `VITE_API_BASE_URL`

No backend code; frontend only.

## Logo

The header shows the Aspire Coworks logo + company name. The asset is `public/logo.svg` (placeholder). To use your own logo: export it from your design (e.g. from the PDF) as **SVG** or **PNG**, then replace `public/logo.svg` or add `public/logo.png` and set `logoSrc="/logo.png"` on `<Logo />` if needed.
