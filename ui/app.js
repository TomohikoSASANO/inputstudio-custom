const $ = (sel) => document.querySelector(sel)
const DEFAULT_LETTER_SPACING = 1.2
const MAX_DELETE_PAGES_PER_OP = 10
const isWeb = () => !!(typeof window !== 'undefined' && window.__INPUTSTUDIO_WEB__)
/** ローカル(EXE)は従来どおり短い製品名。WEB公開版はサイト表記と揃える。 */
const appDisplayName = () => (isWeb() ? "PDF Input Studio" : "Input Studio")
const tr = (key, fallback, vars = {}) => {
  const fn = window.i18n?.t
  if (typeof fn !== "function") return String(fallback || key)
  const out = fn(key, vars)
  if (out === key && fallback) return String(fallback)
  return String(out)
}
const getLocaleSafe = () => {
  const fn = window.i18n?.getLocale
  if (typeof fn !== "function") return "ja"
  return fn() || "ja"
}
const LOCALE_OPTIONS = [
  { code: "ja", label: "日本語 / Japanese", flag: "jp" },
  { code: "en", label: "English / 英語", flag: "us" },
  { code: "zh", label: "中文 / Chinese", flag: "cn" },
  { code: "hi", label: "हिन्दी / Hindi", flag: "in" },
  { code: "es", label: "Español / Spanish", flag: "es" },
  { code: "fr", label: "Français / French", flag: "fr" },
  { code: "ar", label: "العربية / Arabic", flag: "sa" },
  { code: "pt", label: "Português / Portuguese", flag: "br" },
  { code: "ru", label: "Русский / Russian", flag: "ru" },
  { code: "bn", label: "বাংলা / Bengali", flag: "bd" },
  { code: "id", label: "Bahasa Indonesia / Indonesian", flag: "id" },
  { code: "ur", label: "اردو / Urdu", flag: "pk" },
  { code: "de", label: "Deutsch / German", flag: "de" },
  { code: "it", label: "Italiano / Italian", flag: "it" },
  { code: "tr", label: "Türkçe / Turkish", flag: "tr" },
  { code: "vi", label: "Tiếng Việt / Vietnamese", flag: "vi" },
  { code: "ko", label: "한국어 / Korean", flag: "kr" },
  { code: "fa", label: "فارسی / Persian", flag: "ir" },
  { code: "th", label: "ไทย / Thai", flag: "th" },
  { code: "pl", label: "Polski / Polish", flag: "pl" },
  { code: "uk", label: "Українська / Ukrainian", flag: "ua" },
  { code: "nl", label: "Nederlands / Dutch", flag: "nl" },
]
const getLocaleMeta = (locale) => {
  return LOCALE_OPTIONS.find((x) => x.code === String(locale || "").toLowerCase()) || LOCALE_OPTIONS[0]
}
function getLocaleFromQuery() {
  try {
    const q = new URLSearchParams(window.location.search || "")
    const v = String(q.get("lang") || "").trim().toLowerCase()
    if (!v) return null
    const hit = LOCALE_OPTIONS.find((x) => x.code === v)
    return hit ? hit.code : null
  } catch {
    return null
  }
}
function syncLocaleQuery(locale) {
  if (!isWeb()) return
  try {
    const url = new URL(window.location.href)
    url.searchParams.set("lang", String(locale || "ja").toLowerCase())
    window.history.replaceState({}, "", url.toString())
  } catch {}
}
let _viewportMetricsBound = false
function syncViewportMetrics() {
  const root = document.documentElement
  if (!root) return
  const vv = window.visualViewport
  const rawViewportH = Number(vv?.height || window.innerHeight || document.documentElement.clientHeight || 0)
  const viewportH = Math.max(1, Math.round(rawViewportH))
  let usableH = viewportH
  // Desktop app can report taller than work area; clamp to OS available height (taskbar excluded).
  if (!isWeb()) {
    const avail = Number(window.screen?.availHeight || 0)
    if (avail > 0) usableH = Math.min(usableH, Math.round(avail))
  }
  root.style.setProperty("--inputstudio-usable-vh", `${usableH}px`)
}

function bindViewportMetricsOnce() {
  if (_viewportMetricsBound) return
  _viewportMetricsBound = true
  syncViewportMetrics()
  window.addEventListener("resize", syncViewportMetrics, { passive: true })
  window.visualViewport?.addEventListener?.("resize", syncViewportMetrics, { passive: true })
}

const AD_UNLOCK_RULES = {
  zip_open: { cooldownMs: 5 * 60 * 1000, maxPerSession: 2 },
  pdf_append: { cooldownMs: 3 * 60 * 1000, maxPerSession: 3 },
}
const AD_SLOT_IDS = {
  gate: "adSlotGate",
  panel: "adSlotPanel",
  panelBottom: "adSlotPanelBottom",
}
const adRuntime = {
  scriptReady: false,
  scriptPromise: null,
}

function getAdConfig() {
  const raw = window.__INPUTSTUDIO_AD_CONFIG__ && typeof window.__INPUTSTUDIO_AD_CONFIG__ === "object"
    ? window.__INPUTSTUDIO_AD_CONFIG__
    : {}
  const adsense = raw.adsense && typeof raw.adsense === "object" ? raw.adsense : {}
  const slots = adsense.slots && typeof adsense.slots === "object" ? adsense.slots : {}
  const unlock = raw.unlock && typeof raw.unlock === "object" ? raw.unlock : {}
  return {
    enabled: !!raw.enabled && isWeb(),
    provider: String(raw.provider || "none").toLowerCase(),
    adsense: {
      client: String(adsense.client || "").trim(),
      slots: {
        gate: String(slots.gate || "").trim(),
        panel: String(slots.panel || "").trim(),
        panelBottom: String(slots.panelBottom || "").trim(),
        unlock: String(slots.unlock || "").trim(),
      },
    },
    unlock: {
      minSeconds: Math.max(0, Number(unlock.minSeconds || 3) || 3),
    },
  }
}

function getAdSlotFor(name) {
  const cfg = getAdConfig()
  return String(cfg.adsense?.slots?.[name] || "").trim()
}

async function ensureAdSenseScript() {
  const cfg = getAdConfig()
  if (!cfg.enabled || cfg.provider !== "adsense") return false
  if (!cfg.adsense.client) return false
  if (adRuntime.scriptReady) return true
  if (adRuntime.scriptPromise) return adRuntime.scriptPromise
  adRuntime.scriptPromise = new Promise((resolve) => {
    const src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cfg.adsense.client)}`
    const exists = Array.from(document.querySelectorAll("script")).find((s) => String(s.src || "").includes("pagead/js/adsbygoogle.js"))
    if (exists) {
      adRuntime.scriptReady = true
      resolve(true)
      return
    }
    const s = document.createElement("script")
    s.async = true
    s.src = src
    s.crossOrigin = "anonymous"
    s.onload = () => {
      adRuntime.scriptReady = true
      resolve(true)
    }
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
  return adRuntime.scriptPromise
}

function mountAdSenseInto(container, slotId) {
  const cfg = getAdConfig()
  if (!container || !slotId || !cfg.adsense.client) return false
  const adId = `ad-${slotId}-${Date.now().toString(36)}`
  container.innerHTML = `
    <ins id="${escapeHtml(adId)}"
      class="adsbygoogle inputstudioAd"
      style="display:block"
      data-ad-client="${escapeHtml(cfg.adsense.client)}"
      data-ad-slot="${escapeHtml(slotId)}"
      data-ad-format="auto"
      data-full-width-responsive="true"></ins>
  `
  try {
    ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    return true
  } catch {
    return false
  }
}

async function refreshAdSlots() {
  const cfg = getAdConfig()
  if (!cfg.enabled || cfg.provider !== "adsense") return
  const ok = await ensureAdSenseScript()
  if (!ok) return
  for (const [slotName, domId] of Object.entries(AD_SLOT_IDS)) {
    const host = document.getElementById(domId)
    if (!host) continue
    const slotId = getAdSlotFor(slotName)
    if (!slotId) continue
    const live = host.querySelector(".adSlot__live")
    if (!live) continue
    if (live.dataset.liveMounted === "1") continue
    const mounted = mountAdSenseInto(live, slotId)
    if (mounted) live.dataset.liveMounted = "1"
  }
}

// --- Web demo mode (GitHub Pages) ------------------------------------------
// GitHub上で「実画面レビュー」を回すため、pywebviewが無い環境では
// 画面を動かせるモックAPIを注入する。
;(function ensureDemoApi() {
  // Desktop app (pywebview + WebView2) may not have window.pywebview at initial parse.
  // Detect desktop reliably and NEVER inject the demo mock there.
  try {
    // WebView2 exposes window.chrome.webview
    if (window.chrome && window.chrome.webview) return
    const host = String(window.location?.hostname || "")
    if (host === "127.0.0.1" || host === "localhost") return
  } catch {
    return
  }
  // If pywebview exists at all, assume desktop and DO NOT inject the mock.
  if (window.pywebview) return
  window.__INPUTSTUDIO_DEMO__ = true

  const demo = {
    projectName: "デモ案件：外國語書類一式",
    projectPath: "demo/project.json",
    pageCount: 58,
    uiMode: "worker",
    tags: [],
    values: {},
    placements: {}, // fid -> {tag,page,x,y,font_size,...}
    defaultFontSize: 14,
    viewZoom: 1.0,
  }

  const makeSvgDataUrl = (pageIndex) => {
    const w = 1240
    const h = 1754
    const p = pageIndex + 1
    const n = demo.pageCount
    const placed = Object.entries(demo.placements).filter(([, pl]) => Number(pl?.page || 0) === pageIndex)
    const overlay = placed
      .map(([, pl]) => {
        const tag = String(pl?.tag || "").trim()
        const v = String(demo.values[tag] || tag).replaceAll("<br>", "\n")
        const x = Math.max(24, Math.min(w - 24, Number(pl.x || 0)))
        const y = Math.max(24, Math.min(h - 24, Number(pl.y || 0)))
        const fs = Math.max(10, Math.min(36, Number(pl.font_size || 14)))
        const safe = v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        return `<text x="${x}" y="${y}" font-size="${fs}" fill="#0f172a" font-family="Arial, sans-serif">${safe}</text>`
      })
      .join("")

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#f3f4ff"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#bg)"/>
  <rect x="40" y="40" width="${w - 80}" height="${h - 80}" fill="#ffffff" stroke="rgba(15,23,42,0.10)" stroke-width="2" rx="18"/>
  <text x="72" y="110" font-size="28" fill="rgba(15,23,42,0.75)" font-family="Arial, sans-serif">PDF Input Studio デモプレビュー</text>
  <text x="72" y="150" font-size="18" fill="rgba(15,23,42,0.55)" font-family="Arial, sans-serif">ページ ${p} / ${n}</text>
  <g opacity="0.18">
    <rect x="90" y="220" width="${w - 180}" height="${h - 320}" fill="none" stroke="#7c5cff" stroke-width="2" stroke-dasharray="10 10" rx="10"/>
  </g>
  ${overlay}
</svg>`
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }

  const api = {
    async get_admin_settings() {
      return {
        ok: true,
        settings: {
          ui_mode: demo.uiMode,
          default_font_size: Number(demo.defaultFontSize || 14) || 14,
          view_zoom: Number(demo.viewZoom || 1.0) || 1.0,
        },
      }
    },
    async update_admin_settings(patch) {
      const p = patch && typeof patch === "object" ? patch : {}
      if (p.default_font_size != null) demo.defaultFontSize = Number(p.default_font_size || 14) || 14
      if (p.view_zoom != null) demo.viewZoom = Number(p.view_zoom || 1.0) || 1.0
      return {
        ok: true,
        settings: {
          ui_mode: demo.uiMode,
          default_font_size: Number(demo.defaultFontSize || 14) || 14,
          view_zoom: Number(demo.viewZoom || 1.0) || 1.0,
        },
      }
    },
    async get_workers() {
      return {
        ok: true,
        workers: [
          { id: "w_demo", name: "デモ作業者", bank: "" },
          { id: "w_demo2", name: "デモ作業者2", bank: "" },
        ],
        last_worker_id: "w_demo",
      }
    },
    async pick_project() {
      return { ok: true, path: demo.projectPath }
    },
    async pick_pdf() {
      return { ok: true, path: "demo.pdf" }
    },
    async create_project_from_pdf_simple() {
      demo.tags = []
      demo.values = {}
      demo.placements = {}
      return { ok: true, path: demo.projectPath }
    },
    async load_project() {
      return {
        ok: true,
        project: demo.projectName,
        tags: demo.tags,
        values: demo.values,
        placements: demo.placements,
        drop_dir: "demo/exports",
        ui_mode: demo.uiMode,
        page_count: demo.pageCount,
      }
    },
    async save_current_project() {
      return { ok: true }
    },
    async save_project_as(name) {
      demo.projectName = String(name || demo.projectName || "案件")
      demo.projectPath = "demo/project.json"
      return { ok: true, path: demo.projectPath }
    },
    async append_pdf_to_project() {
      demo.pageCount = Math.max(1, Number(demo.pageCount || 1) + 1)
      return { ok: true, page_count: demo.pageCount }
    },
    async copy_page_with_elements(page_index) {
      const idx = Math.max(0, Math.min(Math.max(1, Number(demo.pageCount || 1)) - 1, Number(page_index || 0)))
      const out = {}
      for (const [fid, pl] of Object.entries(demo.placements || {})) {
        if (!pl || typeof pl !== "object") continue
        const page = Number(pl.page || 0)
        const next = { ...pl }
        if (page > idx) next.page = page + 1
        out[fid] = next
        if (page === idx) {
          const nf = `f_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 8)}`
          out[nf] = { ...pl, page: idx + 1 }
        }
      }
      demo.placements = out
      demo.pageCount = Math.max(1, Number(demo.pageCount || 1) + 1)
      return { ok: true, page_count: demo.pageCount, page_index: idx + 1, placements: demo.placements }
    },
    async delete_page_from_project(page_index) {
      const total = Math.max(1, Number(demo.pageCount || 1))
      if (total <= 1) return { ok: false, error: "cannot_delete_last_page" }
      const idx = Math.max(0, Math.min(total - 1, Number(page_index || 0)))
      const out = {}
      for (const [fid, pl] of Object.entries(demo.placements || {})) {
        if (!pl || typeof pl !== "object") continue
        const page = Number(pl.page || 0)
        if (page === idx) continue
        out[fid] = { ...pl, page: page > idx ? page - 1 : page }
      }
      demo.placements = out
      demo.pageCount = Math.max(1, total - 1)
      return {
        ok: true,
        page_count: demo.pageCount,
        page_index: Math.max(0, Math.min(demo.pageCount - 1, idx)),
        tags: demo.tags,
        values: demo.values,
        placements: demo.placements,
      }
    },
    async reorder_pages(order) {
      const total = Math.max(1, Number(demo.pageCount || 1))
      if (!Array.isArray(order) || order.length !== total) return { ok: false, error: "invalid_order" }
      const norm = order.map((x) => Number(x))
      if (norm.some((x) => !Number.isFinite(x))) return { ok: false, error: "invalid_order" }
      const set = new Set(norm)
      if (set.size !== total) return { ok: false, error: "invalid_order" }
      const min = Math.min(...norm)
      const max = Math.max(...norm)
      if (min < 0 || max >= total) return { ok: false, error: "invalid_order" }
      const oldToNew = {}
      norm.forEach((oldIdx, newIdx) => {
        oldToNew[Number(oldIdx)] = Number(newIdx)
      })
      const out = {}
      for (const [fid, pl] of Object.entries(demo.placements || {})) {
        if (!pl || typeof pl !== "object") continue
        const oldPage = Number(pl.page || 0)
        out[fid] = { ...pl, page: Number(oldToNew[oldPage] ?? oldPage) }
      }
      demo.placements = out
      return { ok: true, page_count: demo.pageCount, placements: demo.placements }
    },
    async set_ui_mode(mode) {
      demo.uiMode = String(mode || "worker")
      return { ok: true }
    },
    async start_work() {
      return { ok: true }
    },
    async toggle_private() {
      return { ok: true, in_private: false }
    },
    async finish() {
      return { ok: true, dir: "demo/exports", zip: "demo.zip" }
    },
    async delete_worker() {
      return { ok: true }
    },
    async set_value(tag, value) {
      demo.values[String(tag)] = String(value ?? "")
      return { ok: true }
    },
    async bulk_apply_values(patch) {
      const p = patch && typeof patch === "object" ? patch : {}
      const incoming = p.values && typeof p.values === "object" ? p.values : {}
      const only_known = p.only_known_tags !== false
      const skip_empty = !!p.skip_empty_values
      const known = new Set(demo.tags.map((t) => String(t).trim()).filter(Boolean))
      for (const pl of Object.values(demo.placements || {})) {
        const tn = String(pl?.tag || "").trim()
        if (tn) known.add(tn)
      }
      const values = { ...demo.values }
      const applied = []
      const skipped_unknown_tags = []
      for (const [rk, rv] of Object.entries(incoming)) {
        const k = normalizeBulkPasteKey(rk)
        if (!k) continue
        const v = String(rv ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
        if (skip_empty && !v.trim()) continue
        if (only_known && !known.has(k)) {
          if (!skipped_unknown_tags.includes(k)) skipped_unknown_tags.push(k)
          continue
        }
        values[k] = v
        applied.push(k)
      }
      demo.values = values
      return { ok: true, applied_count: applied.length, applied, skipped_unknown_tags, values }
    },
    async add_text_field(tag, page, x, y, font_size) {
      const t = String(tag || "").trim()
      if (!t) return { ok: false, error: "missing_tag" }
      if (!demo.tags.includes(t)) demo.tags.push(t)
      const fid = `f_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 8)}`
      demo.placements[fid] = {
        tag: t,
        page: Number(page || 0),
        x: Number(x || 0),
        y: Number(y || 0),
        font_size: Number(font_size || 14),
        color: "#0f172a",
        line_height: 1.2,
        letter_spacing: DEFAULT_LETTER_SPACING,
      }
      return { ok: true, fid, tag: t }
    },
    async set_element_pos(fid, x, y) {
      const f = String(fid || "").trim()
      const pl = demo.placements[f] || { tag: "", page: 0, x: 0, y: 0, font_size: 14 }
      pl.x = Number(x || 0)
      pl.y = Number(y || 0)
      demo.placements[f] = pl
      return { ok: true }
    },
    async update_placement(fid, patch) {
      const f = String(fid || "").trim()
      const pl = demo.placements[f]
      if (!pl) return { ok: false, error: "not_found" }
      const p = patch && typeof patch === "object" ? patch : {}
      Object.assign(pl, p)
      demo.placements[f] = pl
      return { ok: true }
    },
    async delete_tags(tags) {
      const arr = Array.isArray(tags) ? tags.map((x) => String(x).trim()).filter(Boolean) : []
      for (const t of arr) {
        demo.tags = demo.tags.filter((k) => k !== t)
        delete demo.values[t]
        for (const [fid, pl] of Object.entries(demo.placements)) {
          if (pl && typeof pl === "object" && String(pl.tag || "").trim() === t) delete demo.placements[fid]
        }
      }
      return { ok: true }
    },
    async delete_elements(fids) {
      const arr = Array.isArray(fids) ? fids.map((x) => String(x).trim()).filter(Boolean) : []
      for (const fid of arr) delete demo.placements[fid]
      return { ok: true }
    },
    async set_project_payload(payload) {
      const p = payload && typeof payload === "object" ? payload : {}
      demo.tags = Array.isArray(p.tags) ? p.tags.map(String) : demo.tags
      demo.values = p.values && typeof p.values === "object" ? { ...p.values } : demo.values
      demo.placements = p.placements && typeof p.placements === "object" ? { ...p.placements } : demo.placements
      return { ok: true }
    },
    async get_element_info(fid) {
      const f = String(fid || "").trim()
      const pl = demo.placements[f]
      if (!pl) return { ok: false, error: "not_found" }
      return {
        ok: true,
        page: Number(pl.page || 0),
        tag: String(pl.tag || ""),
        x: Number(pl.x || 0),
        y: Number(pl.y || 0),
        font_size: Number(pl.font_size || 14),
        page_display_width: 1240,
        page_display_height: 1754,
      }
    },
    async get_preview_png_base64_page(page_index) {
      const idx = Math.max(0, Math.min(demo.pageCount - 1, Number(page_index || 0)))
      return {
        ok: true,
        png: makeSvgDataUrl(idx),
        page_display_width: 1240,
        page_display_height: 1754,
        page_index: idx,
      }
    },
    async get_preview_png_base64(tagOrFid) {
      const q = String(tagOrFid || "").trim()
      const pl = demo.placements[q]
      if (pl) return api.get_preview_png_base64_page(Number(pl.page || 0))
      for (const [, p] of Object.entries(demo.placements)) {
        if (p && typeof p === "object" && String(p.tag || "").trim() === q) return api.get_preview_png_base64_page(Number(p.page || 0))
      }
      return api.get_preview_png_base64_page(0)
    },
  }

  window.pywebview = { api }
})()

// いろんなママさんペルソナで“最大公約数”に寄せた設計（後述）:
// - 夜に作業する（暗めでも目が疲れない）
// - 片手でも押せる（大きいタップ領域、下に主要アクション）
// - “作業感”を減らす（柔らかい色、手ごたえ、気分が上がる演出）
// - 迷わない（次へだけで進む、今どこか常に見える）

const state = {
  projectPath: null,
  projectName: null,
  workers: [],
  workerId: null,
  appStage: "gate", // "gate" | "main"
  gate: {
    step: "choose", // "choose" | "worker" | "admin"
    password: "",
    error: "",
  },
  tags: [],
  idx: 0,
  values: {},
  placements: {},
  selectKeys: [],
  clipboard: null,
  marquee: null,
  marqueeBaseKeys: [],
  sections: [],
  cases: [],
  notes: [],
  deletedLogicalPages: [],
  binderTrash: [],
  presets: [],
  binderCaseFilter: "",
  noteAddMode: false,
  undoStack: [],
  redoStack: [],
  working: false,
  inPrivate: false,
  timerStart: null,
  privateTotal: 0,
  dropDir: "",
  lastPreviewKey: null,
  justCompleted: false,
  designMode: false,
  designKey: null,
  pageW: 600,
  pageH: 800,
  designPos: null,
  uiMode: "worker", // "admin" | "worker"
  addMode: false,
  addDraftName: "",
  previewPageIndex: 0,
  history: [],
  lastSession: null,
  sessionStart: null,
  lastProjectDir: null,
  pageCount: 1,
  // タグ欄は常時表示（右上のON/OFFボタンは廃止）
  showTagPane: true,
  showPanel: true,
  pageLocked: false,
  lastFilledPdf: null,
  lastReportPdf: null,
  lastExportDir: null,
  defaultFontSize: 14,
  viewZoom: 1.0,
  viewBaseZoom: 1.0,
  viewPanX: 0,
  viewPanY: 0,
  locale: getLocaleSafe(),
  adLastShown: {},
  adSessionCounts: {},
  showPreviewHint: true,
  placePaletteOpen: false,
  /** 流用チェック: パレット上のタグ名を赤字で「未編集」表示し、値を触ったタグだけ黒へ */
  reviewReuseActive: false,
  reviewReusePending: null,
}

state.history = loadLocal("inputstudio-history", [])
state.lastSession = loadLocal("inputstudio-last-session", null)
state.lastProjectDir = loadLocal("inputstudio-last-dir", null)
state.showPanel = loadLocal("inputstudio-show-panel", true)
state.adLastShown = loadLocal("inputstudio-ad-last-shown", {})

function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function saveLocal(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val))
  } catch {}
}

let _lastRenderedProjectPathForReuseReview

function refreshTagQuickPaletteGlobal() {
  try {
    const fn = window.__inputstudio_refreshTagQuick
    if (typeof fn === "function") fn()
  } catch {}
}

function clearReuseReviewState() {
  state.reviewReuseActive = false
  state.reviewReusePending = null
  refreshTagQuickPaletteGlobal()
}

function markTagReuseReviewEdited(tag) {
  const t = String(tag || "").trim()
  if (!t || !state.reviewReuseActive || !state.reviewReusePending) return
  if (!state.reviewReusePending.has(t)) return
  state.reviewReusePending.delete(t)
  refreshTagQuickPaletteGlobal()
}

function toggleReuseReviewMode() {
  if (state.reviewReuseActive) {
    clearReuseReviewState()
    toast(tr("main.reuseReviewEndToast", "流用チェックを終了しました"))
    return
  }
  if (!state.tags?.length) {
    toast(tr("main.reuseReviewNoTags", "タグがありません"))
    return
  }
  state.reviewReuseActive = true
  state.reviewReusePending = new Set(state.tags.map((x) => String(x)))
  refreshTagQuickPaletteGlobal()
  toast(
    tr(
      "main.reuseReviewStartToast",
      "未確認のタグ名が赤字になります（配置パレットの一覧と、左の編集欄のタグ名）。値を編集したタグだけ黒に戻ります。",
    ),
  )
}

/** 次へ/戻るクリックでボタンがフォーカスを奪うと WebView で textarea に戻らないことがあるため、mousedown で抑止する */
function bindNoFocusOnPrimaryClick(el) {
  if (!el) return
  el.addEventListener("mousedown", (e) => {
    if (e.button === 0) e.preventDefault()
  })
}

function focusValueAfterTagNavigate() {
  const run = () => {
    const el = document.getElementById("val")
    if (!el || el.disabled) return
    try {
      const ae = document.activeElement
      if (ae && ae !== el && typeof ae.blur === "function") ae.blur()
    } catch {}
    try {
      el.focus({ preventScroll: true })
    } catch {
      try {
        el.focus()
      } catch {}
    }
    try {
      const len = String(el.value || "").length
      el.setSelectionRange(len, len)
    } catch {}
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      run()
      // pywebview / Win でクリック直後にフォーカスが戻る場合のフォロー
      setTimeout(run, 0)
      setTimeout(run, 50)
      setTimeout(run, 120)
      setTimeout(run, 220)
    })
  })
}

function getRenderedContentRect(imgEl, pageW, pageH) {
  // imgEl is sized to its container, with object-fit: contain.
  // We need the actual rendered content box to avoid coordinate drift.
  const r = imgEl.getBoundingClientRect()
  const cw = Math.max(1, r.width)
  const ch = Math.max(1, r.height)
  // Prefer actual intrinsic image aspect; fall back to logical page size.
  const iw = Math.max(1, Number(imgEl.naturalWidth || pageW || 1))
  const ih = Math.max(1, Number(imgEl.naturalHeight || pageH || 1))
  const s = Math.min(cw / iw, ch / ih)
  const dw = iw * s
  const dh = ih * s
  const dx = (cw - dw) / 2
  const dy = (ch - dh) / 2
  return {
    left: r.left + dx,
    top: r.top + dy,
    width: dw,
    height: dh,
  }
}

function clampNum(v, minV, maxV) {
  const n = Number(v)
  if (!Number.isFinite(n)) return minV
  return Math.max(minV, Math.min(maxV, n))
}

function applyPreviewTransform() {
  const sc = $("#previewScale")
  if (!sc) return
  const userZoom = clampNum(state.viewZoom || 1, 0.5, 3.0)
  const baseZoom = clampNum(state.viewBaseZoom || 1, 0.6, 1.0)
  const z = clampNum(userZoom * baseZoom, 0.4, 3.0)
  const host = $("#previewImg")
  if (host) {
    const r = host.getBoundingClientRect()
    const w = Math.max(1, Number(r.width || 0))
    const h = Math.max(1, Number(r.height || 0))
    if (z <= 1.001) {
      state.viewPanX = 0
      state.viewPanY = 0
    } else {
      const maxX = Math.max(0, ((w * z) - w) / 2)
      const maxY = Math.max(0, ((h * z) - h) / 2)
      state.viewPanX = clampNum(state.viewPanX || 0, -maxX, maxX)
      state.viewPanY = clampNum(state.viewPanY || 0, -maxY, maxY)
    }
  }
  const tx = Number(state.viewPanX || 0) || 0
  const ty = Number(state.viewPanY || 0) || 0
  sc.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`
  const zi = $("#zoomIndicator")
  if (zi) zi.textContent = `${Math.round(userZoom * 100)}%`
}

function resetPreviewViewport({ zoom = 1.0 } = {}) {
  state.viewZoom = clampNum(zoom, 0.5, 3.0)
  state.viewBaseZoom = 1.0
  state.viewPanX = 0
  state.viewPanY = 0
}

function updatePreviewBaseZoom() {
  // Keep base zoom neutral; object-fit: contain already handles viewport fitting.
  state.viewBaseZoom = 1.0
}

function normalizeViewportAtFit() {
  const z = clampNum((Number(state.viewZoom || 1) || 1) * (Number(state.viewBaseZoom || 1) || 1), 0.4, 3.0)
  if (z <= 1.001) {
    state.viewPanX = 0
    state.viewPanY = 0
  }
}

function updatePreviewGuideHint() {
  const hint = $("#previewGuideHint")
  if (!hint) return
  const previewImg = $("#previewImg")
  if (!previewImg) {
    hint.style.display = "none"
    return
  }
  const paletteMode = !!state.placePaletteOpen
  const title = paletteMode
    ? "タグ名と値を入力して配置しよう"
    : "まずはPDFに欄（タグ）を置きましょう"
  const text = paletteMode
    ? "タグ名と値を入力して配置しよう。タグ一覧のタグをクリックすると既存タグを呼び出せます。同じタグはまとめて値を編集できます。"
    : "PDF上をダブルクリックしてタグ名と値を入力し、欄を配置できます。"
  hint.className = `emptyHint ${paletteMode ? "emptyHint--palette" : ""}`.trim()
  hint.innerHTML = `
    <div class="emptyHint__title">${escapeHtml(title)}</div>
    <div class="emptyHint__text">${escapeHtml(text)}</div>
    <div class="emptyHint__actions">
      ${paletteMode ? "" : `<button class="btn btn--primary" id="btnAddFromCenter">中央に欄を追加</button>`}
    </div>
  `
  hint.style.display = "block"

  const btnAddFromCenter = $("#btnAddFromCenter")
  if (btnAddFromCenter) btnAddFromCenter.onclick = () => {
    const x = Math.round(0.5 * state.pageW)
    const y = Math.round(0.5 * state.pageH)
    if (!x || !y) return
    openPlacePalette({ x, y })
  }
}

async function setViewZoom(nextZoom, { persist = true } = {}) {
  state.viewZoom = clampNum(nextZoom, 0.5, 3.0)
  normalizeViewportAtFit()
  applyPreviewTransform()
  drawOverlay()
  if (!persist) return
  try {
    await window.pywebview?.api?.update_admin_settings?.({ view_zoom: state.viewZoom })
  } catch {}
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function hydrateBinder(src) {
  state.sections = Array.isArray(src?.sections) ? src.sections : []
  state.cases = Array.isArray(src?.cases) ? src.cases : []
  state.notes = Array.isArray(src?.notes) ? src.notes : []
  state.deletedLogicalPages = Array.isArray(src?.deleted_logical_pages)
    ? src.deleted_logical_pages.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x >= 0)
    : []
  if (Array.isArray(src?.binder_trash) && src.binder_trash.length) {
    state.binderTrash = mergeBinderTrashLists(state.binderTrash, src.binder_trash)
  }
  // 旧データ（page_start/page_end）を pages 配列に移行
  for (const s of state.sections) {
    if (!Array.isArray(s.pages) || !s.pages.length) {
      const a = Number(s.page_start || 0)
      const b = Number(s.page_end || 0)
      const pages = []
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) pages.push(i)
      s.pages = pages
    }
    ensureSectionOriginalPages(s)
  }
  const deletedFromNotes = loadDeletedLogicalPagesFromNotes()
  if (deletedFromNotes.length) {
    state.deletedLogicalPages = [...new Set([...getDeletedLogicalPages(), ...deletedFromNotes])].sort((a, b) => a - b)
  }
  syncBinderTrashState()
}

function getDeletedLogicalPages() {
  return [...(state.deletedLogicalPages || [])]
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && x >= 0)
    .sort((a, b) => a - b)
}

function physicalToLogicalPage(physicalIdx) {
  const physical = Math.max(0, Number(physicalIdx || 0))
  let logical = physical
  for (const d of getDeletedLogicalPages()) {
    if (d <= logical) logical++
  }
  return logical
}

function logicalToPhysicalPage(logicalIdx) {
  const logical = Math.max(0, Number(logicalIdx || 0))
  if (getDeletedLogicalPages().includes(logical)) return -1
  let physical = logical
  for (const d of getDeletedLogicalPages()) {
    if (d < physical) physical--
    else break
  }
  return Math.max(0, physical)
}

function isLogicalPageDeleted(logicalIdx) {
  return getDeletedLogicalPages().includes(Number(logicalIdx || 0))
}

function registerDeletedLogicalPages(pageIndices) {
  const incoming = pageIndices.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x >= 0)
  const set = new Set([...getDeletedLogicalPages(), ...incoming])
  state.deletedLogicalPages = [...set].sort((a, b) => a - b)
}

const DELETED_LOGICAL_PAGES_NOTE_KIND = "__deleted_logical_pages__"
const DELETED_LOGICAL_PAGES_NOTE_ID = "__meta_deleted_logical_pages__"

function isDeletedLogicalPagesNote(n) {
  return !!n && (n.kind === DELETED_LOGICAL_PAGES_NOTE_KIND || n.id === DELETED_LOGICAL_PAGES_NOTE_ID)
}

function mergeDeletedLogicalPageLists(...lists) {
  const set = new Set()
  for (const list of lists) {
    for (const x of list || []) {
      const n = Number(x)
      if (Number.isFinite(n) && n >= 0) set.add(n)
    }
  }
  return [...set].sort((a, b) => a - b)
}

function loadDeletedLogicalPagesFromNotes() {
  const n = (state.notes || []).find(isDeletedLogicalPagesNote)
  if (!n) return []
  try {
    const arr = JSON.parse(String(n.text || "[]"))
    return Array.isArray(arr) ? arr.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x >= 0) : []
  } catch {
    return []
  }
}

function syncDeletedLogicalPagesToNotes() {
  const keep = (state.notes || []).filter((n) => !isDeletedLogicalPagesNote(n))
  const deleted = getDeletedLogicalPages()
  if (!deleted.length) {
    state.notes = keep
    return
  }
  state.notes = [
    ...keep,
    {
      id: DELETED_LOGICAL_PAGES_NOTE_ID,
      kind: DELETED_LOGICAL_PAGES_NOTE_KIND,
      text: JSON.stringify(deleted),
      page: -1,
      x: 0,
      y: 0,
      section_id: "",
      resolved: true,
    },
  ]
}

function getSectionTrashedLogicalPages(sectionId) {
  const set = new Set()
  for (const e of state.binderTrash || []) {
    if (e?.type === "page" && e.sectionId === sectionId) set.add(Number(e.logicalPage))
  }
  return set
}

function ensureSectionOriginalPages(s) {
  if (!s) return
  const current = sectionPages(s)
  if (!Array.isArray(s.original_pages) || !s.original_pages.length) {
    if (current.length) s.original_pages = [...current].map(Number).sort((a, b) => a - b)
  } else if (current.length !== s.original_pages.length || current.some((p, i) => p !== s.original_pages[i])) {
    // バックエンド等で pages が詰め替えられても、表示用の元番号は維持
    s.pages = [...s.original_pages]
  }
}

function assignSectionPages(s, logicalPages) {
  if (!s) return
  const sorted = [...logicalPages].map(Number).sort((a, b) => a - b)
  s.pages = sorted
  s.original_pages = [...sorted]
  delete s.page_start
  delete s.page_end
}

function sectionOriginalPages(s) {
  ensureSectionOriginalPages(s)
  if (Array.isArray(s?.original_pages) && s.original_pages.length) {
    return [...s.original_pages].map(Number).sort((a, b) => a - b)
  }
  return sectionPages(s)
}

function sectionActivePages(s) {
  const trashed = getSectionTrashedLogicalPages(s?.id)
  return sectionOriginalPages(s).filter((lp) => !isLogicalPageDeleted(lp) && !trashed.has(lp))
}

function sectionPageStats(s) {
  const orig = sectionOriginalPages(s)
  const trashed = getSectionTrashedLogicalPages(s?.id)
  let pdfDel = 0
  let binderDel = 0
  for (const lp of orig) {
    if (isLogicalPageDeleted(lp)) pdfDel++
    else if (trashed.has(lp)) binderDel++
  }
  return { total: orig.length, active: orig.length - pdfDel - binderDel, pdfDel, binderDel }
}

function sectionBinderMetaLine(s) {
  const range = sectionRangeLabel(s)
  const stats = sectionPageStats(s)
  const countLabel = tr("binder.pageCountFixed", "{count}枚", { count: stats.total })
  let extra = ""
  if (stats.pdfDel) extra += tr("binder.pagePdfDeletedShort", "・PDF削除{count}", { count: stats.pdfDel })
  if (stats.binderDel) extra += tr("binder.pageTrashShort", "・ゴミ箱{count}", { count: stats.binderDel })
  return `元${range}・${countLabel}${extra}・${sectionStatusMeta(s?.status).label}`
}

async function reloadProjectState() {
  if (!state.projectPath) return false
  const loaded = await window.pywebview?.api?.load_project?.(state.projectPath)
  if (!loaded?.ok) return false
  state.tags = loaded.tags || []
  state.values = loaded.values || {}
  state.placements = loaded.placements || {}
  state.pageCount = loaded.page_count || 1
  hydrateBinder(loaded)
  syncBinderTrashState()
  try {
    const r = await window.pywebview?.api?.get_admin_settings?.()
    const s = r?.settings && typeof r.settings === "object" ? r.settings : {}
    if (Array.isArray(s.deleted_logical_pages) && s.deleted_logical_pages.length) {
      state.deletedLogicalPages = mergeDeletedLogicalPageLists(
        getDeletedLogicalPages(),
        s.deleted_logical_pages.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x >= 0),
      )
    }
    if (Array.isArray(s.binder_trash) && s.binder_trash.length) {
      state.binderTrash = mergeBinderTrashLists(state.binderTrash, s.binder_trash)
      syncTrashToHiddenCase()
      saveBinderTrashLocal()
    }
  } catch {}
  return true
}

async function persistBinder() {
  syncTrashToNotes()
  syncDeletedLogicalPagesToNotes()
  syncTrashToHiddenCase()
  saveBinderTrashLocal()
  const payload = {
    sections: state.sections || [],
    cases: state.cases || [],
    notes: state.notes || [],
  }
  try {
    await window.pywebview?.api?.set_binder_data?.(payload)
  } catch (e) {
    toast(`バインダー情報の保存に失敗: ${e}`)
    return false
  }
  try {
    await window.pywebview?.api?.set_binder_data?.({
      ...payload,
      deleted_logical_pages: getDeletedLogicalPages(),
    })
  } catch {}
  try {
    await window.pywebview?.api?.update_admin_settings?.({
      deleted_logical_pages: getDeletedLogicalPages(),
      binder_trash: state.binderTrash || [],
    })
  } catch {}
  return true
}

function genId(prefix) {
  return `${prefix}_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 6)}`
}

const SECTION_STATUSES = [
  { id: "reference", label: "参考資料", color: "#94a3b8" },
  { id: "todo", label: "未着手", color: "#cbd5e1" },
  { id: "in_progress", label: "作成中", color: "#f59e0b" },
  { id: "review", label: "要確認", color: "#fb923c" },
  { id: "done", label: "完了", color: "#22c55e" },
]

function sectionStatusMeta(status) {
  return SECTION_STATUSES.find((s) => s.id === status) || SECTION_STATUSES[1]
}

const NOTE_KINDS = [
  { id: "question", label: "不明", icon: "❓" },
  { id: "fix", label: "要修正", icon: "⚠️" },
  { id: "wait", label: "待ち", icon: "⏳" },
]

const CASE_VARIANTS = ["認定", "変更", "更新"]
const CASE_INDUSTRIES = ["", "介護", "外食業", "飲食料品製造業", "建設", "ビルクリーニング", "農業", "漁業", "宿泊", "製造業", "自動車整備", "航空", "造船・舶用工業"]

// 申請テンプレート（必要書類の初期セット）。実務で調整できる“叩き台”。
const BUILTIN_PRESETS = [
  {
    id: "builtin_nintei",
    name: "特定技能・認定（在留資格認定証明書交付申請）",
    variant: "認定",
    builtin: true,
    required_docs: [
      "在留資格認定証明書交付申請書",
      "提出書類一覧表",
      "特定技能雇用契約書",
      "雇用条件書",
      "賃金の支払",
      "特定技能外国人の報酬に関する説明書",
      "雇用の経緯に係る説明書",
      "特定技能外国人支援計画書",
      "支援委託契約に係る説明書",
    ],
    industry_docs: {
      介護: ["介護分野誓約書", "技能試験合格証"],
      外食業: ["外食業分野特定技能協議会の構成員資格を証する書類"],
      飲食料品製造業: ["食品産業特定技能協議会の構成員資格を証する書類"],
      建設: ["建設特定技能受入計画認定証", "JAC加入を証する書類"],
    },
  },
  {
    id: "builtin_henko",
    name: "特定技能・変更（在留資格変更許可申請）",
    variant: "変更",
    builtin: true,
    required_docs: [
      "在留資格変更許可申請書",
      "提出書類一覧表",
      "特定技能雇用契約書",
      "雇用条件書",
      "賃金の支払",
      "特定技能外国人の報酬に関する説明書",
      "特定技能外国人支援計画書",
      "支援委託契約に係る説明書",
    ],
    industry_docs: {
      介護: ["介護分野誓約書", "技能試験合格証"],
      外食業: ["外食業分野特定技能協議会の構成員資格を証する書類"],
      飲食料品製造業: ["食品産業特定技能協議会の構成員資格を証する書類"],
      建設: ["建設特定技能受入計画認定証", "JAC加入を証する書類"],
    },
  },
  {
    id: "builtin_koshin",
    name: "特定技能・更新（在留期間更新許可申請）",
    variant: "更新",
    builtin: true,
    required_docs: [
      "在留期間更新許可申請書",
      "提出書類一覧表",
      "特定技能雇用契約書（更新後）",
      "雇用条件書",
      "賃金の支払",
      "特定技能外国人支援計画書",
    ],
    industry_docs: {
      介護: ["介護分野誓約書"],
      外食業: ["外食業分野特定技能協議会の構成員資格を証する書類"],
    },
  },
]

function allPresets() {
  return [...BUILTIN_PRESETS, ...((state.presets || []).filter((p) => p && p.id))]
}

function presetById(id) {
  return allPresets().find((p) => p.id === id) || null
}

function requiredDocsForCase(c) {
  const preset = presetById(c?.preset)
  if (!preset) return []
  const base = [...(preset.required_docs || [])]
  const ind = c?.industry && preset.industry_docs ? preset.industry_docs[c.industry] || [] : []
  return [...base, ...ind]
}

function normLabel(s) {
  return String(s || "").replace(/\s+/g, "").toLowerCase()
}

// 必要書類 doc に対応するセクションを、ケース内の書類からラベル一致で探す
function matchSectionForDoc(caseObj, docName) {
  const sids = caseObj?.section_ids || []
  const dn = normLabel(docName)
  for (const sid of sids) {
    const s = sectionById(sid)
    if (!s) continue
    const sl = normLabel(s.label)
    if (sl === dn || sl.includes(dn) || dn.includes(sl)) return s
  }
  return null
}

async function loadPresets() {
  try {
    const r = await window.pywebview?.api?.list_doc_presets?.()
    state.presets = Array.isArray(r?.presets) ? r.presets : []
  } catch {
    state.presets = []
  }
}

function noteKindMeta(kind) {
  return NOTE_KINDS.find((k) => k.id === kind) || NOTE_KINDS[0]
}

function binderBadgeHtml() {
  const open = (state.notes || []).filter((n) => !n.resolved && !isBinderMetaNote(n)).length
  if (!open) return ""
  return ` <span class="chipBadge" style="display:inline-block;min-width:18px;padding:0 5px;border-radius:999px;background:#ef4444;color:#fff;font-size:11px;font-weight:800;text-align:center;line-height:18px">${open}</span>`
}

function sectionById(id) {
  return (state.sections || []).find((s) => s.id === id) || null
}

function sectionsSortedAll() {
  return [...(state.sections || [])].sort((a, b) => sectionFirstPage(a) - sectionFirstPage(b))
}

function sectionsForCase(caseId) {
  if (!caseId) return sectionsSortedAll()
  const c = (state.cases || []).find((x) => x.id === caseId)
  if (!c) return []
  return (c.section_ids || []).map((id) => sectionById(id)).filter(Boolean)
}

function sectionSharedCount(sectionId) {
  return (state.cases || []).filter((c) => (c.section_ids || []).includes(sectionId)).length
}

function notesForSection(sectionId) {
  return (state.notes || []).filter((n) => n.section_id === sectionId)
}

function sectionForPage(pageIdx) {
  return (state.sections || []).find((s) => sectionOriginalPages(s).includes(Number(pageIdx)))
}

const BINDER_TRASH_CASE_ID = "__binder_trash__"
const BINDER_TRASH_NOTE_KIND = "__binder_trash__"

function isTrashStorageNote(n) {
  return !!n && String(n.kind || "") === BINDER_TRASH_NOTE_KIND
}

function isBinderMetaNote(n) {
  return isTrashStorageNote(n) || isDeletedLogicalPagesNote(n)
}

function parseTrashEntryFromNote(n) {
  if (!isTrashStorageNote(n)) return null
  try {
    const entry = JSON.parse(String(n.text || ""))
    if (entry?.id) return entry
  } catch {}
  return null
}

function syncTrashFromNotes() {
  return (state.notes || []).map(parseTrashEntryFromNote).filter(Boolean)
}

function syncTrashToNotes() {
  const trash = state.binderTrash || []
  const keep = (state.notes || []).filter((n) => !isTrashStorageNote(n))
  const encoded = trash.map((entry) => ({
    id: String(entry.id),
    kind: BINDER_TRASH_NOTE_KIND,
    text: JSON.stringify(entry),
    page: -1,
    x: 0,
    y: 0,
    section_id: "",
    resolved: true,
  }))
  state.notes = [...keep, ...encoded]
}

function binderTrashStorageKey() {
  const p = String(state.projectPath || "").trim()
  return p ? `inputstudio-binder-trash:${p}` : null
}

function loadBinderTrashLocal() {
  const key = binderTrashStorageKey()
  if (!key) return []
  const raw = loadLocal(key, [])
  return Array.isArray(raw) ? raw : []
}

function saveBinderTrashLocal() {
  const key = binderTrashStorageKey()
  if (!key) return
  saveLocal(key, state.binderTrash || [])
}

function mergeBinderTrashLists(...lists) {
  const map = new Map()
  for (const list of lists) {
    for (const item of list || []) {
      if (item?.id) map.set(String(item.id), item)
    }
  }
  return [...map.values()].sort((a, b) => Number(b.deletedAt || 0) - Number(a.deletedAt || 0))
}

function isTrashBinCase(c) {
  return !!c && (c.id === BINDER_TRASH_CASE_ID || c._isTrashBin === true)
}

function visibleBinderCases() {
  return (state.cases || []).filter((c) => !isTrashBinCase(c))
}

function syncTrashToHiddenCase() {
  if (!Array.isArray(state.cases)) state.cases = []
  let tc = state.cases.find((c) => c.id === BINDER_TRASH_CASE_ID)
  if (!tc) {
    tc = { id: BINDER_TRASH_CASE_ID, label: "", section_ids: [], _isTrashBin: true, _trash: [] }
    state.cases.push(tc)
  }
  tc._trash = deepClone(state.binderTrash || [])
  tc._isTrashBin = true
}

function syncTrashFromHiddenCase() {
  const tc = (state.cases || []).find((c) => c.id === BINDER_TRASH_CASE_ID)
  return Array.isArray(tc?._trash) ? tc._trash : []
}

function syncBinderTrashState() {
  state.binderTrash = mergeBinderTrashLists(
    state.binderTrash,
    syncTrashFromNotes(),
    syncTrashFromHiddenCase(),
    loadBinderTrashLocal(),
  )
  syncTrashToNotes()
  syncTrashToHiddenCase()
  saveBinderTrashLocal()
}

function binderTrashCount() {
  syncBinderTrashState()
  return (state.binderTrash || []).length
}

function trashSectionLabel(entry) {
  if (entry?.type === "page") {
    const label = entry.sectionLabel || sectionById(entry.sectionId)?.label || "(無題)"
    return `${label} — P${Number(entry.logicalPage || 0) + 1}`
  }
  if (entry?.type === "unlink") {
    const s = sectionById(entry.sectionId)
    return s?.label || "(無題)"
  }
  return entry?.section?.label || "(無題)"
}

function trashSectionRange(entry) {
  if (entry?.type === "page") {
    return tr("binder.trashPageRange", "ページ P{page}", { page: Number(entry.logicalPage || 0) + 1 })
  }
  if (entry?.type === "unlink") {
    const s = sectionById(entry.sectionId)
    return s ? sectionRangeLabel(s) : "—"
  }
  return entry?.section ? sectionRangeLabel(entry.section) : "—"
}

function trashEntryKindLabel(entry) {
  if (entry?.type === "page") return tr("binder.trashKindPage", "ページ")
  if (entry?.type === "unlink") return tr("binder.trashKindUnlink", "書類リンク")
  return tr("binder.trashKindDoc", "書類")
}

async function moveSectionPagesToTrash(caseObj, section, logicalPageIndices) {
  if (!caseObj || !section) return { moved: 0, emptied: false, fullDoc: false }
  ensureSectionOriginalPages(section)
  const trashed = getSectionTrashedLogicalPages(section.id)
  const allPages = sectionOriginalPages(section).filter((lp) => !isLogicalPageDeleted(lp) && !trashed.has(lp))
  const chosenSet = new Set(
    (logicalPageIndices || []).map((x) => Number(x)).filter((lp) => allPages.includes(lp)),
  )
  const sortedChosen = allPages.filter((lp) => chosenSet.has(lp))
  if (!sortedChosen.length) return { moved: 0, emptied: false, fullDoc: false }

  const orig = sectionOriginalPages(section)
  if (sortedChosen.length >= allPages.length) {
    const ok = await moveSectionToTrash(caseObj, section.id)
    return { moved: ok ? sortedChosen.length : 0, emptied: ok, fullDoc: true }
  }

  const newEntries = sortedChosen.map((lp) => {
    const pageIndexInSection = orig.indexOf(lp)
    const pageNotes = notesForSection(section.id).filter((n) => Number(n.page || 0) === lp)
    return {
      id: genId("tr"),
      type: "page",
      sectionId: section.id,
      sectionLabel: String(section.label || ""),
      logicalPage: lp,
      pageIndexInSection,
      caseId: caseObj.id,
      caseLabel: caseLabel(caseObj),
      notes: deepClone(pageNotes),
      deletedAt: Date.now(),
    }
  })

  state.binderTrash = [...(state.binderTrash || []), ...newEntries]
  syncTrashToNotes()
  syncTrashToHiddenCase()
  saveBinderTrashLocal()
  await persistBinder()
  syncBinderTrashState()
  return { moved: sortedChosen.length, emptied: false, fullDoc: false }
}

async function moveSectionToTrash(caseObj, sid) {
  const s = sectionById(sid)
  if (!s || !caseObj) {
    toast("書類が見つかりません")
    return false
  }
  const idx = (caseObj.section_ids || []).indexOf(sid)
  if (idx < 0) {
    toast("このバインダーに書類がありません")
    return false
  }
  const sharedBefore = sectionSharedCount(sid)
  const confirmMsg = tr(
    "dialog.moveDocToTrash",
    `「${s.label || "(無題)"}」をゴミ箱へ移動します。ゴミ箱から復元できます。よろしいですか？`,
    { name: s.label || "(無題)" },
  )
  let ok = false
  try {
    ok = await uiConfirm(confirmMsg)
  } catch (e) {
    console.error("uiConfirm failed:", e)
    ok = window.confirm(confirmMsg)
  }
  if (!ok) return false

  caseObj.section_ids = (caseObj.section_ids || []).filter((x) => x !== sid)
  if (sharedBefore > 1) {
    state.binderTrash = [
      ...(state.binderTrash || []),
      {
        id: genId("tr"),
        type: "unlink",
        sectionId: sid,
        caseId: caseObj.id,
        caseLabel: caseLabel(caseObj),
        sectionIndex: idx,
        deletedAt: Date.now(),
      },
    ]
  } else {
    state.binderTrash = [
      ...(state.binderTrash || []),
      {
        id: genId("tr"),
        type: "full",
        section: deepClone(s),
        caseId: caseObj.id,
        caseLabel: caseLabel(caseObj),
        sectionIndex: idx,
        notes: deepClone(notesForSection(sid)),
        deletedAt: Date.now(),
      },
    ]
    state.sections = (state.sections || []).filter((x) => x.id !== sid)
    state.notes = (state.notes || []).filter((n) => n.section_id !== sid)
  }
  syncTrashToNotes()
  syncTrashToHiddenCase()
  saveBinderTrashLocal()
  await persistBinder()
  syncBinderTrashState()
  toast(tr("main.toast.movedToTrash", "ゴミ箱に移動しました"))
  return true
}

async function restoreBinderTrashItems(trashIds) {
  const ids = [...new Set((trashIds || []).map(String).filter(Boolean))]
  if (!ids.length) return { restored: 0, failed: 0 }

  const sortedIds = [...ids].sort((a, b) => {
    const ea = (state.binderTrash || []).find((x) => x.id === a)
    const eb = (state.binderTrash || []).find((x) => x.id === b)
    if (ea?.type === "page" && eb?.type === "page") {
      if (ea.sectionId !== eb.sectionId) return String(ea.sectionId || "").localeCompare(String(eb.sectionId || ""))
      return Number(ea.pageIndexInSection || 0) - Number(eb.pageIndexInSection || 0)
    }
    return 0
  })

  let restored = 0
  let failed = 0
  for (const tid of sortedIds) {
    const entry = (state.binderTrash || []).find((x) => x.id === tid)
    if (!entry) {
      failed++
      continue
    }
    const caseObj = (state.cases || []).find((c) => c.id === entry.caseId)
    if (!caseObj) {
      toast(tr("main.toast.trashRestoreNoCase", `バインダー「${entry.caseLabel || ""}」が見つかりません`, { name: entry.caseLabel || "" }))
      failed++
      continue
    }
    if (!Array.isArray(caseObj.section_ids)) caseObj.section_ids = []

    if (entry.type === "page") {
      const sid = entry.sectionId
      const sec = sectionById(sid)
      if (!sec) {
        toast(tr("main.toast.trashRestoreNoSection", "書類データが見つかりません"))
        failed++
        continue
      }
      ensureSectionOriginalPages(sec)
      for (const n of entry.notes || []) {
        if (!n?.id) continue
        if (!(state.notes || []).some((x) => x.id === n.id)) {
          state.notes = [...(state.notes || []), deepClone(n)]
        }
      }
    } else if (entry.type === "unlink") {
      const sid = entry.sectionId
      if (!sectionById(sid)) {
        toast(tr("main.toast.trashRestoreNoSection", "書類データが見つかりません"))
        failed++
        continue
      }
      if (!caseObj.section_ids.includes(sid)) {
        const at = Math.max(0, Math.min(Number(entry.sectionIndex || 0), caseObj.section_ids.length))
        caseObj.section_ids.splice(at, 0, sid)
      }
    } else {
      const sec = entry.section
      if (!sec?.id) {
        failed++
        continue
      }
      if (!sectionById(sec.id)) {
        state.sections = [...(state.sections || []), deepClone(sec)]
      }
      if (!caseObj.section_ids.includes(sec.id)) {
        const at = Math.max(0, Math.min(Number(entry.sectionIndex || 0), caseObj.section_ids.length))
        caseObj.section_ids.splice(at, 0, sec.id)
      }
      for (const n of entry.notes || []) {
        if (!n?.id) continue
        if (!(state.notes || []).some((x) => x.id === n.id)) {
          state.notes = [...(state.notes || []), deepClone(n)]
        }
      }
    }

    state.binderTrash = (state.binderTrash || []).filter((x) => x.id !== tid)
    restored++
  }

  syncTrashToNotes()
  syncTrashToHiddenCase()
  saveBinderTrashLocal()
  if (restored) await persistBinder()
  return { restored, failed }
}

async function purgeBinderTrashItems(trashIds) {
  const ids = new Set((trashIds || []).map(String).filter(Boolean))
  if (!ids.size) return 0
  const before = (state.binderTrash || []).length
  state.binderTrash = (state.binderTrash || []).filter((x) => !ids.has(x.id))
  const removed = before - state.binderTrash.length
  syncTrashToNotes()
  syncTrashToHiddenCase()
  saveBinderTrashLocal()
  if (removed) await persistBinder()
  return removed
}

function formatTrashDate(ts) {
  try {
    const d = new Date(Number(ts || 0))
    if (!Number.isFinite(d.getTime())) return ""
    return d.toLocaleString(getLocaleSafe())
  } catch {
    return ""
  }
}

function renderBinderTrash() {
  const modal = $("#modal")
  if (!modal) return
  syncBinderTrashState()
  const items = [...(state.binderTrash || [])].sort((a, b) => Number(b.deletedAt || 0) - Number(a.deletedAt || 0))
  const selected = new Set()

  const renderList = () => {
    const host = $("#trashList")
    if (!host) return
    if (!items.length) {
      host.innerHTML = `<div style="color:#64748b;padding:16px;text-align:center">${escapeHtml(tr("binder.trashEmpty", "ゴミ箱は空です"))}</div>`
      return
    }
    host.innerHTML = items
      .map((entry) => {
        const checked = selected.has(entry.id) ? "checked" : ""
        const name = trashSectionLabel(entry)
        const range = trashSectionRange(entry)
        const kind = trashEntryKindLabel(entry)
        return `
      <label class="binderRow binderTrashRow" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;cursor:pointer">
        <input type="checkbox" class="trashPick" data-trash-id="${escapeHtml(entry.id)}" ${checked} style="margin-top:4px" />
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(name)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${escapeHtml(tr("binder.trashFrom", "元のバインダー"))}: ${escapeHtml(entry.caseLabel || "—")} ・ <span style="color:#7c5cff">${escapeHtml(kind)}</span> ・ ${escapeHtml(range)} ・ ${escapeHtml(formatTrashDate(entry.deletedAt))}</div>
        </div>
      </label>`
      })
      .join("")

    host.querySelectorAll(".trashPick").forEach((el) => {
      el.onchange = () => {
        const id = el.getAttribute("data-trash-id")
        if (!id) return
        if (el.checked) selected.add(id)
        else selected.delete(id)
        updateTrashActions()
      }
    })
  }

  const updateTrashActions = () => {
    const restoreBtn = $("#trashRestore")
    const purgeBtn = $("#trashPurge")
    const n = selected.size
    if (restoreBtn) restoreBtn.disabled = n <= 0
    if (purgeBtn) purgeBtn.disabled = n <= 0
  }

  modal.style.display = "block"
  modal.innerHTML = `
    <div class="modal__backdrop" id="binderClose"></div>
    <div class="modal__card" style="max-width:720px;width:92vw;max-height:88vh;display:flex;flex-direction:column">
      <div class="modal__title" style="display:flex;align-items:center;gap:10px">
        <button class="btn btn--soft" id="trashBack" style="padding:4px 10px">${escapeHtml(tr("binder.trashBack", "← 戻る"))}</button>
        <span style="flex:1">${escapeHtml(tr("binder.trashTitle", "ゴミ箱"))} <span style="font-size:13px;color:#64748b">(${items.length})</span></span>
      </div>
      <div class="label" style="margin-bottom:8px">${escapeHtml(tr("binder.trashHint", "復元したい書類・ページにチェックを入れて「復元」を押してください。元のバインダー・書類・順番に戻ります。"))}</div>
      <div id="trashList" style="overflow:auto;flex:1;min-height:120px"></div>
      <div class="row" style="margin-top:12px;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <div class="row" style="gap:8px">
          <button class="btn btn--soft" id="trashSelectAll" ${items.length ? "" : "disabled"}>${escapeHtml(tr("binder.trashSelectAll", "すべて選択"))}</button>
          <button class="btn btn--soft" id="trashClearSel" ${items.length ? "" : "disabled"}>${escapeHtml(tr("binder.trashClearSel", "選択解除"))}</button>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn btn--primary" id="trashRestore" disabled>${escapeHtml(tr("binder.trashRestore", "選択を復元"))}</button>
          <button class="btn btn--soft" id="trashPurge" disabled>${escapeHtml(tr("binder.trashPurge", "完全削除"))}</button>
        </div>
      </div>
    </div>`

  renderList()
  updateTrashActions()

  $("#binderClose").onclick = closeBinderModal
  $("#trashBack").onclick = () => {
    if (state.binderTrashReturn === "detail" && state.binderCaseFilter) renderBinderDetail()
    else renderBinderHome()
  }
  $("#trashSelectAll")?.addEventListener("click", () => {
    items.forEach((x) => selected.add(x.id))
    renderList()
    updateTrashActions()
  })
  $("#trashClearSel")?.addEventListener("click", () => {
    selected.clear()
    renderList()
    updateTrashActions()
  })
  $("#trashRestore")?.addEventListener("click", async () => {
    const ids = [...selected]
    if (!ids.length) return
    const r = await restoreBinderTrashItems(ids)
    if (r.restored) {
      toast(tr("main.toast.trashRestored", "{count} 件の書類を復元しました", { count: r.restored }))
      render()
      if (state.binderTrashReturn === "detail" && state.binderCaseFilter) renderBinderDetail()
      else renderBinderTrash()
    }
  })
  $("#trashPurge")?.addEventListener("click", async () => {
    const ids = [...selected]
    if (!ids.length) return
    const ok = await uiConfirm(tr("dialog.purgeTrash", "選択した書類をゴミ箱から完全に削除します。復元できなくなります。よろしいですか？"))
    if (!ok) return
    const n = await purgeBinderTrashItems(ids)
    if (n) toast(tr("main.toast.trashPurged", "{count} 件を完全削除しました", { count: n }))
    renderBinderTrash()
    render()
  })
}

function openBinderTrash(from = "home") {
  state.binderTrashReturn = from === "detail" ? "detail" : "home"
  renderBinderTrash()
}

function binderTrashBadgeHtml() {
  const n = binderTrashCount()
  if (!n) return ""
  return ` <span class="chipBadge" style="display:inline-block;min-width:18px;padding:0 5px;border-radius:999px;background:#64748b;color:#fff;font-size:11px;font-weight:800;text-align:center;line-height:18px">${n}</span>`
}

async function binderJumpToPage(pageIdx) {
  const logical = Math.max(0, Number(pageIdx || 0))
  if (isLogicalPageDeleted(logical)) {
    return toast(tr("main.toast.binderPageDeleted", `P${logical + 1} はPDFから削除済みです`, { page: logical + 1 }))
  }
  const physical = logicalToPhysicalPage(logical)
  const idx = Math.max(0, Math.min(Number(state.pageCount || 1) - 1, physical))
  state.pageLocked = true
  await showPage(idx)
}

function snapshotProject() {
  return {
    tags: [...state.tags],
    values: deepClone(state.values || {}),
    placements: deepClone(state.placements || {}),
  }
}

async function applyProjectSnapshot(snap, { save = true } = {}) {
  clearReuseReviewState()
  state.tags = Array.isArray(snap?.tags) ? [...snap.tags] : []
  state.values = snap?.values && typeof snap.values === "object" ? deepClone(snap.values) : {}
  state.placements = snap?.placements && typeof snap.placements === "object" ? deepClone(snap.placements) : {}
  state.idx = Math.max(0, Math.min(state.idx, state.tags.length - 1))
  state.selectKeys = state.selectKeys.filter((fid) => state.placements?.[fid])
  if (save && window.pywebview?.api?.set_project_payload) {
    await window.pywebview.api.set_project_payload({ tags: state.tags, values: state.values, placements: state.placements })
    await window.pywebview.api.save_current_project?.(false)
  }
  render()
}

function pushUndo(beforeSnap) {
  state.undoStack.push(beforeSnap)
  if (state.undoStack.length > 60) state.undoStack.shift()
  state.redoStack = []
}

const CLIPBOARD_SESSION_KEY = "inputstudio.elementClipboard"

function persistElementClipboard(clip) {
  try {
    if (clip) sessionStorage.setItem(CLIPBOARD_SESSION_KEY, JSON.stringify(clip))
    else sessionStorage.removeItem(CLIPBOARD_SESSION_KEY)
  } catch {}
}

function restoreElementClipboardFromSession() {
  try {
    const raw = sessionStorage.getItem(CLIPBOARD_SESSION_KEY)
    if (!raw) return
    const clip = JSON.parse(raw)
    if (clip?.fids?.length && clip?.placements) state.clipboard = clip
  } catch {}
}

function buildElementClipboard(fids) {
  const placements = {}
  let minX = Infinity
  let minY = Infinity
  for (const fid of fids) {
    const pl = state.placements?.[fid]
    if (!pl) continue
    placements[fid] = deepClone(pl)
    minX = Math.min(minX, Number(pl.x || 0))
    minY = Math.min(minY, Number(pl.y || 0))
  }
  const keys = fids.filter((f) => placements[f])
  return {
    fids: keys,
    placements,
    anchor: { x: minX === Infinity ? 0 : minX, y: minY === Infinity ? 0 : minY },
    sourcePage: Number(state.previewPageIndex || 0),
  }
}

function pasteElementClipboard(clip) {
  if (!clip?.fids?.length) return []
  const targetPage = Number(state.previewPageIndex || 0)
  const sourcePage = Number.isFinite(clip.sourcePage) ? Number(clip.sourcePage) : null
  const samePage = sourcePage === null ? true : targetPage === sourcePage
  const pasteDx = samePage ? 18 : 0
  const pasteDy = samePage ? 18 : 0
  let ax = Number(clip.anchor?.x)
  let ay = Number(clip.anchor?.y)
  if (!Number.isFinite(ax) || !Number.isFinite(ay)) {
    const rebuilt = buildElementClipboard(clip.fids)
    ax = rebuilt.anchor.x
    ay = rebuilt.anchor.y
  }
  const pasted = []
  const makeFid = () => `f_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 8)}`
  for (const src of clip.fids) {
    const pl = clip.placements?.[src]
    if (!pl) continue
    const newFid = makeFid()
    const tag = String(pl.tag || "").trim()
    if (tag && !state.tags.includes(tag)) state.tags.push(tag)
    const rx = Number(pl.x || 0) - ax
    const ry = Number(pl.y || 0) - ay
    state.placements[newFid] = {
      ...deepClone(pl),
      page: targetPage,
      x: Math.max(0, ax + rx + pasteDx),
      y: Math.max(0, ay + ry + pasteDy),
    }
    pasted.push(newFid)
  }
  return pasted
}

function rectsIntersect(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1) {
  return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0
}

function fidsInPageRect(page, x0, y0, x1, y1) {
  const rx0 = Math.min(x0, x1)
  const ry0 = Math.min(y0, y1)
  const rx1 = Math.max(x0, x1)
  const ry1 = Math.max(y0, y1)
  const out = []
  for (const [fid, pl] of Object.entries(state.placements || {})) {
    if (Number(pl?.page || 0) !== page) continue
    const b = placementBoxOnPage(fid, pl)
    const px = Number(pl.x || 0)
    const py = Number(pl.y || 0)
    if (rectsIntersect(rx0, ry0, rx1, ry1, px, py, px + b.w, py + b.h)) out.push(fid)
  }
  return out
}

function selectKeysOnCurrentPage() {
  const page = Number(state.previewPageIndex || 0)
  return (state.selectKeys || []).filter((k) => Number(state.placements?.[k]?.page || 0) === page)
}

function isTextEditingTarget(el) {
  const t = (el?.tagName || "").toLowerCase()
  if (t === "textarea") return true
  if (t === "input") return true
  if (el?.isContentEditable) return true
  return false
}

function uniqueTag(base) {
  const clean = String(base || "").trim() || "tag"
  if (!state.tags.includes(clean)) return clean
  for (let i = 2; i < 9999; i++) {
    const t = `${clean}_${i}`
    if (!state.tags.includes(t)) return t
  }
  return `${clean}_${Date.now()}`
}

function isWideChar(ch) {
  const c = (ch || "").charCodeAt(0) || 0
  // Hiragana/Katakana/CJK, fullwidth forms, punctuation blocks
  if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0x3400 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef) || (c >= 0x3000 && c <= 0x303f))
    return true
  return false
}

function placementBoxOnPage(fid, pl) {
  const fs = Number(pl?.font_size || 14) || 14
  const lh = Number(pl?.line_height || 1.2) || 1.2
  const ls = Number(pl?.letter_spacing ?? DEFAULT_LETTER_SPACING) || DEFAULT_LETTER_SPACING
  const writingMode = String(pl?.writing_mode || "horizontal")
  const tag = String(pl?.tag || "").trim()
  const v = String((state.values?.[tag] || "")).replaceAll("<br>", "\n")
  const lines = (v ? v.split("\n") : []).filter((s) => s != null)
  const drawLines = lines.length ? lines : [tag || fid]

  const padX = Math.max(8, fs * 0.35)
  const padY = Math.max(6, fs * 0.25)

  let wPage = 42
  let hPage = 22
  if (writingMode === "vertical") {
    // splitlines => columns (right-to-left)
    const cols = drawLines
    const maxChars = Math.max(1, ...cols.map((s) => String(s || "").length))
    const colCount = Math.max(1, cols.length)
    const stepY = fs * lh + ls
    const stepX = fs * 1.10 + ls
    hPage = Math.max(22, maxChars * stepY + padY * 2)
    wPage = Math.max(32, colCount * stepX + padX * 2)
  } else {
    let maxW = 0
    for (const line of drawLines) {
      const s = String(line || "")
      let w = 0
      for (const ch of s) {
        w += (isWideChar(ch) ? fs * 1.0 : fs * 0.62)
      }
      if (s.length > 1) w += (s.length - 1) * ls
      maxW = Math.max(maxW, w)
    }
    wPage = Math.max(42, maxW + padX * 2)
    hPage = Math.max(22, drawLines.length * fs * lh + padY * 2)
  }

  const x = Number(pl?.x || 0)
  const y = Number(pl?.y || 0)
  return { x, y, w: wPage, h: hPage, padX, padY }
}

function toast(msg) {
  const el = $("#toast")
  el.textContent = msg
  el.style.display = "block"
  clearTimeout(el._t)
  el._t = setTimeout(() => (el.style.display = "none"), 2100)
}

// ---- Blocking loading overlay with progress (%) ----
// Built at the document.body level so render() (which rewrites #app) never wipes it.
function ensureLoadMask() {
  let mask = document.getElementById("isLoadMask")
  if (mask) return mask
  mask = document.createElement("div")
  mask.id = "isLoadMask"
  mask.style.cssText = [
    "position:fixed", "inset:0", "z-index:99999", "display:none",
    "align-items:center", "justify-content:center",
    "background:rgba(15,23,42,.55)", "backdrop-filter:blur(3px)",
  ].join(";")
  mask.innerHTML = `
    <div style="min-width:320px;max-width:80vw;background:#fff;border-radius:16px;padding:24px 28px;box-shadow:0 20px 60px rgba(0,0,0,.35);font-family:system-ui,-apple-system,Segoe UI,sans-serif">
      <div id="isLoadTitle" style="font-weight:800;font-size:16px;color:#0f172a;margin-bottom:4px">処理中…</div>
      <div id="isLoadSub" style="font-size:13px;color:#64748b;margin-bottom:14px">しばらくお待ちください（この間は操作できません）</div>
      <div style="height:12px;border-radius:999px;background:#e2e8f0;overflow:hidden">
        <div id="isLoadBar" style="height:100%;width:0%;background:linear-gradient(90deg,#7c5cff,#ff6aa2);transition:width .15s ease"></div>
      </div>
      <div id="isLoadPct" style="margin-top:8px;font-size:13px;color:#475569;text-align:right">0%</div>
    </div>`
  document.body.appendChild(mask)
  return mask
}

function showLoading(title, sub) {
  const mask = ensureLoadMask()
  const t = mask.querySelector("#isLoadTitle")
  const s = mask.querySelector("#isLoadSub")
  if (t) t.textContent = title || "処理中…"
  if (s) s.textContent = sub || "しばらくお待ちください（この間は操作できません）"
  setLoadingProgress({ current: 0, total: 0, indeterminate: true })
  mask.style.display = "flex"
}

function setLoadingProgress(p) {
  const mask = document.getElementById("isLoadMask")
  if (!mask) return
  const bar = mask.querySelector("#isLoadBar")
  const pct = mask.querySelector("#isLoadPct")
  const sub = mask.querySelector("#isLoadSub")
  const total = Number(p?.total || 0)
  const current = Number(p?.current || 0)
  if (!total || p?.indeterminate) {
    if (bar) {
      bar.style.width = "35%"
      bar.style.opacity = "0.6"
    }
    if (pct) pct.textContent = ""
    return
  }
  const ratio = Math.max(0, Math.min(1, current / total))
  if (bar) {
    bar.style.opacity = "1"
    bar.style.width = `${Math.round(ratio * 100)}%`
  }
  if (pct) pct.textContent = `${Math.round(ratio * 100)}%（${current} / ${total} ページ）`
  if (sub && p?.label) sub.textContent = p.label
}

function hideLoading() {
  const mask = document.getElementById("isLoadMask")
  if (mask) mask.style.display = "none"
}

// Called from Python (window.evaluate_js) during long export operations.
window.__isProgress = (p) => {
  try {
    setLoadingProgress({ current: p?.current, total: p?.total, label: p?.label })
  } catch {}
}

function normalizeBulkPasteKey(raw) {
  return String(raw ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\u3000/g, " ")
    .trim()
}

function collectKnownTagsForBulk() {
  const s = new Set((state.tags || []).map((t) => String(t).trim()).filter(Boolean))
  for (const pl of Object.values(state.placements || {})) {
    const t = String(pl?.tag || "").trim()
    if (t) s.add(t)
  }
  return s
}

/** Tag order: state.tags first, then any tag found only on placements. */
function listProjectTagsOrdered() {
  const out = []
  const seen = new Set()
  for (const t of state.tags || []) {
    const tt = String(t).trim()
    if (!tt || seen.has(tt)) continue
    seen.add(tt)
    out.push(tt)
  }
  for (const pl of Object.values(state.placements || {})) {
    const tt = String(pl?.tag || "").trim()
    if (!tt || seen.has(tt)) continue
    seen.add(tt)
    out.push(tt)
  }
  return out
}

/**
 * Parse pasted table/chart text into tag->value map.
 * @param {string} text
 * @param {"tab"|"comma"|"colon"|"equals"} mode
 * @param {{ skipFirst: boolean }} opts
 */
function parseBulkPasteText(text, mode, opts = {}) {
  const skipFirst = !!opts.skipFirst
  const lines = String(text || "").split(/\r?\n/)
  const rows = []
  for (const line of lines) {
    if (!line.replace(/\uFEFF/g, "").trim()) continue
    rows.push(line.replace(/\r/g, ""))
  }
  if (skipFirst && rows.length) rows.shift()
  /** @type {Record<string,string>} */
  const out = Object.create(null)
  for (const row of rows) {
    let k = ""
    let v = ""
    if (mode === "tab") {
      const parts = row.split("\t")
      if (parts.length < 2) continue
      k = normalizeBulkPasteKey(parts[0])
      v = parts.slice(1).join("\t").replace(/\r/g, "")
    } else if (mode === "comma") {
      const idx = row.indexOf(",")
      if (idx <= 0) continue
      k = normalizeBulkPasteKey(row.slice(0, idx))
      v = row.slice(idx + 1).replace(/^\s+/, "")
    } else if (mode === "colon") {
      const m = row.match(/^(.+?)[:：]\s*(.*)$/)
      if (!m) continue
      k = normalizeBulkPasteKey(m[1])
      v = m[2] || ""
    } else if (mode === "equals") {
      const idx = row.indexOf("=")
      if (idx <= 0) continue
      k = normalizeBulkPasteKey(row.slice(0, idx))
      v = row.slice(idx + 1).replace(/^\s+/, "")
    }
    if (!k) continue
    out[k] = v.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  }
  return out
}

async function copyBulkTemplateTsv(includeValues) {
  const esc = (x) =>
    String(x ?? "")
      .replace(/\t/g, " ")
      .replace(/\r?\n/g, " ")
  const tagH = tr("bulkPaste.tsvHeaderTag", "項目（タグ名）")
  const valH = tr("bulkPaste.tsvHeaderVal", "値")
  const lines = [`${tagH}\t${valH}`]
  for (const tag of listProjectTagsOrdered()) {
    lines.push(`${esc(tag)}\t${includeValues ? esc(String(state.values?.[tag] ?? "")) : ""}`)
  }
  const blob = lines.join("\n")
  try {
    await navigator.clipboard.writeText(blob)
    toast(tr("bulkPaste.toastCopied", "表をクリップボードにコピーしました（タブ区切り）"))
  } catch {
    toast(tr("bulkPaste.toastCopyFailed", "コピーできませんでした（ブラウザの権限を確認してください）"))
  }
}

function ensureSysDialogRoot() {
  let root = document.getElementById("sysDialogRoot")
  if (!root) {
    root = document.createElement("div")
    root.id = "sysDialogRoot"
    root.className = "sysDialog"
    root.style.display = "none"
    document.body.appendChild(root)
  }
  return root
}

async function openSysDialog({ title, message, type = "alert", defaultValue = "" }) {
  const root = ensureSysDialogRoot()
  return await new Promise((resolve) => {
    const close = (value) => {
      root.style.display = "none"
      root.innerHTML = ""
      resolve(value)
    }
    root.style.display = "block"
    root.innerHTML = `
      <div class="sysDialog__backdrop" id="sysDialogBackdrop"></div>
      <div class="sysDialog__card">
        <div class="sysDialog__title">${escapeHtml(String(title || tr("dialog.title", "確認")))}</div>
        <div class="sysDialog__body">${escapeHtml(String(message || ""))}</div>
        ${type === "prompt" ? `<input class="input" id="sysDialogInput" value="${escapeHtml(String(defaultValue || ""))}" />` : ""}
        <div class="row" style="justify-content:flex-end; margin-top:12px">
          ${type !== "alert" ? `<button class="btn btn--soft" id="sysDialogCancel">${escapeHtml(tr("dialog.cancel", "キャンセル"))}</button>` : ""}
          <button class="btn btn--primary" id="sysDialogOk">${escapeHtml(type === "alert" ? tr("dialog.ok", "OK") : tr("dialog.continue", "続行"))}</button>
        </div>
      </div>
    `
    const input = document.getElementById("sysDialogInput")
    if (input) {
      input.focus()
      try {
        const len = String(input.value || "").length
        input.setSelectionRange(len, len)
      } catch {}
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault()
          close(String(input.value || ""))
        }
      })
    }
    const ok = document.getElementById("sysDialogOk")
    if (ok) ok.onclick = () => close(type === "prompt" ? String(input?.value || "") : true)
    const cancel = document.getElementById("sysDialogCancel")
    if (cancel) cancel.onclick = () => close(type === "prompt" ? null : false)
    const backdrop = document.getElementById("sysDialogBackdrop")
    if (backdrop) backdrop.onclick = () => close(type === "prompt" ? null : false)
  })
}

const uiAlert = async (msg, title = null) => openSysDialog({ title, message: msg, type: "alert" })
const uiConfirm = async (msg, title = null) => openSysDialog({ title, message: msg, type: "confirm" })
const uiPrompt = async (msg, defaultValue = "", title = null) => openSysDialog({ title, message: msg, type: "prompt", defaultValue })

function apiErrorMessage(result, fallback = "エラーが発生しました") {
  const code = String(result?.code || "").toUpperCase()
  const map = {
    RATE_LIMITED: tr("error.rateLimited", "アクセスが集中しています。少し待って再試行してください。"),
    UPLOAD_TOO_LARGE: tr("error.uploadTooLarge", "アップロードファイルが大きすぎます。サイズを下げて再試行してください。"),
    SERVER_BUSY: tr("error.serverBusy", "サーバーが混み合っています。少し待って再試行してください。"),
    INVALID_ORDER: tr("error.invalidOrder", "並び順データが不正です。並べ替えをやり直してください。"),
    METHOD_NOT_ALLOWED: tr("error.methodNotAllowed", "サーバー接続エラーです。サーバー再起動後に再試行してください。"),
  }
  if (code && map[code]) return map[code]
  return String(result?.error || fallback)
}

function shouldShowUnlockAd(action) {
  if (!isWeb()) return false
  const rule = AD_UNLOCK_RULES[action]
  if (!rule) return false
  const now = Date.now()
  const last = Number(state.adLastShown?.[action] || 0)
  const count = Number(state.adSessionCounts?.[action] || 0)
  if (count >= Number(rule.maxPerSession || 0)) return false
  return now - last >= Number(rule.cooldownMs || 0)
}

function recordUnlockAdShown(action) {
  const now = Date.now()
  state.adLastShown = state.adLastShown || {}
  state.adSessionCounts = state.adSessionCounts || {}
  state.adLastShown[action] = now
  state.adSessionCounts[action] = Number(state.adSessionCounts[action] || 0) + 1
  saveLocal("inputstudio-ad-last-shown", state.adLastShown)
}

function unlockHintBubble(action) {
  if (!isWeb()) return ""
  if (!AD_UNLOCK_RULES[action]) return ""
  return ` <span class="adHintBubble">${escapeHtml(tr("ad.unlock.badge", "広告を見て解放"))}</span>`
}

async function showUnlockAd(action) {
  if (!shouldShowUnlockAd(action)) return true
  const modal = $("#modal")
  if (!modal) return true
  const cfg = getAdConfig()
  const unlockSlotId = getAdSlotFor("unlock") || getAdSlotFor("gate")
  const showLiveUnlockAd = cfg.enabled && cfg.provider === "adsense" && !!unlockSlotId
  return await new Promise((resolve) => {
    let sec = Math.max(1, Number(cfg.unlock?.minSeconds || 3) || 3)
    const close = (ok) => {
      modal.style.display = "none"
      modal.innerHTML = ""
      resolve(!!ok)
    }
    modal.style.display = "block"
    modal.innerHTML = `
      <div class="modal__backdrop" id="adUnlockClose"></div>
      <div class="modal__card" style="max-width:420px; width:min(92vw,420px)">
        <div class="modal__title">${escapeHtml(tr("ad.unlock.title", "広告を表示して続行"))}</div>
        <div class="label" style="line-height:1.7">${escapeHtml(tr("ad.unlock.desc", "無料提供を継続するため、短い広告表示後にこの操作を実行できます。"))}</div>
        ${showLiveUnlockAd ? `<div class="adUnlockLive" id="adUnlockLive"></div>` : `<div class="adUnlockMock">AD</div>`}
        <div class="label" id="adUnlockTimer">${escapeHtml(tr("ad.unlock.wait", `${sec}秒後に続行できます`, { sec }))}</div>
        <div class="row" style="justify-content:flex-end; margin-top:12px">
          <button class="btn btn--soft" id="adUnlockCancel">${escapeHtml(tr("ad.unlock.cancel", "キャンセル"))}</button>
          <button class="btn btn--primary" id="adUnlockGo" disabled>${escapeHtml(tr("ad.unlock.continue", "広告を見て続行"))}</button>
        </div>
      </div>
    `
    if (showLiveUnlockAd) {
      ensureAdSenseScript().then((ok) => {
        if (!ok) return
        const live = document.getElementById("adUnlockLive")
        if (!live) return
        mountAdSenseInto(live, unlockSlotId)
      })
    }
    const btnGo = $("#adUnlockGo")
    const timerEl = $("#adUnlockTimer")
    const timer = setInterval(() => {
      sec -= 1
      if (sec <= 0) {
        clearInterval(timer)
        if (btnGo) btnGo.disabled = false
        if (timerEl) timerEl.textContent = tr("ad.unlock.ready", "続行できます")
        return
      }
      if (timerEl) timerEl.textContent = tr("ad.unlock.wait", `${sec}秒後に続行できます`, { sec })
    }, 1000)
    $("#adUnlockClose").onclick = () => {
      clearInterval(timer)
      close(false)
    }
    $("#adUnlockCancel").onclick = () => {
      clearInterval(timer)
      close(false)
    }
    if (btnGo) {
      btnGo.onclick = () => {
        clearInterval(timer)
        recordUnlockAdShown(action)
        close(true)
      }
    }
  })
}

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec))
  const h = String(Math.floor(s / 3600)).padStart(2, "0")
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
  // 要望: タイマーは「時:分」だけ表示（秒は不要）
  return `${h}:${m}`
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function tipIcon(n, text) {
  return `<span class="tipIcon" data-tip="${escapeHtml(text)}">${n}</span>`
}

// Tooltip that never goes off-screen (replaces CSS-only tooltip).
let _tipFloatBound = false
let _previewFitBound = false
function bindTipFloatOnce() {
  if (_tipFloatBound) return
  _tipFloatBound = true

  const ensureEl = () => {
    let el = document.getElementById("tipFloat")
    if (!el) {
      el = document.createElement("div")
      el.id = "tipFloat"
      el.className = "tipFloat"
      el.style.display = "none"
      document.body.appendChild(el)
    }
    return el
  }

  let active = null
  const hide = () => {
    const el = document.getElementById("tipFloat")
    if (el) el.style.display = "none"
    active = null
  }
  const showFor = (target) => {
    const tip = target?.getAttribute?.("data-tip")
    if (!tip) return
    active = target
    const el = ensureEl()
    el.textContent = tip
    el.style.display = "block"

    const r = target.getBoundingClientRect()
    const br = el.getBoundingClientRect()
    const pad = 10
    const clamp = (v, a, b) => Math.min(Math.max(v, a), b)
    let left = r.left + r.width / 2 - br.width / 2
    left = clamp(left, pad, window.innerWidth - br.width - pad)
    let top = r.top - br.height - 10
    if (top < pad) top = r.bottom + 10
    top = clamp(top, pad, window.innerHeight - br.height - pad)
    el.style.left = `${Math.round(left)}px`
    el.style.top = `${Math.round(top)}px`
  }

  const findIcon = (ev) => ev?.target?.closest?.(".tipIcon")
  document.addEventListener("pointerover", (ev) => {
    const icon = findIcon(ev)
    if (!icon) return
    showFor(icon)
  })
  document.addEventListener("pointerout", (ev) => {
    const icon = findIcon(ev)
    if (!icon) return
    const rel = ev.relatedTarget
    if (rel && icon.contains(rel)) return
    hide()
  })
  document.addEventListener("focusin", (ev) => {
    const icon = findIcon(ev)
    if (!icon) return
    showFor(icon)
  })
  document.addEventListener("focusout", (ev) => {
    const icon = findIcon(ev)
    if (!icon) return
    hide()
  })
  window.addEventListener(
    "scroll",
    () => {
      if (!active) return
      showFor(active)
    },
    true
  )
  window.addEventListener("resize", () => {
    if (!active) return
    showFor(active)
  })
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") hide()
  })
}

function bindPreviewFitOnce() {
  if (_previewFitBound) return
  _previewFitBound = true
  window.addEventListener("resize", () => {
    if (!state.projectPath) return
    updatePreviewBaseZoom()
    normalizeViewportAtFit()
    applyPreviewTransform()
    drawOverlay()
  })
}

async function showPage(pageIndex) {
  if (!state.projectPath) return
  const api = window.pywebview?.api
  if (!api || typeof api.get_preview_png_base64_page !== "function") return
  const idx = Math.max(0, Math.min((state.pageCount || 1) - 1, Number(pageIndex) || 0))
  state.previewPageIndex = idx
  state.pageLocked = true
  const my = ++pageReq
  const p0 = $("#pageIndicator")
  if (p0) p0.textContent = `${idx + 1} / ${state.pageCount || 1} …`
  let r = await api.get_preview_png_base64_page(idx)
  // Auto-recover when backend lost the project (WebView reload / timing / cache issues).
  if (r && !r.ok && r.error === "no_project" && state.projectPath && typeof api.load_project === "function") {
    try {
      await api.load_project(state.projectPath)
      r = await api.get_preview_png_base64_page(idx)
    } catch {}
  }
  if (my !== pageReq) return
  if (r && r.ok) {
    const img = $("#previewImg")
    if (img) {
      img.onload = () => {
        img.style.visibility = "visible"
        updatePreviewBaseZoom()
        normalizeViewportAtFit()
        applyPreviewTransform()
        drawOverlay()
      }
      img.onerror = () => {
        img.style.visibility = "hidden"
        toast("プレビュー画像の読み込みに失敗しました（パス/権限/文字コードの可能性）")
      }
      img.style.visibility = "hidden"
      img.src = r.png_data || r.png
    }
    // Align coordinate system to actual rendered image (rotation/aspect-safe)
    if (img && img.naturalWidth && img.naturalHeight) {
      state.pageW = img.naturalWidth
      state.pageH = img.naturalHeight
    } else {
      state.pageW = r.page_display_width || state.pageW
      state.pageH = r.page_display_height || state.pageH
      updatePreviewBaseZoom()
      normalizeViewportAtFit()
    }
    drawOverlay()
    const p = $("#pageIndicator")
    if (p) p.textContent = `${idx + 1} / ${state.pageCount || 1}`
  } else {
    const img = $("#previewImg")
    if (img) {
      img.src = ""
      img.style.visibility = "hidden"
    }
    toast(`ページ表示に失敗: ${r?.error || "unknown"}`)
  }
}

function calcNetSeconds() {
  if (!state.timerStart) return 0
  const now = Date.now()
  const base = (now - state.timerStart) / 1000
  return Math.max(0, base - state.privateTotal)
}

function filledCount() {
  let n = 0
  for (const k of state.tags) {
    const v = (state.values[k] || "").replaceAll("<br>", "").trim()
    if (v) n++
  }
  return n
}

async function updateTagValue(tag, rawText) {
  const raw = (rawText || "").replaceAll("\r\n", "\n")
  const val = raw.replaceAll("\n", "<br>")
  state.values[tag] = val
  await window.pywebview.api.set_value(tag, val)
  queuePreview(tag)
}

// NOTE: 右側（または下段）に常時表示するタグ一覧は廃止。
// タグ操作は「パレット上のタグ一覧」に一本化する。

/** ローカル(EXE) 起動直後：入力者／管理者の選択 → 作業者 or パスワード（WEB 版とは別フロー） */
const DESKTOP_ADMIN_GATE_PASSWORD = "takafumi0812"

function renderDesktopRoleGate() {
  const step = state.gate?.step || "choose"
  const err = String(state.gate?.error || "")
  const workerOptions = (state.workers || [])
    .map((w) => `<option value="${escapeHtml(w.id)}" ${w.id === state.workerId ? "selected" : ""}>${escapeHtml(w.name)}</option>`)
    .join("")

  $("#app").innerHTML = `
    <div class="bgBlobs" aria-hidden="true">
      <div class="blob b1"></div>
      <div class="blob b2"></div>
      <div class="blob b3"></div>
    </div>
    <div class="gate">
      <div class="gateCard gateCard--desktop">
        <div class="gateBrand">
          <div class="logo gateLogo" aria-hidden="true"></div>
          <div class="gateTitle">
            <div class="gateTitle__top">${escapeHtml(appDisplayName())}</div>
            <div class="gateTitle__sub">${escapeHtml(tr("brand.tagline", "PDFに文字を置いて、完成PDFを作る"))}</div>
          </div>
        </div>

        ${
          step === "choose"
            ? `<div class="gateActions">
                <button class="btn btn--primary" id="gateWorker">${escapeHtml(tr("gate.desktop.worker", "入力者"))}</button>
                <button class="btn btn--soft" id="gateAdmin">${escapeHtml(tr("gate.desktop.admin", "管理者"))}</button>
              </div>
              <div class="label gateHint">${escapeHtml(tr("gate.desktop.roleHint", "入力者：作業者を選んで開始　／　管理者：パスワードで機能を開放"))}</div>`
            : ""
        }

        ${
          step === "worker"
            ? `<div class="gateSection">
                <div class="row spread" style="margin-bottom:8px">
                  <div class="badge">${escapeHtml(tr("gate.desktop.worker", "入力者"))}</div>
                  <button class="btn btn--ghost" id="gateBack">${escapeHtml(tr("gate.desktop.back", "戻る"))}</button>
                </div>
                <div class="field">
                  <div class="label">${escapeHtml(tr("gate.desktop.pickWorker", "作業者を選択"))}</div>
                  <select id="gateWorkerPick" class="input">${workerOptions}</select>
                </div>
                <div class="row" style="margin-top:10px">
                  <button class="btn btn--soft" id="gateWorkerNew">${escapeHtml(tr("gate.desktop.newWorker", "新規登録"))}</button>
                  <button class="btn btn--primary" id="gateWorkerGo">${escapeHtml(tr("gate.desktop.startAsWorker", "この作業者で開始"))}</button>
                </div>
              </div>`
            : ""
        }

        ${
          step === "admin"
            ? `<div class="gateSection">
                <div class="row spread" style="margin-bottom:8px">
                  <div class="badge">${escapeHtml(tr("gate.desktop.admin", "管理者"))}</div>
                  <button class="btn btn--ghost" id="gateBack">${escapeHtml(tr("gate.desktop.back", "戻る"))}</button>
                </div>
                <div class="field">
                  <div class="label">${escapeHtml(tr("gate.desktop.password", "パスワード"))}</div>
                  <input class="input" id="gatePass" type="password" placeholder="${escapeHtml(tr("gate.desktop.passwordPh", "パスワードを入力"))}" value="${escapeHtml(state.gate?.password || "")}">
                </div>
                <div class="row" style="margin-top:10px">
                  <button class="btn btn--primary" id="gateAdminGo">${escapeHtml(tr("gate.desktop.startAsAdmin", "管理者として開始"))}</button>
                </div>
              </div>`
            : ""
        }
        ${err ? `<div class="gateError">${escapeHtml(err)}</div>` : ""}
        ${window.__INPUTSTUDIO_DEMO__ ? `<input type="file" id="gateDemoPdf" accept=".pdf,application/pdf" style="display:none" />` : ""}
      </div>
    </div>
    <div class="toast" id="toast"></div>
    <div class="modal" id="modal" style="display:none"></div>
  `

  const setStep = (s) => {
    state.gate = state.gate || { step: "choose", password: "", error: "" }
    state.gate.step = s
    state.gate.error = ""
    render()
  }
  const back = $("#gateBack")
  if (back) back.onclick = () => setStep("choose")

  const bWorker = $("#gateWorker")
  if (bWorker) bWorker.onclick = () => setStep("worker")
  const bAdmin = $("#gateAdmin")
  if (bAdmin) bAdmin.onclick = () => setStep("admin")

  const workerPick = $("#gateWorkerPick")
  if (workerPick) {
    workerPick.onchange = (e) => {
      state.workerId = e.target.value
      saveLocal("inputstudio-last-worker", state.workerId)
    }
  }
  const workerNew = $("#gateWorkerNew")
  if (workerNew) workerNew.onclick = () => openWorkerModal({ mode: "create" })
  const workerGo = $("#gateWorkerGo")
  if (workerGo) {
    workerGo.onclick = async () => {
      try {
        if (!state.workerId) {
          state.gate = state.gate || { step: "choose", password: "", error: "" }
          state.gate.error = tr("gate.desktop.errNoWorker", "作業者を選んでください")
          return render()
        }
        try {
          await window.pywebview.api.set_ui_mode?.("worker")
        } catch {}
        state.uiMode = "worker"
        state.appStage = "main"
        saveLocal("inputstudio-last-role", "worker")
        render()
      } catch (e) {
        state.gate = state.gate || { step: "choose", password: "", error: "" }
        state.gate.error = `${tr("gate.desktop.errStart", "開始できませんでした")}: ${e}`
        render()
      }
    }
  }

  const pass = $("#gatePass")
  if (pass) {
    pass.focus()
    pass.oninput = (e) => {
      state.gate = state.gate || { step: "choose", password: "", error: "" }
      state.gate.password = e.target.value
      state.gate.error = ""
    }
    pass.onkeydown = (e) => {
      if (e.key === "Enter") $("#gateAdminGo")?.click?.()
    }
  }
  const adminGo = $("#gateAdminGo")
  if (adminGo) {
    adminGo.onclick = async () => {
      state.gate = state.gate || { step: "choose", password: "", error: "" }
      const p = String(state.gate.password || "")
      if (p !== DESKTOP_ADMIN_GATE_PASSWORD) {
        state.gate.error = tr("gate.desktop.errBadPassword", "パスワードが違います")
        render()
        return
      }
      try {
        await window.pywebview.api.set_ui_mode?.("admin")
      } catch {}
      state.uiMode = "admin"
      state.appStage = "main"
      saveLocal("inputstudio-last-role", "admin")
      render()
    }
  }

  refreshAdSlots()
}

function renderGate() {
  if (!isWeb()) {
    renderDesktopRoleGate()
    return
  }

  const err = String(state.gate?.error || "")
  const localeOptionsHtml = LOCALE_OPTIONS.map((opt) => {
    const sel = state.locale === opt.code ? "selected" : ""
    return `<option value="${escapeHtml(opt.code)}" ${sel}>${escapeHtml(opt.label)}</option>`
  }).join("")
  const localeFlag = getLocaleMeta(state.locale).flag

  $("#app").innerHTML = `
    <div class="bgBlobs" aria-hidden="true">
      <div class="blob b1"></div>
      <div class="blob b2"></div>
      <div class="blob b3"></div>
    </div>
    <div class="gate">
      <div class="gateCard${isWeb() ? "" : " gateCard--desktop"}">
        <div class="gateBrand">
          <div class="logo gateLogo" aria-hidden="true"></div>
          <div class="gateTitle">
            <div class="gateTitle__top">${escapeHtml(appDisplayName())}</div>
            <div class="gateTitle__sub">${escapeHtml(tr("brand.tagline", "PDFに文字を置いて、完成PDFを作る"))}</div>
          </div>
        </div>
        <div class="row gateLocaleRow" style="justify-content:flex-end; margin-top:8px">
          <label class="label gateLocaleLabel" for="gateLocale">${escapeHtml(tr("top.languageMixed", "言語 Language"))}</label>
          <span id="gateLocaleFlag" class="flagIcon flagIcon--${escapeHtml(localeFlag)}" aria-hidden="true"></span>
          <select id="gateLocale" class="input" style="width:220px; padding:8px 10px">
            ${localeOptionsHtml}
          </select>
        </div>

        <div class="gateActions">
          <button class="btn btn--primary" id="gateLoadPdf">${escapeHtml(tr("gate.loadPdf", "PDFを読み込む"))}</button>
          <button class="btn btn--soft" id="gateLoadProject">${escapeHtml(tr("gate.loadZip", "プロジェクトZIPを開く"))}${unlockHintBubble("zip_open")}</button>
        </div>
        <div class="label gateHint">${escapeHtml(tr("gate.hint", "PDFから新規作成　／　既存の案件（ZIP・PDF同梱）を開く"))}</div>
        ${
          isWeb()
            ? `
        <div class="label gateHint">${escapeHtml(tr("top.notice.trust", "運営情報・お問い合わせ・規約・プライバシーはページ下部リンクから確認できます。"))}</div>
        <div class="gateGuide">
          <div class="gateGuide__title">${escapeHtml(tr("top.value.title", "Build reusable PDF templates"))}</div>
          <div class="gateGuide__item">${escapeHtml(tr("top.value.audience", "For business users and teams handling repetitive forms"))}</div>
          <div class="gateGuide__item">${escapeHtml(tr("top.value.benefit1", "Edit one field. Update every document."))}</div>
          <div class="gateGuide__item">${escapeHtml(tr("top.value.benefit2", "Reuse projects with ZIP handoff across teammates."))}</div>
          <div class="gateGuide__item">${escapeHtml(tr("top.value.benefit3", "Merge, split, and finalize PDFs in one workflow."))}</div>
          <div class="gateGuide__title" style="margin-top:6px">${escapeHtml(tr("top.howto.title", "How it works (3 steps)"))}</div>
          <div class="gateGuide__item">${escapeHtml(tr("top.howto.step1", "1. Open a project ZIP or start from PDF"))}</div>
          <div class="gateGuide__item">${escapeHtml(tr("top.howto.step2", "2. Place tags and edit values once"))}</div>
          <div class="gateGuide__item">${escapeHtml(tr("top.howto.step3", "3. Download final PDFs or save reusable project"))}</div>
        </div>
        <div class="adSlot adSlot--gate" id="adSlotGate">
          <div class="adSlot__label">${escapeHtml(tr("ad.label", "広告"))}</div>
          <div class="adSlot__title">${escapeHtml(tr("ad.sponsorTitle", "スポンサーからのお知らせ"))}</div>
          <div class="adSlot__body">${escapeHtml(tr("ad.sponsorBody", "ここにバナー広告が表示されます（実装準備中）"))}</div>
          <div class="adSlot__live" aria-label="ad slot gate"></div>
        </div>
        <div class="gateTrustNav gateTrustNav--footer" aria-label="site trust navigation">
          <a class="gateTrustNav__link" href="/global-search.html">${escapeHtml(tr("top.nav.global", "多言語検索ガイド"))}</a>
          <a class="gateTrustNav__link" href="/solutions.html">${escapeHtml(tr("top.nav.guide", "活用ガイド"))}</a>
          <a class="gateTrustNav__link" href="/application-form-filling.html">${escapeHtml(tr("top.nav.forms", "申請書/様式入力"))}</a>
          <a class="gateTrustNav__link" href="/pdf-merge-split.html">${escapeHtml(tr("top.nav.tools", "PDF結合/分割"))}</a>
          <a class="gateTrustNav__link" href="/beginner-guide.html">${escapeHtml(tr("top.nav.guideFull", "使い方ガイド"))}</a>
          <a class="gateTrustNav__link" href="/updates.html">${escapeHtml(tr("top.nav.updates", "更新情報"))}</a>
          <a class="gateTrustNav__link" href="/case-studies.html">${escapeHtml(tr("top.nav.cases", "活用事例"))}</a>
          <a class="gateTrustNav__link" href="/document-quality-checklist.html">${escapeHtml(tr("top.nav.checklist", "提出前チェックリスト"))}</a>
          <a class="gateTrustNav__link" href="/tag-design-rules.html">${escapeHtml(tr("top.nav.tagrules", "タグ設計ルール"))}</a>
          <a class="gateTrustNav__link" href="/template-builder.html">${escapeHtml(tr("top.nav.templateBuilder", "Template Builder (EN)"))}</a>
          <a class="gateTrustNav__link" href="/pricing.html">${escapeHtml(tr("top.nav.pricing", "料金"))}</a>
          <a class="gateTrustNav__link" href="/about.html">${escapeHtml(tr("top.nav.about", "企業情報"))}</a>
          <a class="gateTrustNav__link" href="/contact.html">${escapeHtml(tr("top.nav.contact", "お問い合わせ"))}</a>
          <a class="gateTrustNav__link" href="/privacy.html">${escapeHtml(tr("top.nav.privacy", "プライバシーポリシー"))}</a>
          <a class="gateTrustNav__link" href="/terms.html">${escapeHtml(tr("top.nav.terms", "利用規約"))}</a>
          <a class="gateTrustNav__link" href="/faq.html">${escapeHtml(tr("top.nav.faq", "FAQ"))}</a>
        </div>
        `
            : `
        <div class="gateGuide">
          <div class="gateGuide__title">${escapeHtml(tr("gate.local.valueTitle", "このアプリでできること"))}</div>
          <div class="gateGuide__item">${escapeHtml(tr("gate.local.audience", "対象: 申請書・帳票の入力担当者"))}</div>
          <div class="gateGuide__item">${escapeHtml(tr("gate.local.benefit1", "タグ同期で同じ項目を一括更新"))}</div>
          <div class="gateGuide__item">${escapeHtml(tr("gate.local.benefit2", "ZIPで案件を持ち運びしやすい"))}</div>
          <div class="gateGuide__item">${escapeHtml(tr("gate.local.benefit3", "入力からPDF出力までこのPCで完結"))}</div>
          <div class="gateGuide__title" style="margin-top:6px">${escapeHtml(tr("gate.local.howtoTitle", "使い方（3ステップ）"))}</div>
          <div class="gateGuide__item">${escapeHtml(tr("gate.local.step1", "1. プロジェクトZIPを開く（またはPDFから新規作成）"))}</div>
          <div class="gateGuide__item">${escapeHtml(tr("gate.local.step2", "2. 項目を入力して必要に応じてページ操作"))}</div>
          <div class="gateGuide__item">${escapeHtml(tr("gate.local.step3", "3. PDFの保存 / プロジェクトZIPの保存"))}</div>
        </div>
        <div class="adSlot adSlot--gate" id="adSlotGate">
          <div class="adSlot__label">${escapeHtml(tr("ad.label", "広告"))}</div>
          <div class="adSlot__title">${escapeHtml(tr("ad.sponsorTitle", "スポンサーからのお知らせ"))}</div>
          <div class="adSlot__body">${escapeHtml(tr("ad.sponsorBody", "ここにバナー広告が表示されます（実装準備中）"))}</div>
          <div class="adSlot__live" aria-label="ad slot gate"></div>
        </div>
        `
        }
        ${err ? `<div class="gateError">${escapeHtml(err)}</div>` : ""}
        ${window.__INPUTSTUDIO_DEMO__ ? `<input type="file" id="gateDemoPdf" accept=".pdf,application/pdf" style="display:none" />` : ""}
      </div>
    </div>
    <div class="toast" id="toast"></div>
    <div class="modal" id="modal" style="display:none"></div>
  `
  refreshAdSlots()

  // bindings: PDFを読み込む
  const gateLocale = $("#gateLocale")
  if (gateLocale) {
    gateLocale.onchange = () => {
      const next = String(gateLocale.value || "ja")
      state.locale = window.i18n?.setLocale?.(next) || next
      syncLocaleQuery(state.locale)
      renderGate()
    }
  }

  const bLoadPdf = $("#gateLoadPdf")
  if (bLoadPdf) bLoadPdf.onclick = async () => {
    if (window.__INPUTSTUDIO_DEMO__) {
      const inp = $("#gateDemoPdf")
      if (inp) inp.click()
      return
    }
    try {
      const api = window.pywebview?.api
      const pick = api?.pick_pdf
      const createSimple = api?.create_project_from_pdf_simple
      if (!pick || !createSimple) {
        await uiAlert("PDFから新規作成する機能が見つかりません。最新版のアプリをご利用ください。")
        return
      }
      const r = await pick()
      if (!r?.ok) return
      toast(tr("gate.toastCreateProjectFromPdf", "PDFを読み込み、新規プロジェクトを作成します…"))
      const g = await createSimple(r.path)
      if (!g?.ok || !g.path) {
        await uiAlert((g?.errors || ["PDFをプロジェクト化できませんでした"]).join("\n"))
        return
      }
      const loaded = await api.load_project(g.path)
      if (!loaded?.ok) {
        await uiAlert("新規プロジェクトを開けませんでした")
        return
      }
      state.projectPath = g.path
      state.projectName = loaded.project
      state.tags = loaded.tags || []
      state.values = loaded.values || {}
      state.placements = loaded.placements || {}
      state.pageCount = loaded.page_count || 1
      hydrateBinder(loaded)
      state.idx = 0
      state.dropDir = loaded.drop_dir || ""
      state.uiMode = loaded.ui_mode || state.uiMode
      state.lastSession = { path: g.path, workerId: state.workerId, projectName: state.projectName }
      saveLocal("inputstudio-last-session", state.lastSession)
      try {
        const dir = g.path.replace(/[/\\][^/\\]+$/, "")
        state.lastProjectDir = dir
        saveLocal("inputstudio-last-dir", dir)
      } catch {}
      state.working = false
      state.inPrivate = false
      state.timerStart = null
      state.privateTotal = 0
      state.appStage = "main"
      state.showPreviewHint = true
      state.placePaletteOpen = false
      resetPreviewViewport({ zoom: 1.0 })
      const started = await autoStartWorkIfPossible()
      toast(started ? "新規案件を作成し、作業タイマーを開始しました" : "PDFから新規プロジェクトを作成しました。必要に応じてタグを配置してください。")
      render()
      await queuePreview()
    } catch (e) {
      await uiAlert(`PDFから新規作成に失敗しました: ${e}`)
    }
  }

  // bindings: ZIPを読み込む（プロジェクト＝ZIP前提）
  const bLoadProject = $("#gateLoadProject")
  if (bLoadProject) bLoadProject.onclick = async () => {
    try {
      const okToProceed = await showUnlockAd("zip_open")
      if (!okToProceed) return
      const r = await window.pywebview.api.pick_project(
        window.__INPUTSTUDIO_WEB__ ? { zipOnly: true } : undefined
      )
      if (!r.ok) {
        if (r.error) toast(apiErrorMessage(r, r.error))
        return
      }
      toast(tr("gate.toastLoadingZip", "ZIPを読み込み中…"))
      try {
        const dir = r.path?.replace(/[/\\][^/\\]+$/, "")
        if (dir) {
          state.lastProjectDir = dir
          saveLocal("inputstudio-last-dir", dir)
        }
      } catch {}
      const loaded = await window.pywebview.api.load_project(r.path)
      if (!loaded.ok) return
      state.projectPath = r.path
      state.projectName = loaded.project
      state.tags = loaded.tags || []
      state.values = loaded.values || {}
      state.placements = loaded.placements || {}
      state.pageCount = loaded.page_count || 1
      hydrateBinder(loaded)
      state.idx = 0
      state.dropDir = loaded.drop_dir || ""
      state.uiMode = loaded.ui_mode || state.uiMode
      state.lastSession = { path: r.path, workerId: state.workerId, projectName: state.projectName }
      saveLocal("inputstudio-last-session", state.lastSession)
      state.working = false
      state.inPrivate = false
      state.timerStart = null
      state.privateTotal = 0
      state.appStage = "main"
      state.showPreviewHint = true
      state.placePaletteOpen = false
      resetPreviewViewport({ zoom: 1.0 })
      const started = await autoStartWorkIfPossible()
      toast(started ? tr("gate.toastLoadedZipAndTimer", "ZIPを読み込み、作業タイマーを開始しました") : tr("gate.toastLoadedZip", "ZIPを読み込みました"))
      render()
      await queuePreview()
    } catch (e) {
      await uiAlert(`プロジェクトの読み込みに失敗しました: ${e}`)
    }
  }

  // Demo: ファイル選択後に読み込み
  const gateDemoPdf = $("#gateDemoPdf")
  if (gateDemoPdf) {
    gateDemoPdf.onchange = async () => {
      const file = gateDemoPdf.files?.[0]
      if (!file) return
      try {
        toast("PDFを読み込み中…")
        const buf = await file.arrayBuffer()
        const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.mjs")
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.mjs"
        const doc = await pdfjs.getDocument({ data: buf }).promise
        window.__demoPdfDoc = doc
        window.__demoPdfCache = new Map()
        const api = window.pywebview?.api
        if (api) {
          api.get_preview_png_base64_page = async (page_index) => {
            const idx = Math.max(0, Math.min(doc.numPages - 1, Number(page_index || 0)))
            const cache = window.__demoPdfCache
            if (cache.has(idx)) return cache.get(idx)
            const page = await doc.getPage(idx + 1)
            const scale = 150 / 72
            const vp = page.getViewport({ scale })
            const canvas = document.createElement("canvas")
            canvas.width = Math.floor(vp.width)
            canvas.height = Math.floor(vp.height)
            const ctx = canvas.getContext("2d")
            await page.render({ canvasContext: ctx, viewport: vp }).promise
            const blob = await new Promise((res) => canvas.toBlob(res, "image/png"))
            const url = URL.createObjectURL(blob)
            const out = { ok: true, png: url, page_display_width: canvas.width, page_display_height: canvas.height, page_index: idx }
            cache.set(idx, out)
            return out
          }
          api.get_preview_png_base64 = async (tag) => {
            const t = String(tag || "").trim()
            const pl = state.placements?.[t]
            const idx = pl ? Number(pl.page || 0) : 0
            return api.get_preview_png_base64_page(idx)
          }
        }
        state.projectPath = "demo:pdf"
        state.projectName = file.name
        state.pageCount = doc.numPages
        state.previewPageIndex = 0
        state.tags = []
        state.values = {}
        state.placements = {}
        state.appStage = "main"
        state.showPreviewHint = true
        state.placePaletteOpen = false
        toast(`PDFを読み込みました（${doc.numPages}ページ）`)
        render()
      } catch (e) {
        await uiAlert(`PDF読み込みに失敗しました: ${e}`)
      } finally {
        gateDemoPdf.value = ""
      }
    }
  }
}

function render() {
  if (state.appStage !== "main") {
    renderGate()
    return
  }
  if (state.projectPath !== _lastRenderedProjectPathForReuseReview) {
    _lastRenderedProjectPathForReuseReview = state.projectPath
    state.reviewReuseActive = false
    state.reviewReusePending = null
    refreshTagQuickPaletteGlobal()
  }
  const total = state.tags.length || 0
  const done = total ? filledCount() : 0
  const idx = state.idx
  const key = total ? state.tags[idx] : null
  const hasTags = !!key
  const val = key ? (state.values[key] || "") : ""
  const valText = val.replaceAll("<br>", "\n")
  const progress = total ? Math.round(((idx + 1) / total) * 100) : 0
  const reuseTitlePending = !!(
    key &&
    state.reviewReuseActive &&
    state.reviewReusePending &&
    state.reviewReusePending.has(String(key))
  )

  const isAdmin = state.uiMode === "admin"
  // 画面常設のタグ一覧は表示しない（パレットに統一）
  const showTagPane = false

  /** ローカル(EXE)は project.json 案件。WEB は ZIP 表記のまま（サーバ／公開用フロー）。 */
  const openProjectBtnHtml = isWeb()
    ? `<button class="chip chip--soft" id="btnOpen">${escapeHtml(tr("main.openZip", "プロジェクトZIPを開く"))}${unlockHintBubble("zip_open")}</button>`
    : `<button class="chip chip--soft" id="btnOpen" title="${escapeHtml(tr("main.openProjectJsonTitle", "案件フォルダ内の project.json を選択します（template.pdf と同じ場所）"))}">${escapeHtml(tr("main.openProjectJson", "案件を開く"))}</button>`

  const desktopProjectGuideHtml = !isWeb()
    ? `<div class="guideDesktop">
        <span class="guideDesktop__step" aria-hidden="true">1</span>
        <div class="guideDesktop__main">
          <div class="guideDesktop__text">${escapeHtml(
            isAdmin
              ? tr("desktop.guide.adminOpen", "管理者：既存案件の project.json を開くか、下の「PDFから新規」でプロジェクトを作成します。")
              : tr("desktop.guide.workerOpen", "入力者：管理者が用意した案件（プロジェクト）を開いて入力を開始"),
          )}</div>
          ${openProjectBtnHtml}
        </div>
      </div>`
    : ""

  const left = `
    <div class="top">
      <div class="brand row spread" style="align-items:center">
        <div class="row" style="align-items:center; gap:12px">
          <div class="logo" aria-hidden="true"></div>
          <div class="brand__name">${escapeHtml(appDisplayName())}</div>
        </div>
        <button class="chip chip--soft" id="btnBackToGate">${escapeHtml(tr("main.backToTop", "トップページに戻る"))}</button>
      </div>
      ${window.__INPUTSTUDIO_DEMO__ ? `<input type="file" id="demoPdfFile" accept=".pdf,application/pdf" style="display:none" />` : ""}
      ${desktopProjectGuideHtml}

      <div class="miniActions">
        ${isWeb() ? openProjectBtnHtml : ""}
        ${isAdmin ? `<button class="chip chip--soft" id="btnOpenPdf">${escapeHtml(tr("main.newFromPdf", "PDFから新規"))}</button>` : ""}
        ${isAdmin ? `        <button class="chip" id="btnDesign">設計（統括）</button>` : ""}
        <button class="chip" id="btnBinder" ${state.projectPath ? "" : "disabled"} title="${escapeHtml(tr("binder.openTitle", "書類・申請・進捗・付箋をまとめて管理します"))}">${escapeHtml(tr("binder.open", "バインダー"))}${binderBadgeHtml()}</button>
        <button class="chip ${state.noteAddMode ? "chip--active" : "chip--soft"}" id="btnNoteMode" ${state.projectPath ? "" : "disabled"} title="${escapeHtml(tr("binder.noteModeTitle", "クリックした位置に付箋（不明点・課題）を貼ります"))}">${escapeHtml(state.noteAddMode ? tr("binder.noteModeOn", "付箋：貼る場所をクリック") : tr("binder.noteMode", "付箋を貼る"))}</button>
        <button class="chip chip--soft" id="btnAppendPdf" ${state.projectPath ? "" : "disabled"}>${escapeHtml(tr("main.appendPdf", "PDF追加"))}${unlockHintBubble("pdf_append")}</button>
        <button class="chip chip--soft" id="btnReorderPdf" ${state.projectPath ? "" : "disabled"}>${escapeHtml(tr("main.reorderPdf", "PDF並べ替え"))}</button>
        <button class="chip chip--soft" id="btnBulkPaste" ${state.projectPath && listProjectTagsOrdered().length ? "" : "disabled"}>${escapeHtml(tr("main.bulkPaste", "値の一括入力"))}</button>
        <button class="chip chip--soft" id="btnTagManager" ${state.projectPath ? "" : "disabled"} title="${escapeHtml(tr("main.tagManagerTitle", "タグの使用数を確認し、現物を見てから削除できます"))}">${escapeHtml(tr("main.tagManager", "タグ整理"))}</button>
        <button class="chip chip--soft" id="btnExcelImport" ${state.projectPath ? "" : "disabled"} title="申請情報シート(Excel)から値を取り込みます（1件ずつ承認）">Excel取込</button>
        <button class="chip chip--soft" id="btnCopyPageOp" ${state.projectPath ? "" : "disabled"}>${escapeHtml(tr("main.copyCurrentPage", "現在ページ複製"))}</button>
        <button class="chip chip--soft" id="btnDeletePageOp" ${state.projectPath ? "" : "disabled"}>${escapeHtml(tr("main.deletePages", "ページ削除"))}</button>
        ${state.projectPath && !isWeb() ? `<button class="chip chip--soft" id="btnOpenSaved">保存先</button>` : ""}
        ${isAdmin ? `<button class="chip chip--soft" id="btnHistoryExport">履歴CSV</button>` : ""}
        ${isAdmin ? `<button class="chip chip--soft" id="btnHistoryReset">履歴リセット</button>` : ""}
      </div>
      ${
        isWeb()
          ? `<div class="adSlot adSlot--panel" id="adSlotPanel">
        <div class="adSlot__label">${escapeHtml(tr("ad.label", "広告"))}</div>
        <div class="adSlot__title">${escapeHtml(tr("ad.recommendTitle", "おすすめサービス"))}</div>
        <div class="adSlot__body">${escapeHtml(tr("ad.recommendBody", "ここに常時バナー広告が表示されます（実装準備中）"))}</div>
        <div class="adSlot__live" aria-label="ad slot panel"></div>
      </div>`
          : ""
      }

    </div>

    ${
      hasTags
        ? `<div class="focus ${state.justCompleted ? "pop" : ""}">
            <div class="focus__head">
              <div class="focus__title${reuseTitlePending ? " focus__title--reusePending" : ""}">${escapeHtml(key)}</div>
              <div class="focus__meta">${total ? escapeHtml(tr("main.focusMeta", `${idx + 1}/${total} ・ Enterで次へ / Shift+Enterで改行`, { index: idx + 1, total })) : ""}</div>
            </div>

            <div class="focus__body">
              <textarea class="input textarea focus__input" id="val" placeholder="${escapeHtml(tr("main.inputPlaceholder", "ここに入力…"))}">${escapeHtml(valText)}</textarea>
              <div class="row spread" style="margin-top:10px">
                <div class="row">
                  <button class="btn btn--soft" id="btnPrev" ${idx <= 0 ? "disabled" : ""}>${escapeHtml(tr("main.prev", "戻る"))}</button>
                  <button class="btn btn--primary" id="btnNext" ${idx >= total - 1 ? "disabled" : ""}>${escapeHtml(tr("main.next", "次へ"))}</button>
                  <button class="btn btn--tint" type="button" id="btnReuseReview" title="${escapeHtml(tr("main.reuseReviewTitle", "前データ流用時：未確認タグを赤字にします。値を編集したタグだけ黒に戻ります（配置パレットの一覧と、左のタグ名にも反映）。"))}">${escapeHtml(state.reviewReuseActive ? tr("main.reuseReviewEnd", "チェック終了") : tr("main.reuseReviewStart", "流用チェック"))}</button>
                </div>
              </div>
              <div class="row" style="margin-top:14px; gap:8px">
                <button class="btn btn--soft" id="btnSave" ${state.projectPath ? "" : "disabled"} style="flex:1" title="${isWeb() ? escapeHtml(tr("main.savePdfTitle", "保存して完成PDFをダウンロードします。保存先を選択できます。")) : escapeHtml(tr("main.saveOverwriteTitle", "入力内容を素早く保存します（PDFは生成しません）"))}">${isWeb() ? escapeHtml(tr("main.savePdf", "PDFダウンロード")) : escapeHtml(tr("main.saveOverwrite", "上書き保存"))}</button>
                ${!isWeb() ? `<button class="btn btn--soft" id="btnExportPdf" ${state.projectPath ? "" : "disabled"} style="flex:1" title="${escapeHtml(tr("main.exportPdfTitle", "完成PDFを生成します（ページ数が多いと時間がかかります）"))}">${escapeHtml(tr("main.exportPdf", "PDF出力"))}</button>` : ""}
                <button class="btn btn--soft" id="btnSaveAs" ${state.projectPath ? "" : "disabled"} style="flex:1" title="${isWeb() ? escapeHtml(tr("main.saveProjectTitle", "プロジェクトをZIP（PDF同梱）で保存します。保存先を選択できます。")) : ""}">${isWeb() ? escapeHtml(tr("main.saveProject", "プロジェクトを保存")) : escapeHtml(tr("main.saveAs", "名前を付けて保存"))}</button>
              </div>
              <button class="btn btn--danger" id="btnFinish" style="width:100%; margin-top:8px; padding:12px 20px">${escapeHtml(tr("main.finish", "終了"))}</button>
            </div>
          </div>`
        : (state.projectPath ? `<div style="margin-top:12px">
            <div class="row" style="gap:8px; margin-bottom:8px">
              <button class="btn btn--soft" id="btnSave" style="flex:1" title="${isWeb() ? escapeHtml(tr("main.savePdfShortTitle", "保存して完成PDFをダウンロードします。")) : escapeHtml(tr("main.saveOverwriteTitle", "入力内容を素早く保存します（PDFは生成しません）"))}">${isWeb() ? escapeHtml(tr("main.savePdf", "PDFダウンロード")) : escapeHtml(tr("main.saveOverwrite", "上書き保存"))}</button>
              ${!isWeb() ? `<button class="btn btn--soft" id="btnExportPdf" style="flex:1" title="${escapeHtml(tr("main.exportPdfTitle", "完成PDFを生成します（ページ数が多いと時間がかかります）"))}">${escapeHtml(tr("main.exportPdf", "PDF出力"))}</button>` : ""}
              <button class="btn btn--soft" id="btnSaveAs" style="flex:1" title="${isWeb() ? escapeHtml(tr("main.saveProjectShortTitle", "プロジェクトをZIP（PDF同梱）で保存します。")) : ""}">${isWeb() ? escapeHtml(tr("main.saveProject", "プロジェクトを保存")) : escapeHtml(tr("main.saveAs", "名前を付けて保存"))}</button>
            </div>
            <button class="btn btn--danger" id="btnFinish" style="width:100%; padding:12px 20px">${escapeHtml(tr("main.finish", "終了"))}</button>
          </div>` : "")
    }
    ${!isWeb() ? `<div class="glassBox" style="margin-top:10px">
      ${state.lastProjectDir ? `<div class="pathLine" title="${escapeHtml(state.lastProjectDir)}">前回開いたフォルダ: <span class="pathValue">${escapeHtml(state.lastProjectDir)}</span></div>` : ""}
      ${state.projectPath ? `<div class="pathLine" title="${escapeHtml(state.projectPath)}">保存先: <span class="pathValue">${escapeHtml(state.projectPath)}</span></div>` : ""}
      ${state.lastFilledPdf ? `<div class="pathLine" title="${escapeHtml(state.lastFilledPdf)}">提出PDF: <span class="pathValue">${escapeHtml(state.lastFilledPdf)}</span></div>` : ""}
    </div>` : ""}
    ${
      isWeb()
        ? `<div class="adSlot adSlot--panelBottom" id="adSlotPanelBottom" style="margin-top:auto">
      <div class="adSlot__label">${escapeHtml(tr("ad.label", "広告"))}</div>
      <div class="adSlot__title">${escapeHtml(tr("ad.recommendTitle", "おすすめサービス"))}</div>
      <div class="adSlot__body">${escapeHtml(tr("ad.recommendBody", "ここに常時バナー広告が表示されます（実装準備中）"))}</div>
      <div class="adSlot__live" aria-label="ad slot panel bottom"></div>
    </div>`
        : ""
    }
  `

  const right = `
    ${
      state.projectPath
        ? `<div class="previewImg">
            <div class="previewScale" id="previewScale">
              <img id="previewImg" alt="preview" draggable="false" />
            </div>
            <div class="previewHud">
              <div class="previewHud__left">
                <span class="badge">ライブプレビュー</span>
              </div>
              <div class="previewHud__right">
                <button class="btn btn--soft" id="btnPrevPage">${escapeHtml(tr("main.prevPage", "前"))}</button>
                <button class="btn btn--soft" id="pageIndicator" title="ページ番号を入力して移動">${(state.previewPageIndex || 0) + 1} / ${state.pageCount || 1}</button>
                <button class="btn btn--soft" id="btnNextPage">${escapeHtml(tr("main.nextPage", "次"))}</button>
                <button class="btn btn--soft" id="btnZoomOut">−</button>
                <span class="badge" id="zoomIndicator">${Math.round((Number(state.viewZoom || 1) || 1) * 100)}%</span>
                <button class="btn btn--soft" id="btnZoomIn">＋</button>
                <button class="btn btn--soft" id="btnZoomReset">100%</button>
              </div>
            </div>
            <canvas id="confetti" class="confetti" aria-hidden="true"></canvas>
            <canvas id="overlay" class="overlay"></canvas>
            ${
              isWeb()
                ? `<div class="emptyHint mainGuidePopup" id="mainGuidePopup">
              <div class="emptyHint__title">まずはPDFに欄（タグ）を置きましょう</div>
              <div class="emptyHint__text">PDF上をダブルクリックしてタグ名と値を入力し、欄を配置できます。</div>
              <div class="emptyHint__actions">
                <button class="btn btn--primary" id="btnGuidePlace">中央に欄を追加</button>
              </div>
            </div>`
                : ""
            }
          </div>`
        : `<div class="previewPlaceholder">${escapeHtml(
            isWeb() ? tr("main.previewOpenZip", "プロジェクトZIPを開くとPDFがここに表示されます") : tr("main.previewOpenProject", "案件を開くとPDFがここに表示されます"),
          )}</div>`
    }
  `

  $("#app").innerHTML = `
    <div class="bgBlobs" aria-hidden="true">
      <div class="blob b1"></div>
      <div class="blob b2"></div>
      <div class="blob b3"></div>
    </div>
    <div class="layout ${state.showPanel ? "" : "layout--nopanel"}">
      <div class="panel">${left}</div>
      <div class="stage stage--nosplit">
        ${right}
      </div>
    </div>
    <div class="toast" id="toast"></div>
    <div class="modal" id="modal" style="display:none"></div>
  `
  refreshAdSlots()

  bind()
  queuePreview()
  tickTimerOnce()
  if (state.justCompleted) {
    burstConfetti()
    state.justCompleted = false
  }
}

function bind() {
  // Tooltips that never go off-screen
  bindTipFloatOnce()
  bindPreviewFitOnce()
  applyPreviewTransform()
  const btnGuidePlace = $("#btnGuidePlace")
  if (btnGuidePlace) btnGuidePlace.onclick = () => {
    const x = Math.round(0.5 * state.pageW)
    const y = Math.round(0.5 * state.pageH)
    if (!x || !y) return
    openPlacePalette({ x, y })
  }


  // Global hotkeys (selection / undo / copy-paste)
  document.onkeydown = async (ev) => {
    if (!state.projectPath) return
    if (isTextEditingTarget(ev.target)) return
    const k = ev.key
    const ctrl = ev.ctrlKey || ev.metaKey

    // Undo / Redo
    if (ctrl && (k === "z" || k === "Z")) {
      ev.preventDefault()
      if (ev.shiftKey) {
        const next = state.redoStack.pop()
        if (!next) return
        state.undoStack.push(snapshotProject())
        await applyProjectSnapshot(next)
        showPage(state.previewPageIndex || 0)
        return
      }
      const prev = state.undoStack.pop()
      if (!prev) return
      state.redoStack.push(snapshotProject())
      await applyProjectSnapshot(prev)
      showPage(state.previewPageIndex || 0)
      return
    }
    if (ctrl && (k === "y" || k === "Y")) {
      ev.preventDefault()
      const next = state.redoStack.pop()
      if (!next) return
      state.undoStack.push(snapshotProject())
      await applyProjectSnapshot(next)
      showPage(state.previewPageIndex || 0)
      return
    }

    // Copy / Paste (相対配置を保持。ページを変えても sessionStorage に保持)
    if (ctrl && (k === "c" || k === "C")) {
      if (!state.selectKeys.length) return
      ev.preventDefault()
      const fids = state.selectKeys.filter((fid) => state.placements?.[fid])
      if (!fids.length) return
      state.clipboard = buildElementClipboard(fids)
      persistElementClipboard(state.clipboard)
      const n = state.clipboard.fids.length
      toast(n > 1 ? tr("toast.copiedMany", "コピー: {n}件").replace("{n}", String(n)) : tr("toast.copied", "コピーしました"))
      return
    }
    if (ctrl && (k === "v" || k === "V")) {
      if (!state.clipboard?.fids?.length) restoreElementClipboardFromSession()
      if (!state.clipboard?.fids?.length) return
      ev.preventDefault()
      const before = snapshotProject()
      const pasted = pasteElementClipboard(state.clipboard)
      if (!pasted.length) return
      state.selectKeys = pasted
      pushUndo(before)
      await window.pywebview.api.set_project_payload?.({ tags: state.tags, values: state.values, placements: state.placements })
      await window.pywebview.api.save_current_project?.(false)
      showPage(state.previewPageIndex || 0)
      render()
      const n = pasted.length
      const srcPg = Number(state.clipboard.sourcePage ?? 0) + 1
      const dstPg = Number(state.previewPageIndex || 0) + 1
      const cross = srcPg !== dstPg
      toast(
        n > 1
          ? (cross
            ? tr("toast.pastedManyCrossPage", "貼り付け: {n}件（p.{src}→p.{dst}）")
                .replace("{n}", String(n))
                .replace("{src}", String(srcPg))
                .replace("{dst}", String(dstPg))
            : tr("toast.pastedMany", "貼り付け: {n}件").replace("{n}", String(n)))
          : tr("toast.pasted", "貼り付けしました"),
      )
      return
    }

    // Delete selected
    if (k === "Delete" || k === "Backspace") {
      if (!state.selectKeys.length) return
      ev.preventDefault()
      const before = snapshotProject()
      const del = [...state.selectKeys]
      for (const fid of del) delete state.placements[fid]
      state.selectKeys = []
      pushUndo(before)
      if (window.pywebview?.api?.delete_elements) await window.pywebview.api.delete_elements(del)
      else {
        // fallback: try to persist full payload
        await window.pywebview.api.set_project_payload?.({ tags: state.tags, values: state.values, placements: state.placements })
      }
      await window.pywebview.api.save_current_project?.(false)
      showPage(state.previewPageIndex || 0)
      render()
      toast(`削除: ${del.length}件`)
      return
    }

    // Arrow keys:
    // - Multi-page projects: page navigation with plain arrows
    // - Element nudge: Alt + arrows
    if (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown") {
      const hasMultiPage = Number(state.pageCount || 1) > 1
      const plainArrow = !ev.altKey && !ctrl
      if (hasMultiPage && plainArrow) {
        ev.preventDefault()
        state.pageLocked = true
        const cur = Number.isFinite(state.previewPageIndex) ? state.previewPageIndex : 0
        const delta = (k === "ArrowRight" || k === "ArrowDown") ? 1 : -1
        await showPage(cur + delta)
        return
      }
      if (!ev.altKey) return
      if (!state.selectKeys.length) return
      ev.preventDefault()
      const step = ev.shiftKey ? 10 : 1
      const dx = k === "ArrowLeft" ? -step : k === "ArrowRight" ? step : 0
      const dy = k === "ArrowUp" ? -step : k === "ArrowDown" ? step : 0
      const before = snapshotProject()
      const page = Number.isFinite(state.previewPageIndex) ? state.previewPageIndex : 0
      for (const fid of state.selectKeys) {
        const pl = state.placements?.[fid]
        if (!pl) continue
        if (Number(pl.page || 0) !== page) continue
        pl.x = Math.max(0, Number(pl.x || 0) + dx)
        pl.y = Math.max(0, Number(pl.y || 0) + dy)
        state.placements[fid] = pl
      }
      pushUndo(before)
      await window.pywebview.api.set_project_payload?.({ tags: state.tags, values: state.values, placements: state.placements })
      await window.pywebview.api.save_current_project?.(false)
      drawOverlay()
      showPage(state.previewPageIndex || 0)
      return
    }
  }

  const btnOpen = $("#btnOpen")
  if (btnOpen) btnOpen.onclick = async () => {
    if (isWeb()) {
      const okToProceed = await showUnlockAd("zip_open")
      if (!okToProceed) return
    }
    const r = isWeb()
      ? await window.pywebview.api.pick_project({ zipOnly: true })
      : await window.pywebview.api.pick_project()
    if (!r.ok) {
      if (r.error) toast(apiErrorMessage(r, r.error))
      return
    }
    try {
      const dir = r.path?.replace(/[/\\][^/\\]+$/, "")
      if (dir) {
        state.lastProjectDir = dir
        saveLocal("inputstudio-last-dir", dir)
      }
    } catch {}
    const loaded = await window.pywebview.api.load_project(r.path)
    if (!loaded.ok) return
    state.projectPath = r.path
    state.projectName = loaded.project
    state.tags = loaded.tags || []
    state.values = loaded.values || {}
    state.placements = loaded.placements || {}
    state.pageCount = loaded.page_count || 1
    hydrateBinder(loaded)
    state.idx = 0
    state.dropDir = loaded.drop_dir || ""
    state.uiMode = loaded.ui_mode || state.uiMode
    state.lastSession = { path: r.path, workerId: state.workerId, projectName: state.projectName }
    saveLocal("inputstudio-last-session", state.lastSession)
    state.working = false
    state.inPrivate = false
    state.timerStart = null
    state.privateTotal = 0
    const started = await autoStartWorkIfPossible()
    toast(started ? tr("main.toast.projectLoadedAndTimer", "案件を読み込み、作業タイマーを開始しました") : tr("main.toast.projectLoaded", "案件を読み込みました"))
    render()
    await queuePreview()
  }

  // --- Demo (GitHub Pages): load real PDF in browser, but use the same button ---
  const demoPdfFile = $("#demoPdfFile")
  const loadPdfInBrowser = async (file) => {
    toast("PDFを読み込み中…")
    const buf = await file.arrayBuffer()
    // dynamic import pdf.js as ESM from CDN
    const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.mjs")
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.mjs"
    const doc = await pdfjs.getDocument({ data: buf }).promise

    window.__demoPdfDoc = doc
    window.__demoPdfCache = new Map()

    const api = window.pywebview.api
    api.get_preview_png_base64_page = async (page_index) => {
      const idx = Math.max(0, Math.min(doc.numPages - 1, Number(page_index || 0)))
      const cache = window.__demoPdfCache
      if (cache.has(idx)) return cache.get(idx)
      const page = await doc.getPage(idx + 1)
      // Match desktop coordinate system (RENDER_DPI=150)
      const scale = 150 / 72
      const vp = page.getViewport({ scale })
      const canvas = document.createElement("canvas")
      canvas.width = Math.floor(vp.width)
      canvas.height = Math.floor(vp.height)
      const ctx = canvas.getContext("2d")
      await page.render({ canvasContext: ctx, viewport: vp }).promise
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"))
      const url = URL.createObjectURL(blob)
      const out = { ok: true, png: url, page_display_width: canvas.width, page_display_height: canvas.height, page_index: idx }
      cache.set(idx, out)
      return out
    }
    api.get_preview_png_base64 = async (tag) => {
      const t = String(tag || "").trim()
      const pl = state.placements?.[t]
      const idx = pl ? Number(pl.page || 0) : 0
      return api.get_preview_png_base64_page(idx)
    }

    state.projectPath = "demo:pdf"
    state.projectName = file.name
    state.pageCount = doc.numPages
    state.previewPageIndex = 0
    state.tags = []
    state.values = {}
    state.placements = {}
    toast(`PDFを読み込みました（${doc.numPages}ページ）`)
    render()
  }
  if (demoPdfFile) {
    demoPdfFile.onchange = async () => {
      const file = demoPdfFile.files?.[0]
      if (!file) return
      try {
        await loadPdfInBrowser(file)
      } catch (e) {
        await uiAlert(`PDF読み込みに失敗しました: ${e}`)
      } finally {
        demoPdfFile.value = ""
      }
    }
  }

  const btnOpenPdf = $("#btnOpenPdf")
  if (btnOpenPdf) btnOpenPdf.onclick = async () => {
    if (window.__INPUTSTUDIO_DEMO__ && demoPdfFile) {
      demoPdfFile.click()
      return
    }
    try {
      const api = window.pywebview?.api
      const pick = api?.pick_pdf
      const createSimple = api?.create_project_from_pdf_simple
      if (!pick || !createSimple) {
        await uiAlert("PDFから新規作成する機能が見つかりません。最新版またはバックエンドの create_project_from_pdf_simple/pick_pdf をご用意ください。")
        return
      }
      const r = await pick()
      if (!r?.ok) return
      toast(tr("gate.toastCreateProjectFromPdf", "PDFを読み込み、新規プロジェクトを作成します…"))
      const g = await createSimple(r.path)
      if (!g?.ok || !g.path) {
        await uiAlert((g?.errors || ["PDFをプロジェクト化できませんでした"]).join("\n"))
        return
      }
      const loaded = await api.load_project(g.path)
      if (!loaded?.ok) {
        await uiAlert("新規プロジェクトを開けませんでした")
        return
      }
      state.projectPath = g.path
      state.projectName = loaded.project
      state.tags = loaded.tags || []
      state.values = loaded.values || {}
      state.placements = loaded.placements || {}
      state.pageCount = loaded.page_count || 1
      hydrateBinder(loaded)
      state.idx = 0
      state.dropDir = loaded.drop_dir || ""
      state.uiMode = loaded.ui_mode || state.uiMode
      state.lastSession = { path: g.path, workerId: state.workerId, projectName: state.projectName }
      saveLocal("inputstudio-last-session", state.lastSession)
      try {
        const dir = g.path.replace(/[/\\][^/\\]+$/, "")
        state.lastProjectDir = dir
        saveLocal("inputstudio-last-dir", dir)
      } catch {}
      state.working = false
      state.inPrivate = false
      state.timerStart = null
      state.privateTotal = 0
      const started = await autoStartWorkIfPossible()
      toast(started ? "新規案件を作成し、作業タイマーを開始しました" : "PDFから新規プロジェクトを作成しました。必要に応じてタグを配置してください。")
      render()
    } catch (e) {
      await uiAlert(`PDFから新規作成に失敗しました: ${e}`)
    }
  }

  const btnResume = $("#btnResume")
  if (btnResume && state.lastSession?.path) {
    btnResume.onclick = async () => {
      const p = state.lastSession.path
      const loaded = await window.pywebview.api.load_project(p)
      if (!loaded.ok) return toast("前回の案件を開けませんでした")
      state.projectPath = p
      state.projectName = loaded.project
      state.tags = loaded.tags || []
      state.values = loaded.values || {}
      state.placements = loaded.placements || {}
      state.pageCount = loaded.page_count || 1
      hydrateBinder(loaded)
      state.idx = 0
      state.dropDir = loaded.drop_dir || ""
      if (state.lastSession.workerId) state.workerId = state.lastSession.workerId
      state.working = false
      state.inPrivate = false
      state.timerStart = null
      state.privateTotal = 0
      const started = await autoStartWorkIfPossible()
      toast(started ? "前回の案件を読み込み、作業タイマーを開始しました" : "前回の案件を読み込みました")
      render()
      await queuePreview()
    }
  }

  // フォーム付きPDFを扱わない前提のため、自動作成機能は削除

  const btnBackToGate = $("#btnBackToGate")
  if (btnBackToGate) btnBackToGate.onclick = () => {
    state.appStage = "gate"
    state.gate = state.gate || { step: "choose", password: "", error: "" }
    if (!isWeb()) {
      state.gate.step = "choose"
      state.gate.password = ""
      state.gate.error = ""
    }
    render()
  }

  const btnDesign = $("#btnDesign")
  if (btnDesign) btnDesign.onclick = async () => {
    if (!state.projectPath) return toast("先に案件を開いてください")
    state.designMode = true
    // design mode operates on element id (fid)
    state.designKey = state.designKey || (Object.keys(state.placements || {})[0] || null)
    await openDesignModal()
  }

  const btnSave = $("#btnSave")
  if (btnSave) btnSave.onclick = async () => {
    if (!state.projectPath) return toast("先に案件を開いてください")
    // ローカル(EXE)は「上書き保存」を JSON のみの高速保存にし、PDF生成は「PDF出力」へ分離。
    if (!isWeb()) {
      try {
        await pushValue()
        toast("保存中…")
        const r = await window.pywebview.api.save_current_project(false)
        if (!r?.ok) return toast(`保存に失敗: ${r?.error || "unknown"}`)
        state.lastSession = { path: state.projectPath, workerId: state.workerId, projectName: state.projectName }
        saveLocal("inputstudio-last-session", state.lastSession)
        toast("保存しました")
      } catch (e) {
        toast(`保存に失敗しました: ${e}`)
      }
      return
    }
    try {
      showLoading("保存してPDFを生成しています…", "完成PDFを作成中です")
      const r = await window.pywebview.api.save_current_project(true)
      if (!r?.ok) {
        hideLoading()
        return toast(`保存に失敗: ${r?.error || "unknown"}`)
      }
      state.lastSession = { path: state.projectPath, workerId: state.workerId, projectName: state.projectName }
      saveLocal("inputstudio-last-session", state.lastSession)
      if (r?.filled_pdf) state.lastFilledPdf = r.filled_pdf
      if (r?.exports_dir) state.lastExportDir = r.exports_dir
      if (window.pywebview?.api?.download_filled_pdf) {
        const dl = await window.pywebview.api.download_filled_pdf()
        hideLoading()
        if (dl?.error === "cancelled") toast("保存をキャンセルしました")
        else if (!dl?.ok) toast(`PDFダウンロードに失敗: ${dl?.error || "unknown"}`)
        else toast("PDFを保存しました")
      } else {
        hideLoading()
        toast("保存しました")
      }
      render()
    } catch (e) {
      hideLoading()
      toast(`保存に失敗しました: ${e}`)
    }
  }

  const btnExportPdf = $("#btnExportPdf")
  if (btnExportPdf) btnExportPdf.onclick = async () => {
    if (!state.projectPath) return toast("先に案件を開いてください")
    const api = window.pywebview?.api
    if (!api?.export_filled_pdf_now) return toast("PDF出力機能が見つかりません（最新版に更新してください）")
    openExportChooser()
  }

  const btnTagManager = $("#btnTagManager")
  if (btnTagManager) btnTagManager.onclick = () => {
    if (!state.projectPath) return toast("先に案件を開いてください")
    openTagManager()
  }

  const btnExcelImport = $("#btnExcelImport")
  if (btnExcelImport) btnExcelImport.onclick = () => {
    if (!state.projectPath) return toast("先に案件を開いてください")
    openExcelImport()
  }

  const btnSaveAs = $("#btnSaveAs")
  if (btnSaveAs) btnSaveAs.onclick = async () => {
    if (!state.projectPath) return toast("先に案件を開いてください")
    const name0 = String(state.projectName || "案件").trim() || "案件"
    try {
      if (isWeb()) {
        toast("プロジェクトを保存します…")
        if (window.pywebview?.api?.save_project_to_picker) {
          const r = await window.pywebview.api.save_project_to_picker(name0)
          if (r?.error === "cancelled") toast("保存をキャンセルしました")
          else if (!r?.ok) toast(`プロジェクト保存に失敗: ${r?.error || "unknown"}`)
          else toast("プロジェクトを保存しました")
        } else {
          toast("プロジェクト保存機能が見つかりません")
        }
        pulse()
        render()
        return
      }
      const name = await uiPrompt("名前を付けて保存（新しい案件名）", `${name0}-コピー`)
      if (!name) return
      showLoading("名前を付けて保存しています…", "コピーを作成し、完成PDFを生成中です")
      const r = await window.pywebview.api.save_project_as(String(name), true)
      if (!r?.ok || !r.path) {
        hideLoading()
        return toast(`保存に失敗: ${r?.error || "unknown"}`)
      }
      const loaded = await window.pywebview.api.load_project(r.path)
      hideLoading()
      if (!loaded?.ok) return toast("保存した案件を開けませんでした")
      state.projectPath = r.path
      state.projectName = loaded.project
      state.tags = loaded.tags || []
      state.values = loaded.values || {}
      state.placements = loaded.placements || {}
      state.pageCount = loaded.page_count || 1
      hydrateBinder(loaded)
      state.idx = 0
      state.dropDir = loaded.drop_dir || ""
      state.uiMode = loaded.ui_mode || state.uiMode
      state.lastSession = { path: r.path, workerId: state.workerId, projectName: state.projectName }
      saveLocal("inputstudio-last-session", state.lastSession)
      if (r?.filled_pdf) state.lastFilledPdf = r.filled_pdf
      if (r?.exports_dir) state.lastExportDir = r.exports_dir
      toast("名前を付けて保存しました（PDFも生成）")
      pulse()
      render()
      await queuePreview()
    } catch (e) {
      hideLoading()
      toast(`保存に失敗しました: ${e}`)
    }
  }

  const btnAppendPdf = $("#btnAppendPdf")
  if (btnAppendPdf) {
    btnAppendPdf.onclick = async () => {
      if (!state.projectPath) return toast("先に案件を開いてください")
      const okToProceed = await showUnlockAd("pdf_append")
      if (!okToProceed) return
      const api = window.pywebview?.api
      if (!api?.pick_pdf || !api?.append_pdf_to_project) return toast("PDF追加機能が見つかりません（最新版に更新してください）")
      const curr = Number(state.previewPageIndex || 0) || 0
      const r = await api.pick_pdf()
      if (!r?.ok || !r.path) return
      toast(tr("main.toast.appendProcessing", "PDFを追加して結合中…"))
      const a = await api.append_pdf_to_project(r.path)
      if (!a?.ok) return toast(`PDF追加に失敗: ${apiErrorMessage(a, "unknown")}`)
      state.pageCount = a.page_count || state.pageCount
      resetPreviewViewport({ zoom: 1.0 })
      render()
      await showPage(curr)
      toast(tr("main.toast.appendDone", `PDFを追加しました（合計 ${state.pageCount} ページ）`, { pages: state.pageCount }))
    }
  }
  const btnCopyPageOp = $("#btnCopyPageOp")
  if (btnCopyPageOp) {
    btnCopyPageOp.onclick = async () => {
      if (!state.projectPath) return toast("先に案件を開いてください")
      const api = window.pywebview?.api
      if (!api?.copy_page_with_elements) return toast("ページコピー機能が見つかりません（最新版に更新してください）")
      const curr = Number(state.previewPageIndex || 0) || 0
      const r = await api.copy_page_with_elements(curr)
      if (!r?.ok) return toast(`ページコピーに失敗: ${apiErrorMessage(r, "unknown")}`)
      state.pageCount = Number(r.page_count || state.pageCount) || state.pageCount
      state.placements = r.placements && typeof r.placements === "object" ? r.placements : state.placements
      render()
      await showPage(Number(r.page_index ?? (curr + 1)))
      toast(tr("main.toast.copyDone", "ページをコピーしました"))
    }
  }
  const btnDeletePageOp = $("#btnDeletePageOp")
  if (btnDeletePageOp) {
    btnDeletePageOp.onclick = async () => {
      if (!state.projectPath) return toast("先に案件を開いてください")
      await openDeletePagesModal()
    }
  }
  const btnReorderPdf = $("#btnReorderPdf")
  if (btnReorderPdf) {
    btnReorderPdf.onclick = async () => {
      if (!state.projectPath) return toast("先に案件を開いてください")
      await openPageOpsModal()
    }
  }

  const btnBulkPaste = $("#btnBulkPaste")
  if (btnBulkPaste) {
    btnBulkPaste.onclick = async () => {
      await openBulkPasteModal()
    }
  }

  const btnBinder = $("#btnBinder")
  if (btnBinder) {
    btnBinder.onclick = () => {
      if (!state.projectPath) return toast("先に案件を開いてください")
      openBinder()
    }
  }

  const btnNoteMode = $("#btnNoteMode")
  if (btnNoteMode) {
    btnNoteMode.onclick = () => {
      if (!state.projectPath) return toast("先に案件を開いてください")
      state.noteAddMode = !state.noteAddMode
      if (state.noteAddMode) toast("プレビュー上のクリックで付箋を貼れます")
      render()
    }
  }

  const btnOpenSaved = $("#btnOpenSaved")
  if (btnOpenSaved) btnOpenSaved.onclick = async () => {
    if (!state.projectPath) return
    const api = window.pywebview?.api
    // Preferred: open Explorer via backend
    if (api?.reveal_in_explorer) {
      const r = await api.reveal_in_explorer(state.projectPath)
      if (!r?.ok) toast(`開けませんでした: ${r?.error || "unknown"}`)
      return
    }
    // Fallback: copy path
    try {
      await navigator.clipboard.writeText(String(state.projectPath))
      toast("保存先パスをコピーしました")
    } catch {
      toast(String(state.projectPath))
    }
  }

  const btnOpenFilled = $("#btnOpenFilled")
  if (btnOpenFilled) btnOpenFilled.onclick = async () => {
    const p = state.lastFilledPdf || state.lastExportDir
    if (!p) return
    const api = window.pywebview?.api
    if (api?.reveal_in_explorer) {
      const r = await api.reveal_in_explorer(p)
      if (!r?.ok) toast(`開けませんでした: ${r?.error || "unknown"}`)
      return
    }
    try {
      await navigator.clipboard.writeText(String(p))
      toast("提出PDFパスをコピーしました")
    } catch {
      toast(String(p))
    }
  }

  const btnPrevPage = $("#btnPrevPage")
  if (btnPrevPage) btnPrevPage.onclick = () => {
    state.pageLocked = true
    showPage((state.previewPageIndex || 0) - 1)
  }
  const btnNextPage = $("#btnNextPage")
  if (btnNextPage) btnNextPage.onclick = () => {
    state.pageLocked = true
    showPage((state.previewPageIndex || 0) + 1)
  }
  const pageIndicator = $("#pageIndicator")
  if (pageIndicator) pageIndicator.onclick = async () => {
    const total = Math.max(1, Number(state.pageCount || 1))
    const cur = (Number(state.previewPageIndex || 0) || 0) + 1
    const raw = await uiPrompt(tr("dialog.gotoPage", `移動先ページを入力してください（1-${total}）`, { total }), String(cur))
    if (raw == null) return
    const n = Number(String(raw).trim())
    if (!Number.isFinite(n)) return toast("ページ番号が不正です")
    const idx = Math.max(1, Math.min(total, Math.floor(n))) - 1
    state.pageLocked = true
    await showPage(idx)
  }

  const btnZoomOut = $("#btnZoomOut")
  if (btnZoomOut) btnZoomOut.onclick = () => setViewZoom((Number(state.viewZoom || 1) || 1) - 0.1)
  const btnZoomIn = $("#btnZoomIn")
  if (btnZoomIn) btnZoomIn.onclick = () => setViewZoom((Number(state.viewZoom || 1) || 1) + 0.1)
  const btnZoomReset = $("#btnZoomReset")
  if (btnZoomReset)
    btnZoomReset.onclick = () => {
      state.viewPanX = 0
      state.viewPanY = 0
      setViewZoom(1.0)
    }

  const btnAdmin = $("#btnAdmin")
  if (btnAdmin) btnAdmin.onclick = async () => {
    const ok = await uiConfirm(tr("dialog.switchAdmin", "管理者モードに切り替えます（OCR/設計が表示されます）。よろしいですか？"))
    if (!ok) return
    const r = await window.pywebview.api.set_ui_mode("admin")
    if (!r.ok) return toast("切り替えに失敗しました")
    state.uiMode = "admin"
    toast("管理者モード")
    render()
  }

  const btnLock = $("#btnLock")
  if (btnLock) btnLock.onclick = async () => {
    const ok = await uiConfirm(tr("dialog.switchWorker", "入力者モードに切り替えます（OCR/設計を隠します）。よろしいですか？"))
    if (!ok) return
    const r = await window.pywebview.api.set_ui_mode("worker")
    if (!r.ok) return toast("切り替えに失敗しました")
    state.uiMode = "worker"
    state.designMode = false
    state.addMode = false
    toast("入力者モード")
    render()
  }

  const workerSelect = $("#workerSelect")
  if (workerSelect) {
    workerSelect.onchange = async (e) => {
      state.workerId = e.target.value
      saveLocal("inputstudio-last-worker", state.workerId)
      if (!state.working) {
        const started = await autoStartWorkIfPossible()
        if (started) {
          toast("作業タイマーを開始しました")
          render()
        }
      }
    }
  }

  const btnWorker = $("#btnWorker")
  if (btnWorker) btnWorker.onclick = () => openWorkerModal({ mode: "manage" })

  const historyExport = () => {
    if (!state.history.length) return toast("履歴がありません")
    const header = ["project","path","worker","start_iso","end_iso","duration_sec"].join(",")
    const rows = state.history.map((h) =>
      [h.projectName || "", h.projectPath || "", h.workerName || "", h.start, h.end, h.duration].map((s) =>
        `"${String(s || "").replace(/"/g, '""')}"`
      ).join(",")
    )
    const csv = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `inputstudio-history-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const btnHistoryExport = $("#btnHistoryExport")
  if (btnHistoryExport) btnHistoryExport.onclick = historyExport
  const btnHistoryReset = $("#btnHistoryReset")
  if (btnHistoryReset) btnHistoryReset.onclick = async () => {
    const ok = await uiConfirm(tr("dialog.resetHistory", "作業履歴をリセットします（内部保存のみ削除、プロジェクトは残ります）。よろしいですか？"))
    if (!ok) return
    state.history = []
    saveLocal("inputstudio-history", state.history)
    toast("履歴をリセットしました")
  }

  const btnStart = $("#btnStart")
  if (btnStart) btnStart.onclick = async () => {
    if (!state.projectPath) return toast("先に案件を開いてください")
    if (!state.workerId) return toast("作業者を選んでください")
    const r = await window.pywebview.api.start_work(state.workerId)
    if (!r.ok) return toast("開始できませんでした")
    state.working = true
    state.inPrivate = false
    state.timerStart = Date.now()
    state.privateTotal = 0
    state.sessionStart = new Date().toISOString()
    state.lastSession = { path: state.projectPath, workerId: state.workerId, projectName: state.projectName }
    saveLocal("inputstudio-last-session", state.lastSession)
    pulse()
    toast("作業タイマーを開始しました")
    render()
  }

  const btnPrivate = $("#btnPrivate")
  if (btnPrivate) btnPrivate.onclick = async () => {
    const r = await window.pywebview.api.toggle_private()
    if (!r.ok) return
    if (!state.inPrivate) {
      state.inPrivate = true
      state._privateStart = Date.now()
      toast("作業タイマーを中断しました")
    } else {
      state.inPrivate = false
      state.privateTotal += (Date.now() - state._privateStart) / 1000
      toast("作業タイマーを再開しました")
      pulse()
    }
    render()
  }

  const btnFinish = $("#btnFinish")
  if (btnFinish) btnFinish.onclick = async () => {
    const ok = await uiConfirm(tr("dialog.finishWork", "勤務を終了して提出物（ZIP）を作成します。よろしいですか？"))
    if (!ok) return
    await pushValue()
    showLoading("提出物（ZIP）を作成しています…", "完成PDFとレポートを生成中です")
    const endIso = new Date().toISOString()
    const meta = {
      worker_id: String(state.workerId || ""),
      worker_name: String((state.workers.find((w) => w.id === state.workerId) || {}).name || ""),
      start_iso: String(state.sessionStart || ""),
      end_iso: String(endIso),
      duration_sec: Number(calcNetSeconds() || 0),
      private_sec: Number(state.privateTotal || 0),
      total_tags: Number(state.tags?.length || 0),
      filled_count: Number(filledCount() || 0),
      placement_count: Number(Object.keys(state.placements || {}).length || 0),
      project_name: String(state.projectName || ""),
      project_path: String(state.projectPath || ""),
    }
    const r = await window.pywebview.api.finish(meta)
    hideLoading()
    if (!r.ok) return toast(`提出物の作成に失敗しました: ${r.error || "unknown"}`)
    if (r?.filled_pdf) state.lastFilledPdf = r.filled_pdf
    if (r?.dir) state.lastExportDir = r.dir
    if (r?.report_pdf) state.lastReportPdf = r.report_pdf
    state.working = false
    state.justCompleted = true
    const duration = calcNetSeconds()
    state.history = [
      ...state.history,
      {
        projectName: state.projectName,
        projectPath: state.projectPath,
        workerId: state.workerId,
        workerName: (state.workers.find((w) => w.id === state.workerId) || {}).name || "",
        start: state.sessionStart,
        end: endIso,
        duration,
      },
    ]
    saveLocal("inputstudio-history", state.history)
    state.sessionStart = null
    state.timerStart = null
    state.privateTotal = 0
    state.inPrivate = false
    render()
    openFinishModal(r)
    // 要望: 終了直後にエクスプローラーで保存階層を開く
    try {
      const api = window.pywebview?.api
      const target = r?.bundle_dir || r?.dir || r?.filled_pdf || ""
      if (api?.reveal_in_explorer && target) {
        await api.reveal_in_explorer(String(target))
      }
    } catch {}
  }

  const btnPrev = $("#btnPrev")
  bindNoFocusOnPrimaryClick(btnPrev)
  if (btnPrev) btnPrev.onclick = async () => {
    await pushValue()
    state.pageLocked = false
    state.idx = Math.max(0, state.idx - 1)
    swipe("left")
    render()
    focusValueAfterTagNavigate()
  }
  const btnNext = $("#btnNext")
  bindNoFocusOnPrimaryClick(btnNext)
  if (btnNext) btnNext.onclick = async () => {
    const beforeEmpty = isCurrentEmpty()
    await pushValue()
    state.pageLocked = false
    const afterEmpty = isKeyEmpty(state.tags[state.idx])
    if (beforeEmpty && !afterEmpty) {
      state.justCompleted = true
    }
    state.idx = Math.min(state.tags.length - 1, state.idx + 1)
    swipe("right")
    render()
    focusValueAfterTagNavigate()
  }
  const btnReuseReview = $("#btnReuseReview")
  if (btnReuseReview) {
    btnReuseReview.onclick = () => {
      toggleReuseReviewMode()
      render()
    }
  }
  const btnNextEmpty = $("#btnNextEmpty")
  bindNoFocusOnPrimaryClick(btnNextEmpty)
  if (btnNextEmpty) btnNextEmpty.onclick = async () => {
    await pushValue()
    state.pageLocked = false
    for (let i = state.idx + 1; i < state.tags.length; i++) {
      const k = state.tags[i]
      if (isKeyEmpty(k)) {
        state.idx = i
        swipe("right")
        render()
        focusValueAfterTagNavigate()
        return
      }
    }
    toast("未入力はありません")
  }
  const btnClear = $("#btnClear")
  if (btnClear) btnClear.onclick = async () => {
    if (!state.tags.length) return
    const k = state.tags[state.idx]
    state.values[k] = ""
    markTagReuseReviewEdited(k)
    await window.pywebview.api.set_value(k, "")
    pulse()
    render()
  }

  const btnAddField = $("#btnAddField")
  if (btnAddField) {
    btnAddField.onclick = async () => {
      if (!state.projectPath) return toast("先に案件を開いてください")
      const name = (await uiPrompt("追加する欄の名前（例：備考2 / メモ / 追記）", "")) || ""
      const n = name.trim()
      if (!n) return
      state.addDraftName = n
      state.addMode = true
      toast("プレビュー上をクリックして欄を置いてください")
      drawOverlay()
      enableOverlayPointer(true)
    }
  }

  const val = $("#val")
  if (val) {
    val.addEventListener("keydown", async (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        if (state.idx < state.tags.length - 1) {
          if (btnNext?.onclick) await btnNext.onclick()
          focusValueAfterTagNavigate()
        }
      }
    })

    let t = null
    val.addEventListener("input", () => {
      const k = state.tags[state.idx]
      if (k) markTagReuseReviewEdited(k)
      clearTimeout(t)
      t = setTimeout(() => {
        pushValue(true)
      }, 180)
    })
  }

  // 追加モード：クリックで配置
  const ov = $("#overlay")
  if (ov) {
    // enable overlay interactions for selection/editing
    enableOverlayPointer(!!state.projectPath)
    const previewHost = ov.parentElement
    if (previewHost) {
      if (!previewHost.__inputstudioWheelBound) {
        previewHost.__inputstudioWheelBound = true
        previewHost.addEventListener("wheel", (ev) => {
          if (!state.projectPath) return
          ev.preventDefault()
          const withCtrl = !!(ev.ctrlKey || ev.metaKey)
          const step = withCtrl ? 0.2 : 0.1
          const dir = ev.deltaY > 0 ? -step : step
          setViewZoom((Number(state.viewZoom || 1) || 1) + dir)
        }, { passive: false })
      }
      // Fallback for environments where pointer middle-drag stops working after zoom.
      if (!previewHost.__inputstudioMiddlePanBound) {
        previewHost.__inputstudioMiddlePanBound = true
        let middlePanning = false
        let startX = 0
        let startY = 0
        let baseX = 0
        let baseY = 0
        const onMove = (ev) => {
          if (!middlePanning) return
          const dx = ev.clientX - startX
          const dy = ev.clientY - startY
          state.viewPanX = baseX + dx
          state.viewPanY = baseY + dy
          applyPreviewTransform()
          drawOverlay()
        }
        const onUp = () => {
          if (!middlePanning) return
          middlePanning = false
          window.removeEventListener("mousemove", onMove, true)
          window.removeEventListener("mouseup", onUp, true)
        }
        previewHost.addEventListener("mousedown", (ev) => {
          if (!state.projectPath || state.designMode) return
          if (ev.button !== 1) return
          middlePanning = true
          startX = ev.clientX
          startY = ev.clientY
          baseX = Number(state.viewPanX || 0) || 0
          baseY = Number(state.viewPanY || 0) || 0
          window.addEventListener("mousemove", onMove, true)
          window.addEventListener("mouseup", onUp, true)
          ev.preventDefault()
        }, { passive: false })
        previewHost.addEventListener("auxclick", (ev) => {
          if (ev.button === 1) ev.preventDefault()
        }, { passive: false })
      }
    }
    const toPageXY = (ev) => {
      const img = $("#previewImg")
      if (!img || !img.src) return null
      const box = getRenderedContentRect(img, state.pageW, state.pageH)
      const x0 = ev.clientX - box.left
      const y0 = ev.clientY - box.top
      if (x0 < 0 || y0 < 0 || x0 > box.width || y0 > box.height) return null
      const x = (x0 / box.width) * state.pageW
      const y = (y0 / box.height) * state.pageH
      return { x, y, box }
    }

    const hitTest = (pt) => {
      const page = Number.isFinite(state.previewPageIndex) ? state.previewPageIndex : 0
      const keys = Object.keys(state.placements || {})
      // last keys = topmost (rough)
      for (let i = keys.length - 1; i >= 0; i--) {
        const fid = keys[i]
        const pl = state.placements?.[fid]
        if (!pl) continue
        if (Number(pl.page || 0) !== page) continue
        const b = placementBoxOnPage(fid, pl)
        const m = Math.max(10, (Number(pl.font_size || 14) || 14) * 0.35)
        if (pt.x >= b.x - m && pt.y >= b.y - m && pt.x <= b.x + b.w + m && pt.y <= b.y + b.h + m) {
          return fid
        }
      }
      return null
    }

    let dragging = false
    let dragStart = null
    let dragBase = null
    let dragUndo = null
    let clickTag = null
    let moved = false
    let gestureMultiPick = false
    let pendingToggleKey = null
    let marqueeActive = false
    let panning = false
    let panStartX = 0
    let panStartY = 0
    let panBaseX = 0
    let panBaseY = 0

    // PDFをダブルクリック -> 配置パレット（作業者でも使える）
    ov.ondblclick = (ev) => {
      if (!state.projectPath) return
      // design mode のダブルクリックは既存の処理に任せる
      if (state.designMode) return
      const p = toPageXY(ev)
      if (!p) return
      ev.preventDefault()
      openPlacePalette({ x: p.x, y: p.y }, null)
    }

    ov.onpointerdown = (ev) => {
      if (!state.projectPath) return
      if (state.designMode) return
      if (ev.button === 1 || ev.altKey) {
        panning = true
        panStartX = ev.clientX
        panStartY = ev.clientY
        panBaseX = Number(state.viewPanX || 0) || 0
        panBaseY = Number(state.viewPanY || 0) || 0
        try {
          ov.setPointerCapture?.(ev.pointerId)
        } catch {}
        ev.preventDefault()
        return
      }
      if (state.addMode) return
      // ignore if starting on modal etc
      const p = toPageXY(ev)
      if (!p) return
      // 付箋モード：クリック位置に付箋を追加
      if (state.noteAddMode) {
        ev.preventDefault()
        const notePt = { page: physicalToLogicalPage(Number(state.previewPageIndex || 0)), x: p.x, y: p.y }
        state.noteAddMode = false
        // 先に再描画してツールバー状態を戻す → そのあとモーダルを開く（renderがモーダルを消すため順序が重要）
        render()
        openNoteEditor(notePt)
        return
      }
      // 既存の付箋ピンをクリック → 編集
      const hitNote = notePinHit(p)
      if (hitNote) {
        ev.preventDefault()
        openNoteEditor(hitNote)
        return
      }
      const t = hitTest(p)
      clickTag = t
      moved = false
      gestureMultiPick = false
      pendingToggleKey = null
      if (t) {
        gestureMultiPick = !!(ev.shiftKey || ev.ctrlKey)
        if (gestureMultiPick) {
          // 未選択は即追加。選択済みの Shift+クリックは離すまでトグルしない（ドラッグ移動を優先）
          if (state.selectKeys.includes(t)) pendingToggleKey = t
          else state.selectKeys = [...state.selectKeys, t]
        } else if (!state.selectKeys.includes(t)) {
          state.selectKeys = [t]
        }
        dragUndo = snapshotProject()
        dragging = true
        dragStart = { x: p.x, y: p.y }
        dragBase = {}
        const curPage = Number(state.previewPageIndex || 0)
        for (const k of state.selectKeys) {
          const pl = state.placements?.[k]
          if (!pl || Number(pl.page || 0) !== curPage) continue
          dragBase[k] = { x: Number(pl.x || 0), y: Number(pl.y || 0), page: Number(pl.page || 0), font_size: Number(pl.font_size || 14), color: pl.color, line_height: pl.line_height, letter_spacing: pl.letter_spacing }
        }
        if (!Object.keys(dragBase).length) {
          dragging = false
          dragStart = null
          dragBase = null
          dragUndo = null
          drawOverlay()
          return
        }
        ev.preventDefault()
        try {
          ov.setPointerCapture?.(ev.pointerId)
        } catch {}
        drawOverlay()
      } else {
        if (ev.shiftKey || ev.ctrlKey) {
          marqueeActive = true
          state.marquee = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }
          state.marqueeBaseKeys = [...state.selectKeys]
          try {
            ov.setPointerCapture?.(ev.pointerId)
          } catch {}
          ev.preventDefault()
          drawOverlay()
        } else {
          state.selectKeys = []
          drawOverlay()
        }
      }
    }

    ov.onpointermove = (ev) => {
      if (marqueeActive && state.marquee) {
        const p = toPageXY(ev)
        if (!p) return
        state.marquee.x1 = p.x
        state.marquee.y1 = p.y
        drawOverlay()
        return
      }
      if (panning) {
        const dx = ev.clientX - panStartX
        const dy = ev.clientY - panStartY
        state.viewPanX = panBaseX + dx
        state.viewPanY = panBaseY + dy
        applyPreviewTransform()
        drawOverlay()
        return
      }
      if (!dragging || !dragStart || !dragBase) return
      const p = toPageXY(ev)
      if (!p) return
      const dx = p.x - dragStart.x
      const dy = p.y - dragStart.y
      if (Math.abs(dx) + Math.abs(dy) > 1) {
        moved = true
        pendingToggleKey = null
      }
      for (const k of Object.keys(dragBase)) {
        const base = dragBase[k]
        if (!base) continue
        const pl = state.placements[k] || {}
        pl.x = Math.max(0, base.x + dx)
        pl.y = Math.max(0, base.y + dy)
        state.placements[k] = pl
      }
      drawOverlay()
    }

    ov.onpointerup = async () => {
      if (marqueeActive) {
        marqueeActive = false
        const m = state.marquee
        state.marquee = null
        if (m) {
          const page = Number(state.previewPageIndex || 0)
          const hits = fidsInPageRect(page, m.x0, m.y0, m.x1, m.y1)
          const base = state.marqueeBaseKeys || []
          state.selectKeys = [...new Set([...base, ...hits])]
          state.marqueeBaseKeys = []
        }
        drawOverlay()
        return
      }
      if (panning) {
        panning = false
        return
      }
      if (!dragging) {
        clickTag = null
        return
      }
      dragging = false
      if (clickTag && !moved) {
        if (pendingToggleKey) {
          state.selectKeys = state.selectKeys.filter((k) => k !== pendingToggleKey)
          pendingToggleKey = null
          dragUndo = null
          clickTag = null
          drawOverlay()
          return
        }
        const sole = state.selectKeys.length === 1 && state.selectKeys[0] === clickTag
        if (sole && !gestureMultiPick) {
          const pl = state.placements?.[clickTag]
          if (pl) openPlacePalette({ x: Number(pl.x || 0), y: Number(pl.y || 0) }, clickTag)
        }
        dragUndo = null
        clickTag = null
        gestureMultiPick = false
        return
      }
      clickTag = null
      gestureMultiPick = false
      pendingToggleKey = null
      // commit drag
      if (dragUndo) {
        pushUndo(dragUndo)
      }
      dragUndo = null
      dragStart = null
      dragBase = null
      try {
        if (window.pywebview?.api?.set_project_payload) {
          await window.pywebview.api.set_project_payload({ tags: state.tags, values: state.values, placements: state.placements })
          await window.pywebview.api.save_current_project?.(false)
        } else {
          // fallback
          for (const k of state.selectKeys) {
            const pl = state.placements?.[k]
            if (pl) await window.pywebview.api.set_element_pos?.(k, pl.x, pl.y)
          }
        }
      } catch {}
      // refresh preview for current page
      showPage(state.previewPageIndex || 0)
    }

    ov.onpointercancel = () => {
      panning = false
      marqueeActive = false
      state.marquee = null
      state.marqueeBaseKeys = []
      dragging = false
      dragUndo = null
      dragStart = null
      dragBase = null
      clickTag = null
      gestureMultiPick = false
      pendingToggleKey = null
    }

    // Prevent browser middle-click auto-scroll from stealing drag interactions.
    ov.onmousedown = (ev) => {
      if (ev.button === 1) ev.preventDefault()
    }
    ov.onauxclick = (ev) => {
      if (ev.button === 1) ev.preventDefault()
    }

    ov.onclick = async (ev) => {
      if (!state.addMode) return
      const p = toPageXY(ev)
      if (!p) return
      const x = p.x
      const y = p.y
      toast("欄を追加中…")
      const fs = Number(state.defaultFontSize || 14) || 14
      let r = await window.pywebview.api.add_text_field(state.addDraftName, state.previewPageIndex || 0, x, y, fs)
      // Recover if backend lost project context (rare, but observed)
      if (!r.ok && r.error === "no_project" && state.projectPath && window.pywebview.api.load_project) {
        try {
          await window.pywebview.api.load_project(state.projectPath)
          r = await window.pywebview.api.add_text_field(state.addDraftName, state.previewPageIndex || 0, x, y, fs)
        } catch {}
      }
      if (!r.ok) {
        state.addMode = false
        enableOverlayPointer(false)
        drawOverlay()
        await uiAlert(`追加に失敗: ${r.error || "unknown"}`)
        return
      }
      const fid = r.fid
      const tag = r.tag
      if (!state.tags.includes(tag)) state.tags.push(tag)
      if (state.values[tag] == null) state.values[tag] = ""
      state.placements[fid] = { tag, page: state.previewPageIndex || 0, x, y, font_size: fs, color: "#0f172a", line_height: 1.2, letter_spacing: DEFAULT_LETTER_SPACING }
      state.selectKeys = [fid]
      state.idx = state.tags.indexOf(tag)
      await window.pywebview.api.save_current_project(false)
      state.addMode = false
      enableOverlayPointer(false)
      toast(`追加しました：${tag}`)
      pulse()
      render()
    }
  }
}

function isKeyEmpty(k) {
  const v = (state.values[k] || "").replaceAll("<br>", "").trim()
  return !v
}
function isCurrentEmpty() {
  if (!state.tags.length) return true
  return isKeyEmpty(state.tags[state.idx])
}

async function pushValue() {
  if (!state.tags.length) return
  const key = state.tags[state.idx]
  const raw = ($("#val")?.value || "").replaceAll("\r\n", "\n")
  const value = raw.replaceAll("\n", "<br>")
  state.values[key] = value
  // 流用チェックの「未編集＝赤字」は、実際に入力欄を編集したときだけ解除する（次へだけでは黒にしない）
  await window.pywebview.api.set_value(key, value)
  queuePreview(key)
}

let previewReq = 0
let pageReq = 0
async function queuePreview(key) {
  if (!state.projectPath) {
    const img = $("#previewImg")
    if (img) {
      img.src = ""
      img.style.visibility = "hidden"
    }
    return
  }

  // ページ固定中は、選択タグに関係なく現在ページを維持
  if (state.pageLocked && window.pywebview?.api?.get_preview_png_base64_page) {
    await showPage(state.previewPageIndex || 0)
    return
  }

  // タグが無い（=新規直後など）でも、まずは1ページ目を表示できるようにする
  if (!state.tags.length) {
    if (window.pywebview?.api?.get_preview_png_base64_page) {
      await showPage(0)
      return
    }
    return
  }

  const k = key || state.tags[state.idx]
  const my = ++previewReq
  let r = await window.pywebview.api.get_preview_png_base64(k)
  if (r && !r.ok && r.error === "no_project" && state.projectPath && window.pywebview?.api?.load_project) {
    try {
      await window.pywebview.api.load_project(state.projectPath)
      r = await window.pywebview.api.get_preview_png_base64(k)
    } catch {}
  }
  if (my !== previewReq) return
  if (r.ok) {
    const img = $("#previewImg")
    if (img) {
      img.onload = () => (img.style.visibility = "visible")
      img.onerror = () => {
        img.style.visibility = "hidden"
      }
      img.style.visibility = "hidden"
      img.src = r.png_data || r.png
    }
    if (img && img.naturalWidth && img.naturalHeight) {
      state.pageW = img.naturalWidth
      state.pageH = img.naturalHeight
    } else {
      state.pageW = r.page_display_width || state.pageW
      state.pageH = r.page_display_height || state.pageH
    }
    state.previewPageIndex = Number.isFinite(r.page_index) ? r.page_index : state.previewPageIndex
    const p = $("#pageIndicator")
    if (p) p.textContent = `${(state.previewPageIndex || 0) + 1} / ${state.pageCount || 1}`
    drawOverlay()
  } else {
    const img = $("#previewImg")
    if (img) {
      img.src = ""
      img.style.visibility = "hidden"
    }
    toast(`プレビュー取得に失敗: ${r?.error || "unknown"}`)
  }
}

async function loadWorkers() {
  const r = await window.pywebview.api.get_workers()
  if (!r.ok) return
  state.workers = r.workers || []
  const last = loadLocal("inputstudio-last-worker", null)
  if (last && state.workers.some((w) => w.id === last)) state.workerId = last
  else state.workerId = r.last_worker_id || (state.workers[0] ? state.workers[0].id : null)
}

async function autoStartWorkIfPossible() {
  // 要望: PDF/案件を読み込んだら自動で作業開始（押し忘れ防止）
  if (!state.projectPath) return false
  if (state.working) return true
  if (!state.workerId) {
    toast("作業者を選ぶと自動で作業タイマー開始します")
    return false
  }
  try {
    const api = window.pywebview?.api
    if (!api?.start_work) return false
    const r = await api.start_work(state.workerId)
    if (!r?.ok) return false
    state.working = true
    state.inPrivate = false
    state.timerStart = Date.now()
    state.privateTotal = 0
    state.sessionStart = new Date().toISOString()
    state.lastSession = { path: state.projectPath, workerId: state.workerId, projectName: state.projectName }
    saveLocal("inputstudio-last-session", state.lastSession)
    return true
  } catch {
    return false
  }
}

let _timerTicker = null
function ensureTimerTicker() {
  if (_timerTicker) return
  _timerTicker = setInterval(() => {
    if (state.appStage !== "main") return
    const el = document.querySelector(".status__time")
    if (!el) return
    el.textContent = fmtTime(calcNetSeconds())
  }, 1000)
}

function tickTimerOnce() {
  const el = $(".status__time")
  if (el) el.textContent = fmtTime(calcNetSeconds())
  ensureTimerTicker()
}

function openFinishModal(result) {
  const modal = $("#modal")
  if (!modal) return
  const dir = String(result?.dir || "")
  const zip = String(result?.zip || "")
  const pdf = String(result?.filled_pdf || "")
  const bundleDir = String(result?.bundle_dir || "")
  const reportPdf = String(result?.report_pdf || "")

  const close = () => {
    modal.style.display = "none"
    modal.innerHTML = ""
  }

  if (isWeb()) {
    modal.style.display = "block"
    modal.innerHTML = `
      <div class="modal__backdrop" id="modalClose"></div>
      <div class="modal__card" style="max-width:480px">
        <div class="modal__title">提出データを作成しました</div>
        <div class="label" style="margin-top:6px; line-height:1.7">
          完成PDFをダウンロードしました。メールに添付して送信してください。お疲れ様でした！
        </div>
        <div class="row" style="margin-top:14px; justify-content:flex-end; gap:10px">
          <button class="btn btn--primary" id="btnFinishDownload">PDFを再ダウンロード</button>
          <button class="btn btn--soft" id="btnFinishClose">閉じる</button>
        </div>
      </div>
    `
    $("#modalClose").onclick = close
    $("#btnFinishClose").onclick = close
    $("#btnFinishDownload").onclick = async () => {
      if (window.pywebview?.api?.download_filled_pdf) {
        await window.pywebview.api.download_filled_pdf()
        toast("ダウンロードを開始しました")
      }
    }
    return
  }

  modal.style.display = "block"
  modal.innerHTML = `
    <div class="modal__backdrop" id="modalClose"></div>
    <div class="modal__card" style="max-width:680px">
      <div class="modal__title">提出データを作成しました</div>
      <div class="label" style="margin-top:6px; line-height:1.7">
        今回の作業成果物を生成しました。次のボタンを押し、出てきたデータをメールに添付して送信してください。お疲れ様でした！
      </div>
      <div class="field" style="margin-top:12px">
        <div class="label">フォルダ</div>
        <div class="pathLine" title="${escapeHtml(dir)}"><span class="pathValue">${escapeHtml(dir)}</span></div>
      </div>
      <div class="field" style="margin-top:10px">
        <div class="label">ZIP（添付）</div>
        <div class="pathLine" title="${escapeHtml(zip)}"><span class="pathValue">${escapeHtml(zip)}</span></div>
      </div>
      <div class="field" style="margin-top:10px">
        <div class="label">送付用フォルダ（PDF + project.json + template.pdf）</div>
        <div class="pathLine" title="${escapeHtml(bundleDir || dir)}"><span class="pathValue">${escapeHtml(bundleDir || dir)}</span></div>
      </div>
      <div class="field" style="margin-top:10px">
        <div class="label">PDF（確認用）</div>
        <div class="pathLine" title="${escapeHtml(pdf)}"><span class="pathValue">${escapeHtml(pdf)}</span></div>
      </div>
      <div class="field" style="margin-top:10px">
        <div class="label">報告書PDF</div>
        <div class="pathLine" title="${escapeHtml(reportPdf || "")}"><span class="pathValue">${escapeHtml(reportPdf || "（未生成）")}</span></div>
      </div>
      <div class="row" style="margin-top:14px; justify-content:flex-end">
        <button class="btn btn--primary" id="btnOpenAttachment">フォルダを開く</button>
        <button class="btn btn--soft" id="btnFinishClose">閉じる</button>
      </div>
    </div>
  `
  const closeEl = $("#modalClose")
  if (closeEl) closeEl.onclick = close
  const closeBtn = $("#btnFinishClose")
  if (closeBtn) closeBtn.onclick = close
  const openBtn = $("#btnOpenAttachment")
  if (openBtn)
    openBtn.onclick = async () => {
      const api = window.pywebview?.api
      const target = bundleDir || dir || zip || pdf
      if (!target) return
      if (api?.reveal_in_explorer) {
        const r = await api.reveal_in_explorer(target)
        if (!r?.ok) toast(`開けませんでした: ${r?.error || "unknown"}`)
        return
      }
      try {
        await navigator.clipboard.writeText(String(target))
        toast("パスをコピーしました")
      } catch {
        toast(String(target))
    }
  }
}

async function openBulkPasteModal() {
  const modal = $("#modal")
  if (!modal) return
  if (!state.projectPath) return toast(tr("bulkPaste.needProject", "先に案件を開いてください"))
  if (!(listProjectTagsOrdered().length)) return toast(tr("bulkPaste.needTags", "タグがありません（管理者が欄を配置してください）"))

  const close = () => {
    modal.style.display = "none"
    modal.innerHTML = ""
  }
  modal.style.display = "block"
  modal.innerHTML = `
    <div class="modal__backdrop" id="bpCloseBackdrop"></div>
    <div class="modal__card" style="width:min(720px, calc(100vw - 32px)); max-width:720px">
      <div class="modal__title">${escapeHtml(tr("bulkPaste.title", "値の一括入力（Excel などから）"))}</div>
      <div class="label" style="margin-top:8px; line-height:1.65">
        ${escapeHtml(tr("bulkPaste.intro", "1列目＝項目名（このプロジェクトのタグ名と一致）、2列目＝値。Excel で範囲コピー→ここに貼り付け→反映。"))}
      </div>
      <div class="field" style="margin-top:10px">
        <div class="label">${escapeHtml(tr("bulkPaste.formatLabel", "区切り形式"))}</div>
        <div class="row" style="flex-wrap:wrap; gap:10px">
          <label><input type="radio" name="bpMode" value="tab" checked /> ${escapeHtml(tr("bulkPaste.formatTab", "タブ（Excel 推奨）"))}</label>
          <label><input type="radio" name="bpMode" value="comma" /> ${escapeHtml(tr("bulkPaste.formatComma", "カンマ（先頭のみ区切り）"))}</label>
          <label><input type="radio" name="bpMode" value="colon" /> ${escapeHtml(tr("bulkPaste.formatColon", "項目：値 の行"))}</label>
          <label><input type="radio" name="bpMode" value="equals" /> ${escapeHtml(tr("bulkPaste.formatEquals", "項目=値 の行"))}</label>
        </div>
      </div>
      <div class="row" style="margin-top:8px; flex-wrap:wrap; gap:14px">
        <label style="cursor:pointer"><input type="checkbox" id="bpSkipFirst" /> ${escapeHtml(tr("bulkPaste.skipFirst", "先頭行を見出しとしてスキップ"))}</label>
        <label style="cursor:pointer"><input type="checkbox" id="bpSkipEmpty" /> ${escapeHtml(tr("bulkPaste.skipEmptyValues", "空の値は上書きしない"))}</label>
      </div>
      <div class="field" style="margin-top:12px">
        <div class="label">${escapeHtml(tr("bulkPaste.textareaLabel", "貼り付けデータ"))}</div>
        <textarea class="input textarea" id="bpTextarea" spellcheck="false" style="width:100%; min-height:200px; font-family:ui-monospace,Consolas,monospace; font-size:13px"></textarea>
      </div>
      <div class="label" style="margin-top:6px; line-height:1.5">${escapeHtml(tr("bulkPaste.hintAi", "別AIへの指示例：『左列を項目名タグ、そのまま右列を入力値にし、タブ区切りで出力してください』"))}</div>
      <div class="row" style="margin-top:14px; flex-wrap:wrap; gap:8px">
        <button type="button" class="btn btn--soft" id="bpCopyEmpty">${escapeHtml(tr("bulkPaste.copyTemplate", "項目一覧をコピー（値は空）"))}</button>
        <button type="button" class="btn btn--soft" id="bpCopyFilled">${escapeHtml(tr("bulkPaste.copyFilled", "現在の値をコピー"))}</button>
        <span style="flex:1"></span>
        <button type="button" class="btn btn--primary" id="bpApply">${escapeHtml(tr("bulkPaste.apply", "反映する"))}</button>
        <button type="button" class="btn btn--soft" id="bpClose">${escapeHtml(tr("bulkPaste.cancel", "閉じる"))}</button>
      </div>
    </div>
  `
  $("#bpCloseBackdrop").onclick = close
  $("#bpClose").onclick = close
  $("#bpCopyEmpty").onclick = () => copyBulkTemplateTsv(false)
  $("#bpCopyFilled").onclick = () => copyBulkTemplateTsv(true)
  queueMicrotask(() => $("#bpTextarea")?.focus())

  const readMode = () => {
    const r = modal.querySelector('input[name="bpMode"]:checked')
    const v = r ? String(r.value || "tab") : "tab"
    if (v === "comma" || v === "colon" || v === "equals" || v === "tab") return v
    return "tab"
  }

  $("#bpApply").onclick = async () => {
    const ta = $("#bpTextarea")
    const raw = String(ta?.value || "")
    if (!raw.trim()) return toast(tr("bulkPaste.emptyPaste", "貼り付けデータがありません"))
    state.undoStack.push(snapshotProject())
    state.redoStack.length = 0
    const map = parseBulkPasteText(raw, readMode(), { skipFirst: !!$("#bpSkipFirst")?.checked })
    const onlyKnown = true
    const skipEmptyValues = !!$("#bpSkipEmpty")?.checked

    const api = window.pywebview?.api
    /** @type {any} */
    let r
    if (api?.bulk_apply_values) {
      r = await api.bulk_apply_values({ values: map, only_known_tags: onlyKnown, skip_empty_values: skipEmptyValues })
      if (!r?.ok) {
        state.undoStack.pop()
        toast(`${tr("bulkPaste.failed", "反映に失敗しました")}: ${apiErrorMessage(r, "unknown")}`)
        return
      }
      state.values = deepClone(r.values || state.values || {})
    } else {
      const known = collectKnownTagsForBulk()
      const merged = deepClone(state.values || {})
      const skipped = []
      let n = 0
      for (const [kk, vv] of Object.entries(map)) {
        const k = normalizeBulkPasteKey(kk)
        if (!k) continue
        if (skipEmptyValues && !String(vv).trim()) continue
        if (!known.has(k)) {
          if (!skipped.includes(k)) skipped.push(k)
          continue
        }
        merged[k] = String(vv ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
        n++
      }
      await window.pywebview?.api?.set_project_payload?.({ tags: state.tags, values: merged, placements: state.placements })
      r = { ok: true, applied_count: n, skipped_unknown_tags: skipped, values: merged }
      state.values = merged
      try {
        await window.pywebview?.api?.save_current_project?.(false)
      } catch {
        /* non-fatal in web mocks */
      }
    }

    const un = Array.isArray(r.skipped_unknown_tags) ? r.skipped_unknown_tags : []
    const ac = Number(r.applied_count ?? 0)
    let msg =
      `${tr("bulkPaste.toastApplied", "一括反映しました")}（${tr("bulkPaste.resultAppliedShort", "件数")}: ${ac}）`
    if (un.length) msg += ` / ${tr("bulkPaste.unknownSkippedShort", "未一致スキップ")}: ${un.length}`
    toast(msg)
    render()
    await queuePreview()
    close()
  }
}

function normalizePageDeleteSelection(pageIndices, totalPages) {
  const total = Math.max(1, Number(totalPages || 1))
  const unique = [...new Set(pageIndices.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x >= 0 && x < total))]
  unique.sort((a, b) => a - b)
  return unique
}

function pageIndexAfterMultiDelete(originalCurr, deletedAsc, newTotal) {
  const delSet = new Set(deletedAsc)
  const curr = Math.max(0, Number(originalCurr || 0))
  const total = Math.max(1, Number(newTotal || 1))
  if (!delSet.has(curr)) {
    const shift = deletedAsc.filter((i) => i < curr).length
    return Math.max(0, Math.min(total - 1, curr - shift))
  }
  const newIdx = curr - deletedAsc.filter((i) => i < curr).length
  return Math.max(0, Math.min(total - 1, newIdx))
}

function snapshotBinderState() {
  return {
    sections: deepClone(state.sections || []),
    cases: deepClone(state.cases || []),
    notes: deepClone(state.notes || []),
    binderTrash: deepClone(state.binderTrash || []),
  }
}

function restoreBinderState(snapshot) {
  if (!snapshot) return
  state.sections = deepClone(snapshot.sections || [])
  state.cases = deepClone(snapshot.cases || [])
  state.notes = deepClone(snapshot.notes || [])
  if (Array.isArray(snapshot.binderTrash)) state.binderTrash = deepClone(snapshot.binderTrash)
}

async function deletePagesFromProject(api, pageIndices) {
  const total = Math.max(1, Number(state.pageCount || 1))
  const selected = normalizePageDeleteSelection(pageIndices, total)
  if (!selected.length) return { ok: false, error: "no_pages_selected" }
  if (selected.length > MAX_DELETE_PAGES_PER_OP) return { ok: false, error: "too_many_pages", max: MAX_DELETE_PAGES_PER_OP }
  if (selected.length >= total) return { ok: false, error: "cannot_delete_all_pages" }
  if (!api?.delete_page_from_project) return { ok: false, error: "missing_api" }

  const binderSnapshot = snapshotBinderState()
  const logicalDeleted = selected.map((p) => physicalToLogicalPage(p))
  const toDelete = [...selected].sort((a, b) => b - a)
  let lastResult = null
  for (const idx of toDelete) {
    const r = await api.delete_page_from_project(idx)
    if (!r?.ok) return r || { ok: false, error: "delete_failed" }
    lastResult = r
    state.pageCount = Number(r.page_count || state.pageCount) || state.pageCount
    state.tags = Array.isArray(r.tags) ? r.tags : state.tags
    state.values = r.values && typeof r.values === "object" ? r.values : state.values
    state.placements = r.placements && typeof r.placements === "object" ? r.placements : state.placements
    restoreBinderState(binderSnapshot)
  }

  registerDeletedLogicalPages(logicalDeleted)
  restoreBinderState(binderSnapshot)
  await persistBinder()
  try {
    await api.save_current_project?.(false)
  } catch {}
  // 保存処理でバインダーが上書きされる場合に備え、元ページ番号を再適用
  restoreBinderState(binderSnapshot)
  registerDeletedLogicalPages(logicalDeleted)
  await persistBinder()

  return {
    ok: true,
    deleted_count: selected.length,
    deleted_pages: selected,
    page_count: state.pageCount,
    tags: state.tags,
    values: state.values,
    placements: state.placements,
    page_index: lastResult?.page_index,
  }
}

async function openDeletePagesModal() {
  const modal = $("#modal")
  if (!modal) return
  const api = window.pywebview?.api
  if (!api?.delete_page_from_project) return toast("ページ削除機能が見つかりません（最新版に更新してください）")

  const close = () => {
    modal.style.display = "none"
    modal.innerHTML = ""
  }
  const curr = Number(state.previewPageIndex || 0) || 0
  const totalPages = Math.max(1, Number(state.pageCount || 1) || 1)
  const selected = new Set([curr])

  const renderModalShell = () => {
    modal.style.display = "block"
    modal.innerHTML = `
      <div class="modal__backdrop" id="modalClose"></div>
      <div class="modal__card" style="width:min(1200px, calc(100vw - 40px)); max-width:1200px">
        <div class="modal__title">${escapeHtml(tr("main.deletePagesTitle", "削除するページを選択"))}</div>
        <div class="label" style="line-height:1.7">${escapeHtml(tr("main.deletePagesHint", "クリックで選択（1回あたり最大10ページ）"))}</div>
        <div class="label" id="dpSelectedCount" style="margin-top:8px;font-weight:700"></div>
        <div class="pageOpsBoard" id="dpDeleteBoard"></div>
        <div class="row" style="margin-top:14px; justify-content:space-between; gap:10px; flex-wrap:wrap">
          <div class="row" style="gap:8px">
            <button class="btn btn--soft" id="dpSelectCurrent">${escapeHtml(tr("main.deletePagesSelectCurrent", "現在ページ"))}</button>
            <button class="btn btn--soft" id="dpClearSelection">${escapeHtml(tr("main.deletePagesClear", "選択解除"))}</button>
          </div>
          <div class="row" style="gap:8px">
            <button class="btn btn--primary" id="dpApplyDelete" disabled>${escapeHtml(tr("main.deletePagesApply", "選択ページを削除"))}</button>
            <button class="btn btn--soft" id="dpClose">${escapeHtml(tr("bulkPaste.cancel", "閉じる"))}</button>
          </div>
        </div>
      </div>
    `
    $("#modalClose").onclick = close
    $("#dpClose").onclick = close
  }

  const updateSelectedLabel = () => {
    const el = $("#dpSelectedCount")
    if (!el) return
    el.textContent = tr("main.deletePagesSelected", `選択: ${selected.size} / ${MAX_DELETE_PAGES_PER_OP}`, {
      count: selected.size,
      max: MAX_DELETE_PAGES_PER_OP,
    })
  }

  const updateApplyButton = () => {
    const btn = $("#dpApplyDelete")
    if (!btn) return
    const count = selected.size
    btn.disabled = count <= 0 || count >= totalPages || count > MAX_DELETE_PAGES_PER_OP
  }

  renderModalShell()
  updateSelectedLabel()
  updateApplyButton()

  const board = $("#dpDeleteBoard")
  const togglePage = (pageIdx) => {
    if (selected.has(pageIdx)) {
      selected.delete(pageIdx)
    } else {
      if (selected.size >= MAX_DELETE_PAGES_PER_OP) {
        toast(tr("error.deletePagesTooMany", `1回に削除できるのは最大 ${MAX_DELETE_PAGES_PER_OP} ページです`, { max: MAX_DELETE_PAGES_PER_OP }))
        return
      }
      selected.add(pageIdx)
    }
    updateSelectedLabel()
    updateApplyButton()
    board?.querySelectorAll(".pageCard").forEach((el) => {
      const idx = Number(el.getAttribute("data-page") || "-1")
      el.classList.toggle("is-selected", selected.has(idx))
    })
  }

  const renderBoard = async () => {
    if (!board) return
    board.innerHTML = `<div style="padding:20px;color:#64748b">${escapeHtml(tr("gate.toastLoadingPdf", "読み込み中…"))}</div>`
    const pageModels = await Promise.all(
      Array.from({ length: totalPages }, (_, pageIdx) =>
        api.get_preview_png_base64_page(pageIdx).then((pr) => ({
          pageIdx,
          src: pr?.ok ? String(pr.png || "") : "",
          srcData: pr?.ok ? String(pr.png_data || "") : "",
        }))
      )
    )
    board.innerHTML = pageModels
      .map(({ pageIdx, src, srcData }) => {
        const initialSrc = src || srcData || ""
        const hasImage = !!initialSrc
        const currentCls = pageIdx === curr ? " is-current" : ""
        const selectedCls = selected.has(pageIdx) ? " is-selected" : ""
        return `
          <div class="pageCard pageCard--selectable${currentCls}${selectedCls}" data-page="${pageIdx}">
            <div class="pageCard__check" aria-hidden="true">${selected.has(pageIdx) ? "✓" : ""}</div>
            <div class="pageCard__thumb">${hasImage ? `<img class="pageCardImg" draggable="false" data-page="${pageIdx}" src="${escapeHtml(initialSrc)}" alt="page ${pageIdx + 1}" />` : '<div class="pageCard__noimg">No Image</div>'}</div>
            <div class="pageCard__meta">
              <span class="badge">${escapeHtml(tr("main.deletePagesPageLabel", "ページ {n}", { n: pageIdx + 1 }))}</span>
              ${pageIdx === curr ? `<span class="badge badge--soft">${escapeHtml(tr("main.deletePagesCurrentBadge", "表示中"))}</span>` : ""}
            </div>
          </div>
        `
      })
      .join("")

    const modelByPage = new Map(pageModels.map((m) => [m.pageIdx, m]))
    board.querySelectorAll(".pageCardImg").forEach((img) => {
      img.addEventListener("error", () => {
        const pageIdx = Number(img.getAttribute("data-page") || "-1")
        const model = modelByPage.get(pageIdx)
        if (!model) return
        const current = String(img.getAttribute("src") || "")
        if (model.srcData && current !== model.srcData) {
          img.setAttribute("src", model.srcData)
        }
      })
    })

    board.querySelectorAll(".pageCard--selectable").forEach((el) => {
      el.addEventListener("click", () => {
        togglePage(Number(el.getAttribute("data-page") || "-1"))
      })
    })
  }

  await renderBoard()

  $("#dpSelectCurrent")?.addEventListener("click", () => {
    if (selected.size >= MAX_DELETE_PAGES_PER_OP && !selected.has(curr)) {
      toast(tr("error.deletePagesTooMany", `1回に削除できるのは最大 ${MAX_DELETE_PAGES_PER_OP} ページです`, { max: MAX_DELETE_PAGES_PER_OP }))
      return
    }
    selected.add(curr)
    updateSelectedLabel()
    updateApplyButton()
    board?.querySelectorAll(".pageCard").forEach((el) => {
      const idx = Number(el.getAttribute("data-page") || "-1")
      el.classList.toggle("is-selected", selected.has(idx))
      const check = el.querySelector(".pageCard__check")
      if (check) check.textContent = selected.has(idx) ? "✓" : ""
    })
  })

  $("#dpClearSelection")?.addEventListener("click", () => {
    selected.clear()
    updateSelectedLabel()
    updateApplyButton()
    board?.querySelectorAll(".pageCard").forEach((el) => {
      el.classList.remove("is-selected")
      const check = el.querySelector(".pageCard__check")
      if (check) check.textContent = ""
    })
  })

  $("#dpApplyDelete")?.addEventListener("click", async () => {
    const chosen = normalizePageDeleteSelection([...selected], totalPages)
    if (!chosen.length) return toast(tr("main.deletePagesNeedSelection", "削除するページを選択してください"))
    if (chosen.length >= totalPages) {
      return toast(tr("error.cannotDeleteAllPages", "すべてのページは削除できません（最低1ページ必要）"))
    }
    if (chosen.length > MAX_DELETE_PAGES_PER_OP) {
      return toast(tr("error.deletePagesTooMany", `1回に削除できるのは最大 ${MAX_DELETE_PAGES_PER_OP} ページです`, { max: MAX_DELETE_PAGES_PER_OP }))
    }
    const ok = await uiConfirm(
      tr(
        "dialog.confirmDeletePages",
        `選択した ${chosen.length} ページを削除します。配置済み要素も対象ページ分は削除されます。よろしいですか？`,
        { count: chosen.length }
      )
    )
    if (!ok) return

    const originalCurr = curr
    const r = await deletePagesFromProject(api, chosen)
    if (!r?.ok) {
      if (r?.error === "cannot_delete_all_pages") {
        return toast(tr("error.cannotDeleteAllPages", "すべてのページは削除できません（最低1ページ必要）"))
      }
      return toast(`ページ削除に失敗: ${apiErrorMessage(r, "unknown")}`)
    }

    const nextPage = pageIndexAfterMultiDelete(originalCurr, chosen, state.pageCount)
    close()
    render()
    await showPage(nextPage)
    const deletedCount = Number(r.deleted_count || chosen.length) || chosen.length
    toast(
      deletedCount === 1
        ? tr("main.toast.deleteDone", "ページを削除しました")
        : tr("main.toast.deleteDoneMany", `${deletedCount} ページを削除しました`, { count: deletedCount })
    )
  })
}

async function openPageOpsModal() {
  const modal = $("#modal")
  if (!modal) return
  const close = () => {
    modal.style.display = "none"
    modal.innerHTML = ""
  }
  modal.style.display = "block"
  modal.innerHTML = `
    <div class="modal__backdrop" id="modalClose"></div>
    <div class="modal__card" style="width:min(1200px, calc(100vw - 40px)); max-width:1200px">
      <div class="modal__title">PDF並べ替え</div>
      <div class="label" style="line-height:1.7">現在ページ: ${(Number(state.previewPageIndex || 0) || 0) + 1} / ${Math.max(1, Number(state.pageCount || 1))}</div>
      <div class="label" style="margin-top:10px">下のカードをドラッグ&ドロップして直感的に並び替えできます。</div>
      <div class="pageOpsBoard" id="pageOpsBoard"></div>
      <div class="row" style="margin-top:14px; justify-content:flex-end">
        <button class="btn btn--primary" id="poApplyOrder" disabled>並び替えを保存</button>
        <button class="btn btn--soft" id="poClose">閉じる</button>
      </div>
    </div>
  `
  $("#modalClose").onclick = close
  $("#poClose").onclick = close

  const api = window.pywebview?.api
  const curr = Number(state.previewPageIndex || 0) || 0
  const totalPages = Math.max(1, Number(state.pageCount || 1) || 1)
  let order = Array.from({ length: totalPages }, (_, i) => i)
  let dragPos = -1
  const poApplyOrder = $("#poApplyOrder")
  const board = $("#pageOpsBoard")

  const renderBoard = async () => {
    if (!board) return
    const pageModels = await Promise.all(
      order.map(async (oldPageIdx, pos) => {
        const pr = await api.get_preview_png_base64_page(oldPageIdx)
        const src = pr?.ok ? String(pr.png || "") : ""
        const srcData = pr?.ok ? String(pr.png_data || "") : ""
        return {
          pos,
          oldPageIdx,
          src,
          srcData,
        }
      })
    )
    const modelByPos = new Map(pageModels.map((m) => [m.pos, m]))
    const cards = pageModels
      .map(({ pos, oldPageIdx, src, srcData }) => {
        const initialSrc = src || srcData || ""
        const hasImage = !!initialSrc
        const currentCls = oldPageIdx === curr ? " is-current" : ""
        return `
          <div class="pageCard${currentCls}" draggable="true" data-pos="${pos}" data-old="${oldPageIdx}">
            <div class="pageCard__thumb">${hasImage ? `<img class="pageCardImg" draggable="false" data-pos="${pos}" src="${escapeHtml(initialSrc)}" alt="page ${oldPageIdx + 1}" />` : "<div class=\"pageCard__noimg\">No Image</div>"}</div>
            <div class="pageCard__meta">
              <span class="badge">表示順 ${pos + 1}</span>
              <span class="badge badge--soft">元ページ ${oldPageIdx + 1}</span>
            </div>
          </div>
        `
      })
      .join("")
    board.innerHTML = cards

    board.querySelectorAll(".pageCardImg").forEach((img) => {
      img.addEventListener("error", () => {
        const pos = Number(img.getAttribute("data-pos") || "-1")
        const model = modelByPos.get(pos)
        if (!model) return
        const current = String(img.getAttribute("src") || "")
        if (model.srcData && current !== model.srcData) {
          img.setAttribute("src", model.srcData)
          return
        }
      })
    })

    board.querySelectorAll(".pageCard").forEach((el) => {
      el.addEventListener("dragstart", (ev) => {
        dragPos = Number(el.getAttribute("data-pos") || "-1")
        ev.dataTransfer?.setData("text/plain", String(dragPos))
        ev.dataTransfer.effectAllowed = "move"
      })
      el.addEventListener("dragover", (ev) => {
        ev.preventDefault()
        el.classList.add("is-over")
      })
      el.addEventListener("dragleave", () => {
        el.classList.remove("is-over")
      })
      el.addEventListener("drop", (ev) => {
        ev.preventDefault()
        el.classList.remove("is-over")
        const toPos = Number(el.getAttribute("data-pos") || "-1")
        const fromPos = Number(ev.dataTransfer?.getData("text/plain") || dragPos)
        if (fromPos < 0 || toPos < 0 || fromPos === toPos) return
        const next = [...order]
        const [moved] = next.splice(fromPos, 1)
        next.splice(toPos, 0, moved)
        order = next
        if (poApplyOrder) poApplyOrder.disabled = false
        renderBoard()
      })
    })
  }

  await renderBoard()

  if (poApplyOrder) {
    poApplyOrder.onclick = async () => {
      if (!api?.reorder_pages) return toast("ページ並び替え機能が見つかりません（最新版に更新してください）")
      const newCurrent = Math.max(0, order.indexOf(curr))
      toast("ページ順を保存中…")
      const r = await api.reorder_pages(order)
      if (!r?.ok) return toast(`ページ並び替えに失敗: ${apiErrorMessage(r, "unknown")}`)
      state.pageCount = Number(r.page_count || state.pageCount) || state.pageCount
      state.placements = r.placements && typeof r.placements === "object" ? r.placements : state.placements
      close()
      render()
      await showPage(newCurrent)
      toast("ページ順を更新しました")
    }
  }
}

function pulse() {
  document.body.classList.remove("pulse")
  void document.body.offsetWidth
  document.body.classList.add("pulse")
  setTimeout(() => document.body.classList.remove("pulse"), 420)
}

function swipe(dir) {
  document.body.dataset.swipe = dir
  setTimeout(() => (document.body.dataset.swipe = ""), 260)
}

function openWorkerModal(opts = {}) {
  const modal = $("#modal")
  const NEW = "__new__"
  const mode = String(opts.mode || "manage") // "manage" | "create"
  let editingId = mode === "create" ? NEW : state.workerId || (state.workers[0] ? state.workers[0].id : NEW)

  const close = () => {
    modal.style.display = "none"
    modal.innerHTML = ""
  }

  const renderModal = () => {
    const isNew = editingId === NEW
    const current = isNew ? {} : state.workers.find((w) => w.id === editingId) || {}
    modal.style.display = "block"
    modal.innerHTML = `
      <div class="modal__backdrop" id="modalClose"></div>
      <div class="modal__card">
        <div class="modal__title">作業者の登録</div>
        <div class="label">作業者を追加・編集できます（開始/終了の記録にも使います）。</div>

        ${
          mode === "manage"
            ? `<div class="row" style="margin-top:10px">
                <div class="field" style="flex:1">
                  <div class="label">一覧</div>
                  <select id="mPick">
                    <option value="${NEW}" ${isNew ? "selected" : ""}>（新規）</option>
                    ${state.workers.map((w) => `<option value="${escapeHtml(w.id)}" ${w.id === editingId ? "selected" : ""}>${escapeHtml(w.name)}</option>`).join("")}
                  </select>
                </div>
                <button class="btn btn--soft" id="mNew">新規</button>
              </div>`
            : `<div class="row" style="margin-top:10px">
                <div class="badge">新規登録</div>
                <span class="label">（既存一覧は表示しません）</span>
              </div>`
        }

        <div class="field" style="margin-top:10px">
          <div class="label">名前</div>
          <input class="input" id="mName" value="${escapeHtml(current.name || "")}" placeholder="例）作業者A">
        </div>
        <div class="field">
          <div class="label">振込先</div>
          <input class="input" id="mBank" value="${escapeHtml(current.bank || "")}" placeholder="○○銀行　普通　1234567　カナザワ　タロウ">
        </div>

        <div class="row spread" style="margin-top:14px">
          <button class="btn btn--soft" id="modalCancel">閉じる</button>
          <div class="row">
            ${mode === "manage" && !isNew && editingId ? `<button class="btn btn--danger" id="mDelete">削除</button>` : ""}
            <button class="btn btn--primary" id="modalSave">保存</button>
          </div>
        </div>
      </div>
    `

    $("#modalClose").onclick = close
    $("#modalCancel").onclick = close
    const pick = $("#mPick")
    if (mode === "manage" && pick) pick.onchange = (e) => {
      editingId = e.target.value
      renderModal()
    }
    const btnNew = $("#mNew")
    if (mode === "manage" && btnNew) btnNew.onclick = () => {
      editingId = NEW
      renderModal()
      $("#mName")?.focus?.()
    }
    const btnDel = $("#mDelete")
    if (mode === "manage" && btnDel) btnDel.onclick = async () => {
      const ok = await uiConfirm(tr("dialog.deleteWorker", "この作業者を削除しますか？"))
      if (!ok) return
      const r = await window.pywebview.api.delete_worker?.(String(editingId))
      if (!r?.ok) return toast(`削除に失敗: ${r?.error || "unknown"}`)
      await loadWorkers()
      editingId = state.workerId || (state.workers[0] ? state.workers[0].id : NEW)
      pulse()
      toast("削除しました")
      renderModal()
      render()
    }

    $("#modalSave").onclick = async () => {
      const w = {
        id: editingId === NEW ? null : editingId,
        name: $("#mName").value.trim(),
        bank: $("#mBank").value.trim(),
      }
      if (!w.name) return toast("名前を入れてください")
      const r = await window.pywebview.api.upsert_worker(w)
      if (!r.ok) return toast("保存できませんでした")
      await loadWorkers()
      state.workerId = r.id
      saveLocal("inputstudio-last-worker", state.workerId)
      editingId = state.workerId || NEW
      pulse()
      toast("保存しました")
      close()
      render()
    }
  }

  renderModal()
}

// confetti（軽量）
function burstConfetti() {
  const c = $("#confetti")
  if (!c) return
  const ctx = c.getContext("2d")
  const rect = c.getBoundingClientRect()
  c.width = Math.max(1, Math.floor(rect.width * devicePixelRatio))
  c.height = Math.max(1, Math.floor(rect.height * devicePixelRatio))
  ctx.scale(devicePixelRatio, devicePixelRatio)

  const parts = []
  const colors = ["#ff6aa2", "#7c5cff", "#5ad7ff", "#ffd36a", "#7cffb2"]
  for (let i = 0; i < 90; i++) {
    parts.push({
      x: rect.width * 0.5,
      y: rect.height * 0.2,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * -5 - 2,
      g: 0.18 + Math.random() * 0.08,
      s: 2 + Math.random() * 3,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.2,
      c: colors[i % colors.length],
      a: 1,
    })
  }
  const t0 = performance.now()
  function step(t) {
    const dt = (t - t0) / 1000
    ctx.clearRect(0, 0, rect.width, rect.height)
    for (const p of parts) {
      p.vy += p.g
      p.x += p.vx
      p.y += p.vy
      p.r += p.vr
      p.a = Math.max(0, 1 - dt / 1.2)
      ctx.save()
      ctx.globalAlpha = p.a
      ctx.translate(p.x, p.y)
      ctx.rotate(p.r)
      ctx.fillStyle = p.c
      ctx.fillRect(-p.s, -p.s, p.s * 2, p.s * 2)
      ctx.restore()
    }
    if (dt < 1.2) requestAnimationFrame(step)
    else ctx.clearRect(0, 0, rect.width, rect.height)
  }
  requestAnimationFrame(step)
}

// ---- design mode ----
async function openDesignModal() {
  const modal = $("#modal")
  modal.style.display = "block"
  const allItems = Object.entries(state.placements || {})
    .map(([fid, pl]) => {
      const p = pl && typeof pl === "object" ? pl : {}
      const tag = String(p.tag || "").trim() || "(タグ未設定)"
      const page = Number(p.page || 0) + 1
      return { fid: String(fid), tag, page, label: `${tag}（p${page}）` }
    })
    .filter((x) => x.fid)
  if (!state.designKey || !state.placements?.[state.designKey]) {
    state.designKey = allItems[0]?.fid || null
  }
  modal.innerHTML = `
    <div class="modal__backdrop" id="modalClose"></div>
    <div class="modal__card">
      <div class="modal__title">設計（統括）モード</div>
      <div class="label" style="margin-bottom:8px">タグを選んで、プレビュー上をクリックで移動。矢印で微調整。</div>

      <div class="row" style="margin-top:6px">
        <div class="field" style="flex:1">
          <div class="label">検索</div>
          <input class="input" id="dSearch" placeholder="例）氏名 / 住所 / 金額 …" />
        </div>
        <div class="field" style="width:140px">
          <div class="label">移動幅</div>
          <select id="dStep">
            <option value="1">1px</option>
            <option value="2" selected>2px</option>
            <option value="5">5px</option>
            <option value="10">10px</option>
          </select>
        </div>
      </div>

      <div class="row" style="margin-top:10px">
        <div class="field" style="flex:1">
          <div class="label">対象要素</div>
          <select id="dKey">
            ${allItems.map((it) => `<option value="${escapeHtml(it.fid)}" ${it.fid === state.designKey ? "selected" : ""}>${escapeHtml(it.label)}</option>`).join("")}
          </select>
        </div>
        <button class="btn btn--soft" id="dPrev">前</button>
        <button class="btn btn--soft" id="dNext">次</button>
        <button class="btn btn--soft" id="dFocus">表示</button>
      </div>

      <div class="row" style="margin-top:10px">
        <button class="btn btn--soft" id="dUp">↑</button>
        <button class="btn btn--soft" id="dLeft">←</button>
        <button class="btn btn--soft" id="dRight">→</button>
        <button class="btn btn--soft" id="dDown">↓</button>
        <span class="badge" id="dPos">x:- y:- ${tipIcon(5, "ここで配置中のタグ座標を確認・微調整できます。")}</span>
      </div>

      <div class="row spread" style="margin-top:14px">
        <button class="btn btn--soft" id="dClose">閉じる</button>
        <div class="row">
          <button class="btn btn--tint" id="dToggleOverlay">プレビューで移動: ON</button>
          <button class="btn btn--primary" id="dSave">保存</button>
        </div>
      </div>
    </div>
  `

  const close = () => {
    state.designMode = false
    modal.style.display = "none"
    drawOverlay()
  }
  $("#modalClose").onclick = close
  $("#dClose").onclick = close

  $("#dKey").onchange = async (e) => {
    state.designKey = e.target.value
    await focusDesignKey()
  }
  $("#dPrev").onclick = async () => {
    const ids = allItems.map((x) => x.fid)
    const i = Math.max(0, ids.indexOf(state.designKey) - 1)
    state.designKey = ids[i] || state.designKey
    $("#dKey").value = state.designKey
    await focusDesignKey()
  }
  $("#dNext").onclick = async () => {
    const ids = allItems.map((x) => x.fid)
    const i = Math.min(ids.length - 1, ids.indexOf(state.designKey) + 1)
    state.designKey = ids[i] || state.designKey
    $("#dKey").value = state.designKey
    await focusDesignKey()
  }
  $("#dFocus").onclick = async () => {
    await focusDesignKey()
  }
  $("#dSave").onclick = async () => {
    const r = await window.pywebview.api.save_current_project(false)
    if (!r.ok) {
      await uiAlert(`保存に失敗: ${r.error || "unknown"}`)
      return
    }
    toast("保存しました")
    pulse()
  }

  let overlayEnabled = true
  $("#dToggleOverlay").onclick = () => {
    overlayEnabled = !overlayEnabled
    $("#dToggleOverlay").textContent = `プレビューで移動: ${overlayEnabled ? "ON" : "OFF"}`
    const ov = $("#overlay")
    if (ov) ov.style.pointerEvents = overlayEnabled && state.designMode ? "auto" : "none"
    drawOverlay()
  }

  const nudge = async (dx, dy) => {
    const info = await window.pywebview.api.get_element_info(state.designKey)
    if (!info.ok) return toast("対象要素が見つかりません")
    const x = (info.x || 0) + dx
    const y = (info.y || 0) + dy
    await window.pywebview.api.set_element_pos(state.designKey, x, y)
    await focusDesignKey(false)
  }
  const step = () => Number($("#dStep")?.value || "2") || 2
  $("#dUp").onclick = () => nudge(0, -step())
  $("#dDown").onclick = () => nudge(0, step())
  $("#dLeft").onclick = () => nudge(-step(), 0)
  $("#dRight").onclick = () => nudge(step(), 0)

  // 検索（option絞り込み）
  const filterOptions = () => {
    const q = ($("#dSearch")?.value || "").trim().toLowerCase()
    const sel = $("#dKey")
    if (!sel) return
    const filtered = allItems.filter((it) => (q ? it.label.toLowerCase().includes(q) : true))
    sel.innerHTML = filtered
      .map((it) => `<option value="${escapeHtml(it.fid)}" ${it.fid === state.designKey ? "selected" : ""}>${escapeHtml(it.label)}</option>`)
      .join("")
  }
  $("#dSearch").addEventListener("input", () => {
    filterOptions()
  })

  // overlay click -> move
  const ov = $("#overlay")
  if (ov) {
    enableOverlayPointer(overlayEnabled && state.designMode)

    // “ドラッグで置ける” を追加
    let dragging = false
    let lastSent = 0
    const toXY = (ev) => {
      const img = $("#previewImg")
      if (!img || !img.src) return null
      // Use actual rendered content rect (object-fit: contain) to avoid drift.
      const box = getRenderedContentRect(img, state.pageW, state.pageH)
      const x0 = ev.clientX - box.left
      const y0 = ev.clientY - box.top
      if (x0 < 0 || y0 < 0 || x0 > box.width || y0 > box.height) return null
      const x = (x0 / box.width) * state.pageW
      const y = (y0 / box.height) * state.pageH
      return { x, y }
    }

    ov.onpointerdown = async (ev) => {
      if (!state.designMode || !overlayEnabled) return
      const p = toXY(ev)
      if (!p) return
      dragging = true
      ov.setPointerCapture?.(ev.pointerId)
      await window.pywebview.api.set_element_pos(state.designKey, p.x, p.y)
      state.designPos = { x: p.x, y: p.y }
      drawOverlay()
      pulse()
    }
    ov.onpointermove = async (ev) => {
      if (!dragging) return
      const now = Date.now()
      if (now - lastSent < 35) return
      lastSent = now
      const p = toXY(ev)
      if (!p) return
      await window.pywebview.api.set_element_pos(state.designKey, p.x, p.y)
      state.designPos = { x: p.x, y: p.y }
      drawOverlay()
    }
    ov.onpointerup = async () => {
      if (!dragging) return
      dragging = false
      await focusDesignKey(false)
    }

    // click（細かい置き直し）
    ov.onclick = async (ev) => {
      if (!state.designMode || !overlayEnabled) return
      const p = toXY(ev)
      if (!p) return
      const { x, y } = p
      await window.pywebview.api.set_element_pos(state.designKey, x, y)
      state.designPos = { x, y }
      await focusDesignKey(false)
      pulse()
    }

    // double click -> open palette (タグ/値/サイズ指定して配置)
    ov.ondblclick = (ev) => {
      if (!state.designMode || !overlayEnabled) return
      const p = toXY(ev)
      if (!p) return
      ev.preventDefault()
      openPlacePalette(p)
    }
  }

  await focusDesignKey()
}

function sectionPages(s) {
  if (Array.isArray(s?.pages) && s.pages.length) return [...s.pages].map(Number).sort((a, b) => a - b)
  const a = Number(s?.page_start || 0)
  const b = Number(s?.page_end || 0)
  const out = []
  for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.push(i)
  return out
}

function sectionFirstPage(s) {
  const active = sectionActivePages(s)
  if (active.length) return active[0]
  const ps = sectionOriginalPages(s)
  return ps.length ? ps[0] : 0
}

function sectionRangeLabel(s) {
  const ps = sectionOriginalPages(s)
  if (!ps.length) return "（ページ未設定）"
  // 連続なら p.a-b、飛びなら列挙（元ページ番号を維持）
  let contiguous = true
  for (let i = 1; i < ps.length; i++) if (ps[i] !== ps[i - 1] + 1) { contiguous = false; break }
  if (contiguous) return ps.length === 1 ? `p.${ps[0] + 1}` : `p.${ps[0] + 1}-${ps[ps.length - 1] + 1}`
  return "p." + ps.map((p) => p + 1).join(",")
}

function removePagesFromSection(section, logicalPageIndices) {
  if (!section) return 0
  const removeSet = new Set((logicalPageIndices || []).map((x) => Number(x)))
  const remaining = sectionPages(section).filter((p) => !removeSet.has(p))
  section.pages = remaining
  delete section.page_start
  delete section.page_end
  return remaining.length
}

async function openSectionPageDeleteModal(caseObj, section) {
  if (!caseObj || !section) return
  const api = window.pywebview?.api
  if (!api?.get_preview_png_base64_page) {
    toast("プレビュー取得機能が見つかりません")
    return
  }
  const logicalPages = sectionActivePages(section)
  if (!logicalPages.length) {
    return toast(tr("binder.removePagesEmpty", "この書類に移動できるページがありません"))
  }

  const modal = $("#modal")
  if (!modal) return
  const shared = sectionSharedCount(section.id)
  const selected = new Set()
  let lastClicked = -1

  const close = () => {
    modal.style.display = "none"
    modal.innerHTML = ""
    renderBinderDetail()
  }

  modal.style.display = "block"
  modal.innerHTML = `
    <div class="modal__backdrop" id="spClose"></div>
    <div class="modal__card" style="width:min(1100px,calc(100vw - 40px));max-width:1100px;max-height:92vh;display:flex;flex-direction:column">
      <div class="modal__title">${escapeHtml(tr("binder.removePagesTitle", "ページをゴミ箱へ移動"))}</div>
      <div class="label" style="line-height:1.7">
        ${escapeHtml(section.label || "(無題)")} ・ ${escapeHtml(sectionRangeLabel(section))}
        ${shared > 1 ? `<span style="color:#7c5cff">（${shared}${escapeHtml(tr("binder.removePagesSharedHint", "件のバインダーで共有"))}）</span>` : ""}
      </div>
      <div class="label" style="margin-top:4px">${escapeHtml(tr("binder.removePagesHint", "ゴミ箱へ移動するページをクリックで選択（PDF本体は削除されません・1回最大10ページ・ゴミ箱から復元可）"))}</div>
      <div class="label" id="spSelectedCount" style="margin-top:8px;font-weight:700"></div>
      <div class="pageOpsBoard" id="spBoard" style="overflow:auto;flex:1"><div style="padding:20px;color:#64748b">${escapeHtml(tr("binder.removePagesLoading", "プレビューを読み込み中…"))}</div></div>
      <div class="row" style="margin-top:12px;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <div class="row" style="gap:8px">
          <button class="btn btn--soft" id="spSelectAll">${escapeHtml(tr("binder.trashSelectAll", "すべて選択"))}</button>
          <button class="btn btn--soft" id="spClearSel">${escapeHtml(tr("binder.trashClearSel", "選択解除"))}</button>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn btn--primary" id="spApply" disabled>${escapeHtml(tr("binder.removePagesApply", "選択ページをゴミ箱へ"))}</button>
          <button class="btn btn--soft" id="spCancel">${escapeHtml(tr("bulkPaste.cancel", "閉じる"))}</button>
        </div>
      </div>
    </div>`

  const updateSelectedLabel = () => {
    const el = $("#spSelectedCount")
    if (!el) return
    el.textContent = tr("main.deletePagesSelected", `選択: ${selected.size} / ${MAX_DELETE_PAGES_PER_OP}`, {
      count: selected.size,
      max: MAX_DELETE_PAGES_PER_OP,
    })
  }
  const updateApplyButton = () => {
    const btn = $("#spApply")
    if (btn) btn.disabled = selected.size <= 0 || selected.size > MAX_DELETE_PAGES_PER_OP
  }
  const applyVisual = () => {
    const board = $("#spBoard")
    if (!board) return
    board.querySelectorAll(".pageCard").forEach((el) => {
      const lp = Number(el.getAttribute("data-lp"))
      el.classList.toggle("is-selected", selected.has(lp))
    })
    updateSelectedLabel()
    updateApplyButton()
  }

  $("#spClose").onclick = close
  $("#spCancel").onclick = close
  $("#spSelectAll")?.addEventListener("click", () => {
    selected.clear()
    for (const lp of logicalPages) {
      if (selected.size >= MAX_DELETE_PAGES_PER_OP) break
      selected.add(lp)
    }
    if (logicalPages.length > MAX_DELETE_PAGES_PER_OP) {
      toast(tr("error.deletePagesTooMany", `1回に削除できるのは最大 ${MAX_DELETE_PAGES_PER_OP} ページです`, { max: MAX_DELETE_PAGES_PER_OP }))
    }
    applyVisual()
  })
  $("#spClearSel")?.addEventListener("click", () => {
    selected.clear()
    applyVisual()
  })

  const thumbs = await Promise.all(
    logicalPages.map(async (lp) => {
      const phys = logicalToPhysicalPage(lp)
      if (phys < 0) return { lp, data: "" }
      const pr = await api.get_preview_png_base64_page(phys)
      const data = pr?.ok ? String(pr.png_data || pr.png || "") : ""
      return { lp, data }
    }),
  )

  const board = $("#spBoard")
  if (board) {
    board.innerHTML = thumbs
      .map(
        ({ lp, data }) => `
      <div class="pageCard pageCard--selectable" data-lp="${lp}" role="button" tabindex="0">
        <div class="pageCard__check" aria-hidden="true">✓</div>
        <div class="pageCard__thumb">${data ? `<img class="pageCardImg" draggable="false" src="${data}" alt="p.${lp + 1}" />` : '<div class="pageCard__noimg">No Image</div>'}</div>
        <div class="pageCard__meta"><span class="badge">${escapeHtml(tr("main.deletePagesPageLabel", "ページ {n}", { n: lp + 1 }))}</span></div>
      </div>`,
      )
      .join("")
    board.querySelectorAll(".pageCard").forEach((el) => {
      el.onclick = (ev) => {
        const lp = Number(el.getAttribute("data-lp"))
        if (ev.shiftKey && lastClicked >= 0) {
          const ordered = logicalPages
          const ia = ordered.indexOf(lastClicked)
          const ib = ordered.indexOf(lp)
          if (ia >= 0 && ib >= 0) {
            const a = Math.min(ia, ib)
            const b = Math.max(ia, ib)
            for (let i = a; i <= b; i++) {
              if (selected.size >= MAX_DELETE_PAGES_PER_OP && !selected.has(ordered[i])) {
                toast(tr("error.deletePagesTooMany", `1回に削除できるのは最大 ${MAX_DELETE_PAGES_PER_OP} ページです`, { max: MAX_DELETE_PAGES_PER_OP }))
                break
              }
              selected.add(ordered[i])
            }
          }
        } else if (selected.has(lp)) {
          selected.delete(lp)
          lastClicked = lp
        } else {
          if (selected.size >= MAX_DELETE_PAGES_PER_OP) {
            toast(tr("error.deletePagesTooMany", `1回に削除できるのは最大 ${MAX_DELETE_PAGES_PER_OP} ページです`, { max: MAX_DELETE_PAGES_PER_OP }))
            return
          }
          selected.add(lp)
          lastClicked = lp
        }
        applyVisual()
      }
    })
  }
  applyVisual()

  $("#spApply")?.addEventListener("click", async () => {
    const chosen = [...selected]
    if (!chosen.length) return toast(tr("main.deletePagesNeedSelection", "削除するページを選択してください"))
    if (chosen.length > MAX_DELETE_PAGES_PER_OP) {
      return toast(tr("error.deletePagesTooMany", `1回に削除できるのは最大 ${MAX_DELETE_PAGES_PER_OP} ページです`, { max: MAX_DELETE_PAGES_PER_OP }))
    }
    if (chosen.length >= logicalPages.length) {
      const okAll = await uiConfirm(
        tr(
          "dialog.removeAllSectionPages",
          `「${section.label || "(無題)"}」の全ページを外します。書類をゴミ箱へ移動しますか？（PDF本体は残ります）`,
          { name: section.label || "(無題)" },
        ),
      )
      if (!okAll) return
      close()
      await moveSectionToTrash(caseObj, section.id)
      render()
      renderBinderDetail()
      return
    }
    let confirmMsg = tr(
      "dialog.moveSectionPagesToTrash",
      `選択した ${chosen.length} ページをゴミ箱へ移動します。PDF本体は削除されません。ゴミ箱から復元できます。よろしいですか？`,
      { count: chosen.length, name: section.label || "(無題)" },
    )
    if (shared > 1) {
      confirmMsg +=
        "\n\n" +
        tr(
          "dialog.removeSectionPagesShared",
          `この書類は ${shared} 件のバインダーで共有されています。すべてのバインダーに反映されます。`,
          { count: shared },
        )
    }
    if (!(await uiConfirm(confirmMsg))) return
    const r = await moveSectionPagesToTrash(caseObj, section, chosen)
    if (!r.moved) return
    toast(
      r.fullDoc
        ? tr("main.toast.movedToTrash", "ゴミ箱に移動しました")
        : tr("main.toast.sectionPagesMovedToTrash", "{count} ページをゴミ箱に移動しました", { count: r.moved }),
    )
    close()
    render()
    renderBinderDetail()
  })
}

function binderProgress(caseObj) {
  const ids = caseObj?.section_ids || []
  let done = 0
  let openIssues = 0
  for (const sid of ids) {
    const s = sectionById(sid)
    if (s && s.status === "done") done++
    openIssues += notesForSection(sid).filter((n) => !n.resolved).length
  }
  return { done, total: ids.length, openIssues }
}

function closeBinderModal() {
  const modal = $("#modal")
  if (!modal) return
  modal.style.display = "none"
  modal.innerHTML = ""
}

// あるタグが使われている配置の一覧（ページ昇順）
function tagUsageList(tag) {
  const out = []
  const pls = state.placements || {}
  for (const fid of Object.keys(pls)) {
    const pl = pls[fid]
    if (pl && String(pl.tag || "") === String(tag)) {
      out.push({ fid, page: Number(pl.page || 0), x: Number(pl.x || 0), y: Number(pl.y || 0) })
    }
  }
  out.sort((a, b) => a.page - b.page)
  return out
}

// 配置（現物）へジャンプして選択ハイライト
async function jumpToPlacement(fid, page) {
  const modal = $("#modal")
  if (modal) {
    modal.style.display = "none"
    modal.innerHTML = ""
  }
  state.selectKeys = fid ? [fid] : []
  state.pageLocked = true
  await showPage(Number(page || 0))
  drawOverlay()
  toast("選択中の配置を表示しました（タグ整理から削除できます）")
}

// タグの全配置を ◀▶（←/→・↑/↓）で順送り確認する。検索ヒット巡回のイメージ。
// returnTo: 確認を終えて「一覧に戻る」時に呼ぶ関数（タグ整理 or 削除提案）。
function startTagWalkthrough(tag, returnTo) {
  const locs = tagUsageList(tag)
  const old = document.getElementById("tagWalkBar")
  if (old) old.remove()
  if (window.__tagWalkKey) {
    document.removeEventListener("keydown", window.__tagWalkKey, true)
    window.__tagWalkKey = null
  }
  if (!locs.length) {
    toast(`「${tag}」は配置がありません（未使用タグ）`)
    if (typeof returnTo === "function") returnTo()
    return
  }
  const modal = $("#modal")
  if (modal) {
    modal.style.display = "none"
    modal.innerHTML = ""
  }

  let i = 0
  const bar = document.createElement("div")
  bar.id = "tagWalkBar"
  bar.style.cssText =
    "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;background:#0f172a;color:#fff;border-radius:12px;box-shadow:0 10px 34px rgba(0,0,0,.4);padding:10px 12px;display:flex;align-items:center;gap:10px;max-width:94vw;font-size:13px"
  document.body.appendChild(bar)

  const cleanup = () => {
    const b = document.getElementById("tagWalkBar")
    if (b) b.remove()
    if (window.__tagWalkKey) {
      document.removeEventListener("keydown", window.__tagWalkKey, true)
      window.__tagWalkKey = null
    }
  }

  const renderBar = () => {
    const l = locs[i]
    const val = String(state.values?.[tag] || "").replaceAll("<br>", " ")
    bar.innerHTML = `
      <button class="btn btn--soft" data-wk="prev" title="前へ（←/↑）" style="padding:6px 10px">◀</button>
      <div style="text-align:center;min-width:120px">
        <div style="font-weight:800;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(tag)}</div>
        <div style="font-size:11px;color:#cbd5e1">${i + 1} / ${locs.length}　・　p.${Number(l.page) + 1}${val ? "　値:" + escapeHtml(val.slice(0, 20)) : ""}</div>
      </div>
      <button class="btn btn--soft" data-wk="next" title="次へ（→/↓）" style="padding:6px 10px">▶</button>
      <span style="width:1px;height:26px;background:#334155;margin:0 2px"></span>
      <button class="btn btn--soft" data-wk="back" style="padding:6px 10px;white-space:nowrap">一覧に戻る</button>
      <button class="btn btn--danger" data-wk="del" style="padding:6px 10px;white-space:nowrap">このタグを削除</button>`
    bar.querySelector('[data-wk="prev"]').onclick = () => go(i - 1)
    bar.querySelector('[data-wk="next"]').onclick = () => go(i + 1)
    bar.querySelector('[data-wk="back"]').onclick = () => {
      cleanup()
      if (typeof returnTo === "function") returnTo()
    }
    bar.querySelector('[data-wk="del"]').onclick = async () => {
      const n = locs.length
      const ok = await uiConfirm(`タグ「${tag}」を削除します。\nこのタグの配置 ${n}件 と入力値も削除されます。よろしいですか？`)
      if (!ok) return
      const api = window.pywebview?.api
      try {
        const r = await api?.delete_tags?.([tag])
        if (!r?.ok) return toast(`削除に失敗: ${r?.error || "unknown"}`)
      } catch (e) {
        return toast(`削除に失敗: ${e}`)
      }
      state.tags = (state.tags || []).filter((x) => x !== tag)
      if (state.values) delete state.values[tag]
      for (const fid of Object.keys(state.placements || {})) {
        if (String(state.placements[fid]?.tag || "") === tag) delete state.placements[fid]
      }
      state.selectKeys = []
      cleanup()
      toast(`タグ「${tag}」を削除しました`)
      await showPage(Number(state.previewPageIndex || 0))
      refreshTagQuickPaletteGlobal()
      if (typeof returnTo === "function") returnTo()
    }
  }

  const go = async (idx) => {
    i = (idx + locs.length) % locs.length
    const l = locs[i]
    state.selectKeys = [l.fid]
    state.pageLocked = true
    await showPage(Number(l.page || 0))
    drawOverlay()
    renderBar()
  }

  window.__tagWalkKey = (ev) => {
    if (!document.getElementById("tagWalkBar")) return
    if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") {
      ev.preventDefault()
      ev.stopPropagation()
      go(i - 1)
    } else if (ev.key === "ArrowRight" || ev.key === "ArrowDown") {
      ev.preventDefault()
      ev.stopPropagation()
      go(i + 1)
    } else if (ev.key === "Escape") {
      cleanup()
      if (typeof returnTo === "function") returnTo()
    }
  }
  document.addEventListener("keydown", window.__tagWalkKey, true)

  go(0)
}

// タグ整理：使用数の確認と、人の目で見てからの削除（AI自動削除はしない）
function openTagManager() {
  const modal = $("#modal")
  if (!modal) return
  if (!state.projectPath) {
    toast("先に案件を開いてください")
    return
  }
  const close = () => {
    modal.style.display = "none"
    modal.innerHTML = ""
  }
  let q = ""
  let sortMode = "count" // count | name
  const expanded = new Set()

  const draw = () => {
    const prevScroll = $("#tmList")?.scrollTop || 0
    const tags = [...(state.tags || [])]
    const usage = new Map(tags.map((t) => [t, tagUsageList(t)]))
    const unusedCount = tags.filter((t) => usage.get(t).length === 0).length
    let rows = tags.map((t) => ({
      t,
      n: usage.get(t).length,
      v: String(state.values?.[t] || "").replaceAll("<br>", " "),
    }))
    if (q) {
      const qq = q.toLowerCase()
      rows = rows.filter((r) => r.t.toLowerCase().includes(qq) || r.v.toLowerCase().includes(qq))
    }
    if (sortMode === "count") rows.sort((a, b) => a.n - b.n || a.t.localeCompare(b.t))
    else rows.sort((a, b) => a.t.localeCompare(b.t))

    const rowHtml = rows.length
      ? rows
          .map((r) => {
            const locs = usage.get(r.t)
            const isOpen = expanded.has(r.t)
            const countColor = r.n === 0 ? "#ef4444" : "#0f172a"
            const locList = isOpen
              ? `<div style="margin-top:8px;padding-left:8px;display:flex;flex-wrap:wrap;gap:6px">
          ${
            locs.length
              ? locs
                  .map(
                    (l, i) =>
                      `<button class="btn btn--soft" data-jump-fid="${escapeHtml(l.fid)}" data-jump-page="${l.page}" style="padding:4px 8px">${i + 1}: p.${l.page + 1} を表示</button>`,
                  )
                  .join("")
              : `<span style="color:#94a3b8;font-size:12px">配置なし（未使用タグ）</span>`
          }
        </div>`
              : ""
            return `
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin-bottom:6px${r.n === 0 ? ";background:#fef2f2;border-color:#fecaca" : ""}">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.t)}</div>
              <div style="font-size:12px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.v || "（値なし）")}</div>
            </div>
            <button class="btn btn--soft" data-toggle="${escapeHtml(r.t)}" title="使用箇所を表示" style="padding:6px 10px;color:${countColor};font-weight:800;white-space:nowrap">使用 ${r.n}件 ${isOpen ? "▲" : "▼"}</button>
            ${r.n ? `<button class="btn btn--soft" data-walk="${escapeHtml(r.t)}" title="配置を順に確認（◀▶）" style="padding:6px 10px;white-space:nowrap">順に確認</button>` : ""}
            <button class="btn btn--danger" data-del-tag="${escapeHtml(r.t)}" style="padding:6px 10px">削除</button>
          </div>
          ${locList}
        </div>`
          })
          .join("")
      : `<div style="color:#64748b;padding:14px;text-align:center">該当するタグがありません。</div>`

    modal.style.display = "block"
    modal.innerHTML = `
      <div class="modal__backdrop" id="tmClose"></div>
      <div class="modal__card" style="max-width:680px;width:92vw;max-height:88vh;display:flex;flex-direction:column">
        <div class="modal__title" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span>タグ整理</span>
          <div style="display:flex;gap:8px">
            <button class="btn btn--soft" id="tmCleanup" style="padding:4px 12px;white-space:nowrap" title="未使用・重複タグをまとめて削除提案">🧹 削除提案</button>
            <button class="btn btn--soft" id="tmCloseBtn" style="padding:4px 12px">閉じる</button>
          </div>
        </div>
        <div style="font-size:12px;color:#475569;margin:2px 0 8px">タグ ${tags.length}件${unusedCount ? `・<span style="color:#ef4444;font-weight:800">未使用 ${unusedCount}件</span>` : ""}　使用数の「▼」で配置場所を表示し、「表示」で現物を確認してから削除できます。</div>
        <div class="row" style="gap:8px;margin-bottom:8px">
          <input class="input" id="tmSearch" placeholder="タグ名・値で絞り込み" value="${escapeHtml(q)}" style="flex:1">
          <button class="btn btn--soft" id="tmSort" style="white-space:nowrap">並び: ${sortMode === "count" ? "使用数(少ない順)" : "名前順"}</button>
        </div>
        <div id="tmList" style="overflow:auto;flex:1;min-height:120px">${rowHtml}</div>
      </div>`

    // 再描画でスクロール位置を見失わないよう復元
    const sc = $("#tmList")
    if (sc) sc.scrollTop = prevScroll

    $("#tmClose").onclick = close
    $("#tmCloseBtn").onclick = close
    const cleanupBtn = $("#tmCleanup")
    if (cleanupBtn)
      cleanupBtn.onclick = () => {
        close()
        openTagCleanup()
      }
    const search = $("#tmSearch")
    if (search) {
      search.oninput = () => {
        q = String(search.value || "")
        const pos = search.selectionStart
        draw()
        const s2 = $("#tmSearch")
        if (s2) {
          s2.focus()
          try {
            s2.setSelectionRange(pos, pos)
          } catch {}
        }
      }
    }
    $("#tmSort").onclick = () => {
      sortMode = sortMode === "count" ? "name" : "count"
      draw()
    }
    modal.querySelectorAll("[data-toggle]").forEach((el) => {
      el.onclick = () => {
        const t = el.getAttribute("data-toggle")
        if (expanded.has(t)) expanded.delete(t)
        else expanded.add(t)
        draw()
      }
    })
    modal.querySelectorAll("[data-jump-fid]").forEach((el) => {
      el.onclick = () => {
        jumpToPlacement(el.getAttribute("data-jump-fid"), Number(el.getAttribute("data-jump-page") || 0))
      }
    })
    modal.querySelectorAll("[data-walk]").forEach((el) => {
      el.onclick = () => {
        startTagWalkthrough(el.getAttribute("data-walk"), openTagManager)
      }
    })
    modal.querySelectorAll("[data-del-tag]").forEach((el) => {
      el.onclick = async () => {
        const t = el.getAttribute("data-del-tag")
        const n = tagUsageList(t).length
        const ok = await uiConfirm(
          n
            ? `タグ「${t}」を削除します。\nこのタグの配置 ${n}件 と入力値もすべて削除されます。よろしいですか？`
            : `未使用タグ「${t}」を削除します。よろしいですか？`,
        )
        if (!ok) return
        const api = window.pywebview?.api
        try {
          const r = await api?.delete_tags?.([t])
          if (!r?.ok) return toast(`削除に失敗: ${r?.error || "unknown"}`)
        } catch (e) {
          return toast(`削除に失敗: ${e}`)
        }
        // ローカル状態も同期
        state.tags = (state.tags || []).filter((x) => x !== t)
        if (state.values) delete state.values[t]
        for (const fid of Object.keys(state.placements || {})) {
          if (String(state.placements[fid]?.tag || "") === t) delete state.placements[fid]
        }
        state.selectKeys = (state.selectKeys || []).filter((k) => state.placements?.[k])
        if (state.idx >= state.tags.length) state.idx = Math.max(0, state.tags.length - 1)
        expanded.delete(t)
        toast(`タグ「${t}」を削除しました`)
        await showPage(Number(state.previewPageIndex || 0))
        refreshTagQuickPaletteGlobal()
        draw()
      }
    })
  }

  draw()
}

// タグ名の正規化キー（全角/半角・空白・記号差を吸収して重複判定に使う）
function tagNormKey(s) {
  return String(s || "")
    .normalize("NFKC")
    .replace(/[\s\u3000（）()「」『』、,。・･：:/／]/g, "")
    .toLowerCase()
}

// 削除提案：未使用タグ・重複(表記ゆれ)タグを抽出し、人が承認/否認して一括削除する。
// AIが勝手に消すのではなく、既定の選択を提案するだけ。最終判断は人。
function openTagCleanup() {
  const modal = $("#modal")
  if (!modal) return
  if (!state.projectPath) {
    toast("先に案件を開いてください")
    return
  }
  const close = () => {
    modal.style.display = "none"
    modal.innerHTML = ""
  }

  const tags = [...(state.tags || [])]
  const usageOf = (t) => tagUsageList(t).length

  // 未使用（配置0件）
  const unused = tags.filter((t) => usageOf(t) === 0)

  // 重複/表記ゆれの疑い：正規化キーが同じタグが2つ以上
  const byKey = new Map()
  for (const t of tags) {
    const k = tagNormKey(t)
    if (!k) continue
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k).push(t)
  }
  const dupGroups = []
  for (const [, arr] of byKey) {
    if (arr.length >= 2) {
      // 使用数の多い順 → 先頭を「残す候補」にする
      const sorted = [...arr].sort((a, b) => usageOf(b) - usageOf(a) || a.localeCompare(b))
      dupGroups.push(sorted)
    }
  }
  dupGroups.sort((a, b) => a[0].localeCompare(b[0]))

  // 削除対象の選択状態。既定：未使用は全選択。重複は各グループの先頭(最多使用)以外を選択。
  const sel = new Set()
  for (const t of unused) sel.add(t)
  for (const g of dupGroups) g.slice(1).forEach((t) => sel.add(t))

  const draw = () => {
    const prevScroll = $("#tcList")?.scrollTop || 0
    const fmtVal = (t) => String(state.values?.[t] || "").replaceAll("<br>", " ")

    const unusedHtml = unused.length
      ? unused
          .map((t) => {
            const checked = sel.has(t) ? "checked" : ""
            return `
        <label style="display:flex;align-items:center;gap:10px;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;margin-bottom:6px;background:${sel.has(t) ? "#fef2f2" : "#fff"};cursor:pointer">
          <input type="checkbox" data-sel="${escapeHtml(t)}" ${checked} style="width:18px;height:18px;flex:none">
          <div style="flex:1;min-width:0">
            <div style="font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t)}</div>
            <div style="font-size:12px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(fmtVal(t) || "（値なし）")}</div>
          </div>
          <span style="font-size:12px;color:#ef4444;font-weight:800;white-space:nowrap">配置0</span>
        </label>`
          })
          .join("")
      : `<div style="color:#94a3b8;font-size:13px;padding:8px">未使用タグはありません。</div>`

    const dupHtml = dupGroups.length
      ? dupGroups
          .map((g) => {
            const rows = g
              .map((t, i) => {
                const n = usageOf(t)
                const keep = i === 0
                const checked = sel.has(t) ? "checked" : ""
                const jump =
                  n > 0
                    ? `<button class="btn btn--soft" data-jump-tag="${escapeHtml(t)}" title="配置を順に確認（◀▶）" style="padding:3px 8px;white-space:nowrap">現物 ◀▶</button>`
                    : ""
                return `
            <label style="display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px;background:${sel.has(t) ? "#fef2f2" : keep ? "#ecfdf5" : "#fff"};cursor:pointer">
              <input type="checkbox" data-sel="${escapeHtml(t)}" ${checked} style="width:18px;height:18px;flex:none">
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t)} ${keep ? '<span style="color:#059669;font-size:11px;font-weight:800">残す候補</span>' : ""}</div>
                <div style="font-size:12px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(fmtVal(t) || "（値なし）")}</div>
              </div>
              <span style="font-size:12px;color:${n === 0 ? "#ef4444" : "#475569"};font-weight:800;white-space:nowrap">使用${n}</span>
              ${jump}
            </label>`
              })
              .join("")
            return `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:8px;margin-bottom:8px">
          <div style="font-size:11px;color:#94a3b8;margin:0 0 4px 2px">同名の疑い（${g.length}件）</div>
          ${rows}
        </div>`
          })
          .join("")
      : `<div style="color:#94a3b8;font-size:13px;padding:8px">重複の疑いはありません。</div>`

    const selCount = sel.size
    modal.style.display = "block"
    modal.innerHTML = `
      <div class="modal__backdrop" id="tcClose"></div>
      <div class="modal__card" style="max-width:680px;width:92vw;max-height:88vh;display:flex;flex-direction:column">
        <div class="modal__title" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span>削除提案</span>
          <div style="display:flex;gap:8px">
            <button class="btn btn--soft" id="tcBack" style="padding:4px 12px;white-space:nowrap">← タグ整理</button>
            <button class="btn btn--soft" id="tcCloseBtn" style="padding:4px 12px">閉じる</button>
          </div>
        </div>
        <div style="font-size:12px;color:#475569;margin:2px 0 8px">チェックの付いたタグが削除対象です。提案は既定値なので、残したいものは外し、消したいものは付けてください。「現物」で配置を確認できます。</div>
        <div id="tcList" style="overflow:auto;flex:1;min-height:120px">
          <div style="font-weight:800;color:#0f172a;margin:4px 2px 6px">未使用タグ（配置0件）　${unused.length}件</div>
          ${unusedHtml}
          <div style="font-weight:800;color:#0f172a;margin:14px 2px 6px">重複・表記ゆれの疑い　${dupGroups.length}グループ</div>
          ${dupHtml}
        </div>
        <div class="row" style="gap:8px;margin-top:10px;align-items:center">
          <button class="btn btn--soft" id="tcNone" style="white-space:nowrap">選択をすべて解除</button>
          <button class="btn btn--soft" id="tcAllUnused" style="white-space:nowrap">未使用を全選択</button>
          <div style="flex:1"></div>
          <button class="btn btn--danger" id="tcApply" style="white-space:nowrap" ${selCount ? "" : "disabled"}>選択した ${selCount}件 を削除</button>
        </div>
      </div>`

    const sc = $("#tcList")
    if (sc) sc.scrollTop = prevScroll

    $("#tcClose").onclick = close
    $("#tcCloseBtn").onclick = close
    $("#tcBack").onclick = () => {
      close()
      openTagManager()
    }
    modal.querySelectorAll("[data-sel]").forEach((el) => {
      el.onchange = () => {
        const t = el.getAttribute("data-sel")
        if (el.checked) sel.add(t)
        else sel.delete(t)
        draw()
      }
    })
    modal.querySelectorAll("[data-jump-tag]").forEach((el) => {
      el.onclick = (ev) => {
        ev.preventDefault()
        const t = el.getAttribute("data-jump-tag")
        startTagWalkthrough(t, openTagCleanup)
      }
    })
    $("#tcNone").onclick = () => {
      sel.clear()
      draw()
    }
    $("#tcAllUnused").onclick = () => {
      unused.forEach((t) => sel.add(t))
      draw()
    }
    $("#tcApply").onclick = async () => {
      const list = [...sel]
      if (!list.length) return
      const usedCount = list.reduce((s, t) => s + usageOf(t), 0)
      const ok = await uiConfirm(
        `選択した ${list.length}件 のタグを削除します。\n` +
          (usedCount ? `うち配置 ${usedCount}件 と入力値も削除されます。\n` : "") +
          `よろしいですか？`,
      )
      if (!ok) return
      const api = window.pywebview?.api
      try {
        const r = await api?.delete_tags?.(list)
        if (!r?.ok) return toast(`削除に失敗: ${r?.error || "unknown"}`)
      } catch (e) {
        return toast(`削除に失敗: ${e}`)
      }
      const delset = new Set(list)
      state.tags = (state.tags || []).filter((x) => !delset.has(x))
      if (state.values) for (const t of list) delete state.values[t]
      for (const fid of Object.keys(state.placements || {})) {
        if (delset.has(String(state.placements[fid]?.tag || ""))) delete state.placements[fid]
      }
      state.selectKeys = (state.selectKeys || []).filter((k) => state.placements?.[k])
      if (state.idx >= state.tags.length) state.idx = Math.max(0, state.tags.length - 1)
      toast(`${list.length}件のタグを削除しました`)
      await showPage(Number(state.previewPageIndex || 0))
      refreshTagQuickPaletteGlobal()
      close()
      openTagCleanup()
    }
  }

  draw()
}

// Excel取込：項目名→既存タグの候補を軽くマッチする（保存済み対応表が無い項目向け）
function suggestTagForName(name, tagKeys, usageMap) {
  const na = tagNormKey(name)
  if (!na) return ""
  let best = ""
  let bestScore = 0
  for (const t of tagKeys) {
    const tn = tagNormKey(t)
    if (!tn || tn.length <= 1) continue
    let s = 0
    if (tn === na) s = 1.0
    else if (na.includes(tn) || tn.includes(na)) {
      const lr = Math.min(na.length, tn.length) / Math.max(na.length, tn.length)
      if (lr >= 0.5) s = 0.8 + 0.15 * lr
    }
    if (s <= 0) continue
    s += (Math.min(usageMap.get(t) || 0, 50) / 50) * 0.04
    if (s > bestScore) {
      bestScore = s
      best = t
    }
  }
  return bestScore >= 0.8 ? best : ""
}

// Excel取込：申請情報シートを読み、1件ずつ承認/微調整/否認して値を流し込む。
async function openExcelImport() {
  const api = window.pywebview?.api
  if (!api?.probe_excel_intake) return toast("この環境ではExcel取込は使えません")
  const modal = $("#modal")
  if (!modal) return

  let picked
  try {
    picked = await api.pick_excel_intake?.()
  } catch (e) {
    return toast(`ファイル選択に失敗: ${e}`)
  }
  if (!picked?.ok || !picked.path) return

  toast("Excelを読み込み中…")
  let res
  try {
    res = await api.probe_excel_intake(picked.path)
  } catch (e) {
    return toast(`読込に失敗: ${e}`)
  }
  if (!res?.ok) return toast(`読込に失敗: ${res?.error || "unknown"}`)
  const items = Array.isArray(res.items) ? res.items : []
  if (!items.length) return toast("取り込める項目が見つかりませんでした")

  let saved = {}
  try {
    const m = await api.get_excel_mapping?.("default")
    if (m?.ok && m.mapping) saved = m.mapping
  } catch {}

  const tagKeys = [...(state.tags || [])]
  const usageMap = new Map(tagKeys.map((t) => [t, tagUsageList(t).length]))

  // 行データ（編集対象）
  const rows = items.map((it) => {
    let tag = String(saved[it.id] || "").trim()
    if (!tag) tag = suggestTagForName(it.name, tagKeys, usageMap)
    const hasVal = String(it.value || "").trim() !== "" && String(it.value).trim() !== "ー"
    return {
      id: it.id,
      block: it.block,
      name: it.name,
      value: String(it.value || ""),
      unit: it.unit || "",
      tag,
      approve: !!tag && hasVal,
    }
  })

  const fileName = String(picked.path).split(/[\\/]/).pop()
  const close = () => {
    modal.style.display = "none"
    modal.innerHTML = ""
  }
  let filterMode = "all" // all | approve | unmapped

  const curVal = (tag) => (tag ? String(state.values?.[tag] || "").replaceAll("<br>", " ") : "")
  const tagExists = (tag) => !tag || tagKeys.includes(tag)

  const datalist = `<datalist id="xiTags">${tagKeys.map((t) => `<option value="${escapeHtml(t)}"></option>`).join("")}</datalist>`

  const draw = () => {
    const prevScroll = $("#xiList")?.scrollTop || 0
    const visible = rows.filter((r) => {
      if (filterMode === "approve") return r.approve
      if (filterMode === "unmapped") return !r.tag
      return true
    })
    const approveCount = rows.filter((r) => r.approve && r.tag).length

    const rowHtml = visible
      .map((r) => {
        const ri = rows.indexOf(r)
        const exists = tagExists(r.tag)
        const cv = curVal(r.tag)
        const valEmpty = String(r.value).trim() === "" || String(r.value).trim() === "ー"
        const warn = r.tag && !exists
        return `
      <div style="border:1px solid ${r.approve ? "#86efac" : "#e2e8f0"};border-radius:10px;padding:9px 10px;margin-bottom:7px;background:${r.approve ? "#f0fdf4" : "#fff"}">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <input type="checkbox" data-xi-approve="${ri}" ${r.approve ? "checked" : ""} title="この項目を取り込む" style="width:18px;height:18px;flex:none;margin-top:3px">
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;color:#94a3b8">${escapeHtml(r.id)}　${escapeHtml(r.block)}区分</div>
            <div style="font-weight:800;color:#0f172a">${escapeHtml(r.name)}</div>
            <div style="font-size:13px;color:${valEmpty ? "#94a3b8" : "#0369a1"};margin-top:2px;word-break:break-all">取込値: ${valEmpty ? "（空）" : escapeHtml(r.value)}${r.unit ? `<span style="color:#94a3b8"> ${escapeHtml(r.unit)}</span>` : ""}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap">
              <span style="font-size:12px;color:#475569;white-space:nowrap">→ タグ</span>
              <input class="input" list="xiTags" data-xi-tag="${ri}" value="${escapeHtml(r.tag)}" placeholder="（未割当）" style="flex:1;min-width:160px;padding:5px 8px;border-color:${warn ? "#fca5a5" : "#cbd5e1"}">
            </div>
            <div style="font-size:12px;margin-top:3px;color:${warn ? "#ef4444" : "#64748b"}">
              ${warn ? "⚠ このタグは存在しません（新規タグは取込時にスキップされます）" : r.tag ? `現在値: ${escapeHtml(cv) || "（なし）"}` : "タグ未割当（取り込まれません）"}
            </div>
          </div>
        </div>
      </div>`
      })
      .join("")

    modal.style.display = "block"
    modal.innerHTML = `
      ${datalist}
      <div class="modal__backdrop" id="xiClose"></div>
      <div class="modal__card" style="max-width:720px;width:94vw;max-height:90vh;display:flex;flex-direction:column">
        <div class="modal__title" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span>Excel取込（承認/微調整/否認）</span>
          <button class="btn btn--soft" id="xiCloseBtn" style="padding:4px 12px">閉じる</button>
        </div>
        <div style="font-size:12px;color:#475569;margin:2px 0 6px">${escapeHtml(fileName || "")}　全${rows.length}項目　チェックの付いた項目だけを取り込みます。タグは ▾ から選んで微調整できます。</div>
        <div class="row" style="gap:6px;margin-bottom:8px;flex-wrap:wrap">
          <button class="btn ${filterMode === "all" ? "" : "btn--soft"}" data-xi-filter="all" style="padding:4px 10px">すべて</button>
          <button class="btn ${filterMode === "approve" ? "" : "btn--soft"}" data-xi-filter="approve" style="padding:4px 10px">承認予定のみ</button>
          <button class="btn ${filterMode === "unmapped" ? "" : "btn--soft"}" data-xi-filter="unmapped" style="padding:4px 10px">未割当のみ</button>
          <div style="flex:1"></div>
          <button class="btn btn--soft" id="xiAllOn" style="padding:4px 10px;white-space:nowrap">割当済を全承認</button>
          <button class="btn btn--soft" id="xiAllOff" style="padding:4px 10px;white-space:nowrap">全否認</button>
        </div>
        <div id="xiList" style="overflow:auto;flex:1;min-height:140px">${rowHtml || '<div style="color:#94a3b8;padding:14px;text-align:center">該当する項目がありません。</div>'}</div>
        <div class="row" style="gap:8px;margin-top:10px;align-items:center">
          <div style="font-size:12px;color:#475569">承認予定: <b style="color:#059669">${approveCount}</b> 件</div>
          <div style="flex:1"></div>
          <button class="btn btn--primary" id="xiApply" style="white-space:nowrap" ${approveCount ? "" : "disabled"}>取込実行（${approveCount}件）</button>
        </div>
      </div>`

    const sc = $("#xiList")
    if (sc) sc.scrollTop = prevScroll

    $("#xiClose").onclick = close
    $("#xiCloseBtn").onclick = close
    modal.querySelectorAll("[data-xi-filter]").forEach((el) => {
      el.onclick = () => {
        filterMode = el.getAttribute("data-xi-filter")
        draw()
      }
    })
    modal.querySelectorAll("[data-xi-approve]").forEach((el) => {
      el.onchange = () => {
        const i = Number(el.getAttribute("data-xi-approve"))
        rows[i].approve = el.checked
        draw()
      }
    })
    modal.querySelectorAll("[data-xi-tag]").forEach((el) => {
      el.onchange = () => {
        const i = Number(el.getAttribute("data-xi-tag"))
        rows[i].tag = String(el.value || "").trim()
        if (rows[i].tag && String(rows[i].value).trim() && String(rows[i].value).trim() !== "ー") rows[i].approve = true
        draw()
      }
    })
    $("#xiAllOn").onclick = () => {
      rows.forEach((r) => {
        if (r.tag && String(r.value).trim() && String(r.value).trim() !== "ー") r.approve = true
      })
      draw()
    }
    $("#xiAllOff").onclick = () => {
      rows.forEach((r) => (r.approve = false))
      draw()
    }
    $("#xiApply").onclick = async () => {
      const approved = rows.filter((r) => r.approve && r.tag)
      if (!approved.length) return
      // 同一タグへ複数値が入る場合を検出
      const seen = new Map()
      const dups = []
      for (const r of approved) {
        if (seen.has(r.tag)) dups.push(r.tag)
        seen.set(r.tag, r.value)
      }
      let msg = `承認した ${approved.length}件 をシステムへ取り込みます。\n既存の値は上書きされます。`
      if (dups.length) msg += `\n\n⚠ 同じタグに複数項目が割当たっています（後の値で上書き）:\n${[...new Set(dups)].join(", ")}`
      const ok = await uiConfirm(msg + "\n\nよろしいですか？")
      if (!ok) return

      const values = {}
      for (const r of approved) values[r.tag] = r.value
      try {
        const r = await api.bulk_apply_values({ values, only_known_tags: true, skip_empty_values: false })
        if (!r?.ok) return toast(`取込に失敗: ${r?.error || "unknown"}`)
        if (r.values && typeof r.values === "object") state.values = { ...state.values, ...r.values }
        // 対応表を保存（タグが割当たっている全行）
        const mapping = {}
        for (const row of rows) if (row.tag) mapping[row.id] = row.tag
        try {
          await api.save_excel_mapping?.("default", mapping)
        } catch {}
        const applied = Array.isArray(r.applied) ? r.applied.length : approved.length
        const skipped = Array.isArray(r.skipped_unknown_tags) ? r.skipped_unknown_tags.length : 0
        toast(`取込完了: ${applied}件を反映${skipped ? `／${skipped}件は未登録タグのためスキップ` : ""}`)
        close()
        await showPage(Number(state.previewPageIndex || 0))
        refreshTagQuickPaletteGlobal()
      } catch (e) {
        toast(`取込に失敗: ${e}`)
      }
    }
  }

  draw()
}

// PDF出力の方式を選ぶ（全頁 / バインダー単位で分割）
function openExportChooser() {
  const modal = $("#modal")
  if (!modal) return
  const close = () => {
    modal.style.display = "none"
    modal.innerHTML = ""
  }
  const cases = visibleBinderCases()
  const caseRows = cases.length
    ? cases
        .map((c) => {
          const docs = (c.section_ids || []).filter((sid) => sectionById(sid)).length
          return `
      <div class="binderRow" style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:6px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(caseLabel(c))}</div>
          <div style="font-size:12px;color:#64748b">${docs}書類を1書類ずつ別PDFに分割</div>
        </div>
        <button class="btn btn--primary" data-export-case="${escapeHtml(c.id)}" style="padding:8px 14px" ${docs ? "" : "disabled"}>出力</button>
      </div>`
        })
        .join("")
    : `<div style="color:#64748b;padding:10px">バインダーがありません。先に「バインダー」で作成してください。</div>`

  modal.style.display = "block"
  modal.innerHTML = `
    <div class="modal__backdrop" id="exClose"></div>
    <div class="modal__card" style="max-width:560px;width:92vw;max-height:88vh;display:flex;flex-direction:column">
      <div class="modal__title" style="display:flex;align-items:center;justify-content:space-between">
        <span>PDF出力</span>
        <button class="btn btn--soft" id="exCloseBtn" style="padding:4px 12px">閉じる</button>
      </div>
      <div style="font-weight:800;color:#0f172a;margin:6px 0">全ページ出力</div>
      <button class="btn btn--primary" id="exFull" style="width:100%;padding:10px;margin-bottom:14px">全ページを1つのPDFで出力</button>
      <div style="font-weight:800;color:#0f172a;margin:2px 0 6px">バインダー単位で出力（ページごとに分割）</div>
      <div style="overflow:auto;flex:1;min-height:60px">${caseRows}</div>
    </div>`

  $("#exClose").onclick = close
  $("#exCloseBtn").onclick = close
  $("#exFull").onclick = () => {
    close()
    runFullExport()
  }
  modal.querySelectorAll("[data-export-case]").forEach((el) => {
    el.onclick = () => {
      const id = el.getAttribute("data-export-case")
      close()
      runBinderExport(id)
    }
  })
}

async function runFullExport() {
  const api = window.pywebview?.api
  if (!api?.export_filled_pdf_now) return toast("PDF出力機能が見つかりません")
  try {
    await pushValue()
    const t0 = Date.now()
    showLoading("完成PDFを生成しています…", "ページを書き出しています")
    const r = await api.export_filled_pdf_now()
    hideLoading()
    if (!r?.ok) return toast(`PDF出力に失敗: ${r?.error || "unknown"}`)
    if (r?.filled_pdf) state.lastFilledPdf = r.filled_pdf
    if (r?.exports_dir) state.lastExportDir = r.exports_dir
    const sec = Math.round((Date.now() - t0) / 1000)
    toast(`PDFを出力しました（${sec}秒）`)
    render()
  } catch (e) {
    hideLoading()
    toast(`PDF出力に失敗しました: ${e}`)
  }
}

async function runBinderExport(caseId) {
  const api = window.pywebview?.api
  if (!api?.export_binder_pdfs) return toast("バインダー出力機能が見つかりません（最新版に更新してください）")
  try {
    await pushValue()
    const t0 = Date.now()
    showLoading("バインダーをPDFに分割出力しています…", "書類ごとに書き出しています")
    const r = await api.export_binder_pdfs(caseId)
    hideLoading()
    if (!r?.ok) {
      const map = { no_documents: "このバインダーに書類がありません", binder_not_found: "バインダーが見つかりません" }
      return toast(`バインダー出力に失敗: ${map[r?.error] || r?.error || "unknown"}`)
    }
    if (r?.folder) state.lastExportDir = r.folder
    const sec = Math.round((Date.now() - t0) / 1000)
    toast(`${r.count}件のPDFを出力しフォルダを開きました（${sec}秒）`)
    render()
  } catch (e) {
    hideLoading()
    toast(`バインダー出力に失敗しました: ${e}`)
  }
}

// エントリ：開いているバインダーがあれば個別画面、なければ一覧画面
function openBinder() {
  const modal = $("#modal")
  if (!modal) return
  if (!state.projectPath) {
    toast("先に案件を開いてください")
    return
  }
  syncBinderTrashState()
  const exists = visibleBinderCases().some((c) => c.id === state.binderCaseFilter)
  if (state.binderCaseFilter && exists) renderBinderDetail()
  else {
    state.binderCaseFilter = ""
    renderBinderHome()
  }
}

// 画面①：バインダー一覧（作る / 流用する / 開く）
function renderBinderHome() {
  const modal = $("#modal")
  if (!modal) return
  const cases = visibleBinderCases()
  const openNotes = (state.notes || []).filter((n) => !n.resolved && !isBinderMetaNote(n))

  const cards = cases.length
    ? cases
        .map((c) => {
          const pg = binderProgress(c)
          return `
      <div class="binderRow" data-open-case="${escapeHtml(c.id)}" style="display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:8px;cursor:pointer">
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(caseLabel(c))}</div>
          <div style="font-size:12px;color:#64748b">書類 ${pg.total}件・完了 ${pg.done}/${pg.total}${pg.openIssues ? `・<span style="color:#ef4444">課題 ${pg.openIssues}</span>` : ""}</div>
        </div>
        <button class="btn btn--primary" data-open-case="${escapeHtml(c.id)}" style="padding:8px 16px">開く</button>
        <button class="btn btn--soft" data-del-case="${escapeHtml(c.id)}" style="padding:8px 10px" title="バインダーを削除">🗑</button>
      </div>`
        })
        .join("")
    : `<div style="color:#64748b;padding:14px;text-align:center">まだバインダーがありません。「新しいバインダーを作る」から始めましょう。</div>`

  const issues = openNotes.length
    ? openNotes
        .map((n) => {
          const km = noteKindMeta(n.kind)
          return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid #f1f5f9">
        <span>${km.icon}</span>
        <div style="flex:1;min-width:0;font-size:13px;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(n.text || "(空の付箋)")}</div>
        <span style="font-size:11px;color:#94a3b8">p.${Number(n.page || 0) + 1}</span>
        <button class="btn btn--soft" data-note-jump="${Number(n.page || 0)}" style="padding:4px 8px">開く</button>
      </div>`
        })
        .join("")
    : `<div style="color:#64748b;padding:10px">未解決の課題はありません。</div>`

  modal.style.display = "block"
  modal.innerHTML = `
    <div class="modal__backdrop" id="binderClose"></div>
    <div class="modal__card" style="max-width:680px;width:92vw;max-height:88vh;display:flex;flex-direction:column">
      <div class="modal__title" style="display:flex;align-items:center;justify-content:space-between">
        <span>バインダー</span>
        <button class="btn btn--soft" id="binderCloseBtn" style="padding:4px 12px">閉じる</button>
      </div>
      <div class="row" style="gap:8px;margin:6px 0 12px">
        <button class="btn btn--primary" id="binderNew" style="flex:1;padding:10px">＋ 新しいバインダーを作る</button>
        <button class="btn btn--soft" id="binderReuse" style="flex:1;padding:10px">過去のバインダーを流用</button>
        <button class="btn btn--soft" id="binderTrashBtn" style="padding:10px 14px" title="${escapeHtml(tr("binder.trashTitle", "ゴミ箱"))}">🗑${binderTrashBadgeHtml()}</button>
      </div>
      <div style="overflow:auto;flex:1;min-height:120px">
        <div style="font-weight:800;color:#0f172a;margin:4px 0">このプロジェクトのバインダー</div>
        ${cards}
        <div style="margin-top:14px;font-weight:800;color:#0f172a">未解決の課題（付箋）</div>
        <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-top:6px">${issues}</div>
      </div>
    </div>`

  $("#binderClose").onclick = closeBinderModal
  $("#binderCloseBtn").onclick = closeBinderModal
  $("#binderNew").onclick = async () => {
    const name = await uiPrompt("新しいバインダーの名前", "認定 / Aさん / ID")
    if (!name) return
    const c = { id: genId("c"), label: String(name), section_ids: [] }
    state.cases = [...(state.cases || []), c]
    state.binderCaseFilter = c.id
    await persistBinder()
    render()
    renderBinderDetail()
  }
  $("#binderReuse").onclick = () => openBinderReusePicker()
  $("#binderTrashBtn")?.addEventListener("click", () => openBinderTrash("home"))
  modal.querySelectorAll("[data-open-case]").forEach((el) => {
    el.onclick = (ev) => {
      ev.stopPropagation()
      state.binderCaseFilter = el.getAttribute("data-open-case")
      renderBinderDetail()
    }
  })
  modal.querySelectorAll("[data-del-case]").forEach((el) => {
    el.onclick = async (ev) => {
      ev.stopPropagation()
      const id = el.getAttribute("data-del-case")
      const ok = await uiConfirm("このバインダーを削除しますか？（書類の中身・PDFは消えません）")
      if (!ok) return
      state.cases = (state.cases || []).filter((c) => c.id !== id)
      syncBinderTrashState()
      await persistBinder()
      render()
      renderBinderHome()
    }
  })
  modal.querySelectorAll("[data-note-jump]").forEach((el) => {
    el.onclick = async () => {
      closeBinderModal()
      await binderJumpToPage(Number(el.getAttribute("data-note-jump") || 0))
    }
  })
}

// 画面②：個別バインダー（書類を上から順に・プレビュー選択で追加）
function renderBinderDetail() {
  const modal = $("#modal")
  if (!modal) return
  const prevScroll = $("#binderScroll")?.scrollTop || 0
  const caseObj = (state.cases || []).find((c) => c.id === state.binderCaseFilter)
  if (!caseObj) {
    renderBinderHome()
    return
  }
  if (!Array.isArray(caseObj.section_ids)) caseObj.section_ids = []
  const docs = caseObj.section_ids.map((sid) => sectionById(sid)).filter(Boolean)
  const pg = binderProgress(caseObj)

  const rows = docs.length
    ? docs
        .map((s, i) => {
          const cm = sectionStatusMeta(s.status)
          const nNotes = notesForSection(s.id).filter((n) => !n.resolved).length
          const shared = sectionSharedCount(s.id)
          return `
      <div class="binderRow" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #e2e8f0;border-left:6px solid ${cm.color};border-radius:10px;margin-bottom:6px">
        <div style="width:38px;text-align:center;font-weight:800;color:#475569">p.${i + 1}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(s.label || "(無題)")}${shared > 1 ? ` <span title="${shared}件のバインダーで共有" style="color:#7c5cff;font-size:12px">🔗</span>` : ""}${nNotes ? ` <span style="color:#ef4444;font-size:12px">❗${nNotes}</span>` : ""}</div>
          <div style="font-size:12px;color:#64748b">${escapeHtml(sectionBinderMetaLine(s))}</div>
        </div>
        <select data-action="set-status" data-sid="${escapeHtml(s.id)}" class="input" style="width:110px;padding:4px">
          ${SECTION_STATUSES.map((st) => `<option value="${st.id}" ${st.id === s.status ? "selected" : ""}>${escapeHtml(st.label)}</option>`).join("")}
        </select>
        <button class="btn btn--soft" data-action="jump" data-page="${sectionFirstPage(s)}" style="padding:6px 8px">開く</button>
        <button class="btn btn--soft" data-action="remove-pages" data-sid="${escapeHtml(s.id)}" style="padding:6px 8px" title="${escapeHtml(tr("binder.removePages", "ページをゴミ箱へ"))}">−P</button>
        <button class="btn btn--soft" data-action="edit-pages" data-sid="${escapeHtml(s.id)}" style="padding:6px 8px" title="名前・ページを編集">✎</button>
        <button class="btn btn--soft" data-action="up" data-sid="${escapeHtml(s.id)}" style="padding:6px 6px" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="btn btn--soft" data-action="down" data-sid="${escapeHtml(s.id)}" style="padding:6px 6px" ${i === docs.length - 1 ? "disabled" : ""}>↓</button>
        <button class="btn btn--soft" data-action="remove" data-sid="${escapeHtml(s.id)}" style="padding:6px 8px" title="${escapeHtml(tr("binder.moveToTrash", "ゴミ箱へ移動"))}">✕</button>
      </div>`
        })
        .join("")
    : `<div style="color:#64748b;padding:12px">まだ書類がありません。「＋ 書類を追加」でプレビューからページを選んで書類を作りましょう。</div>`

  modal.style.display = "block"
  modal.innerHTML = `
    <div class="modal__backdrop" id="binderClose"></div>
    <div class="modal__card" style="max-width:780px;width:92vw;max-height:88vh;display:flex;flex-direction:column">
      <div class="modal__title" style="display:flex;align-items:center;gap:10px">
        <button class="btn btn--soft" id="binderBack" style="padding:4px 10px">← 一覧</button>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(caseLabel(caseObj))}</span>
        <button class="btn btn--soft" id="binderRename" style="padding:4px 8px" title="名前変更">✎</button>
        <button class="btn btn--soft" id="binderDuplicate" style="padding:4px 10px" title="資料(ページ)とタグを別物として丸ごと複製（タグ名に番号が付き、元には影響しません）">丸ごと複製</button>
        <button class="btn btn--soft" id="binderSaveReuse" style="padding:4px 10px" title="このバインダー構成を保存して次回流用">流用保存</button>
        <button class="btn btn--soft" id="binderTrashBtn" style="padding:4px 10px" title="${escapeHtml(tr("binder.trashTitle", "ゴミ箱"))}">🗑${binderTrashBadgeHtml()}</button>
      </div>
      <div style="font-size:12px;color:#475569;margin:4px 0 10px">書類 ${pg.total}件・完了 ${pg.done}/${pg.total}${pg.openIssues ? `・<span style="color:#ef4444">未解決の課題 ${pg.openIssues}</span>` : ""}</div>
      <div id="binderScroll" style="overflow:auto;flex:1;min-height:120px">
        ${rows}
        <button class="btn btn--primary" id="binderAddDoc" style="width:100%;padding:10px;margin-top:8px">＋ 書類を追加（プレビューからページ選択）</button>
      </div>
    </div>`

  const scEl = $("#binderScroll")
  if (scEl) scEl.scrollTop = prevScroll

  $("#binderClose").onclick = closeBinderModal
  $("#binderBack").onclick = () => {
    state.binderCaseFilter = ""
    renderBinderHome()
  }
  $("#binderRename").onclick = async () => {
    const name = await uiPrompt("バインダー名を変更", caseLabel(caseObj))
    if (name == null) return
    caseObj.label = String(name)
    await persistBinder()
    render()
    renderBinderDetail()
  }
  $("#binderSaveReuse").onclick = () => saveBinderForReuse(caseObj)
  $("#binderDuplicate").onclick = () => duplicateBinder(caseObj)
  $("#binderAddDoc").onclick = () => openDocPagePicker(caseObj, null)
  $("#binderTrashBtn")?.addEventListener("click", () => openBinderTrash("detail"))

  modal.querySelectorAll("[data-action]").forEach((el) => {
    const action = el.getAttribute("data-action")
    const sid = el.getAttribute("data-sid")
    if (action === "set-status") {
      el.onchange = async () => {
        const s = sectionById(sid)
        if (s) s.status = el.value
        await persistBinder()
        renderBinderDetail()
      }
    } else if (action === "jump") {
      el.onclick = async () => {
        closeBinderModal()
        await binderJumpToPage(Number(el.getAttribute("data-page") || 0))
      }
    } else if (action === "edit-pages") {
      el.onclick = () => openDocPagePicker(caseObj, sectionById(sid))
    } else if (action === "remove-pages") {
      el.onclick = () => openSectionPageDeleteModal(caseObj, sectionById(sid))
    } else if (action === "up" || action === "down") {
      el.onclick = async () => {
        const arr = caseObj.section_ids
        const idx = arr.indexOf(sid)
        const to = action === "up" ? idx - 1 : idx + 1
        if (idx < 0 || to < 0 || to >= arr.length) return
        const tmp = arr[idx]
        arr[idx] = arr[to]
        arr[to] = tmp
        await persistBinder()
        renderBinderDetail()
      }
    } else if (action === "remove") {
      el.onclick = async () => {
        try {
          const moved = await moveSectionToTrash(caseObj, sid)
          if (moved) {
            render()
            renderBinderDetail()
          }
        } catch (e) {
          console.error("moveSectionToTrash failed:", e)
          toast(`書類の削除に失敗しました: ${e}`)
        }
      }
    }
  })
}

function caseLabel(c) {
  if (!c) return ""
  if (c.label) return String(c.label)
  const parts = [c.variant, c.person, c.lang].filter(Boolean)
  return parts.length ? parts.join(" / ") : String(c.id || "申請")
}

// 書類のページをプレビューから選んで追加・編集（PDF並べ替えと同じサムネイル）
function pagesLabel(pages) {
  return sectionRangeLabel({ pages })
}

// 書類のページをプレビューから選択。新規追加時は「一度の読み込みで複数の書類を続けて作成」できる。
async function openDocPagePicker(caseObj, section) {
  const modal = $("#modal")
  if (!modal) return
  const api = window.pywebview?.api
  if (!api?.get_preview_png_base64_page) {
    toast("プレビュー取得機能が見つかりません")
    return
  }
  const total = Math.max(1, Number(state.pageCount || 1))
  const isNew = !section

  const pending = [] // このセッションで作る書類 [{label, pages(logical)}]
  const selected = new Set(
    isNew ? [] : sectionOriginalPages(section).map((lp) => logicalToPhysicalPage(lp)).filter((p) => p >= 0),
  )
  let lastClicked = -1
  let thumbs = null // [{idx, data}]

  const assignedMap = () => {
    const m = new Map()
    pending.forEach((d, i) => {
      d.pages.forEach((logicalP) => {
        const phys = logicalToPhysicalPage(logicalP)
        if (phys >= 0) m.set(phys, i)
      })
    })
    return m
  }

  modal.style.display = "block"
  modal.innerHTML = `
    <div class="modal__backdrop" id="dpClose"></div>
    <div class="modal__card" style="width:min(1100px, calc(100vw - 40px));max-width:1100px;max-height:92vh;display:flex;flex-direction:column">
      <div class="modal__title">${isNew ? "書類を追加（複数まとめて作成できます）" : "書類のページを編集"}</div>
      ${isNew ? `<div id="dpChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px"></div>` : ""}
      <div class="row" style="gap:8px;align-items:flex-end;margin-bottom:6px">
        <div class="field" style="flex:1"><div class="label">${isNew ? "いま作る書類の名前" : "この書類の名前"}</div>
          <input class="input" id="dpName" placeholder="例：雇用契約書" value="${escapeHtml(isNew ? "" : section.label || "")}"></div>
        <div class="label" id="dpCount" style="white-space:nowrap">選択 ${selected.size} ページ</div>
        ${isNew ? `<button class="btn btn--soft" id="dpConfirm" style="white-space:nowrap">この書類を確定 ＋</button>` : ""}
      </div>
      <div class="label" style="margin-bottom:6px">含めるページをクリックで選択（Shift+クリックで範囲選択）。${isNew ? "確定すると緑色になり、続けて次の書類を選べます。" : ""}</div>
      <div class="pageOpsBoard" id="dpBoard" style="overflow:auto;flex:1"><div style="padding:20px;color:#64748b">プレビューを読み込み中…</div></div>
      <div class="row" style="margin-top:12px;justify-content:space-between;gap:8px">
        <button class="btn btn--soft" id="dpCancel">キャンセル</button>
        <button class="btn btn--primary" id="dpSave">${isNew ? "0件の書類を追加" : "保存"}</button>
      </div>
    </div>`

  const board = $("#dpBoard")
  const nameInput = $("#dpName")
  const updateCount = () => {
    const el = $("#dpCount")
    if (el) el.textContent = `選択 ${selected.size} ページ`
  }
  const updateSaveLabel = () => {
    const btn = $("#dpSave")
    if (btn && isNew) btn.textContent = `${pending.length}件の書類を追加`
  }
  const renderChips = () => {
    const el = $("#dpChips")
    if (!el) return
    if (!pending.length) {
      el.innerHTML = `<div style="color:#94a3b8;font-size:12px">確定した書類がここに p.1, p.2 … と並びます。</div>`
      return
    }
    el.innerHTML = pending
      .map(
        (d, i) => `
      <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:999px;font-size:12px;color:#166534">
        <b>${i + 1}.</b> ${escapeHtml(d.label)} <span style="color:#15803d">${escapeHtml(pagesLabel(d.pages))}</span>
        <button data-unpend="${i}" title="取り消し" style="border:none;background:transparent;cursor:pointer;color:#16a34a;font-weight:800">✕</button>
      </span>`,
      )
      .join("")
    el.querySelectorAll("[data-unpend]").forEach((b) => {
      b.onclick = () => {
        const i = Number(b.getAttribute("data-unpend"))
        pending.splice(i, 1)
        renderChips()
        applyVisual()
        updateSaveLabel()
      }
    })
  }
  const applyVisual = () => {
    if (!board) return
    const amap = assignedMap()
    board.querySelectorAll(".pageCard").forEach((el) => {
      const idx = Number(el.getAttribute("data-idx"))
      const tag = el.querySelector(".dpTag")
      if (amap.has(idx)) {
        const di = amap.get(idx)
        el.dataset.assigned = "1"
        el.style.outline = "3px solid #22c55e"
        el.style.opacity = "0.7"
        el.style.cursor = "not-allowed"
        if (tag) {
          tag.textContent = `${di + 1}. ${pending[di].label || ""}`.slice(0, 14)
          tag.style.background = "#22c55e"
          tag.style.color = "#fff"
        }
      } else if (selected.has(idx)) {
        el.dataset.assigned = "0"
        el.style.outline = "3px solid #7c5cff"
        el.style.opacity = "1"
        el.style.cursor = "pointer"
        if (tag) {
          tag.textContent = "選択"
          tag.style.background = "#ede9fe"
          tag.style.color = "#5b21b6"
        }
      } else {
        el.dataset.assigned = "0"
        el.style.outline = "none"
        el.style.opacity = "1"
        el.style.cursor = "pointer"
        if (tag) tag.textContent = ""
      }
    })
    updateCount()
  }
  const buildBoard = () => {
    if (!board) return
    board.innerHTML = thumbs
      .map(
        ({ idx, data }) => `
      <div class="pageCard" data-idx="${idx}" style="outline-offset:-1px">
        <div class="pageCard__thumb">${data ? `<img class="pageCardImg" draggable="false" src="${data}" alt="page ${idx + 1}" />` : '<div class="pageCard__noimg">No Image</div>'}</div>
        <div class="pageCard__meta"><span class="badge">p.${physicalToLogicalPage(idx) + 1}</span><span class="badge badge--soft dpTag" style="min-width:0"></span></div>
      </div>`,
      )
      .join("")
    board.querySelectorAll(".pageCard").forEach((el) => {
      el.onclick = (ev) => {
        if (el.dataset.assigned === "1") {
          toast("このページは別の書類に確定済みです（チップの✕で取り消せます）")
          return
        }
        const idx = Number(el.getAttribute("data-idx"))
        const amap = assignedMap()
        if (ev.shiftKey && lastClicked >= 0) {
          const a = Math.min(lastClicked, idx)
          const b = Math.max(lastClicked, idx)
          for (let k = a; k <= b; k++) if (!amap.has(k)) selected.add(k)
        } else {
          if (selected.has(idx)) selected.delete(idx)
          else selected.add(idx)
          lastClicked = idx
        }
        applyVisual()
      }
    })
    applyVisual()
  }

  // サムネイルは一度だけ読み込む（base64で確実に表示）
  thumbs = await Promise.all(
    Array.from({ length: total }, (_, i) => i).map(async (idx) => {
      const pr = await api.get_preview_png_base64_page(idx)
      const data = pr?.ok ? String(pr.png_data || pr.png || "") : ""
      return { idx, data }
    }),
  )
  buildBoard()
  renderChips()
  updateSaveLabel()

  const confirmCurrent = () => {
    const label = String(nameInput?.value || "").trim()
    if (!label) {
      toast("書類名を入力してください")
      return false
    }
    if (!selected.size) {
      toast("ページを1つ以上選択してください")
      return false
    }
    pending.push({ label, pages: [...selected].sort((a, b) => a - b).map((p) => physicalToLogicalPage(p)) })
    selected.clear()
    lastClicked = -1
    if (nameInput) nameInput.value = ""
    renderChips()
    applyVisual()
    updateSaveLabel()
    if (nameInput) nameInput.focus()
    return true
  }

  const confirmBtn = $("#dpConfirm")
  if (confirmBtn) confirmBtn.onclick = () => confirmCurrent()

  const back = () => {
    closeBinderModal()
    renderBinderDetail()
  }
  $("#dpClose").onclick = back
  $("#dpCancel").onclick = back
  $("#dpSave").onclick = async () => {
    if (isNew) {
      // 入力途中（名前＋選択あり）なら自動で確定
      const hasDraft = String(nameInput?.value || "").trim() && selected.size
      if (hasDraft && !confirmCurrent()) return
      if (!pending.length) return toast("追加する書類がありません")
      for (const d of pending) {
        const s = { id: genId("s"), label: d.label, pages: d.pages, original_pages: [...d.pages], status: "todo" }
        state.sections = [...(state.sections || []), s]
        caseObj.section_ids = [...(caseObj.section_ids || []), s.id]
      }
    } else {
      const label = String(nameInput?.value || "").trim()
      if (!label) return toast("書類名を入力してください")
      if (!selected.size) return toast("ページを1つ以上選択してください")
      section.label = label
      assignSectionPages(
        section,
        [...selected].sort((a, b) => a - b).map((p) => physicalToLogicalPage(p)),
      )
    }
    await persistBinder()
    closeBinderModal()
    render()
    renderBinderDetail()
  }
}

// バインダーを丸ごと複製：ページ・配置・タグを別物として複製し、独立して修正できるようにする
async function duplicateBinder(caseObj) {
  if (!caseObj) return
  const api = window.pywebview?.api
  if (!api?.duplicate_binder) return toast("複製機能が見つかりません（最新版に更新してください）")
  const docCount = (caseObj.section_ids || []).filter((sid) => sectionById(sid)).length
  if (!docCount) return toast("このバインダーに書類がありません")
  const ok = await uiConfirm(
    `バインダー「${caseLabel(caseObj)}」を丸ごと複製します。\n\n` +
      `・${docCount}書類のページ（資料）を新しいページとしてコピー\n` +
      `・配置とタグもコピーし、タグ名の頭に番号（例: (2)）が付きます\n` +
      `・入力値もコピーされます\n\n` +
      `複製後は独立した別バインダーになり、修正しても元のバインダーや他の人の書類には影響しません。続けますか？`,
  )
  if (!ok) return
  try {
    showLoading("バインダーを複製しています…", "ページ・配置・タグをコピー中です")
    const r = await api.duplicate_binder(caseObj.id)
    if (!r?.ok) {
      hideLoading()
      const map = { no_documents: "このバインダーに書類がありません", binder_not_found: "バインダーが見つかりません" }
      return toast(`複製に失敗: ${map[r?.error] || r?.error || "unknown"}`)
    }
    await reloadProjectState()
    hideLoading()
    state.binderCaseFilter = r.case_id
    toast(`複製しました（タグ ${r.new_tags}件を ${r.prefix} で複製）`)
    render()
    renderBinderDetail()
    await showPage(Number(state.previewPageIndex || 0))
  } catch (e) {
    hideLoading()
    toast(`複製に失敗しました: ${e}`)
  }
}

// このバインダー構成（書類名＋ページ）を保存して次回流用できるようにする
async function saveBinderForReuse(caseObj) {
  const docs = (caseObj.section_ids || [])
    .map((sid) => {
      const s = sectionById(sid)
      return s ? { label: s.label || "", pages: sectionPages(s) } : null
    })
    .filter(Boolean)
  if (!docs.length) return toast("このバインダーに書類がありません")
  const name = await uiPrompt("流用名（次回この構成を呼び出せます）", caseLabel(caseObj))
  if (!name) return
  const entry = { id: genId("b"), kind: "binder", name: String(name), docs }
  try {
    const r = await window.pywebview?.api?.save_doc_preset?.(entry)
    if (r?.ok) {
      state.presets = Array.isArray(r.presets) ? r.presets : [...(state.presets || []), entry]
      toast("流用用に保存しました")
    } else {
      toast(`保存に失敗: ${r?.error || "unknown"}`)
    }
  } catch (e) {
    toast(`保存に失敗: ${e}`)
  }
}

// 過去バインダーの流用ピッカー
async function openBinderReusePicker() {
  await loadPresets()
  const modal = $("#modal")
  if (!modal) return
  const saved = (state.presets || []).filter((p) => p && Array.isArray(p.docs))
  const rows = saved.length
    ? saved
        .map(
          (p) => `
      <div class="binderRow" style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:6px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.name || "(無題)")}</div>
          <div style="font-size:12px;color:#64748b">書類 ${(p.docs || []).length}件</div>
        </div>
        <button class="btn btn--primary" data-reuse="${escapeHtml(p.id)}" style="padding:6px 12px">この構成で作成</button>
        <button class="btn btn--soft" data-reuse-del="${escapeHtml(p.id)}" style="padding:6px 8px" title="保存済み構成を削除">🗑</button>
      </div>`,
        )
        .join("")
    : `<div style="color:#64748b;padding:14px;text-align:center">保存済みのバインダー構成がありません。<br>バインダーを開いて「流用保存」すると、ここに表示されます。</div>`

  modal.style.display = "block"
  modal.innerHTML = `
    <div class="modal__backdrop" id="reuseClose"></div>
    <div class="modal__card" style="max-width:560px;width:92vw;max-height:88vh;display:flex;flex-direction:column">
      <div class="modal__title" style="display:flex;align-items:center;gap:10px">
        <button class="btn btn--soft" id="reuseBack" style="padding:4px 10px">← 一覧</button>
        <span style="flex:1">過去のバインダーを流用</span>
      </div>
      <div class="label" style="margin-bottom:8px">保存済みの書類構成（名前＋ページ）から新しいバインダーを作ります。ページ番号はそのまま引き継ぎます（必要なら後で各書類の✎で調整できます）。</div>
      <div style="overflow:auto;flex:1;min-height:120px">${rows}</div>
    </div>`

  $("#reuseClose").onclick = closeBinderModal
  $("#reuseBack").onclick = () => renderBinderHome()
  modal.querySelectorAll("[data-reuse]").forEach((el) => {
    el.onclick = async () => {
      const p = saved.find((x) => x.id === el.getAttribute("data-reuse"))
      if (!p) return
      await applyReuseBinder(p)
    }
  })
  modal.querySelectorAll("[data-reuse-del]").forEach((el) => {
    el.onclick = async () => {
      const id = el.getAttribute("data-reuse-del")
      const ok = await uiConfirm("この保存済み構成を削除しますか？")
      if (!ok) return
      try {
        const r = await window.pywebview?.api?.delete_doc_preset?.(id)
        if (r?.ok) state.presets = Array.isArray(r.presets) ? r.presets : (state.presets || []).filter((x) => x.id !== id)
      } catch {}
      openBinderReusePicker()
    }
  })
}

async function applyReuseBinder(entry) {
  const name = await uiPrompt("新しいバインダー名", entry.name || "")
  if (!name) return
  const c = { id: genId("c"), label: String(name), section_ids: [] }
  for (const d of entry.docs || []) {
    const pages = (Array.isArray(d.pages) ? d.pages : []).map(Number).filter((p) => p >= 0 && !isLogicalPageDeleted(p))
    const s = { id: genId("s"), label: String(d.label || ""), pages, status: "todo" }
    state.sections = [...(state.sections || []), s]
    c.section_ids.push(s.id)
  }
  state.cases = [...(state.cases || []), c]
  state.binderCaseFilter = c.id
  await persistBinder()
  render()
  renderBinderDetail()
}

function openNoteEditor(note) {
  const modal = $("#modal")
  if (!modal) return
  const isNew = !note.id
  const close = () => {
    modal.style.display = "none"
    modal.innerHTML = ""
  }
  modal.style.display = "block"
  modal.innerHTML = `
    <div class="modal__backdrop" id="noteClose"></div>
    <div class="modal__card" style="max-width:420px">
      <div class="modal__title">${isNew ? "付箋を追加" : "付箋を編集"}</div>
      <div class="field">
        <div class="label">種類</div>
        <div class="row" id="noteKindRow" style="gap:6px">
          ${NOTE_KINDS.map(
            (k) => `<button type="button" class="btn ${k.id === (note.kind || "question") ? "btn--primary" : "btn--soft"}" data-kind="${k.id}" style="flex:1">${k.icon} ${escapeHtml(k.label)}</button>`,
          ).join("")}
        </div>
      </div>
      <div class="field">
        <div class="label">内容</div>
        <textarea class="textarea" id="noteText" rows="3" placeholder="例：在留期限が未確認。本人に要確認">${escapeHtml(note.text || "")}</textarea>
      </div>
      <div class="row" style="gap:8px;margin-top:10px">
        ${!isNew ? `<button class="btn btn--soft" id="noteDelete" style="padding:8px 12px">削除</button>` : ""}
        ${!isNew && !note.resolved ? `<button class="btn btn--soft" id="noteResolve" style="padding:8px 12px">解決済みに</button>` : ""}
        <div style="flex:1"></div>
        <button class="btn btn--soft" id="noteCancel" style="padding:8px 12px">キャンセル</button>
        <button class="btn btn--primary" id="noteSave" style="padding:8px 16px">保存</button>
      </div>
    </div>`

  let kind = note.kind || "question"
  modal.querySelectorAll("#noteKindRow [data-kind]").forEach((b) => {
    b.onclick = () => {
      kind = b.getAttribute("data-kind")
      modal.querySelectorAll("#noteKindRow [data-kind]").forEach((x) => {
        x.classList.toggle("btn--primary", x === b)
        x.classList.toggle("btn--soft", x !== b)
      })
    }
  })

  $("#noteClose").onclick = close
  $("#noteCancel").onclick = close

  const saveBtn = $("#noteSave")
  if (saveBtn) saveBtn.onclick = async () => {
    const text = String($("#noteText")?.value || "").trim()
    if (isNew) {
      const n = {
        id: genId("n"),
        page: Number(note.page || 0),
        x: Number(note.x || 0),
        y: Number(note.y || 0),
        section_id: sectionForPage(Number(note.page || 0))?.id || null,
        text,
        kind,
        resolved: false,
      }
      state.notes = [...(state.notes || []), n]
    } else {
      note.text = text
      note.kind = kind
    }
    await persistBinder()
    close()
    render()
    drawOverlay()
  }

  const delBtn = $("#noteDelete")
  if (delBtn) delBtn.onclick = async () => {
    state.notes = (state.notes || []).filter((x) => x.id !== note.id)
    await persistBinder()
    close()
    render()
    drawOverlay()
  }

  const resBtn = $("#noteResolve")
  if (resBtn) resBtn.onclick = async () => {
    note.resolved = true
    await persistBinder()
    close()
    render()
    drawOverlay()
  }
}

function notePinHit(pt) {
  const page = physicalToLogicalPage(Number(state.previewPageIndex || 0))
  const r = 16
  for (const n of (state.notes || []).filter((x) => !isBinderMetaNote(x) && Number(x.page || 0) === page)) {
    const dx = Number(n.x || 0) - pt.x
    const dy = Number(n.y || 0) - pt.y
    // approximate in page-pixel space; tolerance scaled by font-ish size
    if (Math.abs(dx) <= r * 3 && Math.abs(dy) <= r * 3) return n
  }
  return null
}

function openPlacePalette(pt, editFid = null) {
  const modal = $("#modal")
  if (!modal) return
  const close = () => {
    try {
      window.__inputstudio_refreshTagQuick = null
    } catch {}
    modal.style.display = "none"
    modal.innerHTML = ""
  }
  const pageIdx = Number.isFinite(state.previewPageIndex) ? state.previewPageIndex : 0
  const isEdit = !!editFid
  const currentPl = isEdit ? (state.placements?.[editFid] || {}) : {}
  const defaultFs = Number(currentPl.font_size || state.defaultFontSize || 14) || 14
  const curColor = String(currentPl.color || "#0f172a")
  const curLH = Number(currentPl.line_height || 1.2) || 1.2
  const curLS = Number(currentPl.letter_spacing ?? DEFAULT_LETTER_SPACING) || DEFAULT_LETTER_SPACING
  let writingMode = String(currentPl.writing_mode || "horizontal")
  const tagsOptions = state.tags.map((t) => `<option value="${escapeHtml(t)}"></option>`).join("")
  modal.style.display = "block"
  modal.innerHTML = `
    <div class="modal__backdrop" id="modalClose"></div>
    <div class="modal__card modal__card--anchored" id="paletteCard" style="max-width:520px">
      <div class="modal__title">${isEdit ? "要素を編集" : "PDFに配置（ダブルクリック）"}</div>
      <div class="label">${isEdit ? "選択中の要素の値・見た目を調整します。" : "タグ一覧でクリックして選択するか、タグ名を直接入力して配置します。"}</div>
      <div class="field" style="margin-top:8px">
        <div class="label">タグ</div>
        <input class="input" id="pTag" ${isEdit ? "" : 'list="paletteTagList"'} placeholder="タグ名（検索・候補選択 or 新規入力）" ${isEdit ? "disabled" : ""} />
        ${isEdit ? "" : `<datalist id="paletteTagList">${tagsOptions}</datalist>`}
      </div>
      <div class="field">
        <div class="label">値</div>
        <textarea class="textarea" id="pVal" rows="3" placeholder="ここに値を入力（Enterで改行）"></textarea>
      </div>
      <div class="row">
        <div class="field" style="width:160px">
          <div class="label">サイズ</div>
          <div class="spin">
            <input class="input" id="pSize" inputmode="numeric" value="${defaultFs}" />
            <div class="spin__btns">
              <button class="spin__btn" id="pSizeUp" type="button">▲</button>
              <button class="spin__btn" id="pSizeDown" type="button">▼</button>
            </div>
          </div>
        </div>
        <div class="field" style="width:200px">
          <div class="label">縦書き/横書き</div>
          <div class="row" style="gap:8px">
            <button class="btn btn--soft" id="pWmH" type="button">横書</button>
            <button class="btn btn--soft" id="pWmV" type="button">縦書</button>
          </div>
        </div>
        <div class="field" style="width:180px">
          <div class="label">色</div>
          <div class="colorPicker">
            <div class="swatches" id="pSwatches"></div>
            <input class="input" id="pColor" value="${escapeHtml(curColor)}" readonly />
          </div>
        </div>
        <div class="field" style="width:120px">
          <div class="label">ページ</div>
          <input class="input" id="pPage" inputmode="numeric" value="${pageIdx + 1}" />
        </div>
      </div>
      <div class="row">
        <div class="field" style="width:160px">
          <div class="label">行間</div>
          <div class="spin">
            <input class="input" id="pLineH" inputmode="decimal" value="${curLH}" />
            <div class="spin__btns">
              <button class="spin__btn" id="pLineHUp" type="button">▲</button>
              <button class="spin__btn" id="pLineHDown" type="button">▼</button>
            </div>
          </div>
        </div>
        <div class="field" style="width:160px">
          <div class="label">字間</div>
          <div class="spin">
            <input class="input" id="pLetterS" inputmode="decimal" value="${curLS}" />
            <div class="spin__btns">
              <button class="spin__btn" id="pLetterSUp" type="button">▲</button>
              <button class="spin__btn" id="pLetterSDown" type="button">▼</button>
            </div>
          </div>
        </div>
        <div class="field" style="flex:1">
          <div class="label">座標 (x,y)</div>
          <input class="input" id="pPos" value="${Math.round(pt.x)}, ${Math.round(pt.y)}" disabled />
        </div>
      </div>
      <div class="row" style="margin-top:10px; justify-content:flex-end">
        ${isEdit ? `<button class="btn btn--danger" id="pDelete">削除</button>` : ""}
        <button class="btn" id="pCancel">キャンセル</button>
        <button class="btn btn--primary" id="pSave">${isEdit ? "更新" : "配置"}</button>
      </div>
    </div>
    <div class="modal__card modal__card--anchored" id="tagCard" style="max-width:520px; width:520px">
      <div class="modal__title">タグ一覧（同期）</div>
      <div class="label">同じタグの値は、このプロジェクト内の全ページ・全要素で同期します。</div>
      <div class="field" style="margin-top:8px">
        <div class="label">検索</div>
        <input class="input" id="tagSearch" placeholder="例）氏名 / 住所 / 金額 …" />
      </div>
      <div class="badge badge--soft" style="margin-top:8px">タグ名をクリックで選択 → 値は即反映</div>
      <div class="tagPane" id="tagQuickPane" style="margin-top:10px; max-height: calc(100vh - 220px)"></div>
    </div>
    <div class="modal__card modal__card--anchored paletteGuideCard" id="paletteGuideCard" style="max-width:420px; width:min(420px, calc(100vw - 40px))">
      <div class="paletteGuideCard__title">配置のコツ</div>
      <div class="paletteGuideCard__text">タグ名と値を入力して配置しよう。タグ一覧のタグをクリックすると既存タグを呼び出せます。同じタグはまとめて値を編集できます。</div>
    </div>
  `
  const original = isEdit
    ? {
        fid: String(editFid),
        pl: { ...(state.placements?.[editFid] || {}) },
        val: String(state.values?.[String((state.placements?.[editFid] || {}).tag || "")] || ""),
      }
    : null
  let liveDirty = false
  let liveTimer = null

  const revertLive = async () => {
    if (!original) return
    try {
      const fid = original.fid
      const pl = original.pl || {}
      const x = Number(pl.x || 0)
      const y = Number(pl.y || 0)
      const page = Number(pl.page || 0)
      const tag = String(pl.tag || "").trim()
      const fontSize = Number(pl.font_size || 14) || 14
      const color = String(pl.color || "#0f172a")
      const lineH = Number(pl.line_height || 1.2) || 1.2
      const letterS = Number(pl.letter_spacing ?? DEFAULT_LETTER_SPACING) || DEFAULT_LETTER_SPACING
      const writingMode0 = String(pl.writing_mode || "horizontal")
      state.placements[fid] = { ...(state.placements?.[fid] || {}), tag, page, x, y, font_size: fontSize, color, line_height: lineH, letter_spacing: letterS }
      if (tag) state.values[tag] = String(original.val || "")
      if (window.pywebview?.api?.update_placement) {
        await window.pywebview.api.update_placement(fid, { tag, page, x, y, font_size: fontSize, color, line_height: lineH, letter_spacing: letterS, writing_mode: writingMode0 })
      } else {
        await window.pywebview.api.set_element_pos?.(fid, x, y)
      }
      if (tag) await window.pywebview.api.set_value?.(tag, String(original.val || ""))
      await showPage(page)
    } catch {}
  }

  const closeMaybe = async () => {
    if (isEdit && liveDirty) await revertLive()
    close()
  }

  $("#modalClose").onclick = closeMaybe
  $("#pCancel").onclick = closeMaybe
  const tagInput = $("#pTag")
  const valInput = $("#pVal")
  const sizeInput = $("#pSize")
  const wmHBtn = $("#pWmH")
  const wmVBtn = $("#pWmV")
  const colorInput = $("#pColor")
  const lineHInput = $("#pLineH")
  const letterSInput = $("#pLetterS")
  const pageInput = $("#pPage")
  const card = $("#paletteCard")
  const tagCard = $("#tagCard")
  const guideCard = $("#paletteGuideCard")
  const tagQuickPane = $("#tagQuickPane")
  const tagSearch = $("#tagSearch")

  const applyTagPickToPaletteFields = (t) => {
    const tag = String(t || "").trim()
    if (!tag) return
    if (tagInput) tagInput.value = tag
    if (valInput) valInput.value = String((state.values?.[tag] || "")).replaceAll("<br>", "\n")
  }
  if (!isEdit && tagInput) {
    const syncPaletteValueFromTag = () => {
      const t = String(tagInput.value || "").trim()
      if (!t || !state.tags.includes(t)) return
      if (valInput) valInput.value = String((state.values?.[t] || "")).replaceAll("<br>", "\n")
    }
    tagInput.addEventListener("change", syncPaletteValueFromTag)
    tagInput.addEventListener("blur", syncPaletteValueFromTag)
    // datalist 選択や入力確定が change を飛ばす環境向け：既存タグ名と一致したら即値欄へ転記
    tagInput.addEventListener("input", syncPaletteValueFromTag)
    tagInput.addEventListener("compositionend", syncPaletteValueFromTag)
    tagInput.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" || ev.shiftKey) return
      ev.preventDefault()
      syncPaletteValueFromTag()
      if (valInput) {
        try {
          valInput.focus({ preventScroll: true })
        } catch {
          valInput.focus()
        }
      }
    })
  }

  const setWritingMode = (m) => {
    writingMode = (String(m) === "vertical") ? "vertical" : "horizontal"
    if (wmHBtn) wmHBtn.classList.toggle("is-selected", writingMode === "horizontal")
    if (wmVBtn) wmVBtn.classList.toggle("is-selected", writingMode === "vertical")
    // live preview: reflect into placement box sizing
    if (isEdit && editFid && state.placements?.[editFid]) {
      state.placements[editFid] = { ...(state.placements[editFid] || {}), writing_mode: writingMode }
      drawOverlay()
    }
  }
  if (wmHBtn) wmHBtn.onclick = () => setWritingMode("horizontal")
  if (wmVBtn) wmVBtn.onclick = () => setWritingMode("vertical")
  setWritingMode(writingMode)

  // 2つのパレットが重なる場合：操作している方を前面にする
  const bringToFront = (which) => {
    if (!card || !tagCard) return
    const top = 90
    const under = 89
    if (which === "tag") {
      tagCard.style.zIndex = String(top)
      card.style.zIndex = String(under)
    } else {
      card.style.zIndex = String(top)
      tagCard.style.zIndex = String(under)
    }
  }
  bringToFront("palette")
  if (card) {
    card.addEventListener("pointerdown", () => bringToFront("palette"), { passive: true })
    card.addEventListener("focusin", () => bringToFront("palette"))
  }
  if (tagCard) {
    tagCard.addEventListener("pointerdown", () => bringToFront("tag"), { passive: true })
    tagCard.addEventListener("focusin", () => bringToFront("tag"))
  }

  // 色パレット（選択式）
  const sw = $("#pSwatches")
  if (sw) {
    const colors = [
      "#0f172a",
      "#ffffff",
      "#141726",
      "#64748b",
      "#7c5cff",
      "#5ad7ff",
      "#ff6aa2",
      "#ff4d6d",
      "#22c55e",
      "#ffd36a",
      "#7cffb2",
    ]
    const norm = (s) => String(s || "").trim().toLowerCase()
    const applySelected = () => {
      const cur = norm(colorInput?.value)
      for (const el of sw.querySelectorAll(".swatch")) {
        el.classList.toggle("is-selected", norm(el.dataset.color) === cur)
      }
    }
    sw.innerHTML = ""
    colors.forEach((c) => {
      const b = document.createElement("button")
      b.type = "button"
      b.className = "swatch"
      const lc = norm(c)
      if (lc === "#ffffff" || lc === "#fff") {
        b.classList.add("swatch--light")
        b.title = "白 #FFFFFF"
      }
      b.dataset.color = c
      b.style.background = c
      b.onclick = () => {
        if (colorInput) {
          colorInput.value = c
          colorInput.dispatchEvent(new Event("input", { bubbles: true }))
        }
        applySelected()
      }
      sw.appendChild(b)
    })
    applySelected()
  }

  // 上下ボタンで微調整（現場では“数字→感覚”が作れないのでボタン中心に）
  const bindSpin = (inputEl, upEl, downEl, step, minV = null, maxV = null, digits = null) => {
    if (!inputEl) return
    const toNum = () => {
      const v = Number(String(inputEl.value || "").trim())
      return Number.isFinite(v) ? v : 0
    }
    const setNum = (v) => {
      let x = v
      if (typeof minV === "number") x = Math.max(minV, x)
      if (typeof maxV === "number") x = Math.min(maxV, x)
      if (typeof digits === "number") x = Number(x.toFixed(digits))
      inputEl.value = String(x)
    }
    const bump = (dir) => {
      setNum(toNum() + dir * step)
      inputEl.dispatchEvent(new Event("input", { bubbles: true }))
    }
    if (upEl) upEl.onclick = () => bump(+1)
    if (downEl) downEl.onclick = () => bump(-1)
  }
  bindSpin(sizeInput, $("#pSizeUp"), $("#pSizeDown"), 1, 6, 96, 0)
  bindSpin(lineHInput, $("#pLineHUp"), $("#pLineHDown"), 0.1, 0.6, 3.0, 1)
  bindSpin(letterSInput, $("#pLetterSUp"), $("#pLetterSDown"), 0.5, -5, 30, 1)

  // 編集中は「変更した瞬間にプレビューへ反映」する（微調整が主運用のため）
  const scheduleLive = () => {
    if (!isEdit) return
    liveDirty = true
    if (liveTimer) clearTimeout(liveTimer)
    liveTimer = setTimeout(async () => {
      try {
        const fid = String(editFid)
        const raw = (valInput?.value || "").replaceAll("\r\n", "\n")
        const val = raw.replaceAll("\n", "<br>")
        const fontSize = Number(sizeInput?.value || "14") || 14
        state.defaultFontSize = fontSize
        window.pywebview?.api?.update_admin_settings?.({ default_font_size: fontSize })
        const color = String(colorInput?.value || "#0f172a").trim() || "#0f172a"
        const lineH = Number(lineHInput?.value || "1.2") || 1.2
        const letterS = Number(letterSInput?.value || "0") || 0
        const page = Math.max(0, (Number(pageInput?.value || "1") || 1) - 1)
        const pl0 = state.placements?.[fid] || currentPl || {}
        const tag = String(tagInput?.value || pl0.tag || "").trim()
        const x = Number(pl0.x || 0)
        const y = Number(pl0.y || 0)
        state.placements[fid] = { ...(pl0 || {}), tag, page, x, y, font_size: fontSize, color, line_height: lineH, letter_spacing: letterS }
        if (tag) state.values[tag] = val
        if (window.pywebview?.api?.update_placement) {
          await window.pywebview.api.update_placement(fid, { tag, page, x, y, font_size: fontSize, color, line_height: lineH, letter_spacing: letterS })
        } else {
          await window.pywebview.api.set_element_pos?.(fid, x, y)
        }
        if (tag) await window.pywebview.api.set_value?.(tag, val)
        await showPage(page)
      } catch {}
    }, 120)
  }
  const onPaletteValInput = () => {
    const tag = String(tagInput?.value || "").trim()
    if (tag) markTagReuseReviewEdited(tag)
    if (isEdit) scheduleLive()
  }
  valInput?.addEventListener("input", onPaletteValInput)
  if (isEdit) {
    sizeInput?.addEventListener("input", scheduleLive)
    lineHInput?.addEventListener("input", scheduleLive)
    letterSInput?.addEventListener("input", scheduleLive)
    pageInput?.addEventListener("input", scheduleLive)
    colorInput?.addEventListener("input", scheduleLive)
  }

  // パレットを“要素に被らず”かつ“PDF表示領域内”に収める
  const positionPalette = () => {
    if (!card) return
    const img = $("#previewImg")
    if (!img || !img.parentElement) return
    const stage = img.parentElement.getBoundingClientRect() // PDF表示枠（白余白含む）
    const content = getRenderedContentRect(img, state.pageW, state.pageH) // 実PDF領域
    const pad = 10
    const margin = 12

    // 最大高さを枠に合わせる（はみ出し防止）
    const maxH = Math.max(240, Math.floor(stage.height - pad * 2))
    card.style.maxHeight = `${maxH}px`
    card.style.overflow = "auto"

    // anchor rect（編集時は要素サイズを推定、配置時はクリック点）
    let ax = content.left + (pt.x / state.pageW) * content.width
    let ay = content.top + (pt.y / state.pageH) * content.height
    let aw = 1
    let ah = 1
    if (isEdit && editFid) {
      const pl = state.placements?.[editFid] || {}
      const fs = Number(pl.font_size || 14) || 14
      const v = String((state.values?.[String(pl.tag || "")] || "")).replaceAll("<br>", "\n")
      const lines = v ? v.split("\n") : [String(pl.tag || "")]
      const longest = Math.max(...lines.map((s) => s.length), 1)
      const lh = Number(pl.line_height || 1.2) || 1.2
      const ls = Number(pl.letter_spacing ?? DEFAULT_LETTER_SPACING) || DEFAULT_LETTER_SPACING
      const wPage = Math.max(42, longest * (fs * 0.62 + ls))
      const hPage = Math.max(22, lines.length * fs * lh)
      ax = content.left + (Number(pl.x || pt.x) / state.pageW) * content.width
      ay = content.top + (Number(pl.y || pt.y) / state.pageH) * content.height
      aw = (wPage / state.pageW) * content.width
      ah = (hPage / state.pageH) * content.height
    }

    const rect = () => card.getBoundingClientRect()
    const cw = rect().width
    const ch = rect().height
    const el = { left: ax, top: ay, width: aw, height: ah }

    // Keep palette visible even when stage is partially outside viewport.
    const viewport = {
      left: pad,
      top: pad,
      right: Math.max(pad, window.innerWidth - pad),
      bottom: Math.max(pad, window.innerHeight - pad),
    }
    const bounds = {
      left: Math.max(stage.left + pad, viewport.left),
      top: Math.max(stage.top + pad, viewport.top),
      right: Math.min(stage.right - pad, viewport.right),
      bottom: Math.min(stage.bottom - pad, viewport.bottom),
    }
    if (bounds.right - bounds.left < 40 || bounds.bottom - bounds.top < 40) {
      bounds.left = viewport.left
      bounds.top = viewport.top
      bounds.right = viewport.right
      bounds.bottom = viewport.bottom
    }

    const fit = (l, t) =>
      l >= bounds.left &&
      t >= bounds.top &&
      l + cw <= bounds.right &&
      t + ch <= bounds.bottom

    const clamp = (l, t) => {
      const ll = Math.min(Math.max(l, bounds.left), bounds.right - cw)
      const tt = Math.min(Math.max(t, bounds.top), bounds.bottom - ch)
      return { l: ll, t: tt }
    }

    const candidates = [
      { l: el.left + el.width + margin, t: el.top }, // 右
      { l: el.left - cw - margin, t: el.top }, // 左
      { l: el.left, t: el.top + el.height + margin }, // 下
      { l: el.left, t: el.top - ch - margin }, // 上
    ]

    let pos = null
    for (const c of candidates) {
      if (fit(c.l, c.t)) {
        pos = c
        break
      }
    }
    if (!pos) pos = clamp(el.left + el.width + margin, el.top)
    else pos = clamp(pos.l, pos.t)

    // もし要素と重なりそうなら、少しずらす（最低限）
    const overlaps =
      pos.l < el.left + el.width &&
      pos.l + cw > el.left &&
      pos.t < el.top + el.height &&
      pos.t + ch > el.top
    if (overlaps) {
      const alt = clamp(el.left - cw - margin, el.top)
      pos = alt
    }

    card.style.left = `${Math.round(pos.l)}px`
    card.style.top = `${Math.round(pos.t)}px`
    // Place tagCard near paletteCard within stage (same size feeling)
    if (tagCard) {
      const r1 = card.getBoundingClientRect()
      const w2 = tagCard.getBoundingClientRect().width || 520
      const h2 = tagCard.getBoundingClientRect().height || 420
      const fit = (l, t) =>
        l >= bounds.left &&
        t >= bounds.top &&
        l + w2 <= bounds.right &&
        t + h2 <= bounds.bottom
      const clamp = (l, t) => {
        const ll = Math.min(Math.max(l, bounds.left), bounds.right - w2)
        const tt = Math.min(Math.max(t, bounds.top), bounds.bottom - h2)
        return { l: ll, t: tt }
      }
      const cands = [
        { l: r1.right + margin, t: r1.top },
        { l: r1.left - w2 - margin, t: r1.top },
        { l: r1.left, t: r1.bottom + margin },
        { l: r1.left, t: r1.top - h2 - margin },
      ]
      let p2 = null
      for (const c of cands) {
        if (fit(c.l, c.t)) {
          p2 = c
          break
        }
      }
      if (!p2) p2 = clamp(r1.right + margin, r1.top)
      else p2 = clamp(p2.l, p2.t)
      tagCard.style.left = `${Math.round(p2.l)}px`
      tagCard.style.top = `${Math.round(p2.t)}px`
    }
    // Keep guide popup at bottom-left inside visible stage area.
    if (guideCard) {
      const w3 = guideCard.getBoundingClientRect().width || 380
      const h3 = guideCard.getBoundingClientRect().height || 120
      const gLeft = Math.min(Math.max(bounds.left + 8, bounds.left), Math.max(bounds.left, bounds.right - w3 - 8))
      const gTop = Math.min(Math.max(bounds.top + 8, bounds.top), Math.max(bounds.top, bounds.bottom - h3 - 8))
      guideCard.style.left = `${Math.round(gLeft)}px`
      guideCard.style.top = `${Math.round(gTop)}px`
    }
  }
  requestAnimationFrame(() => {
    positionPalette()
    setTimeout(positionPalette, 0)
  })

  if (tagInput) tagInput.focus()
  if (isEdit) {
    try {
      tagInput.value = String((currentPl.tag || "")).trim()
      valInput.value = String((state.values?.[String(currentPl.tag || "")] || "")).replaceAll("<br>", "\n")
      pageInput.value = String((Number(currentPl.page || pageIdx) || 0) + 1)
    } catch {}
  }

  const normalizeText = (s) => String(s || "").replaceAll("<br>", "\n").trim().toLowerCase()
  const getFilteredTags = (qRaw) => {
    const q = normalizeText(qRaw)
    const tags = state.tags || []
    if (!q) return [...tags]
    return tags.filter((t) => {
      const tt = normalizeText(t)
      const vv = normalizeText(state.values?.[t] || "")
      return tt.includes(q) || vv.includes(q)
    })
  }

  // ---- Tag quick palette (edit values / select tag to place) ----
  const renderTagQuick = () => {
    if (!tagQuickPane) return
    const q = String(tagSearch?.value || "")
    const tags = getFilteredTags(q)
    const currentTag = String(tagInput?.value || "").trim()
    tagQuickPane.innerHTML = `
      <div class="badge">タグ一覧</div>
      <div class="badge badge--soft">${tags.length} 件</div>
      <div class="list" id="tagQuickList"></div>
    `
    const list = $("#tagQuickList")
    if (!list) return
    tags.forEach((t, i) => {
      const row = document.createElement("div")
      row.className = "row"
      row.style.alignItems = "center"
      row.style.gap = "10px"
      const v = String((state.values?.[t] || "")).replaceAll("<br>", "\n")
      row.innerHTML = `
        <button type="button" class="btn btn--soft tagNameBtn" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>
        <input class="input" data-tag="${escapeHtml(t)}" placeholder="値…" value="${escapeHtml(v)}">
      `
      const name = row.querySelector(".tagNameBtn")
      const inp = row.querySelector("input")
      if (name) {
        const pending = !!(state.reviewReuseActive && state.reviewReusePending && state.reviewReusePending.has(t))
        if (pending) {
          name.style.color = "#dc2626"
          name.style.fontWeight = "850"
        } else {
          name.style.removeProperty("color")
          name.style.removeProperty("fontWeight")
        }
        name.onclick = () => {
          applyTagPickToPaletteFields(t)
          try {
            const chips = tagQuickPane.querySelectorAll("[data-tag]")
            chips.forEach((el) => el.classList.remove("is-selected"))
          } catch {}
          renderTagQuick()
        }
      }
      if (inp) {
        if (t === currentTag) inp.style.boxShadow = "0 0 0 5px rgba(124,92,255,.12)"
        let timer = null
        inp.addEventListener("input", () => {
          markTagReuseReviewEdited(t)
          const raw = String(inp.value || "").replaceAll("\r\n", "\n")
          const val = raw.replaceAll("\n", "<br>")
          state.values[t] = val
          if (timer) clearTimeout(timer)
          timer = setTimeout(async () => {
            try {
              await window.pywebview.api.set_value(t, val)
              await showPage(state.previewPageIndex || 0)
            } catch {}
          }, 120)
        })
        inp.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" && !ev.shiftKey) {
            ev.preventDefault()
            const next = list.querySelectorAll("input")[i + 1]
            if (next) next.focus()
          }
        })
      }
      list.appendChild(row)
    })
  }
  if (tagSearch) {
    tagSearch.addEventListener("input", () => renderTagQuick())
    tagSearch.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" || ev.shiftKey) return
      const qRaw = String(tagSearch.value || "")
      const tags = getFilteredTags(qRaw)
      if (!tags.length) return
      const q = normalizeText(qRaw)
      let pick = null
      if (tags.length === 1) {
        pick = tags[0]
      } else if (q) {
        pick = tags.find((t) => normalizeText(t) === q) || null
      }
      // 複数ヒット時も、フィルタ先頭を Enter で確定（検索→キーボードでタグ・値欄へ）
      if (!pick) pick = tags[0]
      ev.preventDefault()
      applyTagPickToPaletteFields(pick)
      if (valInput) {
        valInput.focus()
        try {
          const len = String(valInput.value || "").length
          valInput.setSelectionRange(len, len)
        } catch {}
      }
      renderTagQuick()
    })
  }
  renderTagQuick()
  window.__inputstudio_refreshTagQuick = renderTagQuick

  const save = async () => {
    const tag = (tagInput?.value || "").trim()
    if (!tag) {
      await uiAlert("タグを入れてください")
      return
    }
    const raw = (valInput?.value || "").replaceAll("\r\n", "\n")
    const val = raw.replaceAll("\n", "<br>")
    const fontSize = Number(sizeInput?.value || "14") || 14
    state.defaultFontSize = fontSize
    window.pywebview?.api?.update_admin_settings?.({ default_font_size: fontSize })
    const color = String(colorInput?.value || "#0f172a").trim() || "#0f172a"
    const lineH = Number(lineHInput?.value || "1.2") || 1.2
    const letterS = Number(letterSInput?.value || "0") || 0
    const page = Math.max(0, (Number(pageInput?.value || "1") || 1) - 1)
    try {
      // Ensure tag exists in list (for tag pane)
      if (!state.tags.includes(tag)) state.tags.push(tag)

      let fid = isEdit ? String(editFid) : null
      if (!isEdit) {
        // Always create a new element (same tag can be placed multiple times).
        let r = await window.pywebview.api.add_text_field(tag, page, pt.x, pt.y, fontSize)
        if (!r.ok && r.error === "no_project" && state.projectPath && window.pywebview.api.load_project) {
          try {
            await window.pywebview.api.load_project(state.projectPath)
            r = await window.pywebview.api.add_text_field(tag, page, pt.x, pt.y, fontSize)
          } catch {}
        }
        if (!r.ok) {
          await uiAlert(`追加に失敗: ${r.error || "unknown"}`)
          return
        }
        fid = r.fid
        state.placements[fid] = { tag, page, x: pt.x, y: pt.y, font_size: fontSize, color, line_height: lineH, letter_spacing: letterS, writing_mode: writingMode }
        if (window.pywebview?.api?.update_placement) {
          await window.pywebview.api.update_placement(fid, { writing_mode: writingMode })
        }
      } else {
        // Update existing element
        if (!fid) {
          await uiAlert("要素IDが不明です")
          return
        }
        state.placements[fid] = { ...(state.placements[fid] || {}), tag, page, x: pt.x, y: pt.y, font_size: fontSize, color, line_height: lineH, letter_spacing: letterS, writing_mode: writingMode }
        if (window.pywebview?.api?.update_placement) {
          await window.pywebview.api.update_placement(fid, { tag, page, x: pt.x, y: pt.y, font_size: fontSize, color, line_height: lineH, letter_spacing: letterS, writing_mode: writingMode })
        } else {
          await window.pywebview.api.set_element_pos(fid, pt.x, pt.y)
        }
      }

      state.values[tag] = val
      let sv = await window.pywebview.api.set_value(tag, val)
      if (sv && sv.ok === false && sv.error === "no_project" && state.projectPath && window.pywebview.api.load_project) {
        try {
          await window.pywebview.api.load_project(state.projectPath)
          await window.pywebview.api.set_value(tag, val)
        } catch {}
      }
      state.selectKeys = fid ? [fid] : []
      state.idx = Math.max(0, state.tags.indexOf(tag))
      await window.pywebview.api.save_current_project(false)
      await showPage(page)
      render()
      close()
    } catch (e) {
      await uiAlert(`配置に失敗: ${e}`)
    }
  }
  $("#pSave").onclick = save
  const del = $("#pDelete")
  if (del) del.onclick = async () => {
    const ok = await uiConfirm(tr("dialog.deleteElement", "この要素を削除しますか？（Undoで戻せます）"))
    if (!ok) return
    const before = snapshotProject()
    const fid = String(editFid)
    delete state.placements[fid]
    state.selectKeys = state.selectKeys.filter((k) => k !== fid)
    pushUndo(before)
    if (window.pywebview?.api?.delete_elements) await window.pywebview.api.delete_elements?.([fid])
    else await window.pywebview.api.set_project_payload?.({ tags: state.tags, values: state.values, placements: state.placements })
    await window.pywebview.api.save_current_project?.(false)
    showPage(state.previewPageIndex || 0)
    render()
    close()
  }
  valInput?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && ev.metaKey) {
      ev.preventDefault()
      save()
    }
  })
}

async function focusDesignKey(refreshPreview = true) {
  if (!state.designKey) return
  const info = await window.pywebview.api.get_element_info(state.designKey)
  if (info.ok) {
    const pos = $("#dPos")
    if (pos) pos.textContent = `x:${Math.round(info.x)} y:${Math.round(info.y)}`
    state.pageW = info.page_display_width || state.pageW
    state.pageH = info.page_display_height || state.pageH
    state.designPos = { x: info.x, y: info.y }
  }
  if (refreshPreview) await queuePreview(state.designKey)
  drawOverlay()
}

function drawOverlay() {
  const ov = $("#overlay")
  const img = $("#previewImg")
  if (!ov) return
  const ctx = ov.getContext("2d")
  const rect = ov.getBoundingClientRect()
  ov.width = Math.max(1, Math.floor(rect.width * devicePixelRatio))
  ov.height = Math.max(1, Math.floor(rect.height * devicePixelRatio))
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
  ctx.clearRect(0, 0, rect.width, rect.height)

  const hasSelection = (state.selectKeys || []).length > 0
  const hasMarquee = !!state.marquee
  const curNotePage = physicalToLogicalPage(Number(state.previewPageIndex || 0))
  const pageNotes = (state.notes || []).filter((n) => !isBinderMetaNote(n) && Number(n.page || 0) === curNotePage)
  const hasNotes = pageNotes.length > 0
  if (
    (!state.designMode && !state.addMode && !hasSelection && !hasMarquee && !hasNotes && !state.noteAddMode) ||
    !img ||
    !img.src
  )
    return

  // 画像の実描画領域（object-fit: contain の余白を除外）
  const box = getRenderedContentRect(img, state.pageW, state.pageH)
  const ox = box.left - rect.left
  const oy = box.top - rect.top
  const iw = box.width
  const ih = box.height

  // 枠
  ctx.save()
  ctx.strokeStyle = "rgba(124,92,255,.35)"
  ctx.lineWidth = 2
  ctx.strokeRect(ox + 1, oy + 1, Math.max(0, iw - 2), Math.max(0, ih - 2))
  ctx.restore()

  // 付箋ピン
  if (hasNotes) {
    ctx.save()
    for (const n of pageNotes) {
      const nx = (Number(n.x || 0) / state.pageW) * iw + ox
      const ny = (Number(n.y || 0) / state.pageH) * ih + oy
      const km = noteKindMeta(n.kind)
      ctx.font = "700 18px system-ui, -apple-system, Segoe UI, sans-serif"
      ctx.textBaseline = "middle"
      ctx.globalAlpha = n.resolved ? 0.4 : 1
      ctx.fillStyle = "rgba(255,255,255,.92)"
      ctx.beginPath()
      ctx.arc(nx, ny, 13, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = n.resolved ? "rgba(148,163,184,.9)" : "rgba(239,68,68,.95)"
      ctx.stroke()
      ctx.fillStyle = "#0f172a"
      ctx.textAlign = "center"
      ctx.fillText(km.icon, nx, ny + 1)
    }
    ctx.restore()
  }

  // 追加モードの案内
  if (state.addMode) {
    ctx.save()
    ctx.fillStyle = "rgba(15,23,42,.60)"
    ctx.strokeStyle = "rgba(255,255,255,.65)"
    ctx.lineWidth = 1
    const pad = 10
    const msg = `クリックで追加：${state.addDraftName}`
    ctx.font = "600 12px system-ui, -apple-system, Segoe UI, sans-serif"
    const tw = ctx.measureText(msg).width
    const x = ox + pad
    const y = oy + pad
    ctx.fillRect(x, y, tw + 18, 26)
    ctx.strokeRect(x, y, tw + 18, 26)
    ctx.fillStyle = "rgba(255,255,255,.92)"
    ctx.fillText(msg, x + 9, y + 17)
    ctx.restore()
    return
  }

  if (hasMarquee && state.marquee) {
    const m = state.marquee
    const rx0 = Math.min(m.x0, m.x1)
    const ry0 = Math.min(m.y0, m.y1)
    const rx1 = Math.max(m.x0, m.x1)
    const ry1 = Math.max(m.y0, m.y1)
    const mx = (rx0 / state.pageW) * iw + ox
    const my = (ry0 / state.pageH) * ih + oy
    const mw = ((rx1 - rx0) / state.pageW) * iw
    const mh = ((ry1 - ry0) / state.pageH) * ih
    ctx.save()
    ctx.strokeStyle = "rgba(124,92,255,.95)"
    ctx.fillStyle = "rgba(124,92,255,.12)"
    ctx.lineWidth = 2
    ctx.setLineDash([5, 4])
    ctx.strokeRect(mx, my, mw, mh)
    ctx.fillRect(mx, my, mw, mh)
    ctx.restore()
  }

  // 選択中要素の枠（作業者向け）
  if (hasSelection) {
    const page = Number.isFinite(state.previewPageIndex) ? state.previewPageIndex : 0
    const selected = state.selectKeys.filter((t) => state.placements?.[t] && Number(state.placements[t].page || 0) === page)
    ctx.save()
    ctx.setLineDash([])
    for (const t of selected) {
      const pl = state.placements[t] || {}
      const b = placementBoxOnPage(t, pl)
      const x1 = (Number(pl.x || 0) / state.pageW) * iw + ox
      const y1 = (Number(pl.y || 0) / state.pageH) * ih + oy
      const w1 = (b.w / state.pageW) * iw
      const h1 = (b.h / state.pageH) * ih
      ctx.strokeStyle = "rgba(255,106,162,.95)"
      ctx.lineWidth = 2
      ctx.strokeRect(x1 - 2, y1 - 2, w1 + 4, h1 + 4)
      ctx.fillStyle = "rgba(255,106,162,.10)"
      ctx.fillRect(x1 - 2, y1 - 2, w1 + 4, h1 + 4)
      // ラベル
      ctx.font = "700 12px system-ui, -apple-system, Segoe UI, sans-serif"
      ctx.fillStyle = "rgba(15,23,42,.82)"
      ctx.fillText(String((state.placements?.[t]?.tag || t) || t), x1 + 4, y1 - 8)
    }
    ctx.restore()
  }

  // 座標（stateにキャッシュして“ヌルヌル”動かす）
  const p = state.designPos
  if (!p) return
  const x = (p.x / state.pageW) * iw + ox
  const y = (p.y / state.pageH) * ih + oy
  ctx.save()
  ctx.strokeStyle = "rgba(255,106,162,.9)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - 12, y)
  ctx.lineTo(x + 12, y)
  ctx.moveTo(x, y - 12)
  ctx.lineTo(x, y + 12)
  ctx.stroke()
  ctx.fillStyle = "rgba(255,106,162,.10)"
  ctx.beginPath()
  ctx.arc(x, y, 12, 0, Math.PI * 2)
  ctx.fill()

  // ガイド線（統括が“気持ちよく揃えられる”）
  ctx.strokeStyle = "rgba(255,255,255,.55)"
  ctx.lineWidth = 1
  ctx.setLineDash([4, 6])
  ctx.beginPath()
  ctx.moveTo(ox, y)
  ctx.lineTo(ox + iw, y)
  ctx.moveTo(x, oy)
  ctx.lineTo(x, oy + ih)
  ctx.stroke()
  ctx.restore()
}

function enableOverlayPointer(on) {
  const ov = $("#overlay")
  if (!ov) return
  ov.classList.toggle("is-active", !!on)
  ov.style.pointerEvents = on ? "auto" : "none"
}

async function boot() {
  bindViewportMetricsOnce()
  restoreElementClipboardFromSession()
  loadPresets()
  try {
    await window.i18n?.ready
    const fromQuery = getLocaleFromQuery()
    if (fromQuery) {
      state.locale = window.i18n?.setLocale?.(fromQuery) || fromQuery
    } else {
      state.locale = getLocaleSafe()
      syncLocaleQuery(state.locale)
    }
  } catch {}
  try {
    await ensureAdSenseScript()
  } catch {}
  try {
    await loadWorkers()
  } catch (e) {
    // If worker fetch fails, still show the gate (so user can retry/relaunch).
    console.error("loadWorkers failed:", e)
    state.workers = []
    state.workerId = null
    state.gate = state.gate || { step: "choose", password: "", error: "" }
    state.gate.error = "起動に失敗しました（作業者一覧の取得）。アプリを再起動してください。"
  }
  try {
    const r = await window.pywebview.api.get_admin_settings?.()
    const s = r?.settings && typeof r.settings === "object" ? r.settings : {}
    state.defaultFontSize = Number(s.default_font_size || 14) || 14
    state.viewZoom = Number(s.view_zoom || 1.0) || 1.0
    if (Array.isArray(s.deleted_logical_pages) && s.deleted_logical_pages.length) {
      state.deletedLogicalPages = mergeDeletedLogicalPageLists(
        getDeletedLogicalPages(),
        s.deleted_logical_pages.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x >= 0),
      )
    }
    if (Array.isArray(s.binder_trash) && s.binder_trash.length) {
      state.binderTrash = mergeBinderTrashLists(state.binderTrash, s.binder_trash)
      syncTrashToNotes()
      saveBinderTrashLocal()
    }
  } catch {
    state.defaultFontSize = 14
    state.viewZoom = 1.0
  }
  // 起動時：ローカル(EXE)は「入力者/管理者」ゲート、WEBは PDF/ZIP ゲート
  state.appStage = "gate"
  state.gate = state.gate || { step: "choose", password: "", error: "" }
  if (!isWeb()) {
    state.gate.step = "choose"
    state.uiMode = "worker"
  } else {
    state.uiMode = "admin"
  }
  render()
}

let _booted = false
async function bootOnce() {
  if (_booted) return
  // In desktop(pywebview), DOMContentLoaded can fire before window.pywebview.api is injected.
  // If we boot too early, we crash and never boot again (because _booted becomes true).
  if (!window.pywebview || !window.pywebview.api) {
    bootOnce.__tries = (bootOnce.__tries || 0) + 1
    // Retry briefly; pywebviewready will also fire.
    if (bootOnce.__tries < 200) setTimeout(bootOnce, 50)
    return
  }
  try {
    await boot()
    _booted = true
  } catch (e) {
    console.error("boot failed:", e)
    _booted = false
    // Retry once API is ready; do not lock into blank screen.
    bootOnce.__tries = (bootOnce.__tries || 0) + 1
    if (bootOnce.__tries < 260) setTimeout(bootOnce, 200)
  }
}

// Desktop (pywebview) emits this event. Web demo (Pages) does not.
window.addEventListener("pywebviewready", bootOnce)
// Web demo entrypoint
window.addEventListener("DOMContentLoaded", bootOnce)
if (document.readyState !== "loading") bootOnce()

