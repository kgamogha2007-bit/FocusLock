const DEFAULT_DOMAINS = [
  "youtube.com", "instagram.com", "facebook.com", "x.com", "twitter.com",
  "reddit.com", "tiktok.com", "netflix.com", "twitch.tv", "primevideo.com",
  "hotstar.com", "snapchat.com", "pinterest.com", "9gag.com", "hulu.com",
  "disneyplus.com", "spotify.com", "soundcloud.com", "discord.com", "tumblr.com",
];

const DEFAULT_APPS = [
  "Discord", "Steam", "Spotify", "Netflix", "Telegram", "WhatsApp", "Slack", "EpicGamesLauncher",
];

const PRESETS = [15, 25, 45, 60, 90, 120];

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

const $ = (id) => document.getElementById(id);
let selectedMinutes = 25;
let current = { active: false, endsAt: null };

/* ---------- setup ---------- */

$("domains").value = store.get("fl.domains", DEFAULT_DOMAINS).join("\n");
$("apps").value = store.get("fl.apps", DEFAULT_APPS).join("\n");
$("domains").addEventListener("input", () => store.set("fl.domains", lines($("domains").value)));
$("apps").addEventListener("input", () => store.set("fl.apps", lines($("apps").value)));

function lines(text) {
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

PRESETS.forEach((m) => {
  const b = document.createElement("button");
  b.className = "chip" + (m === selectedMinutes ? " on" : "");
  b.textContent = m + "m";
  b.onclick = () => {
    selectedMinutes = m;
    $("custom").value = "";
    [...$("presets").children].forEach((c) => c.classList.toggle("on", c === b));
  };
  $("presets").appendChild(b);
});

$("custom").addEventListener("input", () => {
  [...$("presets").children].forEach((c) => c.classList.remove("on"));
});

/* ---------- pin ---------- */

function pinIsSet() {
  return !!store.get("fl.pin", null);
}

function refreshPinState() {
  $("pinState").textContent = pinIsSet() ? "PIN is set." : "No PIN yet — set one before starting.";
}
refreshPinState();

$("savePin").onclick = () => {
  const v = $("pinSet").value.trim();
  if (!/^(\d{4}|\d{6})$/.test(v)) {
    alert("PIN must be exactly 4 or 6 digits.");
    return;
  }
  store.set("fl.pin", v);
  $("pinSet").value = "";
  refreshPinState();
};

/* ---------- session ---------- */

const agent = window.focusAgent;

$("startBtn").onclick = async () => {
  if (!pinIsSet()) {
    alert("Set your 4 or 6 digit PIN first — it's what stops you bailing out early.");
    return;
  }
  const custom = parseInt($("custom").value, 10);
  const minutes = Number.isFinite(custom) && custom > 0 ? custom : selectedMinutes;
  const payload = {
    endsAt: Date.now() + minutes * 60_000,
    domains: lines($("domains").value),
    apps: lines($("apps").value),
  };
  render(await agent.start(payload));
};

$("stopBtn").onclick = () => {
  $("pinCheck").value = "";
  $("pinErr").textContent = "";
  $("modal").classList.add("open");
  $("pinCheck").focus();
};

$("cancelStop").onclick = () => $("modal").classList.remove("open");

$("confirmStop").onclick = async () => {
  if ($("pinCheck").value.trim() !== store.get("fl.pin", null)) {
    $("pinErr").textContent = "Wrong PIN. Session continues.";
    $("pinCheck").value = "";
    return;
  }
  $("modal").classList.remove("open");
  render(await agent.stop());
};

$("pinCheck").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("confirmStop").click();
});

/* ---------- render ---------- */

function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function render(status) {
  current = status;
  $("env").textContent = `${status.platform} · agent connected`;
  $("dot").classList.toggle("live", status.active);
  $("statusText").textContent = status.active ? "Session active — blocking enforced" : "Idle";
  $("startBtn").style.display = status.active ? "none" : "";
  $("stopBtn").style.display = status.active ? "" : "none";
  $("timer").classList.toggle("idle", !status.active);
  $("domains").disabled = status.active;
  $("apps").disabled = status.active;
  $("warn").style.display = status.hostsWritable ? "none" : "block";
  $("warn").textContent =
    "Focus Lock can't write the system hosts file. Relaunch it as administrator (Windows) or with sudo (macOS/Linux) so website blocking works.";
  tick();
}

function tick() {
  if (current.active && current.endsAt) {
    const left = current.endsAt - Date.now();
    $("timer").textContent = fmt(left);
    if (left <= 0) agent.getStatus().then(render);
  } else {
    const custom = parseInt($("custom").value, 10);
    const minutes = Number.isFinite(custom) && custom > 0 ? custom : selectedMinutes;
    $("timer").textContent = fmt(minutes * 60_000);
  }
}

setInterval(tick, 1000);

if (agent) {
  agent.getStatus().then(render);
  agent.onStatus(render);
} else {
  $("env").textContent = "agent unavailable";
}
