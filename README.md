# Focus Lock

A desktop productivity tool that enforces distraction-free focus sessions by blocking entertainment and social websites across every browser (via system hosts file) and closing blocklisted desktop apps while a session is active.

## Features

- **System-wide Website Blocking:** Updates the system `hosts` file to block distracting domains across all browsers.
- **App Blocker:** Automatically terminates blocklisted desktop applications (e.g., Discord, Steam, Spotify) during active sessions.
- **PIN Protection:** Ending a session early requires a pre-set 4 or 6-digit PIN.
- **Persistence:** Quitting the app does not lift the block—blocks persist until the session timer expires or is unlocked with your PIN.
- **Privacy:** Blocklists and PINs remain stored locally on your device.

## Running from Source

1. Ensure **Node.js 18+** is installed.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Launch with elevated/administrator privileges (required for hosts file modification):
   - **Windows:** Open PowerShell as Administrator, then run:
     ```bash
     npx electron .
     ```
   - **macOS / Linux:**
     ```bash
     sudo npx electron .
     ```

## Why Administrator Rights?
Modifying system-wide network routing across all browsers requires updating `C:\Windows\System32\drivers\etc\hosts` (or `/etc/hosts` on Unix), which is protected by the operating system.
