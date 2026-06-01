// --- Client Options ---

export interface TownshipClientOptions {
  /** Township America API key. */
  apiKey: string;
  /** Override the default API base URL. */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000). */
  timeout?: number;
}

// --- GeoJSON Geometry ---

export interface GeoJSONPoint {
  type: "Point";
  coordinates: [longitude: number, latitude: number];
}

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface GeoJSONMultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

export type GeoJSONBoundary = GeoJSONPolygon | GeoJSONMultiPolygon;

// --- Feature Properties ---

export type Unit = "Township" | "First Division" | "Second Division";

export type SurveySystem = "PLSS" | "TXSS";

export interface FeatureProperties {
  shape: "grid" | "centroid";
  search_term: string | number[];
  legal_location: string;
  alternate_legal_location?: string;
  unit?: Unit | null;
  survey_system?: SurveySystem | string;
  county?: string;
  state?: string;
  /** Texas abstract number (TXSS only). */
  abstract_no?: string;
  /** Texas block number (TXSS only). */
  block_no?: string;
  /** Texas survey name (TXSS only). */
  survey_name?: string;
  /** Reported acreage when available (TXSS only). */
  acreage?: number;
}

// --- GeoJSON Features ---

export interface GeoJSONFeature<G = GeoJSONPoint | GeoJSONBoundary> {
  type: "Feature";
  geometry: G;
  properties: FeatureProperties;
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

// --- SDK Result Types ---

export interface SearchResult {
  /** The normalized legal land description. */
  legalLocation: string;
  /** Latitude of the centroid. */
  latitude: number;
  /** Longitude of the centroid. */
  longitude: number;
  /** US state where the land unit is located. */
  state: string | undefined;
  /** County where the land unit is located. */
  county: string | undefined;
  /** The land unit type (Township, First Division, Second Division). Null for TXSS. */
  unit: string | null | undefined;
  /** The survey system: PLSS or TXSS (Texas). */
  surveySystem: SurveySystem | string | undefined;
  /** Alternate legal land description if available. */
  alternateLegalLocation: string | undefined;
  /** Grid boundary polygon, or null if no boundary returned. */
  boundary: GeoJSONBoundary | null;
  /** The raw GeoJSON FeatureCollection from the API. */
  raw: GeoJSONFeatureCollection;
}

// --- Method Options ---

export interface ReverseOptions {
  /** Precision level: 'Township', 'First Division', 'Second Division', or 'all'. */
  unit?: Unit | "all";
}

export interface AutocompleteOptions {
  /** Maximum number of suggestions (1–10, default 3). */
  limit?: number;
  /** [longitude, latitude] to bias results toward. */
  proximity?: [number, number];
}

export interface BatchSearchOptions {
  /** Max items per HTTP request (default 100, max 100). */
  chunkSize?: number;
}

export interface BatchReverseOptions {
  /** Precision level: 'Township', 'First Division', 'Second Division', or 'all'. */
  unit?: Unit | "all";
  /** Max items per HTTP request (default 100, max 100). */
  chunkSize?: number;
}
