// Shared helpers for the eval UI pages (index.html, prompts.html).
// Vanilla ES module — no build step. Renderers return HTML strings; when the
// React migration lands they convert to components mechanically.

// --- fetch -------------------------------------------------------------------
export async function api(method, path, body) {
  const headers = { 'x-access-key': localStorage.getItem('accessKey') || '' };
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { error: 'NON_JSON', message: text.slice(0, 500) }; }
  if (!res.ok) throw Object.assign(new Error('api error'), { status: res.status, payload: json });
  return json;
}

// --- header wiring -------------------------------------------------------------
/** Bind the access-key input to localStorage; returns the input element. */
export function initHeader() {
  const key = document.getElementById('access-key');
  key.value = localStorage.getItem('accessKey') || '';
  key.addEventListener('input', () => localStorage.setItem('accessKey', key.value));
  return key;
}

// --- formatting ----------------------------------------------------------------
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const fmtTime = (iso) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function fmtPrompt(v) {
  if (!v) return '';
  if (v.startsWith('default#')) return 'default prompt';
  if (v.startsWith('custom#')) return 'custom prompt · ' + fmtTime(v.slice('custom#'.length));
  return v;
}

// --- cost transparency -------------------------------------------------------------
// EDIT YOUR RATES HERE — placeholders until real contract rates are set.
// PRICES is keyed by usage.model, USD per 1M tokens; SCRAPE_COST is USD per
// BrightData unlocker request. Unset (null / missing model) renders "$—".
// The provider reports the resolved snapshot id (e.g. "gpt-5.5-2026-04-23",
// not "gpt-5.5") — check a card's raw JSON for the exact key to use.
export const PRICES = {
  // 'gpt-5.5-2026-04-23': { input: 0.0, output: 0.0 },
};
export const SCRAPE_COST = null;

/** Per-step cost/latency copy shown before you click — edit freely. */
export const STEP_ESTIMATES = {
  scrape: '1 unlocker request · ~5–10 s',
  parse: 'free · instant',
  research: 'LLM + web ≈ $— · ~1 min',
  tag: 'LLM ≈ $— · ~30–60 s',
  generate: 'LLM fast ≈ $— · ~1–2 min',
};

/** ≈ dollars for a usage stamp, or null when no rate is configured. */
export function estCost(usage) {
  const rate = usage && PRICES[usage.model];
  if (!rate) return null;
  return (usage.inputTokens * rate.input + usage.outputTokens * rate.output) / 1e6;
}

export const fmtUsd = (v) => (v == null ? '$—' : v < 0.01 ? '<$0.01' : '$' + v.toFixed(2));

export const fmtTokens = (n) => (n >= 1000 ? Math.round(n / 1000) + 'k' : String(n));

export function fmtDur(ms) {
  if (ms == null) return null;
  if (ms >= 60_000) return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
  return (ms / 1000).toFixed(ms < 10_000 ? 1 : 0) + 's';
}

export function fmtBytes(n) {
  if (n == null) return null;
  if (n >= 1_048_576) return (n / 1_048_576).toFixed(1) + ' MB';
  if (n >= 1024) return Math.round(n / 1024) + ' KB';
  return n + ' B';
}

/** "last run: 62 s · 41k in / 3k out ≈ $0.09" from artifact stamps (either may be absent). */
export function fmtActuals({ usage, durationMs } = {}) {
  const bits = [];
  if (durationMs != null) bits.push(fmtDur(durationMs));
  if (usage) bits.push(`${fmtTokens(usage.inputTokens)} in / ${fmtTokens(usage.outputTokens)} out ≈ ${fmtUsd(estCost(usage))}`);
  return bits.length ? `last run: ${bits.join(' · ')}` : '';
}

// --- prompt staleness ------------------------------------------------------------
let activePrompts = null; // slot id → active version, from GET /prompts

