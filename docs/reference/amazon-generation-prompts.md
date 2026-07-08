# Amazon Listing Generation — Logic and Prompts

## What this document is for

This document explains how to generate four Amazon listing fields for a product, and gives four ready-to-run prompts that do it. The four fields are the Title, a new field called Item Highlights, the About This Item bullets, and the Product Description. The rules here follow Amazon's title changes that take effect on 27 July 2026.

Two goals run through every field. The first is keyword discovery: matching the words a shopper types into the Amazon search bar. The second is intent discovery: matching the way a person phrases a request to an AI assistant. Every field is also filled as close to its character limit as the real product information allows, because unused space is wasted search coverage.

The generator does not invent keywords or use a separate keyword list. Everything it writes comes from a structured analysis of the product, described in section 2. So the quality of the output depends on how complete that analysis is.

---

## 1. Background: the Amazon title change from 27 July 2026

Until now, Amazon product titles could run to roughly 200 characters, and sellers commonly filled the tail end with extra search keywords that a shopper never really reads but the search engine still indexes.

From 27 July 2026 that changes in most non-media categories:

- **The Title is capped at 75 characters** (including spaces). It should carry only the core identifiers: brand, product type, the main distinguishing attribute, size, and at most one primary benefit.
- **A new Item Highlights field holds up to 125 characters.** This is where the secondary specs, materials, and extra keywords now live. In effect, the keyword tail that used to sit at the end of the long title moves into this separate field. This field also feeds voice assistants such as Alexa and AI answer engines, so it is written to carry both search keywords and natural-language intent, not just a keyword dump.
- If a seller does nothing, Amazon's own system will rewrite and split the title automatically, which risks dropping the specific terms that drive sales. So the safer path is to generate these fields deliberately.

The other two fields are unchanged by this update but are generated here for completeness:

- **About This Item** bullets: 10 to 500 characters each. In practice the useful limit is the mobile view, so all five bullets together should stay under about 1,000 characters.
- **Product Description**: up to 2,000 characters, plain text only.

---

## 2. The input: how each product is described (the tag model)

Before any field is generated, an earlier analysis step reads the product's current Amazon page (its live title, bullets, description, A+ content, and images) and turns it into a structured object. That object has two parts: the product's identity, and a list of tags. Both are the input to every prompt in this document.

### 2a. Identity

Identity is the product expressed as a set of named parts rather than one string:

- **brand**: the maker, for example Dettol. May point to a parent brand (for example Nivea Men points to Nivea).
- **category**: the product type, for example Cleaning Wipes.
- **family**: a specific version of the product, defined by the attributes that change what the product is or what can be claimed about it, such as formulation or fragrance. For example, Dettol Cleaning Wipes Alcohol-Free is one family; the alcoholic version is a different family.
- **sku**: the exact thing a shopper buys, which is that version in one particular pack and size, for example a box of 120 wipes.
- **displayName**: a readable name assembled from the parts above.

### 2b. Tags

A tag is one atomic fact or claim about the product, for example "alcohol-free" or "kills 99.9% of germs". Each tag carries five pieces of metadata that the generator relies on:

**type** — what kind of descriptor it is. There are six:
- *fact*: an objective attribute, for example "alcohol-free", "120 wipes".
- *functional*: something the product does, for example "kills 99.9% of germs", "multi-surface cleaning".
- *sensory*: how it looks, smells, or feels, for example "fresh scent".
- *emotional*: the feeling or trust it trades on, for example "trusted hygiene brand".
- *occasion*: when or where it is used, for example "kitchen", "quick everyday cleaning".
- *audience*: who it is for, for example "families with kids", "for children".

**scope** — the level of the product hierarchy at which the tag is true. This is the concept that decides title priority, so it is worth being precise. Products sit in a four-level hierarchy, from most general to most specific:

- *brand*: true of everything the brand makes. "Trusted hygiene brand" is true of every Dettol product.
- *category*: true of the whole product type. "Disposable wipe format" is true of every cleaning wipe.
- *family*: true of this specific version across all its pack sizes. "Alcohol-free" and "multi-surface cleaning" are true of the alcohol-free wipes whether you buy the box of 60 or the box of 120.
- *sku*: true of this one listing only. "120 wipes" and "box format" describe this exact pack and nothing else.

