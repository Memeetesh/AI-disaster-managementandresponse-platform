/*
 * DRISHTI — ESP32 offline SOS gateway ("Saarthi")
 * ================================================
 * Single-node offline relay: the phone joins this ESP32's own WiFi hotspot
 * (no internet needed on the phone) and POSTs an SOS to it. This ESP32 is
 * *simultaneously* joined to your real WiFi (AP+STA mode) and forwards the
 * SOS straight through to the backend's existing POST /sos endpoint —
 * carrying the phone's own login token, so it lands on the dashboard exactly
 * like a normal citizen SOS.
 *
 * This is a single-hop relay, not a multi-hop ESP-NOW mesh — there's only
 * one board. If a second ESP32 joins later, the natural extension point is
 * right where handleRelay() calls forwardToBackend(): instead of (or in
 * addition to) forwarding over WiFi/STA, esp_now_send() the same fields to a
 * base-station peer, which then does what this sketch's forwardToBackend()
 * does. Nothing else here needs to change for that.
 *
 * Board: any ESP32 (Arduino core "ESP32 by Espressif Systems", board-manager
 * tested against 2.x/3.x). Libraries used (WiFi, WebServer, HTTPClient) all
 * ship with that core — no extra library installs needed.
 */

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>

// =====================================================
// EDIT THESE FOR YOUR DEMO
// =====================================================

// Hotspot the phone joins. No internet on this network — that's the point.
#define AP_SSID     "DRISHTI-SOS"
#define AP_PASSWORD "saarthi123"   // WPA2 needs >= 8 chars

// The real WiFi this ESP32 also joins, to reach your laptop/backend.
// Must be the SAME network your backend's --host 0.0.0.0 machine is on.
#define STA_SSID     "YOUR_WIFI_SSID"
#define STA_PASSWORD "YOUR_WIFI_PASSWORD"

// Your backend's LAN IP + port — keep this in sync with the Android app's
// dev BASE_URL in android/app/build.gradle.kts.
#define BACKEND_HOST "10.59.57.80"
#define BACKEND_PORT 8000
#define BACKEND_SOS_PATH "/api/v1/sos"

// =====================================================

WebServer server(80);
unsigned long lastReconnectAttempt = 0;
const unsigned long RECONNECT_INTERVAL_MS = 10000;

// ---- status page (open http://192.168.4.1/ from a laptop on the hotspot) ----

