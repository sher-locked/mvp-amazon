# Glossary

Canonical vocabulary for product, design, and engineering. Terms describe the **target** domain (post filesystem), not necessarily today’s TypeScript shapes. Relationships and v1 decisions live in [domain-model.md](domain-model.md).

## Naming rules

- **Account** = the customer workspace we bill and authorize. Not a login, not an Amazon seller account.
- A **User** does not own catalog data. An Account does, through Memberships.
- A **Brand** is a marketed identity, not the tenant.
- A **SKU** is not an ASIN. One SKU can have many Listings.
- A **Listing** is the continuing channel page. A **Listing Snapshot** is one observation of it.
- Prefer **Claim** over “tag” for product knowledge. Optional **buckets** (fact, functional, …) classify Claims; they are not a separate knowledge store.
- **Accepted** = in the Account’s working claim set (or approved content placeholder). **Published** (later) = confirmed live on a Platform.

---

## Account and access

### User

A person who logs in (work email). Acts only through Memberships.

### Account

The workspace, data-ownership boundary, and billable tenant. Owns brands, catalog, claims, runs, credits, and plan limits. Replaces earlier “Organization” wording.

### Membership

The link User ↔ Account. Carries a **role**. Free plan: one Membership. Paid/enterprise: up to the Plan’s seat limit.

### Role

v1: `owner` | `member`. Permissions can tighten later (e.g. owner-only billing, brand-scoped members) without changing tenancy.

### Seat

One Membership slot counting toward the Plan’s max users.

### Plan

Commercial package on the Account (`free` | `self_serve` | `enterprise`, names flexible). Describes limits and features, not permissions.

### Entitlement

What the Plan grants: max seats, credit balance rules, feature flags. Freemium is entitlements, not a boolean on User.

### Credits

One **weighted pool** on the Account. Lifetime free credits, then pay. Costly stages spend; cache/cheap steps spend ~0; provider failures do not burn credits. Exact weights are config, not domain identity.

### Usage event

Immutable ledger row: Account (and User if known) spent credits / consumed a billable action. Survives even when intermediate artifacts expire.

---

## Catalog and channel

### Brand

Customer-facing marketed identity. An Account manages one or more Brands.

### Product

Stable commercial model/design under a Brand. Most Claims hang here. Not a pack size and not a channel page.

### SKU

Exact sellable physical unit under a Product. Different physical packing ⇒ different SKU (60-pack ≠ 120-pack). Combo/variety packs are deferred.

### SKU attribute

Identity differentiator on a SKU (`flavour`, `pack_format`, `pack_count`, `size`, …). Keys come from a **controlled allowlist**; values are discovered. Soft cap on how many attributes a SKU carries. Not the same as Claims.

### Platform

Commerce channel: Amazon, Walmart, Blinkit, …

### Marketplace

Platform-specific site/market: Amazon UK, Amazon US, …

### Listing

Continuing buyable representation of a SKU on one Platform + Marketplace (e.g. child ASIN). Content can change; Listing identity stays.

### Listing–SKU match

Explicit link Listing → SKU with **confidence** and optional **needs_review**. Discovery proposes; review (or high confidence) accepts.

### Listing Snapshot

Immutable parsed view of a Listing from one observation. Today’s stored `Listing` JSON is closest to this. Re-scrape ⇒ new Snapshot.

### Source capture

Raw fetched document (e.g. PDP HTML) behind a Snapshot. Large blob; conceptually first-class, stored like an object/file.

---

## Knowledge (Claims)

### Claim

Atomic statement about a **subject** (Product by default; SKU when pack/flavour-specific). Hard specs and marketing lines use the same model with fields as needed.

### Subject

Entity a Claim is about: Product or SKU (v1). No brand→category→family inheritance engine.

### Bucket (optional)

Directional classifier on a Claim, proposed allowlist:

`fact` | `functional` | `sensory` | `emotional` | `occasion` | `audience`

Optional for v1; useful for filtering, generation emphasis, and competitive compare. Revisit if the six stop earning their keep.

### Sensitive

Simple boolean: claim is higher-risk for auto-writing into copy (health, safety, efficacy, etc.). Generate treats it cautiously.

### Observed vs inferred

Whether the Claim was taken from sources/PDP (**observed**) or hypothesized by the model (**inferred**). Stored simply for generation gates and review.

### Confidence

0..1 extraction/proposal score. Auto-accept above a configurable bar (default **0.6**). Acceptance ≠ confidence; humans can edit later.

### Claim status

`candidate` | `accepted` | `rejected` | `needs_review` (and similar). High-confidence proposals may auto-accept; conflicts flag **needs_review**.

### Evidence (lightweight)

Minimal provenance: source URL, Snapshot field, or short quote. Full assertion graphs are out of v1.

### Effective claim set

For one Listing’s SKU: **accepted Product claims ∪ accepted SKU claims**. Identity attributes stay separate. Input to evaluate/generate.

---

## Work and outputs

### Discover Brand (job)

Fills catalog: Products, SKUs, Listings for a Brand. Separate from analyzing one page.

### Analyze Listing (Run)

One Run targets **one Listing**: observe → (reuse or refresh research/classify) → evaluate/generate as product allows. Many listings ⇒ many Runs.

### Run

Inspectable execution row: Account, actor, type, target, status, timing, credit spend, links to outcomes. Append-only history with attribution.

### Stage

Backend step inside a Run (scrape, parse, research, classify, …). May be hidden in customer UX; still real for cost, reuse, and debugging.

### Artifact

Technical stage output (research notes, claim set, generated fields). May expire under retention policy unless retained by durable records.

### Research / classify reuse

Default: reuse latest research/classify for the same **Product/SKU**. Force refresh is explicit and spends credits.

### Approved content (placeholder)

Account-accepted content version for a Listing (or intended Listing). v1 records approval; live **Publication** to a Platform is later.

---

## Current code → target terms

| Current term | Target reading |
|--------------|----------------|
| `Listing` (parsed JSON) | Listing Snapshot |
| Raw scrape | Source capture |
| `Identity` tuple | Hypothesis for Brand / Product / SKU attributes + match |
| `Tag` / `TagSet` | Claim(s); buckets ≈ old `type`; old `scope` → subject Product/SKU |
| `complianceSensitive` | `sensitive` |
| `Run` | Analyze Listing Run (summary); artifacts not owned solely by it |
| Artifact dirs by ASIN | Become Account-scoped; keyed by Listing + time |
| Auth/billing stubs | User, Account, Membership, Plan, Credits, Usage |
| Organization (old docs) | Account |