"Deeper scope" means further down that list, closer to the individual listing. This matters because the title has only 75 characters to spend. A brand or category tag is generic: it is shared by dozens of the brand's other listings, so it does little to tell this product apart from them. A family or sku tag is specific to this listing, so it is exactly what a shopper needs in order to identify and choose it. When title space runs out, the specific attributes are kept and the generic ones are pushed down to the fields below. That is what "scope is the priority ladder for the title" means in practice: keep the specific, drop the generic.

**source** — where the tag came from:
- *observed*: taken from the product's actual page, so it can be stated plainly as fact.
- *inferred*: worked out by research rather than seen on the page, so it is treated as softer positioning, not a hard claim.

**complianceSensitive** — true or false. A true flag means the claim is regulated (common in health, pharma, and hygiene) and must be handled with care, as set out in section 4.

**confidence** — a number from 0 to 1 for how sure the analysis is about the tag. Higher confidence tags can be stated more assertively.

### 2c. The shape of the input object

```
{
  "identity": {
    "brand": { "name": "...", "parentBrand": null },
    "category": "...",
    "family": { "name": "...", "variantAttributes": { "...": "..." } },
    "sku": { "packaging": "...", "size": "..." },
    "displayName": "..."
  },
  "tags": [
    { "value": "...", "type": "fact|functional|sensory|emotional|occasion|audience",
      "scope": "brand|category|family|sku",
      "complianceSensitive": true|false,
      "source": "observed|inferred",
      "evidence": "...",
      "confidence": 0.0-1.0 }
  ],
  "scraped": { "title": "...", "bullets": ["..."], "description": "..." }
}
```

The `scraped` block is the current live listing text, kept so the generator can preserve the exact wording of any observed claim rather than reword a regulated statement.

---

## 3. How tags become the four fields

Two signals drive the routing. **Type** decides which field a tag naturally belongs in. **Scope** decides how much priority it gets when space is tight, as explained above.

| Tag type | Where it goes | Which discovery it serves |
|---|---|---|
| fact | Title (size, form, key attribute), Highlights (secondary specs) | Keyword |
| functional | Title (one benefit, if room), Bullets, Description | Both |
| sensory | Highlights, Bullets, Description | Mild keyword and intent |
| emotional | Description opening, bullet framing | Intent |
| occasion | Bullets, Description, Highlights if space | Intent |
| audience | Title or Highlights (as a target-user term), Bullets, Description | Both |

### The keyword and intent split, inside every field

- **Keyword discovery** is the words a shopper types: short noun phrases like brand plus attribute plus size. These come from fact and functional tags and sit at the front of the title, the highlights, and each bullet head.
- **Intent discovery** is how someone asks an AI assistant: full sentences about when, why, and who. These come from occasion, emotional, and audience tags and live in the bullet bodies and the description prose.

**Audience sits in both.** A phrase like "nutrition drink for kids" is at once a real search term a parent types (keyword) and a statement of who the product is for (intent). So audience terms are not confined to soft framing in the description; when they are observed and high-confidence, they can appear as a title element and as a bullet head, and they still do intent work in the prose. The one limit is provenance: an audience tag that is only inferred (like guessing "families with kids" for a general cleaning wipe) stays as soft framing and does not become a title element or a hard claim.

Every bullet is built as a keyword head then an intent sentence, so each line serves both at once. The description is mostly intent, with keyword phrases folded in naturally.

---

## 4. Provenance and compliance gates

Applied in every field, so a claim is never stronger than its evidence:

1. **source observed** can be stated plainly as fact.
2. **source inferred** becomes positioning or use-case language, never a hard product claim.
3. **complianceSensitive true** may appear only using wording that mirrors what is on the actual page, never amplified, and never promoted into the title as a hook unless it is already the product's registered claim. A tag that is both inferred and compliance-sensitive is dropped from claims entirely.

Confidence sets a floor: about 0.8 and above to state as fact in the title, highlights, or a bullet head; 0.6 to 0.8 usable as soft framing in the description; below 0.6 dropped.

