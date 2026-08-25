# townshipamerica

[![npm](https://img.shields.io/npm/v/townshipamerica)](https://www.npmjs.com/package/townshipamerica)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Official TypeScript SDK for the [Township America API](https://townshipamerica.com/api) — convert US PLSS (Public Land Survey System) and Texas TXSS legal land descriptions to GPS coordinates and back.

[Documentation](https://townshipamerica.com/api) · [GitHub](https://github.com/townshipamerica/typescript-sdk) · [npm](https://www.npmjs.com/package/townshipamerica)

## Install

```bash
npm install townshipamerica
```

## Quick Start

```typescript
import { TownshipClient } from "townshipamerica";

const client = new TownshipClient({ apiKey: "YOUR_API_KEY" });

// PLSS to GPS
const plss = await client.search("NW 25 24N 1E 6th Meridian");
console.log(plss.latitude, plss.longitude); // 41.077932 -104.01924
console.log(plss.surveySystem); // "PLSS"

// Texas TXSS to GPS
const tx = await client.search("A-175 Reeves County");
console.log(tx.surveySystem); // "TXSS"
console.log(tx.state); // "TX"

// GPS to legal description (PLSS or TXSS depending on location)
const reverse = await client.reverse(-104.01924, 41.077932);
console.log(reverse.legalLocation);

// Autocomplete (PLSS or TXSS)
const suggestions = await client.autocomplete("A-175", { limit: 5 });
console.log(suggestions.features[0].properties.legal_location);

// Batch — mix PLSS and TXSS in one call (up to 100 per request, auto-chunks larger arrays)
const batch = await client.batchSearch([
  "NW 25 24N 1E 6th Meridian",
  "A-175 Reeves County"
]);
```

## API Reference

### `new TownshipClient(options)`

| Option    | Type     | Default                                 | Description                                                                        |
| --------- | -------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| `apiKey`  | `string` | —                                       | **Required.** Your API key from [townshipamerica.com](https://townshipamerica.com) |
| `baseUrl` | `string` | `https://developer.townshipamerica.com` | Override the API base URL                                                          |
| `timeout` | `number` | `30000`                                 | Request timeout in milliseconds                                                    |

---

### `client.search(legalLocation)`

Convert a PLSS or Texas TXSS legal land description to GPS coordinates.

```typescript
const plss = await client.search("NE 12 4N 5E Indian Meridian");
const tx = await client.search("A-175 Reeves County");
```

**Returns:** `SearchResult`

| Field                    | Type                       | Description                                        |
| ------------------------ | -------------------------- | -------------------------------------------------- |
| `legalLocation`          | `string`                   | Normalized legal description                       |
| `latitude`               | `number`                   | Centroid latitude                                  |
| `longitude`              | `number`                   | Centroid longitude                                 |
| `state`                  | `string`                   | US state                                           |
| `county`                 | `string`                   | County                                             |
| `unit`                   | `string \| null`           | PLSS unit, or `null` for TXSS                      |
| `surveySystem`           | `"PLSS" \| "TXSS"`         | Survey system                                      |
| `alternateLegalLocation` | `string`                   | Alternate description format                       |
| `boundary`               | `GeoJSONBoundary \| null`  | Grid boundary polygon (Polygon or MultiPolygon)    |
| `raw`                    | `GeoJSONFeatureCollection` | Raw API response                                   |

TXSS responses also include `abstract_no`, `block_no`, `survey_name`, and `acreage` on feature properties when available.

---

### `client.reverse(longitude, latitude, options?)`

Find the legal land description at GPS coordinates (PLSS or Texas TXSS).

```typescript
const result = await client.reverse(-104.01924, 41.077932, {
  unit: "First Division"
});
```

**Options:**

| Option | Type                                                           | Description      |
| ------ | -------------------------------------------------------------- | ---------------- |
| `unit` | `'Township' \| 'First Division' \| 'Second Division' \| 'all'` | Precision filter |

**Returns:** `SearchResult` (single unit) or `SearchResult[]` (when `unit: 'all'`)

---

### `client.autocomplete(query, options?)`

Get autocomplete suggestions for a partial PLSS or Texas TXSS description.

```typescript
const fc = await client.autocomplete("NW 25", { limit: 5 });
for (const feature of fc.features) {
  console.log(feature.properties.legal_location);
}
```

**Options:**

| Option      | Type         | Description                           |
| ----------- | ------------ | ------------------------------------- |
| `limit`     | `number`     | Max suggestions, 1–10 (default 3)     |
| `proximity` | `[lng, lat]` | Bias results toward these coordinates |

**Returns:** `GeoJSONFeatureCollection`

---

### `client.batchSearch(locations, options?)`

Convert multiple descriptions in one request. Automatically chunks arrays larger than 100.

```typescript
const results = await client.batchSearch([
  "NW 25 24N 1E 6th Meridian",
  "NE 12 4N 5E Indian Meridian"
]);
// results[0] is SearchResult or null (if no match)
```

**Returns:** `(SearchResult | null)[]`

---

### `client.batchReverse(coordinates, options?)`

Reverse geocode multiple coordinate pairs. Automatically chunks arrays larger than 100.

```typescript
const results = await client.batchReverse(
  [
    [-104.01924, 41.077932],
    [-104.648933, 41.454928]
  ],
  { unit: "Township" }
);
```

**Options:**

| Option      | Type                                                           | Description                         |
| ----------- | -------------------------------------------------------------- | ----------------------------------- |
| `unit`      | `'Township' \| 'First Division' \| 'Second Division' \| 'all'` | Precision filter                    |
| `chunkSize` | `number`                                                       | Items per request (default/max 100) |

**Returns:** `(SearchResult | null)[]`

---

### `client.boundary(legalLocation)`

Get just the boundary polygon for a legal description.

```typescript
const polygon = await client.boundary("NW 25 24N 1E 6th Meridian");
// polygon.type === 'Polygon'
// polygon.coordinates === [[[lng, lat], ...]]
```

**Returns:** `GeoJSONPolygon | GeoJSONMultiPolygon | null`

---

### `client.raw(legalLocation)`

Get the raw GeoJSON FeatureCollection from the API (no transformation).

```typescript
const fc = await client.raw("NW 25 24N 1E 6th Meridian");
```

**Returns:** `GeoJSONFeatureCollection`

---

### `client.energyReport(legalLocation, options?)`

Energy parcel report for a PLSS section — state-regulator wells, operators,
BLM federal leases, ONRR county royalties, orphaned wells, pipelines,
FracFocus disclosures, and development constraints.

```typescript
const report = await client.energyReport("25 24N 1E 6th Meridian");
console.log(report.summary.wells_in_section);
console.log(report.wells?.in_section.rows[0]?.api_number);

// Only the sections you need — the rest are never queried
const slim = await client.energyReport("25 24N 1E 6th Meridian", {
  include: ["wells", "pipelines"]
});

// Attach the parcel boundary under parcel.geometry
const withGeometry = await client.energyReport("25 24N 1E 6th Meridian", {
  include: ["geometry"]
});
```

**Options:** `include` — any of `wells`, `operators`, `leases`, `royalties`,
`orphaned_wells`, `pipelines`, `fracfocus`, `constraints`, `geometry`.

**Returns:** `EnergyReport`. Array sections are
`{total, returned, truncated, more, rows}` envelopes; a failed section lands
in `meta.unavailable` instead of failing the report.

---

### `client.federalLandReport(legalLocation, options?)`

Federal-land parcel report for a PLSS tract — surface management, BLM O&G and
geothermal leases, rights-of-way, flood zones, mining claims, wetlands,
firesheds, soils, crop history, orphaned wells, critical habitat, public
access, wildfire risk, and elevation.

```typescript
const report = await client.federalLandReport("NW 25 24N 1E 6th Meridian");
console.log(report.surface_management?.rows[0]?.agency);

const slim = await client.federalLandReport("NW 25 24N 1E 6th Meridian", {
  include: ["og_leases", "flood_zones"]
});
```

**Options:** `include` — any of `surface_management`, `og_leases`,
`geothermal_leases`, `rights_of_way`, `flood_zones`, `mining_claims`,
`wetlands`, `fireshed`, `soils`, `crop_history`, `orphaned_wells`,
`critical_habitat`, `public_access`, `wildfire_risk_communities`,
`elevation`, `geometry`.

**Returns:** `FederalLandReport`. `report_scope` is `"containing_section"`
when the tract is finer than the stored grid (the section is named by
`report_section`); a layer the state has no data for is listed in
`meta.unavailable` with reason `no_state_coverage`.

---

### `client.texasReport(legalLocation, options?)`

Texas abstract report for a TXSS legal description — GLO state leases and
pooled units, PSF lands, state-agency lands, upland leases, RRC wells and T-4
pipelines, pending permits, coastal erosion, federal overlays (flood zones,
wetlands, firesheds, soils, orphaned wells, critical habitat, wildfire risk),
elevation, and RRC lease production.

```typescript
const report = await client.texasReport("A-175 Reeves County");
console.log(report.active_wells?.rows[0]?.api_number);
console.log(report.production?.summary.total_cum_boe);

const slim = await client.texasReport("A-175 Reeves County", {
  include: ["state_leases", "production"]
});
```

**Options:** `include` — any of `state_leases`, `state_units`, `psf_lands`,
`state_agency_lands`, `upland_leases`, `active_wells`, `pipelines`,
`pending_permits`, `coastal_erosion`, `flood_zones`, `wetlands`, `fireshed`,
`soils`, `orphaned_wells`, `critical_habitat`, `wildfire_risk_communities`,
`elevation`, `production`, `geometry`.

**Returns:** `TexasReport`

---

### `client.texasProduction(options)`

RRC lease production for a Texas abstract — per-lease lifetime totals,
trailing-12-month volumes, and the 60-month monthly series. Key by a legal
description OR the registry ids.

```typescript
const byLocation = await client.texasProduction({ legalLocation: "A-175 Reeves County" });
const byKeys = await client.texasProduction({ countyFips: "48389", abstractNo: "175" });
console.log(byKeys.summary.total_cum_boe);
```

**Options:** `{ legalLocation }` or `{ countyFips, abstractNo, blockNo? }`

**Returns:** `TexasProduction`. Production is reported by RRC at the lease
level — rows are the leases whose wells fall on the abstract, never
sub-allocated to the tract.

---

### `client.texasWell(api)`

Per-well allocated production for a Texas well by API number (API-8 or
API-14) — summary scalars for every lease edge, the monthly series (when
provisioned), and an Arps decline fit.

```typescript
const well = await client.texasWell("42-389-32345");
console.log(well.units[0]?.cum_boe);
if (well.decline.available) console.log(well.decline.value?.di);
```

**Returns:** `TexasWell`. Volumes are allocated estimates — RRC reports
production by lease, never by well.

---

## Error Handling

All errors extend `TownshipError`:

```typescript
import {
  TownshipClient,
  TownshipError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  PayloadTooLargeError
} from "townshipamerica";

try {
  await client.search("NW 25 24N 1E 6th Meridian");
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Invalid API key (401)
  } else if (error instanceof NotFoundError) {
    // No results found
  } else if (error instanceof RateLimitError) {
    // Too many requests (429)
  } else if (error instanceof ValidationError) {
    // Bad request (400)
  }
}
```

Errors from the Energy, Federal Land, and Texas APIs also carry a
machine-readable `code` (e.g. `invalid_parameter`, `plss_not_supported`,
`ambiguous_location`, `not_found`, `rate_limit_exceeded`); it is `null` for
endpoints that do not send one:

```typescript
try {
  await client.texasReport("NW 25 24N 1E 6th Meridian");
} catch (error) {
  if (error instanceof ValidationError && error.code === "plss_not_supported") {
    // Use federalLandReport or energyReport for PLSS descriptions
  }
}
```

## What's new in v2.0.0

v2.0.0 adds the parcel-report APIs:

- `client.energyReport(legalLocation, { include? })` — Energy API report
- `client.federalLandReport(legalLocation, { include? })` — Federal Land API report
- `client.texasReport(legalLocation, { include? })` — Texas abstract report
- `client.texasProduction({ legalLocation } | { countyFips, abstractNo, blockNo? })` — RRC lease production
- `client.texasWell(api)` — per-well allocated production + Arps decline fit

Breaking changes:

- Error classes gained a third constructor parameter and a readonly `code`
  property (`string | null`). If you subclass or construct SDK errors
  directly, update the constructor calls; `instanceof` checks are unaffected.
- Error bodies of the form `{"error": {"code", "message"}}` (Energy, Federal
  Land, and Texas APIs) are now parsed into `error.message`/`error.code`.
  Legacy `{"error": "..."}` / `{"message": "..."}` bodies parse as before.

## Format Examples

### PLSS (30 states)

```
NW 25 24N 1E 6th Meridian     → Quarter Section (First Division)
25 24N 1E 6th Meridian         → Section (Second Division)
24N 1E 6th Meridian            → Township
NE 12 4N 5E Indian Meridian   → Named meridian
7 2N 3E Black Hills Meridian  → Section with named meridian
```

### Texas TXSS

```
A-175 Reeves County
Abstract 175 Reeves County Texas
Block 25 Section 14 Pecos County
Survey H&TC, Travis County
```

## License

MIT — [Maps & Apps Inc.](https://townshipamerica.com)