export async function loadActivePrompts() {
  try {
    const res = await api('GET', '/prompts');
    activePrompts = Object.fromEntries(res.prompts.map((p) => [p.id, p.active.version]));
  } catch { activePrompts = null; }
}

export const isPromptStale = (artifactVersion, slot) =>
  Boolean(artifactVersion && activePrompts && activePrompts[slot] && artifactVersion !== activePrompts[slot]);

// --- button machinery ------------------------------------------------------------
/** Disable a button and tick an elapsed timer on it while `fn` runs. */
export async function runAction(button, fn) {
  const original = button.textContent;
  const start = Date.now();
  button.disabled = true;
  const tick = setInterval(() => {
    const s = Math.floor((Date.now() - start) / 1000);
    button.innerHTML = `${esc(original)} <span class="timer">${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</span>`;
  }, 1000);
  try { await fn(); }
  finally {
    clearInterval(tick);
    button.textContent = button.dataset.label || original;
    button.disabled = false;
  }
}

/** Relabel a button; takes effect immediately unless a runAction is ticking on it. */
export function setBtnLabel(button, label) {
  button.dataset.label = label;
  if (!button.disabled) button.textContent = label;
}

// --- renderers -------------------------------------------------------------------
export function renderDesc(text) {
  return String(text || '')
    .split('\n')
    .map((ln) => ln.startsWith('### ')
      ? `<div class="desc-head">${esc(ln.slice(4))}</div>`
      : `<div class="desc-line">${esc(ln)}</div>`)
    .join('');
}

export function renderListing(listing) {
  const imgs = [];
  if (listing.heroImage) imgs.push({ ...listing.heroImage, label: 'hero' });
  for (const im of listing.secondaryImages || []) imgs.push({ ...im, label: '' });
  const parts = [];
  parts.push(`<h3 class="field">Title</h3><div class="listing-title">${esc(listing.title)}</div>`);
  parts.push(`<h3 class="field">Bullets</h3><ul class="bullets">${(listing.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`);
  parts.push(`<h3 class="field">Description</h3><div class="desc">${renderDesc(listing.description)}</div>`);
  if (listing.aplusContent) {
    parts.push(`<details class="box"><summary>A+ content (${listing.aplusContent.length.toLocaleString()} chars)</summary><div class="desc">${esc(listing.aplusContent)}</div></details>`);
  }
  if (imgs.length) {
    parts.push(`<h3 class="field">Images</h3><div class="thumbs">${imgs.map((im) =>
      `<figure><img src="${esc(im.url)}" alt="${esc(im.alt || '')}" loading="lazy" /><figcaption>${esc(im.label || im.alt || '')}</figcaption></figure>`).join('')}</div>`);
  }
  return parts.join('');
}

/**
 * The SKU identity tuple in sku-tags.md form: {brand} × {category} ×
 * {variantAttributes} × {size}. Claim-bearing axes (family.variantAttributes)
 * and logistical axes (sku) render as visually distinct chip groups. Identity
 * is RESEARCH output — callers pass a source label like "identity · from research".
 */
export function renderIdentity(identity, srcLabel) {
  const attrChips = (attrs, cls) => {
    const entries = Object.entries(attrs || {});
    if (!entries.length) return '<span class="id-x">—</span>';
    return entries.map(([k, v]) => `<span class="chip ${cls}">${esc(k)}: ${esc(v)}</span>`).join('');
  };
  const parent = identity.brand?.parentBrand
    ? ` <span class="id-parent">(part of ${esc(identity.brand.parentBrand)})</span>`
    : '';
  return `<div class="id-head">
    <div class="id-name">${esc(identity.displayName)}</div>
    <div class="id-tuple">
      <span class="id-brand">${esc(identity.brand?.name || '')}</span>${parent}
      <span class="id-x">×</span>
      <span>${esc(identity.category || '')}</span>
      <span class="id-x">×</span>
      ${attrChips(identity.family?.variantAttributes, 'fam')}
      <span class="id-x">×</span>
      ${attrChips(identity.sku, 'skuax')}
    </div>
    <div class="id-src">${esc(srcLabel)} — <span class="fam-key">blue chips</span>: claim-bearing (family) · grey: logistical (sku)</div>
  </div>`;
}

