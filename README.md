# Treximo

Treximo is an offline-first GPS run tracker built with React, TypeScript, and Vite. It stores run data locally on the device so it keeps working without a network connection.

## Features
- Offline-first PWA experience
- GPS tracking with accuracy filtering
- Distance, pace, and weekly goal tracking
- Local run history and stats
- Installable on mobile devices as an app

## Local development

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal. If you want to test from your phone on the same Wi-Fi network, use the LAN URL shown by Vite instead of localhost.

## Production build

```bash
npm run build
npm run preview -- --host
```

This serves the production bundle locally so you can verify the PWA install flow before deployment.

## Deploying for phone use

### Option 1: GitHub Pages
1. Push the repo to GitHub.
2. In the repo settings, enable GitHub Pages.
3. Use the default GitHub Pages build output or serve the `dist` folder from your preferred static host.
4. Open the deployed URL on your phone.
5. Tap the browser menu and choose "Add to Home Screen" or "Install app".

### Option 2: Local network / self-hosted server
1. Run the production preview:
   ```bash
   npm run preview -- --host
   ```
2. Open the LAN URL from your phone’s browser.
3. Install the app from the browser menu.

## Important notes
- Geolocation only works over HTTPS or on localhost.
- For true phone installation, the app must be served with HTTPS or on a trusted local network.
- The app uses browser storage for local persistence, so it is designed for device-local tracking rather than cloud sync.
