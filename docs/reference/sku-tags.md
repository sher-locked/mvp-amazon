# SKU & Tag APIs

API routes and request/response schemas for the scoped MVP: ingesting an SKU from an Amazon URL and researching its tags into a scoped, typed structure.

---

## MVP Scope

1. **[M1] Retrieve SKU information** from an Amazon URL (or ASIN).
   - Parse `country` and `asin`
   - Scrape Amazon PDP: `title`, `description`, `bullets`, `a+ content`, `images`
   - Create a **barebones** `sku` object — raw evidence only, no structure
2. **[M2] Research and structure tags.**
   - LLM-research the SKU using the scraped evidence
   - Resolve identity: `brand`, `category`, `productFamily`, `variantAttributes`, `size`
   - Discover the exhaustive tag set and place each tag on two axes: **scope** and **type**

-- Next -- 

3. **[M3] Evaluate listings** and recommend improvements.
  - Evaluate title (& others) using above information as the base
  - Recommend changes with Amazon guidelines' new guidance
4. **[M4] Generate new listings**  based on recommendations
  - Recommend `title`, `subTitle` and `backendKeywords`
  - Preview recommendations for `heroImage`, `secondaryImages`

---

## Choices

### Division of labour

M1 is a **deterministic scraper** — it stores evidence and returns `identity: null`. M2 is the **only LLM pass** — it resolves identity and discovers tags in one research call. Nothing structural is guessed at scrape time.

### Identity is a tuple, never a string

There is no canonical title. An SKU is identified by the tuple:

```
{brand} × {category} × {variantAttributes} × {size}
```

`displayName` is *derived* from this tuple for display, and is never parsed. Retrieval and dedup match on the tuple.

### Variant axes: claim-bearing vs logistical

Variants are typed key-value attributes, not a single string. Axes split into two kinds:

| Kind | Examples | Lives at | Why |
|---|---|---|---|
| **Claim-bearing** | formulation (alcohol-free), fragrance | Product family identity | Changes what the product *is* and which claims are true |
| **Logistical** | size, count, pack format, multipack | SKU | Changes how much / how packaged; claims unaffected |

So a **product family** = brand + category + claim-bearing variant attributes. Its member SKUs differ only in logistical axes — which preserves the definition "the level at which claims are shared across sizes and pack formats."

```
Dettol Cleaning Wipes Alcohol-Free          ← family (claim-bearing: formulation)
├── ... Box 120 Wipes                       ← sku (logistical: packaging, size)
├── ... Sachet 60 Wipes
└── ... Box 60 Wipes
```

### Brand hierarchy: one pointer, no engine

A brand has a nullable `parentBrand` (e.g. `Nivea Men` → `Nivea`). For the MVP:

- Never merge sub-brands into the parent — their claims differ and would cross-contaminate.
- No inheritance logic yet: research each brand's tags independently.
- Later, inheritance is a read-time change: union the parent brand's tags into the effective set. No migration needed.

### Tags: store flat, scope once, group on read

Every tag is an **atomic row** carrying both axes as plain fields:

```
value                the claim/attribute text
type                 fact | functional | sensory | emotional | occasion | audience
scope                brand | category | family | sku
complianceSensitive  boolean flag (not a separate bucket)
source               observed | inferred
evidence             where it came from (e.g. amazon_pdp_bullet, llm_research)
confidence           0..1
```

Rules:

1. **Each tag is stored exactly once, at the highest scope where it is true.** "Kills 99.9% germs" lives at brand scope, not repeated per SKU.
2. **The SKU's "effective tag set" is computed at read time** by unioning tags down the scope chain (brand → category → family → sku). The chain is ≤4 nodes; the construct-vs-retrieve cost concern doesn't bite at this scale.
3. **Compliance is a flag, not a type.** A claim is functional *and* compliance-sensitive; flagging avoids storing it twice.
4. Grouping (by type, by scope) is a **view concern** — clients group the flat list however they need.

---

## [M1] Retrieve Amazon PDP

Scrapes PDP content and creates a barebones SKU. No research, no classification.

`POST` `api/v1/skus/`

### Request JSON

`country` and `asin` are not required if a reachable URL is passed.

```json
{
  "platform": "amazon",
  "url": "https://www.amazon.in/dp/B0B8PDHRWY/",
  "country": "in",
  "asin": "B0B8PDHRWY"
}
```

### Response JSON

Returns the SKU with raw scraped evidence. `identity` stays `null` until research (M2) runs.

```json
{
  "id": "sku_8f3a2c",
  "status": "scraped",
  "platform": "amazon",
  "country": "in",
  "asin": "B0B8PDHRWY",
  "scraped": {
    "title": "Dettol Disinfectant Cleaning Wipes for Home, 120 Wipes",
    "description": "...",
    "bullets": ["Kills 99.9% germs", "Multi-surface cleaning", "..."],
    "aPlusContent": "...",
    "images": {
      "primary": "https://m.media-amazon.com/...jpg",
      "secondary": ["https://m.media-amazon.com/...jpg"]
    }
  },
  "identity": null
}
```