---

## 5. Field-by-field rules

### Title (75 characters, target 70 to 75)

Built in a fixed order, split into a protected core that always ships and an optional tail that fills only while space remains.

**Protected core, in this order:**
1. Brand.
2. Product type (the wording with the most search intent, drawn from the category and the current title).
3. Primary distinguishing attribute (the highest-confidence claim-bearing family attribute, for example a formulation or a flavour).
4. Target user, only when the product is defined by who it is for and the audience tag is observed and high-confidence, for example a drink sold specifically for kids. When the audience is inferred or merely a nice-to-have, this element is skipped here and left to the highlights or description.
5. Size or count (the sku fact).
6. Packaging form (the sku fact, for example box, pouch, sachet). Size and packaging often read best merged, for example "Box of 120".

**Optional tail, added only while the running total stays at or under 75, in this priority:**
7. One primary benefit (highest-confidence functional tag, preferring one that is not compliance-sensitive).
8. A secondary distinguishing attribute.

**A benefit is never guaranteed a place.** It is the first thing dropped when there is no room, and no protected-core element is ever sacrificed to fit one. Whenever the brand and product-type wording is long, expect the tail to drop out completely and the title to stop at the core. If the protected core alone still exceeds 75, compress the product-type wording first, then drop the packaging form, then drop the target user, then shorten the primary attribute. Brand, product type, and size are never dropped.

Fill toward 75 using real elements only. Never pad with filler words to reach the count.

### Item Highlights (125 characters, target 118 to 125)

This field holds the secondary layer that no longer fits in the shortened title, and it is also used to prime voice assistants such as Alexa and AI answer engines. So it is not a plain keyword dump: it has to pack both the search keywords a shopper types and the natural-language intent cues a person speaks, within 125 characters. Write it as semicolon-separated fragments that each carry a keyword and, where possible, an intent modifier: what it is (alcohol-free disinfectant wipes), where and when it is used (for kitchen, daily), who it is for (for homes with kids), and the key spec (box of 120). Draw from the tags that did not make the title: the primary benefit or regulated claim (stated exactly as it appears on the page), secondary specs, scent, use-surfaces, occasion, packaging, and any audience term not already used. The compliance gates apply, and an inferred audience term may only be implied as framing (for homes with kids), never stated as a safety claim. Spell out "and" rather than using an ampersand, use no special characters, and fill toward 125.

### About This Item (5 bullets, about 190 to 200 characters each, total under 1,000)

The 500-character per-bullet ceiling is not the target. The binding constraint is the mobile view, so keep all five together under 1,000 characters and fill toward it. Each bullet is a capitalised keyword head, then a colon, then one plain intent sentence. The head is the keyword a shopper searches; the sentence answers when, why, or who.

Suggested routing across the five:
1. Top distinguishing attribute.
2. Primary benefit or functional claim (compliance-aware).
3. Second functional or sensory point, for example multi-surface.
4. Occasion: when and why to use it.
5. Sku facts (size, pack), with an audience note.

An observed, high-confidence audience tag can be a keyword head in its own right (for example a bullet led by who the product is made for). An inferred audience tag appears only as soft framing. No emojis, no promotional phrases, no special characters.

### Product Description (2,000 characters, target 1,900 to 1,990)

Plain text, filled as close to 2,000 as the real content allows, without padding or repeated sentences. Blank lines may separate paragraphs. Intent-led throughout, with keyword phrases folded in naturally.

Structure:
- Open with the emotional and audience framing: who it is for and why.
- Middle covers functional and occasion: what it does, across which surfaces or uses, and when it fits into the day.
- Add the sensory note (scent or feel) if there is one.
- Close with the facts (size, pack, reseal) and a final sentence that folds in the main phrase a shopper would search.

The provenance gates apply.

---

## 6. The four prompts

Each prompt is standalone. Paste the product's input object (section 2c) in place of `{{RESEARCH_JSON}}` and run. Prompts B onward also take the fields generated before them so they do not repeat content.

### Prompt A — Title

