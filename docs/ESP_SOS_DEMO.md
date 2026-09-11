# Offline SOS via ESP32 gateway — demo runbook

A single-node offline relay: the phone joins the ESP32's own WiFi hotspot
(no internet on it) and sends an SOS through it. The ESP32 is *also* joined
to your real WiFi and relays the SOS straight to the backend's existing
`POST /sos`, carrying the phone's own login — so it lands on the dashboard
exactly like a normal citizen SOS.

This is a **single-hop relay, not a multi-hop ESP-NOW mesh** — there's only
one board. Say so if judges ask "is this ESP-NOW?": it's an offline WiFi
gateway today; a second board would let it hop over ESP-NOW to a base
station instead, with no change to the phone side or the backend.

## What's involved

- `android/esp_Saarthi.ino` — the ESP32 firmware.
- The app's **SOS tab → "Offline via ESP32"** card (below "I am Safe").
- Nothing else — same backend, same dashboard, same incident pipeline as a
  normal SOS.

## 1. Flash the ESP32

Edit the top of `android/esp_Saarthi.ino`:

```cpp
#define AP_SSID     "DRISHTI-SOS"
#define AP_PASSWORD "saarthi123"
#define STA_SSID     "YOUR_WIFI_SSID"       // the WiFi your laptop is on
#define STA_PASSWORD "YOUR_WIFI_PASSWORD"
#define BACKEND_HOST "10.149.121.80"        // your laptop's current LAN IP — ip -4 addr show wlp4s0
#define BACKEND_PORT 8000
```

Arduino IDE → install the "esp32 by Espressif Systems" board package (Boards
Manager) → select your board + port → **Upload**. Keep **Serial Monitor**
open at 115200 baud — it logs every step, which is your best live proof.

Expected boot log:
```
AP started: DRISHTI-SOS  IP: 192.168.4.1
Connecting to backend WiFi: YOUR_WIFI_SSID
STA connected. IP: 10.149.121.xxx
Relay server started on port 80
```

## 2. Backend + dashboard

Same as the normal SOS demo (`docs/SOS_DEMO.md`) — nothing new:
```bash
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Dashboard at `http://localhost:3000/login`, signed in as admin
(`9000000001` / `drishtiops`).

## 3. Install the app

```bash
cd android && ./gradlew :app:installDevDebug
```
While the phone is still on your **normal** WiFi, open the app and log in
(so a fresh token is cached — you'll need it once you switch networks).

## 4. Bench-test the relay before judges arrive

From your laptop (still on the normal WiFi), hit the gateway directly:
```bash
curl -i http://<esp32-STA-ip-from-serial>/relay -X POST \
  -d "latitude=13.08&longitude=80.27&people_affected=1&description=bench+test" \
  -H "Authorization: Bearer <a real citizen token>"
```
Expect `201` and the incident to land on the dashboard. This proves the
ESP32→backend leg works before any phone is involved. Get a citizen token by
logging in via `curl -X POST http://10.149.121.80:8000/api/v1/auth/login -d '{"phone":"9000000000","password":"drishtidemo"}' -H 'Content-Type: application/json'` and reading `access_token` from the response.

## 5. Live demo

1. Phone: WiFi → join **`DRISHTI-SOS`** (`saarthi123`). Accept "no internet,
   stay connected?" if asked.
2. App → **SOS tab** → scroll to **"Offline via ESP32"**.
3. Gateway IP field should already read `192.168.4.1` (the default). Tap
   **Send via ESP32**.
4. The app gets a fresh GPS fix and POSTs it to the ESP32 over the hotspot.
   Watch the ESP32's Serial Monitor print the received fields and the relay
   attempt; the app shows "Sent via the ESP32 gateway".
5. The incident appears on the dashboard within a second or two — same
   marker, same map fly-to, same list entry as any other SOS.
6. Reconnect the phone to normal WiFi afterward to use the rest of the app.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Couldn't reach the ESP32 at 192.168.4.1" | Phone isn't actually joined to `DRISHTI-SOS` — check the WiFi status bar. |
| App shows a gateway error mentioning the backend WiFi | ESP32's STA hasn't connected — check Serial Monitor; wrong `STA_SSID`/`STA_PASSWORD`, or out of router range. |
| Gateway relays but backend never responds | `BACKEND_HOST` in the sketch doesn't match your laptop's *current* LAN IP, or the backend isn't on `--host 0.0.0.0`, or a firewall blocks port 8000 from the ESP32's subnet. |
| Backend returns 401 | The cached token expired — log in again on the app while still on normal WiFi, *then* switch to the hotspot. |
| Nothing on the dashboard | You're viewing it as the citizen, not the admin (`/login` again). |

## Fallback if hardware misbehaves live

Keep the Serial Monitor on screen the whole time — even if the phone UI
hiccups, "received from phone → forwarded → 201 from backend" printing
alongside the dashboard updating is convincing on its own. Have a
screen-recorded rehearsal run as backup.
