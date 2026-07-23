# Domain Model

Plain-English **v1 target** before relational tables. Canonical terms: [glossary.md](glossary.md).

This replaces the earlier denser draft. Goal: same page on entities and rules; schema design comes after.

---

## Big picture

Four layers. Do not collapse them into one per-ASIN document (that is today’s filesystem model).

```
┌─────────────────────────────────────────────────────────────────┐
│  1. ACCOUNT & ACCESS                                            │
│     User ──Membership──► Account ──Plan──► Entitlements/Credits │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. CATALOG & CHANNEL                                           │
│     Brand → Product → SKU → Listing → Listing Snapshot          │
│              (attrs)     (match)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. KNOWLEDGE                                                   │
│     Claims on Product (default) / SKU (when specific)           │
│     buckets optional · sensitive · observed|inferred            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. WORK                                                        │
│     Discover Brand  |  Analyze Listing (Run → Stages → Artifacts)│
│     Credits / Usage ledger · Approved content (placeholder)     │
└─────────────────────────────────────────────────────────────────┘
```

**Product job (unchanged):** improve discoverability and purchasability of channel content, with scores and prioritized fixes — now on a multi-brand, multi-platform catalog owned by an Account.

---

## 1. Account and access

### Nesting

```
User
 └── Membership (role: owner | member)
      └── Account                          ← tenant + payer
           ├── Plan → Entitlements
           │            ├── max seats
           │            └── credit pool (weighted, lifetime free → pay)
           ├── Usage events (append-only ledger)
           └── Brands / catalog / claims / runs …
```

### v1 rules

| Topic | Decision |
|-------|----------|
| Naming | **Account** in product language (not Organization) |
| Self-serve free | **1 seat**; lifetime free **credits**, then pay |
| Paid / enterprise | Same shape; higher seats and credits (Plan numbers) |
| Roles | `owner` + `member` only |
| Brand-scoped access | **Not in v1**; Membership can gain brand grants later |
| Who can pay | **Any member** in v1; owner-only billing later |
| One company, many Accounts | **Not in v1** |
| Separate Billing Account entity | **Not in v1** — Account is the payer |

### Credits (weighted pool)

- User sees **one** balance.
- Expensive stages spend (weights are config; e.g. research > scrape > generate; tag/parse/cache ≈ 0).
- **Failures do not burn** credits (lenient; favor demonstrating value).
- Deliberate re-run after success spends again; force refresh of research spends.

---

## 2. Catalog and channel

### Nesting

```
Account
 └── Brand (1..N)
      └── Product (model / design)
           └── SKU (sellable physical unit)
                │    └── SKU attributes[]   ← identity only (allowlisted keys)
                │         e.g. flavour=lemon, pack_count=60, pack_format=tub
                │
                └── Listing (1..N)          ← per Platform + Marketplace
                     │    e.g. Amazon UK ASIN, Blinkit product id
                     │
                     └── Listing Snapshot (1..N over time)
                          └── from Source capture (raw HTML, …)
```

### SKU ≠ Listing

```
                    SKU “Lemon wipes 60ct”
                     /        |        \
                    /         |         \
            Listing         Listing      Listing
           Amazon UK       Amazon US     Blinkit
                |               |
           Snapshot(s)     Snapshot(s)
```

### Identity attributes (not Claims)

- Keys from a **controlled allowlist** (~8–12 CPG-shaped keys): e.g. `flavour`, `scent`, `pack_format`, `pack_count`, `size`, `color`, `material`, `formulation`.
- Values discovered (normalize later).
- Soft cap (about **≤ 4–5** attributes per SKU); excess ⇒ `needs_review`, do not invent new keys.
- Research may only propose allowlisted keys; unmapped differences ⇒ review, not a new axis.
- **Different physical goods ⇒ different SKUs.** Combo/variety packs deferred.

### No “Variant” entity

Multi-axis reality (flavour × pack × size) is modeled as **attributes on SKU**, not `Product → Variant → SKU`. Colloquially people still say “variants”; in the model those are other SKUs (or attribute values).

### Listing–SKU match

```
Listing ──?──► SKU
         │
         ├── confidence
         └── needs_review (when ambiguous)
```

v1: candidate match + confidence + needs_review is enough. No heavy merge/split machinery required on day one; correcting the link is enough.

### Discovery vs analysis

| Job | Grain | Fills / does |
|-----|--------|----------------|
| **Discover Brand** | Brand / Account | Products, SKUs, Listings across platforms |
| **Analyze Listing** | One Listing | Observe + knowledge reuse + evaluate/generate |

Self-serve may start from one Listing (show value), then discover the rest. Enterprise may discover the assortment up front. Same objects either way.

---

## 3. Knowledge (Claims)

### Three piles (do not mix)

```
A. SKU attributes     → identity (what makes SKUs different)
B. Claims             → knowledge (what is true / claimed)
C. Buckets (optional) → labels on Claims for filter / compare
```

Most marketing and shared product truth is **pile B on Product**. Pile A never substitutes for Claims.

### Claim shape (v1)

```
Claim
 ├── subject          Product (default) | SKU (when specific)
 ├── text / proposition
 ├── bucket[]?        fact | functional | sensory | emotional | occasion | audience
 ├── sensitive?       boolean (generation caution)
 ├── source kind      observed | inferred
 ├── confidence       0..1  (auto-accept bar configurable, default 0.6)
 ├── status           candidate | accepted | rejected | needs_review
 ├── evidence         lightweight (url / snapshot field / quote)
 └── Account-private
```

### Where Claims hang

```
Product  ◄── most Claims (shared across pack sizes)
   │
   └── SKU  ◄── only Claims that are truly pack/flavour-specific
```