---

## [M2] Research Identity & Tags

One LLM research pass over the scraped evidence (plus web search) that i. resolves the SKU's identity, ii. discovers the exhaustive tag set, each tag placed on the scope × type axes.

`POST` `api/v1/skus/:skuId/research`

### Request JSON

```json
{
  "provider": "anthropic",
  "model": "opus-4.6",
  "scope": ["identity", "tags"]
}
```

### Response JSON

Identity is the resolved tuple; tags are a flat list, each stored at its highest true scope — note **no claim repeats across scopes**.

```json
{
  "id": "sku_8f3a2c",
  "identity": {
    "brand": { "id": "brd_1a2b", "name": "Dettol", "parentBrand": null },
    "category": "Cleaning Wipes",
    "family": {
      "id": "fam_9c4d",
      "name": "Dettol Cleaning Wipes Alcohol-Free",
      "variantAttributes": { "formulation": "alcohol-free", "fragrance": "regular" }
    },
    "sku": {
      "packaging": "box",
      "size": "120 wipes"
    },
    "displayName": "Dettol Cleaning Wipes Alcohol-Free Box 120 Wipes"
  },
  "tags": [
    { "value": "trusted hygiene brand", "type": "emotional", "scope": "brand",
      "complianceSensitive": false, "source": "inferred", "evidence": "llm_research", "confidence": 0.9 },
    { "value": "kills 99.9% germs", "type": "functional", "scope": "brand",
      "complianceSensitive": true, "source": "observed", "evidence": "amazon_pdp_bullet", "confidence": 0.95 },
    { "value": "disposable wipe format", "type": "fact", "scope": "category",
      "complianceSensitive": false, "source": "inferred", "evidence": "llm_research", "confidence": 0.95 },
    { "value": "quick everyday cleaning", "type": "occasion", "scope": "category",
      "complianceSensitive": false, "source": "inferred", "evidence": "llm_research", "confidence": 0.8 },
    { "value": "alcohol-free", "type": "fact", "scope": "family",
      "complianceSensitive": false, "source": "observed", "evidence": "amazon_pdp_title", "confidence": 0.95 },
    { "value": "multi-surface cleaning", "type": "functional", "scope": "family",
      "complianceSensitive": false, "source": "observed", "evidence": "amazon_pdp_bullet", "confidence": 0.9 },
    { "value": "regular fragrance", "type": "sensory", "scope": "family",
      "complianceSensitive": false, "source": "observed", "evidence": "amazon_pdp_description", "confidence": 0.85 },
    { "value": "kitchen", "type": "occasion", "scope": "family",
      "complianceSensitive": false, "source": "observed", "evidence": "amazon_aplus", "confidence": 0.85 },
    { "value": "families with kids", "type": "audience", "scope": "family",
      "complianceSensitive": false, "source": "inferred", "evidence": "llm_research", "confidence": 0.7 },
    { "value": "120 wipes", "type": "fact", "scope": "sku",
      "complianceSensitive": false, "source": "observed", "evidence": "amazon_pdp_title", "confidence": 1.0 },
    { "value": "box format", "type": "fact", "scope": "sku",
      "complianceSensitive": false, "source": "observed", "evidence": "amazon_pdp_images", "confidence": 0.9 }
  ]
}
```

### Retrieval: the effective tag set

Consumers (M3/M4, comparisons) read the SKU's **effective tag set** — the union of tags down its scope chain:

`GET` `api/v1/skus/:skuId/tags?view=effective`

Returns the flat list above with each tag's scope annotated; grouping by type or scope is done client-side. When brand inheritance lands, the parent brand's tags join this union — no storage change.

---

## Clarifications

### Product Family

The level at which claims are shared across sizes and pack formats. Family identity includes claim-bearing variant attributes, so sibling formulations are **separate families**:

```
Dettol Cleaning Wipes Alcohol-Free      Dettol Cleaning Wipes (Alcoholic)
├── Box 120 Wipes                       ├── Box 120 Wipes
├── Box 60 Wipes                        └── Sachet 60 Wipes
└── Sachet 60 Wipes
```

Claims genuinely shared across sibling families (e.g. "multi-surface cleaning") get duplicated per family at MVP scale — acceptable; a `categoryLine` scope between category and family is an additive change if it ever hurts.

### Decisions & trade-offs

1. **Flat tag list over nested per-scope objects** — inserts, filters, and future axes (listing scope, competitor tags) are additive; nesting hard-codes today's axes into the JSON shape.
2. **Write once at highest scope, compute effective set on read** — avoids the repetition that scoping was meant to eliminate; the ≤4-node chain makes read-time union trivial.
3. **No `Variant` entity** — claim-bearing axes fold into family identity, logistical axes are SKU fields. A variant table adds a join with no MVP payoff.
4. **`parentBrand` pointer without inheritance logic** — records the Nivea / Nivea Men fact now; inheritance is a deferred read-time computation.
5. **Compliance as a flag** — prevents the same claim living in two buckets.
