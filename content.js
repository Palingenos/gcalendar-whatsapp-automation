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

  const TRIGGER_PHRASE = "remind me to"; // → creates a Google Task
  const TARGET_CHAT = "you"; // The chat name to watch, lowercased for comparison.

  // Any of these words followed by "at" at the start of a message → calendar event.
  // e.g. "Meeting at 3 pm", "Class at 9 am tomorrow", "Exam at 2 pm Friday"
  const EVENT_TRIGGER_WORDS = new Set([
    "meeting", "class", "exam", "appointment", "call",
    "dinner", "lunch", "interview", "session", "party",
    "seminar", "workout", "date", "event",
  ]);

  // Selectors to try when reading the active chat name, in order of preference.
  // Confirmed working: #main header span[dir="auto"] and header span[dir="auto"].
  // data-testid selectors kept as future-proofing in case WhatsApp re-adds them.
  const CHAT_NAME_SELECTORS = [
    '#main header span[dir="auto"]',
    'header span[dir="auto"]',
    '[data-testid="conversation-info-header-chat-title"]',
    '[data-testid="conversation-info-header"] span[dir="auto"]',
  ];

  // Reads the active chat name by trying each known selector in order.
  // Returns the first non-empty result, lowercased.
  function getActiveChatName() {
    for (const selector of CHAT_NAME_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && el.innerText.trim()) {
        return el.innerText.trim().toLowerCase();
      }
    }
    return null;
  }

  // Returns true only when the user is inside the target chat ("You").
  function isTargetChat() {
    return getActiveChatName() === TARGET_CHAT;
  }

  // Returns true if the message starts with "[trigger word] at".
  // e.g. "Meeting at 3pm", "Class at 9 am tomorrow", "Exam at 2 pm Friday"
  function isEventTrigger(lower) {
    const match = lower.match(/^(\w+)\s+at\s+/);
    return match ? EVENT_TRIGGER_WORDS.has(match[1]) : false;
  }

  // Parses a message and returns the text to send to the background, or null.
  // "Remind me to buy milk"       → "buy milk"                     (task)
  // "Meeting at 7 pm with mom"    → "Meeting at 7 pm with mom"     (event)
  // "Class at 9 am tomorrow"      → "Class at 9 am tomorrow"       (event)
  // "Hey how are you"             → null (ignored)
  function parseReminder(text) {
    const lower = text.toLowerCase();

    if (lower.startsWith(TRIGGER_PHRASE)) {
      const task = text.slice(TRIGGER_PHRASE.length).trim();
      return task || null;
    }

    if (isEventTrigger(lower)) {
      return text.trim() || null;
    }

    return null;
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

              // Hand off to the background service worker for Google Calendar.
              chrome.runtime.sendMessage(
                { type: "REMINDER_DETECTED", task },
                (response) => {
                  if (chrome.runtime.lastError) {
                    console.error("[WA→GCal] Failed to reach background:", chrome.runtime.lastError.message);
                    return;
                  }
                  console.log("[WA→GCal] Background acknowledged:", response?.status);
                }
              );
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