export function renderResearch(r) {
  const parts = [renderIdentity(r.identity, 'identity · from research')];
  parts.push(`<h3 class="field">Notes</h3><div class="desc">${renderDesc(r.notes)}</div>`);
  const sources = r.sources || [];
  parts.push(`<details class="box"><summary>${sources.length} sources consulted</summary><ul class="src-list">${sources
    .map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a></li>`)
    .join('')}</ul></details>`);
  return parts.join('');
}

const SCOPES = ['brand', 'category', 'family', 'sku'];
const TYPES = ['fact', 'functional', 'sensory', 'emotional', 'occasion', 'audience'];

export function chip(t) {
  const tip = `confidence ${t.confidence}${t.evidence ? ' — ' + t.evidence : ''}`;
  return `<span class="chip" title="${esc(tip)}">${esc(t.value)}${t.source === 'inferred' ? '<span class="inf" title="inferred">*</span>' : ''}${t.complianceSensitive ? '<span class="comp" title="compliance-sensitive">!</span>' : ''}</span>`;
}

export function renderTags(identity, tags) {
  const id = identity
    ? `<div class="identity"><b>${esc(identity.displayName)}</b> — ${esc(identity.brand?.name || '')} · ${esc(identity.category || '')}</div>`
    : '';
  const head = `<tr><th>scope</th>${TYPES.map((t) => `<th>${t}</th>`).join('')}</tr>`;
  const rows = SCOPES.map((scope) => {
    const cells = TYPES.map((type) => {
      const cell = (tags || []).filter((t) => t.scope === scope && t.type === type);
      return cell.length ? `<td>${cell.map(chip).join('')}</td>` : `<td class="none">—</td>`;
    });
    return `<tr><td class="scope">${scope}</td>${cells.join('')}</tr>`;
  }).join('');
  const legend = `<div class="legend"><span class="inf" style="color:var(--warn)">*</span> inferred · <span style="color:var(--bad)">!</span> compliance-sensitive · hover for confidence</div>`;
  return `${id}<table class="matrix">${head}${rows}</table>${legend}`;
}

export function meter(chars, hard, targetLow) {
  const cls = chars > hard ? 'over' : chars >= targetLow ? 'ok' : 'under';
  return `<span class="meter ${cls}">${chars} / ${hard}</span>`;
}

export function renderGenerated(g) {
  const parts = [];
  parts.push(`<h3 class="field">Title ${meter(g.title.chars, 75, 70)}</h3><div class="listing-title">${esc(g.title.text)}</div><details class="box"><summary>rationale</summary><div class="desc">${esc(g.title.rationale)}</div></details>`);
  parts.push(`<h3 class="field">Item highlights ${meter(g.itemHighlights.chars, 125, 118)}</h3><div>${esc(g.itemHighlights.text)}</div><details class="box"><summary>rationale</summary><div class="desc">${esc(g.itemHighlights.rationale)}</div></details>`);
  parts.push(`<h3 class="field">Bullets ${meter(g.bullets.chars, 1000, 900)}</h3><ol class="gen-bullets">${g.bullets.items.map((b) => `<li>${esc(b)}<span class="bullet-count">${b.length}</span></li>`).join('')}</ol><details class="box"><summary>rationale</summary><div class="desc">${esc(g.bullets.rationale)}</div></details>`);
  parts.push(`<h3 class="field">Description ${meter(g.description.chars, 2000, 1900)}</h3><div class="desc">${esc(g.description.text)}</div><details class="box"><summary>rationale</summary><div class="desc">${esc(g.description.rationale)}</div></details>`);
  return parts.join('');
}
