FOCUS LOCK — desktop agent
==========================

Focus Lock blocks entertainment/social websites in EVERY browser (system hosts file)
and closes blocklisted desktop apps while a session is running. Ending a session
early requires the 4 or 6 digit PIN you set beforehand.

RUNNING FROM SOURCE
-------------------
1. Install Node.js 18+.
2. In this folder run:   npm install electron --save-dev
3. Start it with elevated rights so it can edit the hosts file:
     macOS / Linux:  sudo npx electron .
     Windows:        open PowerShell as Administrator, then  npx electron .

RUNNING A PACKAGED BUILD
------------------------
   macOS / Linux:  sudo ./"Focus Lock"
   Windows:        right-click Focus Lock.exe -> Run as administrator

WHY ADMIN RIGHTS?
-----------------
Blocking sites for all browsers means editing the system hosts file
(/etc/hosts or C:\Windows\System32\drivers\etc\hosts). That file is
OS-protected, so the agent needs elevated permissions.

NOTES
-----
- Quitting the app does NOT unblock anything. The block is restored on relaunch
  if the session hasn't expired.
- The blocked lists and the PIN are stored locally on your machine only.
- Desktop app entries are process names (Discord, Steam, Spotify...). On Windows
  ".exe" is added automatically.
