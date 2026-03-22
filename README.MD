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


