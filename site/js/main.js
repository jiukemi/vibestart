(function () {
  "use strict";

  const cfg = { ...window.VIBESTART_RELEASE };
  if (!cfg.github || !cfg.gitee) return;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const state = {
    platform: "mac-arm",
    mirror: "auto",
    resolvedMirror: "gitee",
    probing: true,
    releaseSource: "fallback",
    detectedOs: "unknown",
  };

  const PLATFORM_LABELS = {
    "mac-arm": { label: "macOS", sub: "Apple Silicon (M 系列)" },
    "mac-intel": { label: "macOS", sub: "Intel 芯片" },
    win: { label: "Windows", sub: "Windows 10 / 11 x64" },
  };

  function buildUrl(mirror, platform) {
    const { tag, assets, github, gitee } = cfg;
    const file =
      platform === "mac-arm"
        ? assets.macArm
        : platform === "mac-intel"
          ? assets.macIntel
          : assets.win;

    if (!file) return "#";

    if (mirror === "github") {
      return `https://github.com/${github.owner}/${github.repo}/releases/download/${tag}/${file}`;
    }
    return `https://gitee.com/${gitee.owner}/${gitee.repo}/releases/download/${tag}/${file}`;
  }

  function matchAssets(names) {
    let macArm;
    let macIntel;
    let win;
    for (const name of names) {
      const n = name.toLowerCase();
      if (n.includes("aarch64") && n.endsWith(".dmg")) macArm = name;
      else if (n.includes("x64-setup") && n.endsWith(".exe")) win = name;
      else if (n.endsWith(".dmg") && n.includes("x64") && !n.includes("aarch64")) macIntel = name;
      else if (n.endsWith(".exe") && n.includes("setup")) win = win || name;
    }
    return { macArm, macIntel, win };
  }

  function applyRelease(tag, assetNames, source) {
    const version = tag.replace(/^v/i, "");
    const assets = matchAssets(assetNames);
    cfg.tag = tag;
    cfg.version = version;
    cfg.assets = { ...cfg.assets, ...Object.fromEntries(Object.entries(assets).filter(([, v]) => v)) };
    state.releaseSource = source;
  }

  async function fetchGithubLatest() {
    const { owner, repo } = cfg.github;
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
      {
        headers: { Accept: "application/vnd.github+json" },
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const data = await res.json();
    const names = (data.assets || []).map((a) => a.name);
    if (!names.length) throw new Error("no assets");
    applyRelease(data.tag_name, names, "github");
    return true;
  }

  async function fetchGiteeLatest() {
    const { owner, repo } = cfg.gitee;
    const res = await fetch(
      `https://gitee.com/api/v5/repos/${owner}/${repo}/releases/latest`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) throw new Error(`Gitee ${res.status}`);
    const data = await res.json();
    if (data.message) throw new Error(data.message);
    const names = (data.assets || []).map((a) => a.name).filter(Boolean);
    if (!names.length) throw new Error("no assets");
    applyRelease(data.tag_name, names, "gitee");
    return true;
  }

  async function loadLatestRelease(preferredMirror) {
    const order =
      preferredMirror === "github" ? ["github", "gitee"] : ["gitee", "github"];
    for (const src of order) {
      try {
        if (src === "github") await fetchGithubLatest();
        else await fetchGiteeLatest();
        return;
      } catch {
        /* try next */
      }
    }
    state.releaseSource = "fallback";
  }

  function detectOs() {
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    if (/Win/i.test(ua) || /Win/i.test(platform)) return "win";
    if (/Mac/i.test(ua) || /Mac/i.test(platform)) return "mac";
    if (/iPhone|iPad|iPod|Android/i.test(ua)) return "mobile";
    return "unknown";
  }

  function detectMacArch() {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) return "mac-arm";
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (!ext) return "mac-arm";
      const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "";
      if (/Apple M/i.test(renderer)) return "mac-arm";
      if (/Intel/i.test(renderer)) return "mac-intel";
    } catch {
      /* ignore */
    }
    return "mac-arm";
  }

  function defaultPlatform() {
    const os = detectOs();
    state.detectedOs = os;
    if (os === "win") return "win";
    if (os === "mac") return detectMacArch();
    return "mac-arm";
  }

  async function probeGithub() {
    const start = performance.now();
    try {
      const res = await fetch("https://api.github.com/zen", {
        cache: "no-store",
        signal: AbortSignal.timeout(4500),
      });
      if (!res.ok) return { ok: false, ms: 0 };
      return { ok: true, ms: Math.round(performance.now() - start) };
    } catch {
      return { ok: false, ms: 0 };
    }
  }

  async function resolveMirror() {
    state.probing = true;
    updateMirrorBadge();

    if (state.mirror === "github") {
      state.resolvedMirror = "github";
      state.probing = false;
      updateMirrorBadge();
      return;
    }
    if (state.mirror === "gitee") {
      state.resolvedMirror = "gitee";
      state.probing = false;
      updateMirrorBadge();
      return;
    }

    const result = await probeGithub();
    state.resolvedMirror = result.ok ? "github" : "gitee";
    state.probing = false;
    state.githubLatency = result.ms;
    updateMirrorBadge();
  }

  function activeMirror() {
    if (state.mirror === "auto") return state.resolvedMirror;
    return state.mirror;
  }

  function updateMirrorBadge() {
    const badge = $("#mirror-badge");
    const text = $("#mirror-badge-text");
    if (!badge || !text) return;

    if (state.probing) {
      badge.dataset.state = "probing";
      text.textContent = "检测线路…";
      return;
    }

    const m = activeMirror();
    badge.dataset.state = m;
    if (m === "github") {
      const ms = state.githubLatency ? ` · ${state.githubLatency}ms` : "";
      text.textContent = `GitHub${ms}`;
    } else {
      text.textContent = "Gitee 国内";
    }
  }

  function updatePlatformUI() {
    $$(".platform-option").forEach((el) => {
      el.setAttribute("aria-checked", el.dataset.platform === state.platform ? "true" : "false");
    });

    const info = PLATFORM_LABELS[state.platform];
    const dlBtn = $("#download-btn");
    const dlLabel = $("#download-label");
    const meta = $("#download-meta");
    const url = buildUrl(activeMirror(), state.platform);
    const hasAsset = url !== "#";

    if (dlBtn) {
      dlBtn.href = hasAsset ? url : "#";
      dlBtn.setAttribute("aria-disabled", hasAsset ? "false" : "true");
      if (hasAsset) dlBtn.setAttribute("download", "");
      else dlBtn.removeAttribute("download");
    }
    if (dlLabel) {
      dlLabel.textContent = hasAsset ? `下载 ${info.label} 版` : "该版本暂无此平台安装包";
    }
    if (meta) {
      const mirrorName = activeMirror() === "github" ? "GitHub" : "Gitee";
      const src =
        state.releaseSource === "fallback"
          ? "内置版本信息"
          : "已同步最新安装包";
      meta.textContent = `${info.sub} · v${cfg.version} · ${mirrorName} · ${src}`;
    }

    $$("[data-version]").forEach((el) => {
      el.textContent = cfg.version;
    });

    $$(".mirror-chip").forEach((chip) => {
      chip.setAttribute("aria-pressed", chip.dataset.mirror === state.mirror ? "true" : "false");
    });

    const notice = $("#mobile-notice");
    if (notice) notice.dataset.visible = state.detectedOs === "mobile" ? "true" : "false";

    const detectHint = $("#detect-hint");
    if (detectHint) {
      if (state.detectedOs === "mobile") {
        detectHint.textContent = "检测到移动设备，请在 Mac 或 Windows 电脑上下载";
      } else if (state.detectedOs === "win") {
        detectHint.textContent = "已识别 Windows，已为你勾选 Windows 版";
      } else if (state.detectedOs === "mac") {
        detectHint.textContent = `已识别 macOS · ${PLATFORM_LABELS[state.platform].sub}`;
      } else {
        detectHint.textContent = "未识别桌面系统，默认推荐 Apple Silicon";
      }
    }
  }

  function bindEvents() {
    $$(".platform-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.platform = btn.dataset.platform;
        updatePlatformUI();
      });
    });

    $$(".mirror-chip").forEach((chip) => {
      chip.addEventListener("click", async () => {
        state.mirror = chip.dataset.mirror;
        if (state.mirror === "auto") {
          await resolveMirror();
        } else {
          state.probing = false;
          state.resolvedMirror = state.mirror;
          updateMirrorBadge();
        }
        await loadLatestRelease(activeMirror());
        updatePlatformUI();
      });
    });

    $("#theme-toggle")?.addEventListener("click", () => {
      const html = document.documentElement;
      const current = html.dataset.theme;
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const next = current === "dark" || (!current && prefersDark) ? "light" : "dark";
      html.dataset.theme = next;
      localStorage.setItem("vibestart-theme", next);
    });

    $("#copy-link-btn")?.addEventListener("click", async () => {
      const url = buildUrl(activeMirror(), state.platform);
      const btn = $("#copy-link-btn");
      if (url === "#") {
        btn.textContent = "暂无直链";
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        btn.textContent = "已复制";
        setTimeout(() => {
          btn.textContent = "复制直链";
        }, 2000);
      } catch {
        btn.textContent = "复制失败";
      }
    });

    $("#download-btn")?.addEventListener("click", (e) => {
      if (state.detectedOs === "mobile") {
        e.preventDefault();
        $("#mobile-notice")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  function initTheme() {
    const saved = localStorage.getItem("vibestart-theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.dataset.theme = saved;
    }
  }

  async function init() {
    initTheme();
    state.platform = defaultPlatform();
    bindEvents();
    await resolveMirror();
    await loadLatestRelease(activeMirror());
    updatePlatformUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
