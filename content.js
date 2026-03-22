// Content script — injected into https://web.whatsapp.com
// Runs after the page DOM is ready (run_at: document_idle in manifest).

(function () {
  "use strict";

  console.log("[WA→GCal] Content script loaded on WhatsApp Web.");

  // WhatsApp Web is a React SPA — the chat UI renders after the initial HTML.
  // We wait for the main app container to appear before doing anything.
  function waitForApp(callback) {
    const appSelector = "#app";
    const app = document.querySelector(appSelector);

    if (app) {
      console.log("[WA→GCal] WhatsApp app container found. Ready.");
      callback(app);
      return;
    }

    // If not ready yet, observe the document until it appears.
    const observer = new MutationObserver(() => {
      const app = document.querySelector(appSelector);
      if (app) {
        observer.disconnect();
        console.log("[WA→GCal] WhatsApp app container found after wait. Ready.");
        callback(app);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Entry point — all further logic starts here.
  waitForApp(function (app) {
    // Stages 3–5 will add message watching logic here.
    console.log("[WA→GCal] Watching for messages...");
  });
})();
