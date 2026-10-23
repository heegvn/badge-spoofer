# Discord Badge Spoofer & Profile Booster

An efficient, lightweight Node.js tool designed to safely send telemetry events to Discord's `/science` pipeline to inflate profile badges (Games Played count and Playtime Hours).

---

## Features

- **Games Count Badge Booster**: Dispatches quick verified sessions to increment your total unique games played badge.
- **Playtime Hours Badge Booster**: Injects accumulated playtime hours across your chosen games catalogue.
- **Windows PE Authenticode Fingerprint**: Generates authentic executable signatures tied to your machine GUID and user ID.
- **Zero External Dependencies**: Runs entirely on native Node.js APIs (`fetch`, `crypto`, `readline`, `child_process`).
- ** State Persistence**: Caches sessions, authentication tokens, and claimed games in `science_state.json` (auto-ignored by git).

---

## 📋 Requirements

- **Node.js** >= `18.0.0`
- **Windows** (required only if generating hardware PE executable fingerprints)

---

## Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/badge-spoofer.git
   cd badge-spoofer
   ```

2. **Launch the tool:**
   ```bash
   node spoof.js
   ```
   *(or `npm start`)*

3. **Follow the interactive CLI prompts:**
   - Paste your Discord authorization token on first launch.
   - Paste your `cf_clearance` cookie from your browser requests.
   - Select option `1` (Games Count) or `2` (Playtime Hours).

---

## How to Get Your Credentials

### Discord Token
1. Open Discord in your browser (or web client).
2. Press `Ctrl + Shift + I` (Developer Tools) and open the **Network** tab.
3. Perform any action (e.g. switch channels) and look for a request to `/api/`.
4. Copy the value of the `Authorization` request header.

### `cf_clearance` Cookie
1. In the same **Network** tab, inspect requests sent to `discord.com`.
2. Under **Request Headers**, look at the `Cookie` header.
3. Copy the `cf_clearance=...` value.

---

## ⚠️ Disclaimer

This tool interacts with Discord's telemetry API. Use responsibly and at your own discretion. The developers are not responsible for any actions taken against your Discord account.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
