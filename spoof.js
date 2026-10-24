#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const child_process = require('node:child_process');
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');

const CONFIG = {
    statePath: path.resolve(__dirname, 'science_state.json'),
    gamesCachePath: path.resolve(__dirname, 'games.json'),
    endpoints: {
        analytics: "https://discord.com/api/v9/users/@me?with_analytics_token=true",
        science: "https://discord.com/api/v9/science",
        superProps: "https://cordapi.dolfi.es/api/v2/properties/windows",
        gamesFeed: "https://cdn.discordapp.com/detectables/games.json",
        communityUrl: "https://discord.gg/remaders",
    },
    client: {
        version: "1.0.9265",
        buildNumber: 649389,
        nativeBuild: 96160,
        osVersion: "10.0.26200",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9265 Chrome/148.0.7778.280 Electron/42.11.15 Safari/537.36",
    },
    network: {
        batchSize: 50,
        throttleMs: 1000,
        tokenTtlSeconds: 43200,
    },
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function launchUrl(url) {
    try {
        const cmd = process.platform === 'win32'
            ? `start "" "${url}"`
            : process.platform === 'darwin'
                ? `open "${url}"`
                : `xdg-open "${url}"`;
        child_process.exec(cmd);
    } catch {}
}

function parseSnowflake(token) {
    try {
        const [segment] = String(token || '').split('.');
        if (!segment) return '';
        const padded = segment.padEnd(segment.length + ((4 - (segment.length % 4)) % 4), '=');
        return Buffer.from(padded, 'base64').toString('utf8');
    } catch {
        return '';
    }
}

class Terminal {
    static C = {
        reset: "\x1b[0m",
        bold: "\x1b[1m",
        dim: "\x1b[2m",
        cyan: "\x1b[38;5;51m",
        blue: "\x1b[38;5;39m",
        teal: "\x1b[38;5;43m",
        emerald: "\x1b[38;5;48m",
        amber: "\x1b[38;5;214m",
        rose: "\x1b[38;5;204m",
        slate: "\x1b[38;5;244m",
        light: "\x1b[38;5;253m",
    };

    static clear() {
        process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
    }

    static clock() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${this.C.slate}${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${this.C.reset}`;
    }

    static header() {
        this.clear();
        console.log();
        console.log(`  ${this.C.cyan}╭──────────────────────────────────────────────────╮${this.C.reset}`);
        console.log(`  ${this.C.cyan}│${this.C.reset}  ${this.C.bold}${this.C.light}DISCORD PROFILE BADGE ACCELERATOR${this.C.reset}               ${this.C.cyan}│${this.C.reset}`);
        console.log(`  ${this.C.cyan}│${this.C.reset}  ${this.C.dim}${this.C.teal}High-speed telemetry pipeline • v2.5${this.C.reset}            ${this.C.cyan}│${this.C.reset}`);
        console.log(`  ${this.C.cyan}╰──────────────────────────────────────────────────╯${this.C.reset}`);
        console.log();
    }

    static separator() {
        console.log(`  ${this.C.slate}──────────────────────────────────────────────────${this.C.reset}`);
    }

    static notice(message) {
        console.log(`  ${this.clock()} ${this.C.blue}ℹ${this.C.reset}  ${this.C.light}${message}${this.C.reset}`);
    }

    static success(label, detail) {
        console.log(`  ${this.clock()} ${this.C.emerald}✔${this.C.reset}  ${this.C.bold}${label}${this.C.reset} ${this.C.slate}→${this.C.reset} ${this.C.emerald}${detail}${this.C.reset}`);
    }

    static warning(label, detail) {
        console.log(`  ${this.clock()} ${this.C.amber}▲${this.C.reset}  ${this.C.bold}${label}${this.C.reset} ${this.C.slate}→${this.C.reset} ${this.C.amber}${detail}${this.C.reset}`);
    }

    static failure(label, detail) {
        console.log(`  ${this.clock()} ${this.C.rose}✖${this.C.reset}  ${this.C.bold}${label}${this.C.reset} ${this.C.slate}→${this.C.reset} ${this.C.rose}${detail}${this.C.reset}`);
    }

    static progress(current, total, detail) {
        const ratio = total > 0 ? current / total : 0;
        const percent = Math.min(100, Math.round(ratio * 100));
        const barLength = 16;
        const filled = Math.round(barLength * ratio);
        const bar = `${this.C.teal}${'━'.repeat(filled)}${this.C.slate}${'━'.repeat(barLength - filled)}${this.C.reset}`;
        console.log(`  ${this.clock()} ${this.C.cyan}⟳${this.C.reset}  [${bar}] ${percent}% ${this.C.slate}::${this.C.reset} ${this.C.light}${detail}${this.C.reset}`);
    }
}

class SessionStore {
    constructor(filePath) {
        this.filePath = filePath;
        this.data = this.read();
    }

    read() {
        try {
            if (fs.existsSync(this.filePath)) {
                return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            }
        } catch {}
        return {
            token: "",
            cookie: "",
            fingerprint: "",
            analytics_token: "",
            fetched_at: 0,
            used_games: [],
            total_games_claimed: 0,
            total_hours_claimed: 0,
            joined_discord: false,
        };
    }

    write() {
        const data = JSON.stringify(this.data, null, 2);
        const tempPath = `${this.filePath}.tmp_${process.pid}_${Date.now()}`;
        try {
            fs.writeFileSync(tempPath, data, 'utf8');
            fs.renameSync(tempPath, this.filePath);
        } catch (err) {
            try {
                fs.writeFileSync(this.filePath, data, 'utf8');
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            } catch (fallbackErr) {
                Terminal.warning("storage", `failed to save state: ${fallbackErr.message}`);
            }
        }
    }

    get(key, defaultValue = "") {
        return this.data[key] !== undefined ? this.data[key] : defaultValue;
    }

    set(key, value) {
        this.data[key] = value;
        this.write();
    }

    isAnalyticsExpired() {
        const fetchedAt = Number(this.data.fetched_at) || 0;
        const elapsed = Math.floor(Date.now() / 1000) - fetchedAt;
        return !this.data.analytics_token || elapsed > CONFIG.network.tokenTtlSeconds;
    }

    recordCompleted(gameCount, hoursCount) {
        this.data.total_games_claimed = (Number(this.data.total_games_claimed) || 0) + gameCount;
        this.data.total_hours_claimed = (Number(this.data.total_hours_claimed) || 0) + hoursCount;
        this.write();
    }
}

class CatalogProvider {
    static async fetchOrCache() {
        if (fs.existsSync(CONFIG.gamesCachePath)) {
            try {
                const content = fs.readFileSync(CONFIG.gamesCachePath, 'utf8').trim();
                const parsed = this.normalize(content);
                if (parsed.length > 0) return parsed;
            } catch {}
        }

        try {
            const res = await fetch(CONFIG.endpoints.gamesFeed, {
                headers: { "User-Agent": "Mozilla/5.0" },
                signal: AbortSignal.timeout(20000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const payload = await res.text();
            try {
                fs.mkdirSync(path.dirname(CONFIG.gamesCachePath), { recursive: true });
                fs.writeFileSync(CONFIG.gamesCachePath, payload, 'utf8');
            } catch {}
            return this.normalize(payload);
        } catch {
            return [];
        }
    }

    static normalize(jsonText) {
        const records = JSON.parse(jsonText);
        const map = new Map();
        for (const item of records) {
            const id = String(item.id || '');
            if (!/^\d+$/.test(id) || map.has(id)) continue;
            const winBinary = (item.executables || []).find((e) => e.os === 'win32' && e.name);
            if (!winBinary) continue;
            map.set(id, {
                id,
                title: item.name || 'Application',
                binary: winBinary.name,
            });
        }
        return Array.from(map.values());
    }
}

class WindowsPEIntegrity {
    static generate(accountSnowflake, exeTarget = '', activePid = 0) {
        if (process.platform !== 'win32') {
            throw new Error('Hardware signature generation is supported only on Windows');
        }

        const scriptBody = `
param([int]$ProcessId = 0, [string]$Path, [Parameter(Mandatory = $true)][string]$UserId)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class CertPubKeyHash {
  const uint X509_ASN_ENCODING = 0x00000001;
  const uint PKCS_7_ASN_ENCODING = 0x00010000;
  const uint CALG_SHA_256 = 0x0000800C;
  [StructLayout(LayoutKind.Sequential)] struct Blob { public uint cbData; public IntPtr pbData; }
  [StructLayout(LayoutKind.Sequential)] struct AlgId { public IntPtr pszObjId; public Blob Parameters; }
  [StructLayout(LayoutKind.Sequential)] struct BitBlob { public uint cbData; public IntPtr pbData; public uint cUnusedBits; }
  [StructLayout(LayoutKind.Sequential)] struct PubKeyInfo { public AlgId Algorithm; public BitBlob PublicKey; }
  [StructLayout(LayoutKind.Sequential)] struct FileTime { public uint Low; public uint High; }
  [StructLayout(LayoutKind.Sequential)]
  struct CertInfo {
    public uint Version; public Blob SerialNumber; public AlgId SignatureAlgorithm; public Blob Issuer;
    public FileTime NotBefore; public FileTime NotAfter; public Blob Subject;
    public PubKeyInfo SubjectPublicKeyInfo; public BitBlob IssuerUniqueId; public BitBlob SubjectUniqueId;
    public uint ExtensionCount; public IntPtr Extensions;
  }
  [StructLayout(LayoutKind.Sequential)]
  struct CertContext {
    public uint EncodingType; public IntPtr Encoded; public uint EncodedSize;
    public IntPtr CertInfo; public IntPtr Store;
  }
  [DllImport("crypt32.dll", SetLastError = true)]
  static extern bool CryptHashPublicKeyInfo(IntPtr provider, uint algid, uint flags, uint encoding, ref PubKeyInfo info, byte[] hash, ref uint hashSize);
  public static byte[] Hash(IntPtr certContext) {
    var ctx = Marshal.PtrToStructure<CertContext>(certContext);
    var info = Marshal.PtrToStructure<CertInfo>(ctx.CertInfo);
    var hash = new byte[32];
    uint hashSize = 32;
    if (!CryptHashPublicKeyInfo(IntPtr.Zero, CALG_SHA_256, 0, X509_ASN_ENCODING | PKCS_7_ASN_ENCODING, ref info.SubjectPublicKeyInfo, hash, ref hashSize) || hashSize != 32)
      throw new InvalidOperationException("CryptHashPublicKeyInfo failed");
    return hash;
  }
}
"@
if (!$Path) {
  if (!$ProcessId) { throw "Executable path or ProcessId required." }
  $Path = (Get-Process -Id $ProcessId).Path
}
if (!$Path) { throw "Unable to resolve executable." }
$stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete)
try {
  $fileSize = [UInt64]$stream.Length
  $readSize = [int][Math]::Min($stream.Length, 0x10000)
  $buf = [byte[]]::new($readSize)
  $read = $stream.Read($buf, 0, $readSize)
  if ($read -lt 0x40) { throw "Invalid PE header size." }
  if ($read -ne $readSize) { [Array]::Resize([ref]$buf, $read) }
} finally {
  $stream.Dispose()
}
if ([BitConverter]::ToUInt16($buf, 0) -ne 0x5A4D) { throw "Not an MZ binary." }
$pe = [BitConverter]::ToInt32($buf, 0x3C)
if ($pe -lt 0 -or [BitConverter]::ToUInt32($buf, $pe) -ne 0x4550) { throw "Not a PE image." }
$fh = $pe + 4
$sections = [BitConverter]::ToUInt16($buf, $fh + 2)
$timestamp = [BitConverter]::ToUInt32($buf, $fh + 4)
$optSize = [BitConverter]::ToUInt16($buf, $fh + 16)
$opt = $fh + 20
$isPe32Plus = [BitConverter]::ToUInt16($buf, $opt) -eq 0x20B
if (!$isPe32Plus) { throw "Discord requires 64-bit PE32+ binary." }
$sizeOfImage = [BitConverter]::ToUInt32($buf, $opt + 56)
$sectionTable = $opt + $optSize
$sha = [Security.Cryptography.SHA256]::Create()
$headerHash = $sha.ComputeHash([byte[]]$buf[0..($sectionTable - 1)])
$sectionHash = $sha.ComputeHash([byte[]]$buf[$sectionTable..($sectionTable + $sections * 40 - 1)])
$machineGuid = (Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Cryptography" -Name MachineGuid).MachineGuid
$machineUserHash = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($machineGuid + $UserId))
$sig = Get-AuthenticodeSignature -LiteralPath $Path
$signed = $sig.Status -eq "Valid" -and $sig.SignerCertificate
if ($signed) {
  $name = $sig.SignerCertificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false)
  $certHash = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($name) + [CertPubKeyHash]::Hash($sig.SignerCertificate.Handle))
} else {
  $certHash = [byte[]]::new(32)
}
$flags = 0
if ($signed) { $flags += 1 }
if ($isPe32Plus) { $flags += 2 }
$out = [byte[]](@(1, [byte]$flags) +
  [BitConverter]::GetBytes($fileSize) +
  [BitConverter]::GetBytes($timestamp) +
  [BitConverter]::GetBytes($sizeOfImage) +
  $headerHash + $machineUserHash + $sectionHash + $certHash)
