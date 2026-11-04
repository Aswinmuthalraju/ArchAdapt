# ARCHADAPT AI — Frontend Styling, Navigation Routing, Runtime Lifecycle & Cache Management

**Document ID:** `docs/04_RUNTIME_STYLING_AND_NAVIGATION.md`  
**Version:** 2.0 (Consolidated Master Manual)  
**Status:** Verified, Tested & In Production  

---

## 1. Header Navigation & Routing Architecture

### 1.1 Root Cause of Inactive Header Links
- **Initial Problem:** Header navigation items (*"How It Works"*, *"Architectural Styles"*, *"Special Modes"*, *"My Projects"*, *"Dashboard"*) were visually rendered but did not route to active pages.
- **Resolution:**
  - Audited [`src/components/navigation/Navbar.tsx`](file:///c:/Drive%20D/ArchAdapt%20AI/src/components/navigation/Navbar.tsx) and converted static spans to functional Next.js `Link` components.
  - Implemented dedicated route pages:
    - `/dashboard`: Project portfolio and overview.
    - `/how-it-works`: Step-by-step architectural workflow walkthrough.
    - `/styles`: Architectural styles catalog (Kerala Traditional, Modern, Minimalist, etc.).
    - `/modes`: Special modes showcase (Climate-Adaptive, Life-Stage, Budget-First, Renovation).
    - `/onboarding`: New project creation wizard.

---

## 2. Tailwind CSS Pipeline & Styling Fixes

### 2.1 CSS `@import` Issue & Resolution
- **Root Cause:** `src/app/globals.css` initially used non-standard CSS `@import` directives (`@import 'tailwindcss/base';`, etc.). In Tailwind CSS v3 without `postcss-import`, these strings were left unparsed, causing browsers to drop base styles and component utility classes.
- **Resolution:** Replaced `@import` with standard Tailwind directives (`@tailwind base;`, `@tailwind components;`, `@tailwind utilities;`) and configured `postcss.config.js` and `tailwind.config.js`.

---

## 3. Separate Development and Production Build Outputs

### 3.1 Root Cause Analysis
- Development and production builds originally shared `.next`. A production build could replace development assets while a dev server was still running, leaving its in-memory asset references stale and causing CSS 404s.

### 3.2 Permanent Fix in `next.config.mjs`
Development uses `.next-dev`; production uses `.next`. The explicit `clean` script removes both output folders when a fresh build is needed. Current commands are:
```json
"scripts": {
  "clean": "node -e \"for (const d of ['.next', '.next-dev']) require('fs').rmSync(d, { recursive: true, force: true })\"",
  "dev": "next dev -p 3000",
  "build": "next build --webpack",
  "start": "next start -p 3000",
  "lint": "eslint ."
}
```

### 3.3 Development Lifecycle Rules
1. Development and production builds can use separate output folders. Do not run `npm run clean` while a dev server is active because that command removes both folders.
2. **Hard Refresh:** If a browser caches a 404 CSS response, press **`Ctrl + F5`** (or **`Ctrl + Shift + R`**) on `http://localhost:3000`.

---

## 4. Development Runtime & Process Management

### 4.1 Development Server Commands
- **Start Fresh Dev Server:**
  ```powershell
  npm run dev
  ```
  *(Uses `.next-dev` and starts on port 3000)*

- **Build Production Bundle:**
  ```powershell
  npm run build
  ```

- **Run Production Server:**
  ```powershell
  npm run start
  ```

### 4.2 Port Conflict Resolution (PowerShell)
If port 3000 is held by a dangling process (`EADDRINUSE`):
```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
```