```
You are generating an Amazon product title under the rules effective 27 July 2026.

INPUT (one product object with identity, tags, and the current scraped listing):
{{RESEARCH_JSON}}

HARD LIMIT: 75 characters including spaces. Target 70 to 75.

BUILD ORDER
Protected core, always present, in this order:
1. Brand name.
2. Product type: the wording with the most search intent, taken from identity.category and the scraped title.
3. Primary distinguishing attribute: the highest-confidence claim-bearing variantAttribute (family scope, source observed preferred), for example a formulation or flavour.
4. Target user: include here ONLY when the product is defined by who it is for AND the audience tag is source observed at confidence 0.8 or above (for example a drink made specifically for kids). Otherwise skip it here.
5. Size or count: the sku-scope fact.
6. Packaging form: the sku-scope fact (box, pouch, sachet). Merge with size where it reads better, for example "Box of 120".

Optional tail, added only while the running total stays at or under 75, in this priority:
7. One primary benefit: the highest-confidence functional tag, preferring one that is NOT complianceSensitive.
8. A secondary distinguishing attribute.

RULES
- A benefit is never guaranteed a slot. Drop the tail from the bottom up when there is no room. Never drop a protected-core element to fit a benefit.
- If the protected core alone exceeds 75, compress the product-type wording first, then drop packaging, then drop the target user, then shorten the primary attribute. Never drop brand, product type, or size.
- An inferred audience tag never enters the title. Leave it to highlights or description.
- Fill toward 75 using real elements only. Do not pad with filler.
- complianceSensitive tags may appear only using wording that mirrors the observed page text, and only if already the registered claim. Drop any tag that is both inferred and complianceSensitive.
- Use numerals for measurements with a space before the unit. Spell out "and". No emojis, no promotional phrases, no special characters, no em dashes.

OUTPUT
Title: <the title>
Characters: <count including spaces>
Included from tail: <list, or none>
Dropped and why: <one line>
```

### Prompt B — Item Highlights

```
You are generating the Amazon Item Highlights field (new field, effective 27 July 2026).

INPUT (one product object with identity, tags, and the current scraped listing):
{{RESEARCH_JSON}}

TITLE ALREADY GENERATED (do not repeat its elements):
{{TITLE}}

HARD LIMIT: 125 characters including spaces. Target 118 to 125.

PURPOSE
This field is also used to prime voice assistants such as Alexa and AI answer engines. It must pack BOTH the search keywords a shopper types AND the natural-language intent cues a person speaks, inside 125 characters. It is not a plain keyword dump.

WHAT GOES HERE
Semicolon-separated fragments, each carrying a keyword and, where it fits, an intent modifier: what it is, where and when it is used, who it is for, and the key spec. Draw from the tags that did not make the title: the primary benefit or regulated claim, secondary specs, scent (sensory), use-surfaces, occasion, packaging, and any audience term not already used.

RULES
- complianceSensitive tags appear only using wording that mirrors the observed page text; drop any that are both inferred and complianceSensitive.
- State as fact only tags at confidence 0.8 or above. An inferred audience term may be implied as framing (for example "for homes with kids"), never stated as a safety claim.
- Spell out "and". Use numerals with a space before units. No emojis, no promotional phrases, no special characters, no em dashes.
- Fill toward 125 using real tags only.

OUTPUT
Item Highlights: <the field>
Characters: <count including spaces>
Rationale: <one short paragraph: which tags were placed here and any dropped on compliance or confidence grounds>
```

### Prompt C — About This Item bullets