$key = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($UserId + "https://discord.com/careers"))
for ($i = 1; $i -lt $out.Length; $i++) {
  $out[$i] = $out[$i] -bxor $key[($i - 1) -band 31]
}
[Convert]::ToBase64String($out)
`;

        const tmpPath = path.join(os.tmpdir(), `d_fp_${crypto.randomUUID().replace(/-/g, '')}.ps1`);
        fs.writeFileSync(tmpPath, scriptBody, 'utf8');

        let runner;
        try {
            const invocation = [
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                tmpPath,
                "-UserId",
                accountSnowflake,
            ];
            if (activePid) {
                invocation.push("-ProcessId", String(activePid));
            } else {
                invocation.push("-Path", exeTarget);
            }
            runner = child_process.spawnSync("powershell", invocation, {
                encoding: "utf8",
                timeout: 45000,
            });
        } finally {
            try { fs.unlinkSync(tmpPath); } catch {}
        }

        if (runner.error) throw runner.error;
        if (runner.status !== 0) {
            const raw = (runner.stderr || runner.stdout || '').trim();
            const last = raw.split(/\r?\n/).filter(Boolean).pop();
            throw new Error(last || "Signature generator exited with error code");
        }

        const lines = (runner.stdout || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (!lines.length) throw new Error("Empty signature output");
        return lines.pop();
    }
}

class TelemetryTransmission {
    constructor(store) {
        this.store = store;
        this.launchSignature = crypto.randomUUID();
        this.heartbeatSessionId = crypto.randomUUID();
        this.encodedSuperProps = "";
        this.sequenceIndex = 0;
    }

    async initialize() {
        this.encodedSuperProps = await this.synthesizeSuperProps();
        if (this.store.isAnalyticsExpired()) {
            await this.refreshAnalyticsToken();
        }
    }

    async synthesizeSuperProps() {
        let meta = null;
        try {
            const resp = await fetch(CONFIG.endpoints.superProps, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": CONFIG.client.userAgent,
                },
                body: "{}",
                signal: AbortSignal.timeout(8000),
            });
            if (resp.ok) {
                const json = await resp.json();
                meta = json.properties;
            }
        } catch {}

        if (!meta) {
            meta = {
                os: "Windows",
                browser: "Discord Client",
                release_channel: "stable",
                client_version: CONFIG.client.version,
                os_version: CONFIG.client.osVersion,
                os_arch: "x64",
                app_arch: "x64",
                system_locale: "en-US",
                has_client_mods: false,
                browser_user_agent: CONFIG.client.userAgent,
                browser_version: "42.7.1",
                os_sdk_version: "26200",
                client_build_number: CONFIG.client.buildNumber,
                native_build_number: CONFIG.client.nativeBuild,
                client_event_source: null,
                client_app_state: "focused",
            };
        }

        meta.client_launch_id = crypto.randomUUID();
        meta.launch_signature = this.launchSignature;
        meta.client_heartbeat_session_id = this.heartbeatSessionId;
        return Buffer.from(JSON.stringify(meta)).toString("base64");
    }

    async refreshAnalyticsToken() {
        const token = this.store.get('token');
        if (!token) throw new Error("Discord token is missing");

        const res = await fetch(CONFIG.endpoints.analytics, {
            headers: {
                "Authorization": token,
                "User-Agent": CONFIG.client.userAgent,
                "X-Super-Properties": this.encodedSuperProps,
            },
            signal: AbortSignal.timeout(12000),
        });

        if (!res.ok) {
            throw new Error(`Token authentication failed (HTTP ${res.status})`);
        }

        const data = await res.json();
        if (!data.analytics_token) {
            throw new Error("No analytics_token returned by server");
        }

        this.store.set('analytics_token', data.analytics_token);
        this.store.set('fetched_at', Math.floor(Date.now() / 1000));
    }

    createSessionPayload(game, durationMs) {
        const sessionId = crypto.randomUUID();
        const now = Date.now();
        const startTime = durationMs > now ? now : now - durationMs;
        const jitter = Math.floor(Math.random() * (680 - 120 + 1)) + 120;
        const launchTime = Math.min(startTime + jitter, now);
        const fingerprint = this.store.get('fingerprint');

        const initialHeartbeat = {
            type: "running_game_heartbeat",
            properties: {
                client_track_timestamp: startTime,
                client_heartbeat_session_id: this.heartbeatSessionId,
                event_sequence_number: ++this.sequenceIndex,
                game_id: game.id,
                game_name: game.title,
                game_metadata: null,
                game_executable: game.binary,
                game_detection_enabled: true,
                initial_heartbeat: true,
                final_heartbeat: false,
                game_session_id: sessionId,
                duration_tracked_ms: 0,
                rtc_connection_id: null,
                media_session_id: null,
                launch_signature: this.launchSignature,
                client_app_state: "focused",
                client_send_timestamp: startTime,
            },
        };

        const launchProperties = {
            client_track_timestamp: launchTime,
            client_heartbeat_session_id: this.heartbeatSessionId,
            event_sequence_number: ++this.sequenceIndex,
            game: game.title,
            game_id: game.id,
            verified: true,
            elevated: false,
            is_launcher: false,
            game_platform: "desktop",
            detection_method: "verified_game",
            is_overlay_enabled: false,
            is_overlay_game_enabled: true,
            is_overlay_game_source: "OOP_DEFAULT_DATABASE",
            fullscreen_type: "UNKNOWN",
            hardware_display_count: 1,
            overlay_method: "Disabled",
            activity_status_enabled: true,
            activity_status_shared_guilds: [],
            current_user_status: "online",
            game_detection_enabled: true,
            executable_path: game.binary,
            voice_channel_id: null,
            voice_channel_type: null,
            voice_channel_bitrate: null,
            voice_channel_guild_id: null,
            hidden_by_distributor: false,
            game_metadata: null,
            client_performance_cpu: null,
            client_performance_memory: null,
            cpu_core_count: null,
            accessibility_features: 0,
            rendered_locale: "en-GB",
            launch_signature: this.launchSignature,
            client_rtc_state: null,
            client_app_state: "focused",
            client_send_timestamp: launchTime,
        };

        if (fingerprint) {
            launchProperties.executable_fingerprint = fingerprint;
        }

        const launchEvent = {
            type: "launch_game",
            properties: launchProperties,
        };

        const finalHeartbeat = {
            type: "running_game_heartbeat",
            properties: {
                client_track_timestamp: now,
                client_heartbeat_session_id: this.heartbeatSessionId,
                event_sequence_number: ++this.sequenceIndex,
                game_id: game.id,
                game_name: game.title,
                game_metadata: null,
                game_executable: game.binary,
                game_detection_enabled: true,
                initial_heartbeat: false,
                final_heartbeat: true,
                game_session_id: sessionId,
                duration_tracked_ms: durationMs,
                rtc_connection_id: null,
                media_session_id: null,
                launch_signature: this.launchSignature,
                client_app_state: "focused",
                client_send_timestamp: now,
            },
        };

        return [initialHeartbeat, launchEvent, finalHeartbeat];
    }

    async sendEventBatch(events) {
        const payload = JSON.stringify({
            token: this.store.get('analytics_token'),
            events,
        });

        const rawCookie = String(this.store.get('cookie') || '').trim();
        const cookieHeader = rawCookie.includes('=') ? rawCookie : `cf_clearance=${rawCookie}`;

        const headers = {
            "Accept": "*/*",
            "Accept-Language": "en-GB,en;q=0.9",
            "Authorization": this.store.get('token'),
            "Content-Type": "application/json",
            "Cookie": cookieHeader,
            "Origin": "https://discord.com",
            "Referer": "https://discord.com/channels/@me",
            "User-Agent": CONFIG.client.userAgent,
            "X-Debug-Options": "bugReporterEnabled",
            "X-Discord-Locale": "en-GB",
            "X-Discord-Timezone": "Europe/Oslo",
            "X-Super-Properties": this.encodedSuperProps,
            "Connection": "keep-alive",
        };

        try {
            const resp = await fetch(CONFIG.endpoints.science, {
                method: "POST",
                headers,
                body: payload,
                signal: AbortSignal.timeout(15000),
            });

            let retryAfter = 0;
            const headerRetry = resp.headers.get("retry-after");
            if (headerRetry) {
                const parsed = parseFloat(headerRetry);
                retryAfter = !isNaN(parsed) && parsed > 0 ? parsed : 2.0;
            }

            return { status: resp.status, retryAfter };
        } catch {
            return { status: 0, retryAfter: 0 };
        }
    }
}

class Orchestrator {
    constructor() {
        this.store = new SessionStore(CONFIG.statePath);
        this.transmission = null;
        this.catalog = [];
        this.reader = readline.createInterface({ input, output });
    }

    async prompt(query) {
        return (await this.reader.question(query)).trim();
    }

    async run() {
        Terminal.header();
        await wait(300);

        if (!this.store.get('joined_discord')) {
            Terminal.notice("opening server link in your browser...");
            launchUrl(CONFIG.endpoints.communityUrl);
            this.store.set('joined_discord', true);
        }

        if (!this.store.get('token')) {
            Terminal.notice("enter your discord account token");
            const token = await this.prompt(`  ${Terminal.C.slate}token:${Terminal.C.reset} `);
            if (!token) {
                Terminal.failure("token", "authentication token is mandatory");
                return;
            }
            this.store.set('token', token);
            Terminal.success("token", "saved to storage");
            await wait(500);
        }

        if (!this.store.get('cookie')) {
            Terminal.header();
            Terminal.notice("enter your cf_clearance cookie value");
            const cookie = await this.prompt(`  ${Terminal.C.slate}cookie:${Terminal.C.reset} `);
            if (!cookie) {
                Terminal.failure("cookie", "cf_clearance cookie is mandatory");
                return;
            }
            this.store.set('cookie', cookie);
            Terminal.success("cookie", "saved to storage");
            await wait(500);
        }

        Terminal.notice("loading detectable games catalog...");
        this.catalog = await CatalogProvider.fetchOrCache();
        if (!this.catalog.length) {
            Terminal.failure("catalog", "could not retrieve game definitions");
            return;
        }
        Terminal.success("catalog", `${this.catalog.length} games ready`);

        if (!this.store.get('fingerprint')) {
            Terminal.warning("fingerprint", "hardware signature missing (recommended for games counter)");
        }

        Terminal.notice("connecting telemetry session...");
        this.transmission = new TelemetryTransmission(this.store);
        try {
            await this.transmission.initialize();
            Terminal.success("session", "ready for telemetry dispatch");
            await wait(400);
        } catch (err) {
            Terminal.failure("session", err.message);
            return;
        }

        await this.mainLoop();
    }

    async mainLoop() {
        while (true) {
            Terminal.header();

            const claimedGames = this.store.get('total_games_claimed', 0);
            const claimedHours = Math.round(Number(this.store.get('total_hours_claimed', 0)));
            console.log(`  ${Terminal.C.bold}Profile Telemetry Stats:${Terminal.C.reset}`);
            console.log(`    ${Terminal.C.teal}•${Terminal.C.reset} Available Titles : ${Terminal.C.bold}${this.catalog.length}${Terminal.C.reset}`);
            console.log(`    ${Terminal.C.teal}•${Terminal.C.reset} Boosted Titles   : ${Terminal.C.bold}${claimedGames}${Terminal.C.reset}`);
            console.log(`    ${Terminal.C.teal}•${Terminal.C.reset} Boosted Playtime : ${Terminal.C.bold}+${claimedHours.toLocaleString()} hours${Terminal.C.reset}`);
            Terminal.separator();
            console.log(`  ${Terminal.C.cyan}[1]${Terminal.C.reset} Boost Games-Played Badge     ${Terminal.C.slate}(inject quick launch sessions)${Terminal.C.reset}`);
            console.log(`  ${Terminal.C.cyan}[2]${Terminal.C.reset} Boost Playtime-Hours Badge    ${Terminal.C.slate}(inject accumulated hours)${Terminal.C.reset}`);
            console.log(`  ${Terminal.C.cyan}[3]${Terminal.C.reset} Update Credentials & Cookie   ${Terminal.C.slate}(refresh authentication)${Terminal.C.reset}`);
            console.log(`  ${Terminal.C.cyan}[4]${Terminal.C.reset} Calibrate Hardware Signature  ${Terminal.C.slate}(bind authentic PE hash)${Terminal.C.reset}`);
            console.log(`  ${Terminal.C.cyan}[5]${Terminal.C.reset} Exit`);
            Terminal.separator();

            const choice = await this.prompt(`  ${Terminal.C.cyan}›${Terminal.C.reset} `);
            console.log();

            if (choice === '1') {
                await this.actionBoostGames();
            } else if (choice === '2') {
                await this.actionBoostHours();
            } else if (choice === '3') {
                await this.actionUpdateCredentials();
            } else if (choice === '4') {
                await this.actionConfigureSignature();
            } else if (choice === '5' || !choice) {
                break;
            } else {
                Terminal.warning("input", "unknown option selected");
                await wait(800);
            }
        }
    }

    selectGameSlice(amount) {
        const used = new Set(this.store.get('used_games', []));
        const unplayed = this.catalog.filter((g) => !used.has(g.id));
        const played = this.catalog.filter((g) => used.has(g.id));

        let selected = [];
        if (unplayed.length >= amount) {
            selected = unplayed.slice(0, amount);
        } else {
            selected = [...unplayed];
            const remaining = amount - selected.length;
            if (played.length > 0) {
                selected.push(...played.slice(0, remaining));
            }
        }

        const newUsed = [...used, ...selected.map((g) => g.id)];
        this.store.set('used_games', Array.from(new Set(newUsed)));
        return selected;
    }

    async dispatchQueue(games, durationMs, hoursMultiplier) {
        const total = games.length;
        const batchSize = CONFIG.network.batchSize;
        let successful = 0;

        for (let i = 0; i < total; i += batchSize) {
            const chunk = games.slice(i, i + batchSize);
            const events = [];
            for (const item of chunk) {
                events.push(...this.transmission.createSessionPayload(item, durationMs));
            }

            let maxRetries = 3;
            let batchSuccess = false;

            while (maxRetries > 0) {
                const { status, retryAfter } = await this.transmission.sendEventBatch(events);

                if (status === 204) {
                    successful += chunk.length;
                    Terminal.progress(successful, total, `${successful}/${total} games transmitted`);
                    batchSuccess = true;
                    break;
                } else if (status === 429) {
                    const waitSec = Math.max(retryAfter, 2.0);
                    Terminal.warning("rate-limit", `HTTP 429 hit · cooling down for ${waitSec.toFixed(1)}s (retries left: ${maxRetries - 1})...`);
                    await wait(Math.round(waitSec * 1000));
                    maxRetries--;
                } else if (status === 401 || status === 403) {
                    Terminal.failure("auth", `rejected (HTTP ${status}) · please update your cf_clearance cookie via option 3`);
                    return;
                } else {
                    Terminal.warning("telemetry", `unexpected response HTTP ${status || 'network error'} (retries left: ${maxRetries - 1})`);
                    await wait(1500);
                    maxRetries--;
                }
            }

            if (!batchSuccess) {
                Terminal.failure("batch", `failed to transmit batch of ${chunk.length} games after retries`);
            }

            if (i + batchSize < total) {
                await wait(CONFIG.network.throttleMs);
            }
        }

        if (successful > 0) {
            this.store.recordCompleted(successful, successful * hoursMultiplier);
            Terminal.success("complete", `${successful} games successfully registered on your Discord badge!`);
        }

        Terminal.separator();
        await this.prompt(`  ${Terminal.C.cyan}›${Terminal.C.reset} press enter to continue`);
    }

    async actionBoostGames() {
        Terminal.notice("configure games-played badge booster");
        const countInput = await this.prompt(`  ${Terminal.C.slate}how many titles to boost? [all / ${this.catalog.length}]:${Terminal.C.reset} `);
        let targetCount = this.catalog.length;
        if (countInput) {
            const parsed = parseInt(countInput, 10);
            if (isNaN(parsed) || parsed <= 0) {
                Terminal.failure("input", "game count must be a positive number");
                await wait(1200);
                return;
            }
            targetCount = Math.min(parsed, this.catalog.length);
        }

        const selectedGames = this.selectGameSlice(targetCount);
        if (!selectedGames.length) {
            Terminal.failure("games", "no titles available");
            await wait(1000);
            return;
        }

        Terminal.separator();
        Terminal.notice(`dispatching telemetry for ${selectedGames.length} titles (1 min session each)...`);
        await this.dispatchQueue(selectedGames, 60 * 1000, 1 / 60);
    }

    async actionBoostHours() {
        Terminal.notice("configure playtime hours booster");
        const hoursInput = await this.prompt(`  ${Terminal.C.slate}playtime hours per title? [50]:${Terminal.C.reset} `);
        if (hoursInput) {
            const parsed = parseFloat(hoursInput);
            if (isNaN(parsed) || parsed <= 0) {
                Terminal.failure("input", "hours must be a positive number");
                await wait(1200);
                return;
            }
        }
        const hours = hoursInput && !isNaN(parseFloat(hoursInput)) && parseFloat(hoursInput) > 0
            ? parseFloat(hoursInput)
            : 50.0;

        const countInput = await this.prompt(`  ${Terminal.C.slate}across how many titles? [10]:${Terminal.C.reset} `);
        if (countInput) {
            const parsed = parseInt(countInput, 10);
            if (isNaN(parsed) || parsed <= 0) {
                Terminal.failure("input", "number of titles must be a positive number");
                await wait(1200);
                return;
            }
        }
        const count = countInput && !isNaN(parseInt(countInput, 10)) && parseInt(countInput, 10) > 0
            ? Math.min(parseInt(countInput, 10), this.catalog.length)
            : Math.min(10, this.catalog.length);

        const selectedGames = this.selectGameSlice(count);
        if (!selectedGames.length) {
            Terminal.failure("games", "no titles available");
            await wait(1000);
            return;
        }

        const totalHours = Math.round(selectedGames.length * hours);
        Terminal.separator();
        Terminal.notice(`injecting +${totalHours.toLocaleString()}h across ${selectedGames.length} titles...`);
        const durationMs = Math.round(hours * 3600 * 1000);
        await this.dispatchQueue(selectedGames, durationMs, hours);
    }

    async actionUpdateCredentials() {
        Terminal.notice("authentication manager");
        const newCookie = await this.prompt(`  ${Terminal.C.slate}paste fresh cf_clearance cookie (or enter to keep current):${Terminal.C.reset} `);
        if (newCookie) {
            this.store.set('cookie', newCookie);
            Terminal.success("cookie", "updated");
        }

        Terminal.notice("refreshing telemetry token...");
        try {
            this.store.set('fetched_at', 0);
            this.transmission = new TelemetryTransmission(this.store);
            await this.transmission.initialize();
            Terminal.success("auth", "session verified and refreshed");
        } catch (err) {
            Terminal.failure("auth", err.message);
        }
        await wait(1200);
    }

    async actionConfigureSignature() {
        const snowflake = parseSnowflake(this.store.get('token'));
        if (!snowflake) {
            Terminal.failure("signature", "valid account token is required first");
            await wait(1200);
            return;
        }

        Terminal.notice(`account user id: ${Terminal.C.cyan}${snowflake}${Terminal.C.reset}`);
        Terminal.notice("enter path to any 64-bit game .exe (or active process PID)");
        const target = (await this.prompt(`  ${Terminal.C.slate}path or PID:${Terminal.C.reset} `)).replace(/^"|"$/g, '');
        if (!target) return;

        const pid = /^\d+$/.test(target) ? parseInt(target, 10) : 0;
        const exePath = pid ? '' : target;

        if (exePath && !fs.existsSync(exePath)) {
            Terminal.failure("signature", `file not found: ${exePath}`);
            await wait(1200);
            return;
        }

        Terminal.notice("computing authentic PE signature...");
        try {
            const sig = WindowsPEIntegrity.generate(snowflake, exePath, pid);
            this.store.set('fingerprint', sig);
            Terminal.success("signature", `generated (${sig.length} bytes) and saved`);
        } catch (err) {
            Terminal.failure("signature", err.message);
        }
        await wait(1500);
    }

    destroy() {
        this.reader.close();
    }
}

async function start() {
    process.on("SIGINT", () => {
        console.log();
        Terminal.warning("process", "operation cancelled");
        process.exit(0);
    });

    const app = new Orchestrator();
    try {
        await app.run();
    } catch (err) {
        Terminal.failure("error", err.message || err);
    } finally {
        app.destroy();
    }
}

if (require.main === module) {
    start();
}

module.exports = {
    Orchestrator,
    Terminal,
    SessionStore,
    CatalogProvider,
    WindowsPEIntegrity,
    TelemetryTransmission,
    parseSnowflake,
};
