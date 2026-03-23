// Background service worker
// Receives reminder tasks from content script, normalizes them,
// then creates a Google Task or Calendar event via the official APIs.

// ─── OAuth ────────────────────────────────────────────────────────────────────

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

// ─── Classification ───────────────────────────────────────────────────────────

// Phrases that imply a time-blocked calendar event rather than a to-do task.
const EVENT_KEYWORDS = [
  "schedule", "book", "meeting", "appointment", "call", "class",
  "dinner", "lunch", "interview", "session",
];

// "remind me to" → task by default.
// Override to event if the text clearly describes a time-blocked activity.
function classifyType(text) {
  const lower = text.toLowerCase();
  for (const kw of EVENT_KEYWORDS) {
    if (lower.includes(kw)) return "event";
  }
  return "task";
}

// ─── Color / Category ────────────────────────────────────────────────────────

// Google Calendar colorId values.
const CALENDAR_COLOR_IDS = {
  red: "11", orange: "6", yellow: "5",
  green: "10", blue: "9", purple: "3", gray: "8",
};

const CATEGORY_RULES = [
  { color: "red",    keywords: ["urgent", "asap", "deadline", "exam", "final", "bill", "tax", "rent", "due"] },
  { color: "orange", keywords: ["doctor", "dentist", "workout", "gym", "medicine", "meds", "medication", "therapy", "health"] },
  { color: "yellow", keywords: ["groceries", "grocery", "laundry", "cleaning", "clean", "errand", "pickup", "buy", "shop"] },
  { color: "green",  keywords: ["study", "homework", "assignment", "coding", "code", "project", "school", "learn"] },
  { color: "blue",   keywords: ["meeting", "call", "dinner", "lunch", "coffee", "hangout", "friend", "mom", "dad", "family"] },
  { color: "purple", keywords: ["read", "journal", "meditate", "reflect", "hobby", "book"] },
];

function classifyColor(text) {
  const lower = text.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) return rule.color;
    }
  }
  return "gray";
}

// ─── Title normalization ──────────────────────────────────────────────────────

