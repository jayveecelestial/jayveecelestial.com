// Picks the layout before the first paint, so the game view doesn't paint as the
// plain CV first and then jump. Loaded as a render-blocking file in <head>; the CSP
// allows no inline scripts. Mirrors resolveMode in src/game/state.ts. If the game
// can't start after all, boot.ts removes the class again, or the load check below
// does if boot.ts never ran, and the plain CV shows.
(function () {
  try {
    var view = new URLSearchParams(location.search).get("view");
    var stored = null;
    try {
      stored = localStorage.getItem("ng-mode");
    } catch (e) {
      /* storage blocked: default mode */
    }
    var mode = view === "plain" || view === "play" ? view : stored === "plain" ? "plain" : "play";
    var canvas = document.createElement("canvas");
    if (mode === "play" && canvas.getContext && canvas.getContext("2d")) {
      document.documentElement.classList.add("game");
      // The load event comes after module scripts have run. If boot.ts never finished
      // (script blocked, failed to download, or threw), show the plain CV instead of a
      // blank stage.
      window.addEventListener("load", function () {
        var root = document.documentElement;
        if (!root.hasAttribute("data-booted")) root.classList.remove("game");
      });
    }
  } catch (e) {
    /* leave the plain layout */
  }
})();