```
You are generating five Amazon About This Item bullets.

INPUT (one product object with identity, tags, and the current scraped listing):
{{RESEARCH_JSON}}

LIMITS: 10 to 500 characters per bullet, but the binding target is the mobile budget. Keep all five together under 1,000 characters and fill toward it. Aim about 190 to 200 characters per bullet.

FORMAT
Each bullet is a capitalised keyword head, then a colon, then one plain intent sentence. The head is the keyword a shopper searches (a spec, benefit, or who it is for). The sentence answers when, why, or who.

ROUTING ACROSS THE FIVE
1. Top distinguishing attribute.
2. Primary benefit or functional claim (compliance-aware).
3. Second functional or sensory point (for example multi-surface).
4. Occasion: when and why to use it.
5. Sku facts (size, pack) with an audience note.

RULES
- complianceSensitive claims mirror the observed page text and are not amplified; drop any that are both inferred and complianceSensitive.
- An observed audience tag at confidence 0.8 or above can be a keyword head; an inferred audience tag appears only as soft framing.
- State as fact only tags at confidence 0.8 or above.
- No emojis, no promotional phrases, no special characters, no em dashes.

OUTPUT
For each bullet: the bullet text, then its character count.
Then: Total characters across all five.
Then: Rationale: <one short paragraph on tag routing and anything dropped>
```

### Prompt D — Product Description

```
You are generating the Amazon Product Description.

INPUT (one product object with identity, tags, and the current scraped listing):
{{RESEARCH_JSON}}

HARD LIMIT: 2,000 characters including spaces and any line breaks. Target 1,900 to 1,990. Fill as close to 2,000 as the real content allows. Do not pad with filler or repeat sentences to reach the count.

FORMAT: plain text. Blank lines may separate paragraphs. No HTML beyond simple line breaks.

STRUCTURE (intent-led, keyword phrases folded in naturally)
- Open with the emotional and audience framing: who it is for and why.
- Middle: functional and occasion. What it does, across which surfaces or uses, and when it fits into the day.
- Add the sensory note (scent or feel) if present.
- Close with the facts (size, pack, reseal) and a final sentence that folds in the main phrase a shopper would search.

RULES
- source observed can be stated plainly; source inferred becomes positioning or use-case language, not a hard claim.
- complianceSensitive claims mirror the observed page text and are not amplified; drop any that are both inferred and complianceSensitive.
- Confidence 0.6 to 0.8 may be used only as soft framing; below 0.6 drop.
- No emojis, no promotional phrases, no special characters, no em dashes.

OUTPUT
Product Description: <the description>
Characters: <count including spaces and line breaks>
Rationale: <one short paragraph on which tags drove which part and anything dropped>
```

---

## 7. Worked example

To make the routing concrete, here is a full example for one product: Dettol alcohol-free disinfectant wipes, a box of 120.

**The input tags for this product** (the effective set):

| value | type | scope | source | compliance | confidence |
|---|---|---|---|---|---|
| trusted hygiene brand | emotional | brand | inferred | no | 0.90 |
| kills 99.9% of germs | functional | brand | observed | yes | 0.95 |
| disposable wipe format | fact | category | inferred | no | 0.95 |
| quick everyday cleaning | occasion | category | inferred | no | 0.80 |
| alcohol-free | fact | family | observed | no | 0.95 |
| multi-surface cleaning | functional | family | observed | no | 0.90 |
| regular fragrance | sensory | family | observed | no | 0.85 |
| kitchen | occasion | family | observed | no | 0.85 |
| families with kids | audience | family | inferred | no | 0.70 |
| 120 wipes | fact | sku | observed | no | 1.00 |
| box format | fact | sku | observed | no | 0.90 |

Its current title is "Dettol Disinfectant Cleaning Wipes for Home, 120 Wipes".

**Title (65 characters)**
Dettol Alcohol-Free Disinfectant Wipes, Multi-Surface, Box of 120

The protected core is Dettol, Disinfectant Wipes, Alcohol-Free, and the sku facts merged as Box of 120 (50 characters). Target user is skipped because the only audience tag here, "families with kids", is inferred at 0.70. That leaves room in the tail, so the benefit "Multi-Surface" is added. "Kills 99.9% of germs" is left out of the title because it is brand scope (generic to every Dettol product) and compliance-sensitive, so it moves down to the highlights and a bullet.

**Title, the drop case (71 characters)**
Dettol Antibacterial Alcohol-Free Disinfectant Surface Wipes, 120 Wipes

If the brand and type wording were longer, as here, the protected core alone would leave no room, so the tail drops entirely and the title stops at the core.

**Title, an audience-in-title case (50 characters)**
Complan Nutrition Drink for Kids, Chocolate, 500 g