const char statusPage[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Saarthi Gateway</title>
<style>
  body { margin:0; font-family: Arial; background:#111; color:#eee; text-align:center; padding: 30px 15px; }
  h1 { color:#00ff88; }
  .row { margin: 8px 0; font-size: 15px; }
  .ok { color:#00ff88; } .bad { color:#ff5566; }
</style>
</head>
<body>
  <h1>Saarthi — Offline SOS Gateway</h1>
  <p>The phone sends its SOS here over this hotspot. This ESP32 relays it to
  the backend over its own WiFi connection.</p>
  <div id="out">Loading status…</div>
  <script>
    fetch('/ping').then(r => r.json()).then(d => {
      document.getElementById('out').innerHTML =
        '<div class="row">AP: <b>' + d.ap_ssid + '</b> (' + d.ap_ip + ')</div>' +
        '<div class="row">Backend link: <span class="' + (d.sta_connected ? 'ok' : 'bad') + '">' +
          (d.sta_connected ? 'connected (' + d.sta_ip + ')' : 'NOT connected') + '</span></div>' +
        '<div class="row">Uptime: ' + d.uptime_s + 's</div>';
    });
  </script>
</body>
</html>
)rawliteral";

// =====================================================
// helpers
// =====================================================

/** Percent-encodes a value for an application/x-www-form-urlencoded body. */
String urlEncode(const String &str) {
  String encoded;
  encoded.reserve(str.length() * 2);
  for (size_t i = 0; i < str.length(); i++) {
    char c = str.charAt(i);
    if (isalnum((unsigned char)c) || c == '-' || c == '_' || c == '.' || c == '~') {
      encoded += c;
    } else if (c == ' ') {
      encoded += '+';
    } else {
      char buf[4];
      snprintf(buf, sizeof(buf), "%%%02X", (unsigned char)c);
      encoded += buf;
    }
  }
  return encoded;
}

/** Forwards the SOS fields (already validated) to the backend, carrying the
 * phone's own Authorization header. Returns the backend's status code, and
 * fills `outBody` with its response body (or an ESP32-side error message). */
int forwardToBackend(const String &latitude, const String &longitude,
                      const String &peopleAffected, const String &description,
                      const String &authHeader, String &outBody) {
  if (WiFi.status() != WL_CONNECTED) {
    outBody = "{\"detail\":\"ESP32 gateway is not connected to the backend WiFi yet\"}";
    return 503;
  }

  String body = "latitude=" + urlEncode(latitude) +
                "&longitude=" + urlEncode(longitude) +
                "&people_affected=" + urlEncode(peopleAffected);
  if (description.length() > 0) {
    body += "&description=" + urlEncode(description);
  }

  String url = String("http://") + BACKEND_HOST + ":" + String(BACKEND_PORT) + BACKEND_SOS_PATH;

  HTTPClient http;
  http.setTimeout(8000);
  http.begin(url);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  if (authHeader.length() > 0) {
    http.addHeader("Authorization", authHeader);
  }

  Serial.println("Relay -> " + url);
  Serial.println("Relay body: " + body);

  int status = http.POST(body);
  if (status > 0) {
    outBody = http.getString();
  } else {
    outBody = "{\"detail\":\"ESP32 could not reach the backend: " + http.errorToString(status) + "\"}";
  }
  http.end();

  Serial.printf("Relay <- status %d\n", status);
  return status > 0 ? status : 502;
}

// =====================================================
// HTTP handlers (served on the AP interface, i.e. what the phone talks to)
// =====================================================

void handleRoot() {
  server.send(200, "text/html", statusPage);
}

void handlePing() {
  String json = "{";
  json += "\"ap_ssid\":\"" + String(AP_SSID) + "\",";
  json += "\"ap_ip\":\"" + WiFi.softAPIP().toString() + "\",";
  json += "\"sta_connected\":" + String(WiFi.status() == WL_CONNECTED ? "true" : "false") + ",";
  json += "\"sta_ip\":\"" + (WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : String("")) + "\",";
  json += "\"uptime_s\":" + String(millis() / 1000);
  json += "}";
  server.send(200, "application/json", json);
}

/** POST /relay — what the Android app calls. Same field names as the
 * backend's own POST /sos (minus image/audio, which this gateway never
 * carries), plus the phone's Authorization header, forwarded as-is. */
void handleRelay() {
  if (!server.hasArg("latitude") || !server.hasArg("longitude") || !server.hasArg("people_affected")) {
    server.send(400, "application/json", "{\"detail\":\"latitude, longitude and people_affected are required\"}");
    return;
  }

  String latitude = server.arg("latitude");
  String longitude = server.arg("longitude");
  String peopleAffected = server.arg("people_affected");
  String description = server.hasArg("description") ? server.arg("description") : "";
  String authHeader = server.header("Authorization");

  Serial.println("---- SOS received from phone ----");
  Serial.println("lat=" + latitude + " lon=" + longitude + " people=" + peopleAffected);
  if (authHeader.length() == 0) {
    Serial.println("WARNING: no Authorization header from phone — backend will reject this");
  }

  String responseBody;
  int status = forwardToBackend(latitude, longitude, peopleAffected, description, authHeader, responseBody);
  server.send(status, "application/json", responseBody);
}

void handleNotFound() {
  server.send(404, "application/json", "{\"detail\":\"unknown route\"}");
}

// =====================================================
// setup / loop
// =====================================================

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println("DRISHTI Saarthi gateway starting...");

  WiFi.mode(WIFI_AP_STA);

  WiFi.softAP(AP_SSID, AP_PASSWORD);
  Serial.print("AP started: ");
  Serial.print(AP_SSID);
  Serial.print("  IP: ");
  Serial.println(WiFi.softAPIP());

  Serial.print("Connecting to backend WiFi: ");
  Serial.println(STA_SSID);
  WiFi.begin(STA_SSID, STA_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("STA connected. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("STA not connected yet — will keep retrying in the background.");
    Serial.println("(The AP + phone side still works; relaying will fail until this connects.)");
  }

  server.on("/", handleRoot);
  server.on("/ping", handlePing);
  server.on("/relay", HTTP_POST, handleRelay);
  server.onNotFound(handleNotFound);
  server.begin();
  Serial.println("Relay server started on port 80");
  Serial.println("Phone should POST to: http://" + WiFi.softAPIP().toString() + "/relay");
}

void loop() {
  server.handleClient();

  if (WiFi.status() != WL_CONNECTED && millis() - lastReconnectAttempt > RECONNECT_INTERVAL_MS) {
    lastReconnectAttempt = millis();
    Serial.println("STA: reconnecting...");
    WiFi.reconnect();
  }
}
