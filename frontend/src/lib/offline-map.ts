// Builds a self-contained, INTERACTIVE offline emergency map: one HTML file
// with Leaflet + a small pyramid of OpenStreetMap tiles baked in as data
// URIs. Pan and zoom work with zero network anywhere inside the downloaded
// area; pan past the edge and tiles just go grey.

const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const MIN_ZOOM = 13;
const MAX_ZOOM = 16;
const BOX_HALF_M = 2000; // ~4 km wide capture area
const TILE_CONCURRENCY = 6;
const MAX_TILES = 110; // keep the file a few MB, stay well inside OSM's fair use

const LEAFLET_CSS = [
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css",
];
const LEAFLET_JS = [
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",
];

// 1x1 transparent-ish grey png, used where a tile wasn't cached
const BLANK_TILE =
  "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e5e7eb"/></svg>'
  );

export interface OfflineMapPlace {
  name: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  phone?: string | null;
  address?: string | null;
  detail?: string | null;
}

export interface OfflineMapInput {
  lat: number;
  lon: number;
  accuracyM?: number | null;
  shelters: OfflineMapPlace[];
  hospital: OfflineMapPlace | null;
}

type Pin = OfflineMapPlace & { marker: string; hospital: boolean };

function lonToTileX(lon: number, z: number): number {
  return ((lon + 180) / 360) * 2 ** z;
}
function latToTileY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * 2 ** z;
}
function metresPerPixel(lat: number, z: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
}

function tileUrl(z: number, x: number, y: number): string {
  return TILE_URL.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

function planTiles(lat: number, lon: number): { z: number; x: number; y: number }[] {
  const specs: { z: number; x: number; y: number }[] = [];
  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
    const n = 2 ** z;
    const tilesHalf = Math.min(3, Math.max(1, Math.ceil(BOX_HALF_M / metresPerPixel(lat, z) / 256)));
    const cx = Math.floor(lonToTileX(lon, z));
    const cy = Math.floor(latToTileY(lat, z));
    for (let dx = -tilesHalf; dx <= tilesHalf; dx++) {
      for (let dy = -tilesHalf; dy <= tilesHalf; dy++) {
        const yt = cy + dy;
        if (yt < 0 || yt >= n) continue;
        specs.push({ z, x: ((((cx + dx) % n) + n) % n), y: yt });
      }
    }
  }
  return specs.slice(0, MAX_TILES);
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const done = (v: HTMLImageElement | null) => resolve(v);
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = url;
    setTimeout(() => done(null), 8000);
  });
}

async function fetchTiles(
  specs: { z: number; x: number; y: number }[]
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  let i = 0;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  async function worker(): Promise<void> {
    while (i < specs.length) {
      const s = specs[i++];
      const img = await loadImage(tileUrl(s.z, s.x, s.y));
      if (img && ctx) {
        ctx.clearRect(0, 0, 256, 256);
        ctx.drawImage(img, 0, 0, 256, 256);
        try {
          out[`${s.z}/${s.x}/${s.y}`] = canvas.toDataURL("image/png");
        } catch {
          /* tainted — skip */
        }
      }
    }
  }
  await Promise.all(Array.from({ length: TILE_CONCURRENCY }, worker));
  return out;
}

async function fetchFirstOk(urls: string[]): Promise<string | null> {
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (r.ok) return await r.text();
    } catch {
      /* try next */
    }
  }
  return null;
}

function esc(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  );
}
function jsStr(s: unknown): string {
  return JSON.stringify(String(s ?? ""));
}

function placeRow(p: Pin): string {
  const bits = [
    `${p.distance_km.toFixed(1)} km away`,
    p.detail ? esc(p.detail) : null,
    p.address ? esc(p.address) : null,
  ].filter(Boolean);
  const tel = p.phone ? p.phone.replace(/[^\d+]/g, "") : null;
  return `<li><span class="pin ${p.hospital ? "h" : "s"}">${p.marker}</span><div>
    <b>${esc(p.name)}</b><div class="meta">${bits.join(" &middot; ")}</div>
    ${tel ? `<a href="tel:${esc(tel)}">Call ${esc(p.phone)}</a>` : ""}
    <a href="https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=17/${p.latitude}/${p.longitude}">Open in maps</a>
  </div></li>`;
}

