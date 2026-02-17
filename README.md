# 🌿 Dust Bunnies Cleaning — Admin Dashboard Demo

A fully interactive demo of an automated enquiry management system for a Sunshine Coast cleaning business.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Admin Dashboard — Inbox, Quotes, Customer Form link, Pricing |
| `/form` | Customer-facing info form (no pricing shown) |
| `/quote/:id` | Printable branded quote preview |

## Features

- **Demo Mode** — Toggle in the sidebar to simulate live incoming enquiries
- **Cross-tab sync** — Open `/form` in another tab, submit it, and watch it appear in the dashboard inbox
- **Full quote workflow** — Generate → Review → Modify → Approve & Send
- **Quote preview** — Branded quote template viewable in-browser and printable as PDF
- **Pricing management** — Edit prices, changes reflect in new quotes

---

## 🚀 Deploy in 5 Minutes

### Step 1: Push to GitHub

```bash
# In your terminal, navigate to this project folder
cd dust-bunnies-demo

# Initialise git
git init
git add .
git commit -m "Dust Bunnies dashboard demo"

# Create a repo on GitHub (github.com/new), then:
git remote add origin https://github.com/YOUR_USERNAME/dust-bunnies-demo.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Vercel (free)

1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account
2. Click **"Add New Project"**
3. Select your `dust-bunnies-demo` repo
4. Vercel auto-detects Vite — just click **Deploy**
5. In ~60 seconds you'll get a live URL like `dust-bunnies-demo.vercel.app`

That's it! Share the link with the business owner.

### Step 3: Share with the owner

Send them two links:
- **Dashboard**: `https://your-app.vercel.app/`
- **Customer Form**: `https://your-app.vercel.app/form`

---

## 🖥️ Run Locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`

---

## 🎬 Demo Script for the Pitch

1. Open the **Dashboard** (`/`) — show the inbox with sample enquiries
2. Click **"🎬 Start Demo Mode"** — watch new enquiries arrive in real-time
3. Walk through the workflow on a new enquiry:
   - Click "Send Info Form" → status changes to "Info Requested"
   - Click "Simulate Info Received" → details populate
   - Click "Generate Quote" → auto-calculates pricing
   - Switch to Quotes tab → review the quote with line items
   - Click "Preview Quote" → show the branded quote template
   - Click "Approve & Send" → done!
4. Open **Customer Form** (`/form`) in a new tab — show what customers see
5. Submit the form → switch back to dashboard → see it appear in inbox
6. Show **Pricing** tab — edit prices, show weekly discount
7. Open the full **Quote Preview** page — show print-to-PDF capability

---

Built with React + Vite. Deployed on Vercel.