// Strips date/time phrases from the task text so the title stays clean.
// e.g. "say good morning to riva in 2 days" → "Say good morning to riva"
function normalizeTitle(task) {
  let title = task
    .replace(/\s+in\s+\d+\s+days?\b/gi, "")
    .replace(/\b(tomorrow|today|tonight|this weekend|next week)\b/gi, "")
    .replace(/\b(on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, "")
    .replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, "")
    .replace(/\b(morning|afternoon|evening)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return title.charAt(0).toUpperCase() + title.slice(1);
}

// ─── Date / Time extraction ───────────────────────────────────────────────────

function getNextWeekday(targetDayIndex) {
  const now = new Date();
  let daysUntil = targetDayIndex - now.getDay();
  if (daysUntil <= 0) daysUntil += 7;
  const result = new Date(now);
  result.setDate(now.getDate() + daysUntil);
  return result;
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// Returns { date: Date|null, hour: number|null, minute: number }
function extractDateTime(text) {
  const lower = text.toLowerCase();
  let date = null;
  let hour = null;
  let minute = 0;

  // ── Day extraction ──
  if (/\btonight\b/.test(lower)) {
    date = new Date(); hour = 20;
  } else if (/\btoday\b/.test(lower)) {
    date = new Date();
  } else if (/\btomorrow\b/.test(lower)) {
    date = new Date(); date.setDate(date.getDate() + 1);
  } else if (/\bthis weekend\b/.test(lower)) {
    date = getNextWeekday(6); hour = 10;
  } else if (/\bnext week\b/.test(lower)) {
    date = getNextWeekday(1); hour = 9;
  } else {
    const inDays = lower.match(/\bin\s+(\d+)\s+days?\b/);
    if (inDays) {
      date = new Date(); date.setDate(date.getDate() + parseInt(inDays[1]));
    } else {
      for (let i = 0; i < DAY_NAMES.length; i++) {
        if (lower.includes(DAY_NAMES[i])) { date = getNextWeekday(i); break; }
      }
    }
  }

  // ── Time-of-day words ──
  if (/\bmorning\b/.test(lower))   { hour = 9;  minute = 0; }
  if (/\bafternoon\b/.test(lower)) { hour = 14; minute = 0; }
  if (/\bevening\b/.test(lower))   { hour = 18; minute = 0; }

  // ── Explicit time: "at 3", "at 3:30", "at 7 pm" ──
  const timeMatch = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (timeMatch) {
    hour   = parseInt(timeMatch[1]);
    minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    if (timeMatch[3] === "pm" && hour < 12) hour += 12;
    if (timeMatch[3] === "am" && hour === 12) hour = 0;
  }

  return { date, hour, minute };
}

// ─── Normalization pipeline ───────────────────────────────────────────────────

// Produces a fully resolved, ready-to-create object from raw task text.
function buildNormalized(rawTask) {
  const type  = classifyType(rawTask);
  const title = normalizeTitle(rawTask);
  const color = classifyColor(rawTask);
  const { date, hour, minute } = extractDateTime(rawTask);

  const now = new Date();
  let finalDate = date ? new Date(date) : null;
  let finalHour = hour;
  let finalMinute = minute;

  // Apply time defaults.
  if (finalHour === null) {
    if (finalDate) {
      // Date given, no time → 9:00 AM.
      finalHour = 9; finalMinute = 0;
    } else {
      // No date, no time → today at 6 PM if not passed, else tomorrow at 9 AM.
      const sixPM = new Date(now);
      sixPM.setHours(18, 0, 0, 0);
      finalDate = new Date(now);
      if (now < sixPM) {
        finalHour = 18; finalMinute = 0;
      } else {
        finalDate.setDate(finalDate.getDate() + 1);
        finalHour = 9; finalMinute = 0;
      }
    }
  }

  finalDate.setHours(finalHour, finalMinute, 0, 0);

  // If the resolved time is already in the past, push to the next day.
  if (finalDate <= now) {
    finalDate.setDate(finalDate.getDate() + 1);
  }

  // Default event duration: 60 min (30 min for call-like items).
  const isCall = /\bcall\b/.test(rawTask.toLowerCase());
  const durationMinutes = type === "event" ? (isCall ? 30 : 60) : null;

  console.log("[WA→GCal] Normalized:", { type, title, date: finalDate.toISOString(), color, durationMinutes });
  return { type, title, date: finalDate, color, durationMinutes, rawTask };
}

// ─── Google Tasks API ─────────────────────────────────────────────────────────

async function createTask(token, normalized) {
  const body = {
    title: normalized.title,
    notes: `Original reminder: "${normalized.rawTask}"`,
    // Tasks API uses RFC 3339 for the due field; only the date portion matters.
    due: normalized.date.toISOString(),
  };

  const response = await fetch(
    "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error(`Tasks API error ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

// ─── Google Calendar API ──────────────────────────────────────────────────────

async function createCalendarEvent(token, normalized) {
  const start = normalized.date;
  const end   = new Date(start.getTime() + normalized.durationMinutes * 60 * 1000);
  const tz    = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const event = {
    summary: normalized.title,
    description: `Original reminder: "${normalized.rawTask}"`,
    colorId: CALENDAR_COLOR_IDS[normalized.color] || "8",
    start: { dateTime: start.toISOString(), timeZone: tz },
    end:   { dateTime: end.toISOString(),   timeZone: tz },
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
    throw new Error(`Calendar API error ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "REMINDER_DETECTED") return;

  const { task } = message;
  console.log("[WA→GCal] Received:", task);

  (async () => {
    try {
      const token      = await getAuthToken();
      const normalized = buildNormalized(task);

      let result;
      if (normalized.type === "task") {
        result = await createTask(token, normalized);
        console.log("[WA→GCal] Task created:", normalized.title);
        sendResponse({ status: "created", kind: "task", title: normalized.title });
      } else {
        result = await createCalendarEvent(token, normalized);
        console.log("[WA→GCal] Event created:", result.htmlLink);
        sendResponse({ status: "created", kind: "event", title: normalized.title, link: result.htmlLink });
      }
    } catch (err) {
      console.error("[WA→GCal] Error:", err.message);
      sendResponse({ status: "error", error: err.message });
    }
  })();

  return true;
});

console.log("[WA→GCal] Background service worker ready.");
