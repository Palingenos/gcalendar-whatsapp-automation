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

  const TRIGGER_PHRASE = "remind me to";
  const TARGET_CHAT = "you"; // The chat name to watch, lowercased for comparison.

  // Reads the active chat name from the page title.
  // WhatsApp Web sets document.title to "ChatName | WhatsApp" when a chat is open.
  // Returns the chat name in lowercase, or null if no chat is open.
  function getActiveChatName() {
    const parts = document.title.split("|");
    if (parts.length < 2) return null;
    return parts[0].trim().toLowerCase();
  }

  // Returns true only when the user is inside the target chat ("You").
  function isTargetChat() {
    return getActiveChatName() === TARGET_CHAT;
  }

  // Parses a message string and extracts the reminder task.
  // Returns the task string if the message matches, or null if it doesn't.
  // e.g. "Remind me to call John" → "call John"
  //      "Hey how are you"        → null
  function parseReminder(text) {
    const lower = text.toLowerCase();
    if (!lower.startsWith(TRIGGER_PHRASE)) return null;
    const task = text.slice(TRIGGER_PHRASE.length).trim();
    // Ignore the trigger phrase sent with nothing after it.
    if (!task) return null;
    return task;
  }

  // Persistent set of fingerprints for messages we've already processed.
  // Survives chat navigation because it lives in JS memory, not on DOM nodes.
  const processedMessages = new Set();

  // Builds a unique fingerprint for a message using its timestamp + text.
  // WhatsApp puts a data-pre-plain-text attribute (containing time + sender)
  // on an ancestor of .copyable-text — e.g. '[22:28, 22/03/2026] You: '.
  // Combining that with the message text gives a stable unique key.
  function getFingerprint(container, text) {
    let el = container;
    while (el) {
      if (el.dataset && el.dataset.prePlainText) {
        return el.dataset.prePlainText + text;
      }
      el = el.parentElement;
    }
    // Fallback: text alone (less precise, but still filters most duplicates).
    return text;
  }

  // Collects all .copyable-text elements from a node:
  // the node itself if it has the class, plus any descendants that do.
  function getCopyableContainers(node) {
    const results = [];
    if (node.classList && node.classList.contains("copyable-text")) {
      results.push(node);
    }
    if (node.querySelectorAll) {
      node.querySelectorAll(".copyable-text").forEach((el) => results.push(el));
    }
    return results;
  }

  // Starts watching for new messages by looking for .copyable-text elements
  // appearing anywhere in the DOM — either as the added node or inside it.
  function watchMessages() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          const containers = getCopyableContainers(node);
          for (const container of containers) {
            setTimeout(() => {
              const text = container.innerText.trim();
              if (!text) return;

              // Skip if we've already handled this exact message before.
              const fingerprint = getFingerprint(container, text);
              if (processedMessages.has(fingerprint)) return;
              processedMessages.add(fingerprint);

              // Ignore messages from any chat other than "You".
              if (!isTargetChat()) return;

              const task = parseReminder(text);
              if (!task) return;

              console.log("[WA→GCal] Reminder detected:", task);
            }, 0);
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log("[WA→GCal] MutationObserver active — watching for new messages.");
  }

  // Entry point — all further logic starts here.
  waitForApp(function () {
    watchMessages();
  });
})();