No automatic inheritance from Brand or Category in v1.

### Effective set for one Listing

```
Listing → SKU → Product
              │
              ├── accepted Claims on that SKU
              └── accepted Claims on that Product
                    │
                    └── effective claim set → evaluate / generate
```

Identity attributes stay outside this set.

### Lifecycle (simple)

```
research / classify
        │
        ▼
   candidate Claim
        │
        ├── confidence ≥ bar ──► accepted (auto)
        ├── conflict / ambiguous ──► needs_review
        └── low confidence ──► candidate (or needs_review)
        │
        ▼
   human edit (simple row edit) any time
```

### Competitors

When that flow is triggered, competitor Products use the **same Claim shape**, Account-private. No separate competitor type required in v1.

### Explicitly out of v1 (knowledge)

- Full Assertion / stance / refute graphs
- Market/locale/jurisdiction approved-use matrices
- Sharing Claims across Accounts
- Formal versioned “Claim decision” documents beyond status + edit

---

## 4. Work, history, retention

### Analyze Listing Run

```
Account / User
    └── Run (Analyze Listing)          ← one Listing per Run; append-only
          ├── Stage scrape  → Source capture
          ├── Stage parse   → Listing Snapshot
          ├── Stage research → Artifact   ┐
          ├── Stage classify → Claims     ┤ reuse by Product/SKU unless refresh
          ├── Stage evaluate → …          │
          └── Stage generate → Artifact   ┘
                │
                └── Usage / credit spend
```

- Many Listings ⇒ many Runs (optional later: a Batch parent that spawns Runs).
- Stages exist in the backend even if customer UX is one “Analyze” button.
- History is **who / when / what happened** (attribution), not git branches/merges.
- Observations are **per-Account copies** in v1 (no shared capture pool yet).

### Reuse

- Default: reuse latest research/classify for the same **Product/SKU**.
- Force refresh: explicit, spends credits.
- Scrape/parse remain Listing-specific when that page must be fresh.

### Approved content

v1: placeholder for **what the Account accepted** as content for a Listing.  
Later: **Publication** = pushed/confirmed live on a Platform (who/when/which version).

### Retention principle

| Keep durably | May expire after a window |
|--------------|---------------------------|
| Account, catalog, matches | Raw/intermediate stage payloads |
| Usage / credit ledger | Verbose debug dumps |
| Run summaries + links to outcomes | |
| Useful Snapshots / evidence for accepted Claims and approved content | |

Exact window (e.g. 30–90 days) is a later product choice; prefer a reversible window over immediate delete.

### Monitoring

Scheduled re-scrape / watch policies: **out of v1**.

---

## How this maps from today’s code

```
Filesystem today                    Target
─────────────────                   ──────
tmp/scrape/MARKET_ASIN/     →      Source capture (Account-scoped)
tmp/parse/...               →      Listing Snapshot
Identity tuple              →      Brand/Product/SKU attrs + match hypothesis
Tag / TagSet                →      Claims (+ optional buckets)
complianceSensitive         →      sensitive
Run + stage artifacts       →      Run / Stage / Artifact + Usage
Global prompt overrides     →      later: Account-scoped (not required to name tables yet)
```

Composable pipeline stages remain the backend spine; customer UX may hide them.

---

## Stress checks (v1 should allow these)

1. Same physical SKU on Amazon UK, Amazon US, Blinkit → one SKU, three Listings.
2. Lemon 60ct vs Lemon 120ct → two SKUs (attributes differ on pack_count).
3. Ambiguous ASIN↔SKU → match with confidence + needs_review.
4. Two Accounts scrape the same public ASIN → separate histories; no cross-leak of claims/runs.
5. Second Analyze on same SKU → reuse research/classify by default.
6. Conflicting claims → needs_review, not silent overwrite.
7. Failed research → no credit burn; successful deliberate re-run → spends.
8. Free user hits lifetime credits → paywall; enterprise is larger Plan numbers on the same machinery.

---

## Deferred (do not block v1 schema sketch)

- Combo / variety pack composition
- Brand-scoped Membership grants
- Owner-only billing; separate Billing Account
- Multiple Accounts per company / agency dual-tenant on one Brand
- Shared public captures across Accounts
- Offer / price / Buy Box as purchasability
- Observation policies (scheduled watch)
- Live Publication workflow
- Heavy Claim evidence graphs and jurisdiction matrices

---

## One-way vs two-way decisions

**Settle before migration (expensive to undo):**

- Account as tenant and payer
- Brand → Product → SKU → Listing → Snapshot
- SKU attributes (allowlisted) vs Claims
- Claim subject Product/SKU; accepted vs candidate; Account-private
- Run = one Listing; append-only history; Usage ledger durable
- Per-Account observation copies in v1

**Can change later behind stable ideas:**

- Credit weights, Plan names, seat counts
- Bucket list (keep six as directional/optional)
- Auto-accept threshold (config; default 0.6)
- ORM, object storage, search, exact retention days
- Whether customer UI shows stages

---

## Where this sits vs the old domain-model draft

| Old draft emphasis | v1 emphasis |
|--------------------|-------------|
| Organization + optional Billing Account | **Account** only |
| Product → Variant → SKU | **Product → SKU + attributes** |
| Claims + Assertions + Evidence cathedral | **Claim + light evidence + status** |
| Tags as classification over Claims | Optional **buckets** on Claims; product name **Claim** |
| Rich approved-use scope | Effective set = Product ∪ SKU accepted claims |
| Shared public observation layer | Separate copies; share later if needed |

Schema, keys, and indexes stay unspecified until this document’s v1 decisions are treated as accepted.