For a different product where the audience is observed and central to how it is searched, "for Kids" is a target-user element inside the protected core, sitting after the flavour and before the size. This is the "nutrition drink for kids" pattern, where audience is both the search term and the intent.

**Item Highlights (121 characters)**
Alcohol-free disinfectant wipes for kitchen; kills 99.9% germs; box of 120; multi-surface daily clean for homes with kids

Written to prime Alexa and AI answer engines, so it blends keywords and intent: the product term (alcohol-free disinfectant wipes), where it is used (for kitchen), the observed germ claim, the pack spec, the multi-surface daily use, and the audience as soft framing (for homes with kids). A spoken query like "alcohol-free wipes for the kitchen safe for a home with kids" can match this line.

**About This Item (945 characters total)**

ALCOHOL-FREE FORMULA: Cleans without alcohol, so it stays gentle enough for homes with young children and pets while still lifting everyday dirt and grime from the surfaces your family touches most (197)

KILLS 99.9% OF GERMS: Each wipe is made to remove 99.9% of germs from hard surfaces, giving reassurance on kitchen counters, dining tables and the other high-contact spots around a busy home (190)

MULTI-SURFACE CLEANING: One wipe handles sealed worktops, tables, cupboard doors and everyday appliances, so you do not need a separate product for every surface across the kitchen and living areas (197)

QUICK EVERYDAY CLEAN-UP: Ready to use straight from the box with no spray or cloth needed, ideal for fast clean-ups after cooking, family meals or the messy moments that come with young kids (190)

BOX OF 120 WIPES: A resealable box of 120 disposable wipes keeps each one moist and within easy reach, so it is simple to keep a pack on the counter and use them every day (171)

**Product Description (1,982 characters)**

Keeping a busy family home clean should not mean reaching for harsh chemicals every time a surface needs a wipe. Dettol Alcohol-Free Disinfectant Wipes are made for households that want a fast, trusted way to clean the surfaces the whole family uses through the day, without the sharp bite of alcohol. They are designed to fit into normal daily routines rather than sit in a cupboard for occasional deep cleans, so they are ready the moment a quick wipe is needed.

Because the formula is alcohol-free, it is a sensible choice for homes with young children and pets, where surfaces are touched, leaned on, spilled on and wiped down all day long. Each wipe is made to remove 99.9% of germs from hard surfaces and to clean across many of them, from kitchen counters and dining tables to sealed worktops, cupboard doors and everyday appliances. That means a single pack can cover most of the small cleaning jobs around the kitchen and living areas, instead of needing a different spray or a fresh cloth for each one.

They are built for quick, everyday use. Pull a wipe straight from the box, clean up right after cooking or a family meal, and throw it away, with no spray bottle to reach for and no cloth to rinse and wring out afterwards. Each wipe leaves a light, fresh scent behind rather than a heavy chemical smell, so the kitchen feels clean without being overpowering. That makes them easy to keep on the counter or by the sink for the small spills, crumbs and sticky marks that turn up throughout the day, especially when there are children around.

Each box holds 120 disposable wipes and reseals after every use, so the wipes stay moist and ready right down to the last one. If you are looking for alcohol-free disinfectant wipes for the kitchen that are gentle enough for a home with kids yet strong enough for daily multi-surface cleaning, this box is made to sit within easy reach and get used often, keeping everyday hygiene simple across the busiest rooms in the house.

**Rationale**
The specific attributes drove the 75-character title: brand, the alcohol-free formulation, the pack size and packaging merged as Box of 120, and the multi-surface benefit that happened to fit. The germ claim sits in the highlights and one bullet rather than the title, because it is generic to the whole brand and is compliance-sensitive, so it mirrors the page wording and is not amplified. The highlights field is written to prime Alexa and AI answer engines, so it packs both the search keywords and the spoken intent within 125 characters. Occasion tags (kitchen, quick everyday) and the audience framing carry the intent layer through the bullet bodies and the description, while the search phrases a shopper types sit at the front of the title, highlights, and bullet heads. The one low-confidence tag, "families with kids" at 0.70 and inferred, is used only as soft framing and is kept out of the title.
