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

  // Returns the text content of a message node, or null if none found.
  // WhatsApp renders message text in spans with data-lexical-text="true".
  // These are children of a paragraph with the class "copyable-text".
  function getMessageText(node) {
    // Collect all text spans and join — handles multi-span messages (e.g. with emoji).
    const spans = node.querySelectorAll("[data-lexical-text='true']");
    if (spans.length > 0) {
      return Array.from(spans)
        .map((s) => s.innerText)
        .join("")
        .trim();
    }
    return null;
  }

  // Checks whether a newly added DOM node is a WhatsApp message bubble.
  // WhatsApp renders message text inside elements with the class "copyable-text".
  function isMessageNode(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    // Direct match — the node itself is the copyable-text paragraph.
    if (node.classList && node.classList.contains("copyable-text")) return true;
    // Nested match — the node contains a copyable-text element inside it.
    return node.querySelector(".copyable-text") !== null;
  }

  // Starts watching the message list for newly added messages.
  function watchMessages() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!isMessageNode(node)) continue;

          const text = getMessageText(node);
          if (!text) continue;

          console.log("[WA→GCal] New message detected:", text);
          // Stages 4 and 5 will parse and filter this message.
        }
      }
    });

    // Watch the entire app for any DOM additions.
    // We narrow down to the active chat panel in Stage 5.
    observer.observe(document.body, { childList: true, subtree: true });
    console.log("[WA→GCal] MutationObserver active — watching for new messages.");
  }

  // Entry point — all further logic starts here.
  waitForApp(function () {
    watchMessages();
  });
})();
