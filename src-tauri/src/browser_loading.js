(function () {
  if (window.__vibestartBrowserLoader) return;
  window.__vibestartBrowserLoader = true;

  var progress = 0;
  var timer = null;

  var style = document.createElement("style");
  style.textContent =
    "#vibestart-top-bar{position:fixed;top:0;left:0;right:0;height:3px;z-index:2147483647;background:rgba(0,0,0,.06);pointer-events:none}" +
    "#vibestart-top-bar>span{display:block;height:100%;width:0;background:linear-gradient(90deg,#6366f1,#8b5cf6);transition:width .25s ease;box-shadow:0 0 8px rgba(99,102,241,.45)}" +
    "@media (prefers-color-scheme:dark){#vibestart-top-bar{background:rgba(255,255,255,.08)}}";
  (document.documentElement || document.head).appendChild(style);

  var barWrap = document.createElement("div");
  barWrap.id = "vibestart-top-bar";
  var bar = document.createElement("span");
  barWrap.appendChild(bar);

  function mount() {
    var root = document.documentElement || document.body;
    if (!root || document.getElementById("vibestart-top-bar")) return;
    root.appendChild(barWrap);
  }

  function setProgress(value) {
    progress = Math.min(100, Math.max(0, value));
    bar.style.width = progress + "%";
  }

  function finish() {
    if (timer) clearInterval(timer);
    setProgress(100);
    setTimeout(function () {
      barWrap.remove();
    }, 400);
  }

  mount();
  setProgress(8);
  timer = setInterval(function () {
    if (progress >= 88) return;
    setProgress(progress + Math.random() * 12);
  }, 280);

  document.addEventListener("readystatechange", function () {
    if (document.readyState === "interactive") setProgress(Math.max(progress, 72));
    if (document.readyState === "complete") finish();
  });

  window.addEventListener("load", finish);
  setTimeout(finish, 12000);
})();
