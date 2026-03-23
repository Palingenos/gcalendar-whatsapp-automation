Google calendar whatsapp script/extension (TBD)

Draft workflow so far

Supposed to be a google extension

Whatsapp web used (in chrome tab here)
Which then parses specific keywords according to message sent
Then sends data to Google Calendar API
Which then creates a Task/Event

Extension vs Node.js script

Node.js script requires QR scans, which usually resets always, I will test and see
if I don't need to have whatsapp.web open for Node.js, which would be a massive Pro.

Extension is more safer, since the Node.js uses unofficial API, extension doesn't need QR code open as well, just needs whatsapp.web and browser extension open and enabled.


You can always verify that the extension is working by opening Whatsapp Web, then opening Devtools Console (Cmd+Option+J for Mac or Ctrl + Shift + J for Windows), and check for [WA→GCal] loglines as seen in this image below!

<img width="357" height="72" alt="Image" src="https://github.com/user-attachments/assets/0d3ae7d5-3f71-4567-b910-bfb4621650bb" />