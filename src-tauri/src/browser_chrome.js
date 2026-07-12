(function () {
  if (window.__vibestartBrowserChrome) return;

  var TOOLBAR_H = 76;

  var state = {
    tabs: [{ id: 1, url: location.href, title: document.title || "新标签页" }],
    activeId: 1,
    nextId: 2,
  };

  function invoke(cmd, payload) {
    if (!window.__TAURI_INTERNALS__ || !window.__TAURI_INTERNALS__.invoke) {
      return Promise.resolve(null);
    }
    return window.__TAURI_INTERNALS__.invoke(cmd, payload || {});
  }

  function applyRustState(rustState) {
    if (!rustState || !rustState.tabs || !rustState.tabs.length) return;
    state.tabs = rustState.tabs.map(function (t) {
      return { id: t.id, url: t.url, title: t.title || "新标签页" };
    });
    state.activeId = rustState.active_id || rustState.tabs[0].id;
    state.nextId = rustState.next_id || state.nextId;
  }

  function persistState() {
    return invoke("browser_tabs_save", {
      tabs: state.tabs,
      active_id: state.activeId,
      next_id: state.nextId,
    }).catch(function () {});
  }

  function loadStateFromRust() {
    return invoke("browser_tabs_get").then(function (rustState) {
      applyRustState(rustState);
      syncActiveTabFromPage();
    });
  }

  var style = document.createElement("style");
  style.textContent =
    "#vibestart-browser-chrome{position:fixed;top:0;left:0;right:0;z-index:2147483646;height:" +
    TOOLBAR_H +
    "px;display:flex;flex-direction:column;border-bottom:1px solid rgba(0,0,0,.08);background:#fafafa;font:12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.06)}" +
    "@media (prefers-color-scheme:dark){#vibestart-browser-chrome{background:#18181b;border-bottom-color:rgba(255,255,255,.1);box-shadow:0 1px 4px rgba(0,0,0,.35)}}" +
    "#vibestart-browser-chrome .vs-nav{display:flex;align-items:center;gap:4px;padding:6px 8px 0}" +
    "#vibestart-browser-chrome .vs-btn{border:1px solid rgba(0,0,0,.12);background:#fff;color:#18181b;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px;min-width:28px}" +
    "#vibestart-browser-chrome .vs-btn:disabled{opacity:.4;cursor:not-allowed}" +
    "@media (prefers-color-scheme:dark){#vibestart-browser-chrome .vs-btn{background:#27272a;border-color:rgba(255,255,255,.12);color:#fafafa}}" +
    "#vibestart-browser-chrome .vs-btn:hover:not(:disabled){background:#f4f4f5}" +
    "@media (prefers-color-scheme:dark){#vibestart-browser-chrome .vs-btn:hover:not(:disabled){background:#3f3f46}}" +
    "#vibestart-browser-chrome .vs-url{flex:1;min-width:0;border:1px solid rgba(0,0,0,.1);border-radius:6px;padding:4px 8px;background:#fff;color:#52525b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}" +
    "@media (prefers-color-scheme:dark){#vibestart-browser-chrome .vs-url{background:#09090b;border-color:rgba(255,255,255,.1);color:#a1a1aa}}" +
    "#vibestart-browser-chrome .vs-tabs{display:flex;align-items:flex-end;gap:2px;padding:4px 8px 0;overflow-x:auto;scrollbar-width:thin}" +
    "#vibestart-browser-chrome .vs-tab{display:flex;align-items:center;gap:4px;max-width:180px;border:1px solid transparent;border-bottom:none;border-radius:8px 8px 0 0;padding:4px 8px;cursor:pointer;background:transparent;color:#71717a;white-space:nowrap}" +
    "#vibestart-browser-chrome .vs-tab.active{background:#fff;border-color:rgba(0,0,0,.1);color:#18181b;font-weight:500}" +
    "@media (prefers-color-scheme:dark){#vibestart-browser-chrome .vs-tab.active{background:#27272a;border-color:rgba(255,255,255,.12);color:#fafafa}}" +
    "#vibestart-browser-chrome .vs-tab-label{overflow:hidden;text-overflow:ellipsis;max-width:120px}" +
    "#vibestart-browser-chrome .vs-tab-close{border:none;background:transparent;color:inherit;cursor:pointer;padding:0 2px;font-size:14px;line-height:1;opacity:.6}" +
    "#vibestart-browser-chrome .vs-tab-close:hover{opacity:1}" +
    "html.vibestart-chrome-padding{padding-top:" +
    TOOLBAR_H +
    "px !important}" +
    "#vibestart-top-bar{top:" +
    TOOLBAR_H +
    "px !important;height:3px !important}";
  (document.documentElement || document.head).appendChild(style);
  document.documentElement.classList.add("vibestart-chrome-padding");

  var root = document.createElement("div");
  root.id = "vibestart-browser-chrome";

  var tabsRow = document.createElement("div");
  tabsRow.className = "vs-tabs";

  var navRow = document.createElement("div");
  navRow.className = "vs-nav";

  var btnBack = document.createElement("button");
  btnBack.className = "vs-btn";
  btnBack.type = "button";
  btnBack.title = "后退";
  btnBack.textContent = "←";

  var btnForward = document.createElement("button");
  btnForward.className = "vs-btn";
  btnForward.type = "button";
  btnForward.title = "前进";
  btnForward.textContent = "→";

  var btnReload = document.createElement("button");
  btnReload.className = "vs-btn";
  btnReload.type = "button";
  btnReload.title = "刷新";
  btnReload.textContent = "↻";

  var btnNewTab = document.createElement("button");
  btnNewTab.className = "vs-btn";
  btnNewTab.type = "button";
  btnNewTab.title = "新标签页";
  btnNewTab.textContent = "+";

  var btnCloseWindow = document.createElement("button");
  btnCloseWindow.className = "vs-btn";
  btnCloseWindow.type = "button";
  btnCloseWindow.title = "关闭窗口 (Esc)";
  btnCloseWindow.textContent = "×";

  var urlBar = document.createElement("div");
  urlBar.className = "vs-url";

  navRow.appendChild(btnBack);
  navRow.appendChild(btnForward);
  navRow.appendChild(btnReload);
  navRow.appendChild(urlBar);
  navRow.appendChild(btnNewTab);
  navRow.appendChild(btnCloseWindow);

  root.appendChild(tabsRow);
  root.appendChild(navRow);

  function mount() {
    var parent = document.documentElement || document.body;
    if (!parent || document.getElementById("vibestart-browser-chrome")) return;
    parent.insertBefore(root, parent.firstChild);
  }

  function activeTab() {
    for (var i = 0; i < state.tabs.length; i++) {
      if (state.tabs[i].id === state.activeId) return state.tabs[i];
    }
    return state.tabs[0];
  }

  function syncActiveTabFromPage() {
    var tab = activeTab();
    if (!tab) return;
    tab.url = location.href;
    tab.title = document.title || tab.title || "新标签页";
  }

  function renderTabs() {
    tabsRow.innerHTML = "";
    state.tabs.forEach(function (tab) {
      var el = document.createElement("div");
      el.className = "vs-tab" + (tab.id === state.activeId ? " active" : "");
      el.title = tab.url;

      var label = document.createElement("span");
      label.className = "vs-tab-label";
      label.textContent = tab.title || "新标签页";

      var close = document.createElement("button");
      close.className = "vs-tab-close";
      close.type = "button";
      close.textContent = "×";
      close.title = "关闭标签页";
      close.addEventListener("click", function (e) {
        e.stopPropagation();
        closeTab(tab.id);
      });

      el.appendChild(label);
      el.appendChild(close);
      el.addEventListener("click", function () {
        switchTab(tab.id);
      });
      tabsRow.appendChild(el);
    });

    var tab = activeTab();
    urlBar.textContent = tab ? tab.url : "";
    updateNavButtons();
  }

  function updateNavButtons() {
    btnBack.disabled = false;
    btnForward.disabled = false;
  }

  function saveActiveTabFromPage() {
    var tab = activeTab();
    if (!tab) return;
    tab.url = location.href;
    tab.title = document.title || tab.title || "新标签页";
  }

  function switchTab(id) {
    if (id === state.activeId) return;
    saveActiveTabFromPage();
    var tab = null;
    for (var i = 0; i < state.tabs.length; i++) {
      if (state.tabs[i].id === id) tab = state.tabs[i];
    }
    if (!tab) return;
    state.activeId = id;
    renderTabs();
    persistState().then(function () {
      location.assign(tab.url);
    });
  }

  function openTab(url, title) {
    saveActiveTabFromPage();
    var id = state.nextId++;
    state.tabs.push({
      id: id,
      url: url,
      title: title || "新标签页",
    });
    state.activeId = id;
    renderTabs();
    persistState().then(function () {
      location.assign(url);
    });
  }

  function closeWindow() {
    invoke("browser_close_shell")
      .catch(function () {
        if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.window) {
          return window.__TAURI_INTERNALS__.window.close();
        }
      })
      .catch(function () {});
  }

  function closeTab(id) {
    if (state.tabs.length <= 1) {
      closeWindow();
      return;
    }
    var idx = -1;
    for (var i = 0; i < state.tabs.length; i++) {
      if (state.tabs[i].id === id) idx = i;
    }
    if (idx < 0) return;
    var wasActive = state.activeId === id;
    state.tabs.splice(idx, 1);
    if (wasActive) {
      var next = state.tabs[Math.min(idx, state.tabs.length - 1)];
      state.activeId = next.id;
      renderTabs();
      persistState().then(function () {
        location.assign(next.url);
      });
    } else {
      renderTabs();
      persistState();
    }
  }

  function openUrl(url, title, opts) {
    opts = opts || {};
    saveActiveTabFromPage();
    var existing = null;
    for (var i = 0; i < state.tabs.length; i++) {
      if (state.tabs[i].url === url) existing = state.tabs[i];
    }
    if (existing && !opts.newTab) {
      state.activeId = existing.id;
      if (title) existing.title = title;
      renderTabs();
      persistState().then(function () {
        if (location.href !== url) location.assign(url);
      });
      return;
    }
    if (opts.newTab) {
      openTab(url, title);
      return;
    }
    var tab = activeTab();
    if (tab) {
      tab.url = url;
      if (title) tab.title = title;
    }
    state.activeId = tab ? tab.id : state.activeId;
    renderTabs();
    persistState().then(function () {
      if (location.href !== url) location.assign(url);
    });
  }

  btnBack.addEventListener("click", function () {
    history.back();
  });
  btnForward.addEventListener("click", function () {
    history.forward();
  });
  btnReload.addEventListener("click", function () {
    location.reload();
  });
  btnNewTab.addEventListener("click", function () {
    var tab = activeTab();
    var base = "about:blank";
    if (tab && tab.url) {
      try {
        var u = new URL(tab.url);
        base = u.origin + "/";
      } catch (e) {}
    }
    openTab(base, "新标签页");
  });

  btnCloseWindow.addEventListener("click", function () {
    closeWindow();
  });

  window.addEventListener("popstate", function () {
    saveActiveTabFromPage();
    renderTabs();
    persistState();
  });

  window.addEventListener("load", function () {
    saveActiveTabFromPage();
    renderTabs();
    persistState();
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      saveActiveTabFromPage();
      renderTabs();
      persistState();
    }
  });

  document.addEventListener("keydown", function (e) {
    var mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === "t") {
      e.preventDefault();
      btnNewTab.click();
    }
    if (mod && e.key === "w") {
      e.preventDefault();
      closeTab(state.activeId);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeWindow();
    }
    if (e.altKey && e.key === "ArrowLeft") {
      e.preventDefault();
      history.back();
    }
    if (e.altKey && e.key === "ArrowRight") {
      e.preventDefault();
      history.forward();
    }
  });

  window.__vibestartBrowserChrome = {
    openUrl: openUrl,
    openTab: openTab,
    switchTab: switchTab,
    closeTab: closeTab,
    back: function () {
      history.back();
    },
    forward: function () {
      history.forward();
    },
    reload: function () {
      location.reload();
    },
  };

  loadStateFromRust().finally(function () {
    mount();
    renderTabs();
  });
})();
