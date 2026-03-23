// Background service worker
// Receives reminder tasks from the content script, gets a Google OAuth token,
// and creates Google Calendar events via the official REST API.

// Requests a Google OAuth2 access token using the Chrome Identity API.
// On first call, Chrome shows a consent popup. On subsequent calls,
// it returns the cached token silently.
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

// Creates a Google Calendar event for the given reminder task.
// Schedules it to start 1 hour from now and last 30 minutes,
// since the WhatsApp message contains no date/time information.
async function createCalendarEvent(token, task) {
  const now = new Date();
  const start = new Date(now.getTime() + 60 * 60 * 1000);       // 1 hour from now
  const end   = new Date(now.getTime() + 60 * 60 * 1000 + 30 * 60 * 1000); // +30 min

  const event = {
    summary: task,
    description: "Created automatically from WhatsApp reminder.",
    start: { dateTime: start.toISOString() },
    end:   { dateTime: end.toISOString() },
  };

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Calendar API error ${response.status}: ${errorBody}`);
  }

  return response.json(); // Returns the created event object from Google.
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "REMINDER_DETECTED") return;

  const { task } = message;
  console.log("[WA→GCal] Background received reminder:", task);

  (async () => {
    try {
      const token = await getAuthToken();
      console.log("[WA→GCal] OAuth token obtained.");

      const event = await createCalendarEvent(token, task);
      console.log("[WA→GCal] Calendar event created:", event.htmlLink);

      sendResponse({ status: "created", eventLink: event.htmlLink });
    } catch (err) {
      console.error("[WA→GCal] Error:", err.message);
      sendResponse({ status: "error", error: err.message });
    }
  })();

  return true; // Keep message channel open for the async response.
});

console.log("[WA→GCal] Background service worker ready.");
