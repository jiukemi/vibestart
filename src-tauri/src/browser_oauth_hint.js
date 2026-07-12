(function () {
  if (window.__vibestartOAuthHint) return;
  window.__vibestartOAuthHint = true;

  var style = document.createElement("style");
  style.textContent =
    "#vibestart-oauth-hint{position:fixed;bottom:12px;left:12px;right:12px;z-index:2147483645;padding:10px 14px;border-radius:10px;border:1px solid rgba(99,102,241,.35);background:rgba(255,255,255,.96);color:#18181b;font:12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.08)}" +
    "@media (prefers-color-scheme:dark){#vibestart-oauth-hint{background:rgba(24,24,27,.96);color:#fafafa;border-color:rgba(99,102,241,.45)}}" +
    "#vibestart-oauth-hint strong{font-weight:600}";
  (document.documentElement || document.head).appendChild(style);

  function mount() {
    if (document.getElementById("vibestart-oauth-hint")) return;
    var bar = document.createElement("div");
    bar.id = "vibestart-oauth-hint";
    bar.innerHTML =
      "<strong>应用内预览</strong> · 若页面空白或无法登录，请点工具栏 <strong>×</strong> 或按 Esc 关闭，在 VibeStart 中改用「系统浏览器打开」。";
    (document.documentElement || document.body).appendChild(bar);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
