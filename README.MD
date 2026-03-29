# WhatsApp Reminder → Google Calendar

A Chrome extension that watches a WhatsApp Web chat called **"You"** (your self-chat) for reminder messages and automatically creates Google Calendar events or Google Tasks.

You can verify the extension is working by opening WhatsApp Web, then opening DevTools Console (Cmd+Option+J on Mac, Ctrl+Shift+J on Windows) and checking for `[WA→GCal]` log lines.

<img width="357" height="72" alt="Image" src="https://github.com/user-attachments/assets/0d3ae7d5-3f71-4567-b910-bfb4621650bb" />

---

## How it works

Send a message to yourself in the **"You"** WhatsApp chat using one of the trigger phrases below. The extension detects it and creates the corresponding item in Google Calendar or Google Tasks.

### Trigger phrases

| Phrase | Creates |
|--------|---------|
| `Remind me to [task]` | Google Task |
| `Meeting at [time]` | Google Calendar event |
| `Class at [time]` | Google Calendar event |
| `Exam at [time]` | Google Calendar event |
| `Dinner at [time]` | Google Calendar event |
| `Call at [time]` | Google Calendar event |
| *(any of: appointment, lunch, interview, session, party, seminar, workout, date, event)* `at [time]` | Google Calendar event |

### Time expressions supported

- `tomorrow`, `today`, `tonight`
- `day after tomorrow`
- `this weekend` → Saturday 10:00 AM
- `next week` → Monday 9:00 AM
- `monday` / `friday` / etc. → nearest upcoming occurrence
- `next monday` / `next friday` / etc. → the week after the nearest
- `in 2 days`, `in 5 days`
- `morning` (9 AM), `afternoon` (2 PM), `evening` (6 PM)
- `at 3 pm`, `at 7:30`, `at 14:00`

### Color tagging

Add a color word at the end of any message to set the task/event color:

```
Remind me to study for exam tomorrow green
Meeting at 3 pm with Sarah blue
Remind me to pay rent friday red
```

**Supported colors:** `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `gray`

Any other color word (e.g. `pink`, `teal`) defaults to **purple**.

If no color is specified, one is assigned automatically based on keywords:

| Color | Keywords |
|-------|----------|
| Red | urgent, deadline, exam, bill, tax, rent |
| Orange | doctor, dentist, workout, gym, medicine, therapy |
| Yellow | groceries, laundry, cleaning, errands, buy, shop |
| Green | study, homework, assignment, coding, school |
| Blue | meeting, call, dinner, lunch, friend, family |
| Purple | read, journal, meditate, hobby *(also the default)* |

### Default times

| Situation | Default |
|-----------|---------|
| Date given, no time | 9:00 AM |
| No date, no time (before 6 PM) | Today at 6:00 PM |
| No date, no time (after 6 PM) | Tomorrow at 9:00 AM |
| Event with no duration | 1 hour (30 min for calls) |

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

### 2. Set up a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (name it anything)
3. Go to **APIs & Services → Library** and enable both:
   - **Google Calendar API**
   - **Google Tasks API**

### 3. Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External**
3. Fill in the app name (anything) and your email
4. Under **Test users**, add your own Google account
5. Save

### 4. Load the extension in Chrome (to get your Extension ID)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** and select the project folder
4. Copy the **Extension ID** shown (you need this in the next step)

### 5. Create an OAuth Client ID

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Chrome Extension**
4. Paste your Extension ID from Step 4
5. Copy the generated **Client ID** (looks like `xxxxxxxxxxxx.apps.googleusercontent.com`)

### 6. Create your manifest.json

Copy the template and fill in your Client ID:

```bash
cp manifest.template.json manifest.json
```

Open `manifest.json` and replace:
```
YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com
```
with your actual Client ID, then reload the extension in `chrome://extensions`.

### 7. Test it

1. Open [web.whatsapp.com](https://web.whatsapp.com)
2. Go to your **"You"** self-chat
3. Send: `Remind me to buy milk`
4. The first time, Chrome will ask you to sign in with Google — allow it
5. Check Google Tasks — a task called "Buy milk" should appear

---

## Security notes

- `manifest.json` is listed in `.gitignore` — your Client ID is never committed to the repo
- No API keys or secrets are stored anywhere in the code
- Authentication uses Chrome's built-in `chrome.identity` API — your Google token is managed by Chrome, not the extension
- The extension only activates on `web.whatsapp.com` and only reads messages from the "You" chat

---

## Project structure

```
├── manifest.template.json   # Commit-safe template (placeholder client ID)
├── manifest.json            # Your local config — gitignored, never committed
├── content.js               # Injected into WhatsApp Web, detects messages
├── background.js            # Service worker, handles OAuth + API calls
├── popup.html / .js / .css  # Extension popup UI
└── .gitignore
```
