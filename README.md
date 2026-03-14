# townshipamerica

[![npm](https://img.shields.io/npm/v/townshipamerica)](https://www.npmjs.com/package/townshipamerica)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Official TypeScript SDK for the [Township America API](https://townshipamerica.com/api) — convert US PLSS (Public Land Survey System) legal land descriptions to GPS coordinates and back.

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
const result = await client.search("NW 25 24N 1E 6th Meridian");
console.log(result.latitude, result.longitude); // 41.077932 -104.01924
console.log(result.state); // "Colorado"
console.log(result.county); // "Weld"

// GPS to PLSS
const reverse = await client.reverse(-104.01924, 41.077932);
console.log(reverse.legalLocation); // "NW 25 24N 1E 6th Meridian"

// Autocomplete
const suggestions = await client.autocomplete("NW 25", { limit: 5 });
console.log(suggestions.features[0].properties.legal_location);

// Batch (up to 100 per request, auto-chunks larger arrays)
const batch = await client.batchSearch([
  "NW 25 24N 1E 6th Meridian",
  "NE 12 4N 5E Indian Meridian"
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

Convert a PLSS legal land description to GPS coordinates.

```typescript
const result = await client.search("NE 12 4N 5E Indian Meridian");
```

**Returns:** `SearchResult`

| Field                    | Type                       | Description                                        |
| ------------------------ | -------------------------- | -------------------------------------------------- |
| `legalLocation`          | `string`                   | Normalized legal description                       |
| `latitude`               | `number`                   | Centroid latitude                                  |
| `longitude`              | `number`                   | Centroid longitude                                 |
| `state`                  | `string`                   | US state                                           |
| `county`                 | `string`                   | County                                             |
| `unit`                   | `string`                   | `Township`, `First Division`, or `Second Division` |
| `surveySystem`           | `string`                   | `PLSS`                                             |
| `alternateLegalLocation` | `string`                   | Alternate description format                       |
| `boundary`               | `GeoJSONPolygon \| null`   | Grid boundary polygon                              |
| `raw`                    | `GeoJSONFeatureCollection` | Raw API response                                   |

---

### `client.reverse(longitude, latitude, options?)`

Find the PLSS description at GPS coordinates.

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

Get autocomplete suggestions for a partial PLSS description.

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

**Returns:** `GeoJSONPolygon | null`

---

### `client.raw(legalLocation)`

Get the raw GeoJSON FeatureCollection from the API (no transformation).

```typescript
const fc = await client.raw("NW 25 24N 1E 6th Meridian");
```

**Returns:** `GeoJSONFeatureCollection`

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

## PLSS Format Examples

```
NW 25 24N 1E 6th Meridian     → Quarter Section (First Division)
25 24N 1E 6th Meridian         → Section (Second Division)
24N 1E 6th Meridian            → Township
NE 12 4N 5E Indian Meridian   → Named meridian
7 2N 3E Black Hills Meridian  → Section with named meridian
```

## License

MIT — [Maps & Apps Inc.](https://townshipamerica.com)
