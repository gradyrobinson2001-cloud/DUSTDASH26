# DustBunz Standalone Marketing Site

This folder is a completely separate one-page website concept (no dependency on the dashboard app).

## Files
- `index.html`
- `styles.css`
- `script.js`

## Local preview
From this project root:

```bash
npx serve marketing-site
```

Then open the local URL shown in your terminal.

## Deploy to a dedicated URL
You can deploy just this folder to any static host.

### Option 1: Netlify (quickest)
1. Create a new site from Git.
2. Set publish directory to `marketing-site`.
3. No build command required.
4. Attach your custom domain (for example: `dustbunzcleaning.com`).

### Option 2: Vercel
1. Import repo in Vercel.
2. Set Root Directory to `marketing-site`.
3. Framework preset: `Other`.
4. Build command: empty.
5. Output directory: `.`

### Option 3: Cloudflare Pages
1. Connect repo.
2. Set project root to `marketing-site`.
3. Build command: none.
4. Output directory: `.`

