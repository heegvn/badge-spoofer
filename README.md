# discord-badge-spoofer

inflates your discord profile badges - add hours played and mark games as played.

## join https://discord.gg/remaders for support

**how it works:** discord's analytics endpoint (`/api/v9/science`) tracks what games you play and how long you play them. this tool posts the same events the real client does (`launch_game` and `running_game_heartbeat`), but with custom hours and game lists. discord accepts the events (`204`) and they do show up in your badges.

**status:** verified working and currently unpatched. badges take 1-2 days to update, so don't expect results right away. your token and cookie are stored locally only - nothing leaves your machine. this may break at any time if discord patches the endpoint.

**important:** this violates discord's tos. use it on accounts you're comfortable losing.

## setup

no external dependencies - pure native node.js (needs node 18+).

1. run it:
   ```
   node spoof.js
   ```

2. first run asks for your discord account token. paste it and it gets saved to `science_state.json` (reused after that). the analytics token is fetched automatically from `GET /users/@me?with_analytics_token=true`.

3. you also need a cookie (`cf_clearance`). on startup it'll ask for one, or you can add/update it later via option `3` (refresh auth). grab the `cf_clearance` cookie from any request to discord in devtools (network tab). it gets saved to `science_state.json`.

4. select what you want to boost from the menu:
   - `[1]` **boost games-played badge**: sends quick verified sessions to increment your total unique games played badge.
   - `[2]` **boost playtime-hours badge**: injects custom accumulated playtime hours across your chosen games.

5. **optional: hardware pe fingerprint for games-played count (option `4`).** on windows, discord validates executable signatures for certain telemetry checks. option `4` lets you provide any 64-bit game `.exe` path or running process pid to compute and bind an authentic authenticode signature.
