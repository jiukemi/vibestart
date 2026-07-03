(function () {
  if (window.__vibestartLinkHandler) return;
  window.__vibestartLinkHandler = true;

  var withApp = __VIBESTART_BROWSER_WITH__;
  var forceInApp = __VIBESTART_FORCE_IN_APP__;
  var inAppPreferred = __VIBESTART_IN_APP_PREFERRED__;

  function hostOf(href) {
    try {
      return new URL(href).hostname.toLowerCase();
    } catch (e) {
      return "";
    }
  }

  function shouldStayInApp(href) {
    if (!forceInApp || !href) return false;
    var host = hostOf(href);
    if (!host) return false;
    for (var i = 0; i < inAppPreferred.length; i++) {
      var h = inAppPreferred[i];
      if (host === h || host.endsWith("." + h)) return true;
    }
    return false;
  }

  function openExternal(url) {
    if (!url) return;
    var href = String(url);
    if (!/^(https?:|mailto:|tel:)/i.test(href)) return;
    if (shouldStayInApp(href)) {
      if (window.__vibestartBrowserChrome && window.__vibestartBrowserChrome.openTab) {
        window.__vibestartBrowserChrome.openTab(href);
      } else {
        window.location.href = href;
      }
      return;
    }
    var payload = { url: href };
    if (withApp) payload.with = withApp;
    if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
      window.__TAURI_INTERNALS__
        .invoke("plugin:opener|open_url", payload)
        .catch(function () {
          window.location.href = href;
        });
      return;
    }
    window.location.href = href;
  }

  var originalOpen = window.open;
  window.open = function (url, target, features) {
    if (url) {
      openExternal(url);
      return null;
    }
    return originalOpen ? originalOpen.call(window, url, target, features) : null;
  };

  document.addEventListener(
    "click",
    function (e) {
      if (e.defaultPrevented) return;
      var node = e.target;
      if (!node || !node.closest) return;
      var anchor = node.closest("a");
      if (!anchor || !anchor.href) return;
      var target = (anchor.target || "").toLowerCase();
      var newTab =
        target === "_blank" ||
        target === "_new" ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey;
      if (!newTab && !forceInApp) return;
      if (!newTab && forceInApp && shouldStayInApp(anchor.href)) {
        return;
      }
      if (!newTab) return;
      if (!/^(https?:|mailto:|tel:)/i.test(anchor.href)) return;
      e.preventDefault();
      e.stopPropagation();
      openExternal(anchor.href);
    },
    true,
  );
})();
