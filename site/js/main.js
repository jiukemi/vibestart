(function () {
  "use strict";

  const cfg = window.VIBESTART_RELEASE;
  if (!cfg) return;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const state = {
    platform: "mac-arm",
    mirror: "auto",
    resolvedMirror: "gitee",
    probing: true,
    detectedOs: "unknown",
  };

  const PLATFORM_LABELS = {
    "mac-arm": { icon: "🍎", label: "macOS", sub: "Apple Silicon (M 系列)" },
    "mac-intel": { icon: "🍎", label: "macOS", sub: "Intel 芯片" },
    win: { icon: "🪟", label: "Windows", sub: "Windows 10 / 11 x64" },
  };

  function buildUrl(mirror, platform) {
    const { tag, assets, github, gitee } = cfg;
    const file =
      platform === "mac-arm"
        ? assets.macArm
        : platform === "mac-intel"
          ? assets.macIntel
          : assets.win;

    if (mirror === "github") {
      return `https://github.com/${github.owner}/${github.repo}/releases/download/${tag}/${file}`;
    }
    return `https://gitee.com/${gitee.owner}/${gitee.repo}/releases/download/${tag}/${file}`;
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
      const gl =
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
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
      text.textContent = "正在检测最佳下载线路…";
      return;
    }

    const m = activeMirror();
    badge.dataset.state = m;
    if (m === "github") {
      const ms = state.githubLatency ? ` · ${state.githubLatency}ms` : "";
      text.textContent = `GitHub 国际线路${ms}`;
    } else {
      text.textContent = "Gitee 国内镜像";
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

    if (dlBtn) {
      dlBtn.href = buildUrl(activeMirror(), state.platform);
      dlBtn.setAttribute("download", "");
    }
    if (dlLabel) {
      dlLabel.textContent = `下载 ${info.label} 版`;
    }
    if (meta) {
      const mirrorName = activeMirror() === "github" ? "GitHub Releases" : "Gitee Releases";
      meta.textContent = `${info.sub} · ${cfg.version} · 来源 ${mirrorName}`;
    }

    $$(".mirror-chip").forEach((chip) => {
      chip.setAttribute("aria-pressed", chip.dataset.mirror === state.mirror ? "true" : "false");
    });

    const notice = $("#mobile-notice");
    if (notice) {
      notice.dataset.visible = state.detectedOs === "mobile" ? "true" : "false";
    }

    const detectHint = $("#detect-hint");
    if (detectHint) {
      if (state.detectedOs === "mobile") {
        detectHint.textContent = "检测到移动设备，请在 Mac 或 Windows 电脑上下载安装";
      } else if (state.detectedOs === "win") {
        detectHint.textContent = "已识别 Windows，已为你勾选 Windows 版";
      } else if (state.detectedOs === "mac") {
        detectHint.textContent = `已识别 macOS，已勾选 ${PLATFORM_LABELS[state.platform].sub}`;
      } else {
        detectHint.textContent = "未识别桌面系统，默认推荐 macOS Apple Silicon";
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
        updatePlatformUI();
      });
    });

    const themeBtn = $("#theme-toggle");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const html = document.documentElement;
        const current = html.dataset.theme;
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const next =
          current === "dark" || (!current && prefersDark) ? "light" : "dark";
        html.dataset.theme = next;
        localStorage.setItem("vibestart-theme", next);
      });
    }

    const copyBtn = $("#copy-link-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const url = buildUrl(activeMirror(), state.platform);
        try {
          await navigator.clipboard.writeText(url);
          copyBtn.textContent = "已复制链接";
          setTimeout(() => {
            copyBtn.textContent = "复制直链";
          }, 2000);
        } catch {
          copyBtn.textContent = "复制失败";
        }
      });
    }

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

  function initVersion() {
    const v = cfg.version;
    $$("[data-version]").forEach((el) => {
      el.textContent = v;
    });
  }

  /* Particle grid background */
  function initCanvas() {
    const canvas = $("#grid-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = 0;
    let h = 0;
    let mouse = { x: -9999, y: -9999 };
    const particles = [];
    const count = () => Math.min(80, Math.floor((w * h) / 18000));

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      particles.length = 0;
      const n = count();
      for (let i = 0; i < n; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
        });
      }
    }

    window.addEventListener("mousemove", (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });
    window.addEventListener("mouseleave", () => {
      mouse.x = -9999;
      mouse.y = -9999;
    });
    window.addEventListener("resize", resize);
    resize();

    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim();

    function loop() {
      ctx.clearRect(0, 0, w, h);
      const linkDist = 120;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 140) {
          p.x -= dx * 0.012;
          p.y -= dy * 0.012;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = accent || "#38bdf8";
        ctx.globalAlpha = 0.55;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < linkDist) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = accent || "#38bdf8";
            ctx.globalAlpha = (1 - d / linkDist) * 0.12;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(loop);
    }
    loop();
  }

  async function init() {
    initTheme();
    initVersion();
    state.platform = defaultPlatform();
    bindEvents();
    initCanvas();
    await resolveMirror();
    updatePlatformUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
