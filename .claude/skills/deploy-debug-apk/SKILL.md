---
name: deploy-debug-apk
description: Build the mobile app and assemble a debug APK, then copy it to the user's Dropbox folder. Use when the user asks to build/deploy a debug APK, or asks to run the "Release: Build & Deploy Debug APK" VS Code task.
user-invocable: true
---

Mirrors the "Release: Build & Deploy Debug APK" task in `.vscode/tasks.json` (which chains "Build: All Packages" → "Build: Debug APK" → "Copy: Debug APK to Dropbox"). Run these steps in order from the repo root, stopping if any step fails:

1. **Build all packages** (repo root):
   ```
   pnpm build
   ```

2. **Build the mobile app, sync Capacitor, and assemble the debug APK** (`apps/mobile`, requires a Windows shell for `gradlew.bat`):
   ```
   pnpm build
   pnpm cap:sync
   cd android
   .\gradlew.bat assembleDebug
   ```

3. **Copy the APK to Dropbox**:
   ```
   xcopy /Y "<repo-root>\apps\mobile\android\app\build\outputs\apk\debug\*.apk" "%USERPROFILE%\Dropbox\"
   ```

After copying, confirm to the user which APK file landed in Dropbox (e.g. `app-debug.apk`).