function buildHtml(
  input: OfflineMapInput,
  pins: Pin[],
  tiles: Record<string, string>,
  leafletCss: string | null,
  leafletJs: string | null
): string {
  const when = new Date().toLocaleString();
  const interactive = !!leafletJs && Object.keys(tiles).length > 0;
  const acc =
    input.accuracyM && input.accuracyM > 0
      ? `<div class="acc${input.accuracyM > 500 ? " warn" : ""}">Location fix: &plusmn;${Math.round(
          input.accuracyM
        )} m${input.accuracyM > 500 ? " — approximate (a phone with GPS outdoors is sharper)." : ""}</div>`
      : "";

  const markersJs = pins
    .map(
      (p) =>
        `addPin(${p.latitude},${p.longitude},${jsStr(p.marker)},${p.hospital},${jsStr(p.name)},${jsStr(
          `${p.distance_km.toFixed(1)} km` + (p.phone ? ` · ${p.phone}` : "")
        )});`
    )
    .join("\n");

  const mapBlock = interactive
    ? `<style>${leafletCss ?? ""}</style>
<div id="map"></div>
<script>${leafletJs}</script>
<script>
var TILES = ${JSON.stringify(tiles)};
var BLANK = ${jsStr(BLANK_TILE)};
var Off = L.TileLayer.extend({ getTileUrl: function (c) { return TILES[c.z + "/" + c.x + "/" + c.y] || BLANK; } });
var map = L.map("map", { minZoom: ${MIN_ZOOM}, maxZoom: ${MAX_ZOOM} }).setView([${input.lat}, ${input.lon}], ${Math.min(15, MAX_ZOOM)});
new Off("", { minZoom: ${MIN_ZOOM}, maxZoom: ${MAX_ZOOM}, tileSize: 256, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
function dot(color, label) {
  return L.divIcon({ className: "", iconSize: [24, 24], iconAnchor: [12, 12],
    html: '<div style="width:24px;height:24px;border-radius:50%;background:' + color +
          ';color:#fff;font:700 12px system-ui;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">' + label + '</div>' });
}
function addPin(lat, lon, marker, isHospital, name, meta) {
  L.marker([lat, lon], { icon: dot(isHospital ? "#dc2626" : "#0284c7", marker) })
    .addTo(map).bindPopup("<b>" + name + "</b><br>" + meta);
}
L.marker([${input.lat}, ${input.lon}], { icon: dot("#16a34a", "•") }).addTo(map).bindPopup("You are here");
${markersJs}
</script>`
    : `<div class="nomap">The interactive map needs a connection the first time you save this file. The place list and phone numbers below still work fully offline.</div>`;

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DRISHTI — Offline Emergency Map</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font: 15px/1.5 system-ui, -apple-system, sans-serif; color: #0f172a; background: #f8fafc; }
  .wrap { max-width: 640px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { color: #64748b; font-size: 12px; }
  .acc { font-size: 12px; color: #475569; margin: 6px 0; }
  .acc.warn { color: #b45309; }
  #map { height: 60vh; min-height: 320px; border-radius: 12px; border: 1px solid #e2e8f0; margin: 10px 0 4px; }
  .nomap { padding: 34px 16px; text-align: center; color: #64748b; background: #eef2f7; border-radius: 12px; margin: 10px 0; }
  .legend { font-size: 12px; color: #475569; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: #475569; margin: 22px 0 8px; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; gap: 10px; padding: 10px 0; border-top: 1px solid #e2e8f0; }
  .pin { flex: 0 0 24px; height: 24px; border-radius: 50%; color: #fff; font-weight: 700; font-size: 12px;
         display: flex; align-items: center; justify-content: center; }
  .pin.h { background: #dc2626; } .pin.s { background: #0284c7; }
  .meta { color: #64748b; font-size: 12px; }
  li a { display: inline-block; margin-right: 12px; font-size: 13px; color: #2563eb; }
  .lines a { display: block; padding: 8px 0; border-top: 1px solid #e2e8f0; font-weight: 600; color: #0f172a; text-decoration: none; }
  .lines a span { float: right; color: #2563eb; }
  .tips { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; }
  .tips ul { list-style: disc; }
  .tips li { display: list-item; border: 0; padding: 3px 0; margin-left: 18px; }
  footer { color: #94a3b8; font-size: 11px; margin-top: 20px; }
</style></head><body><div class="wrap">
  <h1>Offline Emergency Map</h1>
  <div class="sub">Centred on ${input.lat.toFixed(5)}, ${input.lon.toFixed(5)} &middot; saved ${esc(when)}</div>
  ${acc}
  ${mapBlock}
  <p class="legend">🟢 You &nbsp; 🔵 Relief shelter &nbsp; 🔴 Hospital (H) &nbsp;·&nbsp; drag to pan, pinch / scroll to zoom</p>

  <h2>Emergency numbers</h2>
  <div class="lines">
    <a href="tel:112">Emergency services <span>112</span></a>
    <a href="tel:9152987821">iCall emotional support <span>9152987821</span></a>
    <a href="tel:18602662345">Vandrevala Foundation <span>1860-2662-345</span></a>
  </div>

  ${pins.some((p) => p.hospital) ? `<h2>Nearest hospital</h2><ul>${pins.filter((p) => p.hospital).map(placeRow).join("")}</ul>` : ""}
  ${pins.some((p) => !p.hospital) ? `<h2>Relief shelters near you</h2><ul>${pins.filter((p) => !p.hospital).map(placeRow).join("")}</ul>` : ""}

  <h2>If the network is down</h2>
  <div class="tips"><ul>
    <li>Move to the nearest relief shelter, ideally on higher ground.</li>
    <li>Do not walk or drive through moving or rising water, and avoid underpasses.</li>
    <li>Tell your family you are safe the moment you get any signal.</li>
    <li>Keep this file — re-download it on a connection to refresh the map.</li>
  </ul></div>

  <footer>Map data © OpenStreetMap contributors. Generated by the DRISHTI citizen app.</footer>
</div></body></html>`;
}

/** Build and download the interactive offline map file. Needs a connection
 * (to pull tiles + Leaflet); everything after that works offline. */
export async function downloadOfflineMap(input: OfflineMapInput): Promise<void> {
  const pins: Pin[] = [
    ...(input.hospital ? [{ ...input.hospital, marker: "H", hospital: true }] : []),
    ...input.shelters.slice(0, 6).map((s, i) => ({ ...s, marker: String(i + 1), hospital: false })),
  ];

  const [tiles, leafletCss, leafletJs] = await Promise.all([
    fetchTiles(planTiles(input.lat, input.lon)),
    fetchFirstOk(LEAFLET_CSS),
    fetchFirstOk(LEAFLET_JS),
  ]);

  const html = buildHtml(input, pins, tiles, leafletCss, leafletJs);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "drishti-offline-map.html";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
