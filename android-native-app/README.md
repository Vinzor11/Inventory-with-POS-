# HIMS Native Android App (Jetpack Compose)

This is a **true native Android app** (not WebView) that mirrors your current mobile web layout and uses the same Laravel backend/database through API calls.

## Project path

- `android-native-app/`

## Features included

- Native Jetpack Compose UI for:
  - POS
  - Delivery
  - Sales
  - Weigh
  - More
- Same mobile design direction:
  - Top search panel + filter icon
  - Rounded cards
  - Bottom nav with raised center Sales button
  - Sales/Delivery expandable cards
- API login with Sanctum token
- Data loaded from your existing endpoints:
  - `/api/auth/login`
  - `/api/pos/products`
  - `/api/sales`
  - `/api/deliveries`
  - `/api/weigh-ins`

## Configure backend URL

Edit `android-native-app/gradle.properties`:

```properties
API_BASE_URL=http://10.0.2.2:8000/
```

Use:

- Emulator + local Laravel: `http://10.0.2.2:8000/`
- Real Android device on same LAN: `http://<pc-lan-ip>:8000/`
- Production: your HTTPS domain

## Open in Android Studio

1. Open Android Studio.
2. Open folder: `android-native-app`.
3. Wait for Gradle sync.
4. Run on emulator or phone.

## Backend requirements

- Laravel app must be reachable from the Android device.
- For LAN testing:

```bash
php artisan serve --host=0.0.0.0 --port=8000
```

- Keep your current DB config in Laravel.  
  The native app uses your existing backend API, so it uses the same database.
