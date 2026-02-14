# HIMS Android App (WebView)

This Android app uses your **existing mobile web UI** and your **current Laravel backend/database**.

## What this gives you

- Same design as your current mobile web view (POS, Delivery, Sales, Weigh, More)
- Same data and database (the app loads your live Laravel URL)
- Installable with Android Studio (`Run` to emulator/device)

## Project location

- `android-app/`

## Open in Android Studio

1. Open Android Studio.
2. Click `Open` and select the `android-app` folder.
3. Let Gradle sync complete.
4. Run on emulator or physical device.

## Configure backend URL

Edit `android-app/gradle.properties`:

```properties
WEB_BASE_URL=http://10.0.2.2:8000
```

Use one of these:

- Emulator + local Laravel: `http://10.0.2.2:8000`
- Physical phone on same Wi-Fi: `http://<your-pc-lan-ip>:8000` (example: `http://192.168.68.102:8000`)
- Production server: your HTTPS domain

Then rebuild the app.

## Laravel side requirements

- Your Laravel server must be reachable by the Android device.
- If using local dev, run Laravel on network-accessible host:

```bash
php artisan serve --host=0.0.0.0 --port=8000
```

- Keep your existing database config; Android app does not connect directly to DB.
  It uses the same backend endpoints, so it uses the same DB automatically.

## Implemented mobile app behavior

- JavaScript + DOM storage enabled
- Cookie/session support for login
- Pull-to-refresh
- File chooser support from web forms
- Android back button navigates web history first
- HTTP (cleartext) enabled for local LAN testing

## Main files

- `android-app/app/src/main/java/com/hims/mobile/MainActivity.kt`
- `android-app/app/src/main/AndroidManifest.xml`
- `android-app/app/build.gradle.kts`
- `android-app/gradle.properties`
