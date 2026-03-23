// Background service worker
// Receives reminder tasks from the content script, gets a Google OAuth token,
// and will create Google Calendar events (API call added in Stage 8).

// Requests a Google OAuth2 access token using the Chrome Identity API.
// On first call, Chrome shows a consent popup. On subsequent calls,
// it returns the cached token silently.
// Returns the token string, or throws if auth fails.
function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(token);
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "REMINDER_DETECTED") return;

  const { task } = message;
  console.log("[WA→GCal] Background received reminder:", task);

  // Run async work inside the listener — must return true to keep channel open.
  (async () => {
    try {
      const token = await getAuthToken();
      console.log("[WA→GCal] OAuth token obtained successfully.");

      // Stage 8 will use this token to call the Google Calendar API.
      sendResponse({ status: "authenticated", task });
    } catch (err) {
      console.error("[WA→GCal] OAuth failed:", err.message);
      sendResponse({ status: "auth_error", error: err.message });
    }
  })();

  return true; // Keep message channel open for the async response.
});

console.log("[WA→GCal] Background service worker ready.");
