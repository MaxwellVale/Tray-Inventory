# Tray Inventory
A lightweight inventory web app for tracking eyewear trays in-store.
Built with React, Vite, React Router, and Supabase.
## What it does
- Shows all trays on a dashboard
- Lets users open a tray and view all SKUs inside it
- Allows quantity changes to be staged before submitting
- Logs submitted changes with user initials
- Supports QR codes that open a tray directly on a phone
## Current workflow
1. Scan a tray QR code
2. Open that tray’s page
3. Review the SKUs and quantities inside
4. Stage add/remove changes
5. Submit changes in bulk with sign-off initials
Repeated button presses on the same SKU are combined into one submitted transaction.
## Main features
- Dashboard with tray search
- Multi-SKU tray support
- Bulk submit for staged inventory changes
- Transaction logging
- Mobile-friendly tray routes such as `/tray/TRAY-001`
## Tech stack
- React
- Vite
- React Router
- Supabase
- CSS
## Project structure
```text
src/
  api/
    inventory.js
  lib/
    supabase.js
  pages/
    Dashboard.jsx
    TrayPage.jsx
  App.jsx
  App.css 
  ```

## Local setup

Install dependencies:

```npm install```

Run the dev server:

```npm run dev```

To test on your phone over the same Wi-Fi network:

```npm run dev -- --host```

## Environment variables

Create a .env.local file in the project root:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Notes

This is currently a proof of concept focused on in-store tray access, quantity updates, and transaction logging.