import {
  AuthenticationError,
  NotFoundError,
  PayloadTooLargeError,
  RateLimitError,
  TownshipError,
  ValidationError
} from "./errors.js";
import type {
  AutocompleteOptions,
  BatchReverseOptions,
  BatchSearchOptions,
  GeoJSONFeatureCollection,
  GeoJSONPolygon,
  ReverseOptions,
  SearchResult,
  TownshipClientOptions
} from "./types.js";

const DEFAULT_BASE_URL = "https://developer.townshipamerica.com";
const DEFAULT_TIMEOUT = 30_000;
const MAX_BATCH_SIZE = 100;

function toSearchResult(fc: GeoJSONFeatureCollection): SearchResult {
  const centroid = fc.features.find((f) => f.properties.shape === "centroid");
  const grid = fc.features.find((f) => f.properties.shape === "grid");

  const props = centroid?.properties ?? grid?.properties;
  if (!props) {
    throw new TownshipError("Unexpected API response: no features returned");
  }

  const [lng, lat] = centroid ? (centroid.geometry.coordinates as [number, number]) : [0, 0];

  return {
    legalLocation: props.legal_location,
    latitude: lat,
    longitude: lng,
    state: props.state,
    county: props.county,
    unit: props.unit,
    surveySystem: props.survey_system,
    alternateLegalLocation: props.alternate_legal_location,
    boundary: grid ? (grid.geometry as GeoJSONPolygon) : null,
    raw: fc
  };
}

export class TownshipClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(options: TownshipClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;

    if (!this.apiKey) {
      throw new TownshipError("apiKey is required");
    }
  }

  // --- Internal ---

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          "X-API-Key": this.apiKey,
          "User-Agent": "townshipamerica-js/1.0.0",
          ...(init?.headers ?? {})
        },
        signal: controller.signal
      });

      if (!response.ok) {
        await this.handleError(response);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof TownshipError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new TownshipError("Request timed out");
      }
      throw new TownshipError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleError(response: Response): Promise<never> {
    let message: string;
    try {
      const body = (await response.json()) as Record<string, unknown>;
      message = (body.error ?? body.message ?? response.statusText) as string;
    } catch {
      message = response.statusText;
    }

    const status = response.status;
    if (status === 400) throw new ValidationError(message);
    if (status === 401) throw new AuthenticationError(message);
    if (status === 404) throw new NotFoundError(message);
    if (status === 413) throw new PayloadTooLargeError(message);
    if (status === 429) throw new RateLimitError(message);
    throw new TownshipError(message, status);
  }

  // --- Search ---

  /**
   * Convert a PLSS legal land description to GPS coordinates.
   *
   * @param legalLocation - e.g. "NW 25 24N 1E 6th Meridian"
   * @returns A SearchResult with coordinates, boundary, and metadata.
   * @throws {ValidationError} If the location string is invalid.
   * @throws {NotFoundError} If no match is found.
   */
  async search(legalLocation: string): Promise<SearchResult> {
    const params = new URLSearchParams({ location: legalLocation });
    const data = await this.request<GeoJSONFeatureCollection | Record<string, never>>(
      `/search/legal-location?${params}`
    );

    if (!("features" in data) || !data.features?.length) {
      throw new NotFoundError(`No results found for "${legalLocation}"`);
    }

    return toSearchResult(data as GeoJSONFeatureCollection);
  }

  /**
   * Find the PLSS legal land description at the given GPS coordinates.
   *
   * @param longitude - Longitude (x) coordinate.
   * @param latitude - Latitude (y) coordinate.
   * @param options - Optional unit filter.
   * @returns A SearchResult or array of SearchResults (when unit is 'all').
   */
  async reverse(
    longitude: number,
    latitude: number,
    options?: ReverseOptions
  ): Promise<SearchResult | SearchResult[]> {
    const params = new URLSearchParams({
      location: `${longitude},${latitude}`
    });
    if (options?.unit) {
      params.set("unit", options.unit);
    }

    const data = await this.request<GeoJSONFeatureCollection | Record<string, never>>(
      `/search/coordinates?${params}`
    );

    if (!("features" in data) || !data.features?.length) {
      throw new NotFoundError(`No results found for coordinates [${longitude}, ${latitude}]`);
    }

    const fc = data as GeoJSONFeatureCollection;

    if (options?.unit === "all") {
      const groups = new Map<string, typeof fc.features>();
      for (const feature of fc.features) {
        const key = feature.properties.legal_location;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(feature);
      }

      return Array.from(groups.values()).map((features) => {
        return toSearchResult({ type: "FeatureCollection", features });
      });
    }

    return toSearchResult(fc);
  }

  // --- Autocomplete ---

  /**
   * Get autocomplete suggestions for a partial PLSS description.
   *
   * @param query - Partial search query (minimum 2 characters).
   * @param options - Optional limit (1–10, default 3) and proximity.
   * @returns Raw GeoJSON FeatureCollection with suggestion features.
   */
  async autocomplete(
    query: string,
    options?: AutocompleteOptions
  ): Promise<GeoJSONFeatureCollection> {
    const params = new URLSearchParams({ location: query });
    if (options?.limit != null) {
      params.set("limit", String(options.limit));
    }
    if (options?.proximity) {
      params.set("proximity", `${options.proximity[0]},${options.proximity[1]}`);
    }

    return this.request<GeoJSONFeatureCollection>(`/autocomplete/legal-location?${params}`);
  }

  // --- Batch ---

  /**
   * Convert multiple PLSS descriptions to GPS coordinates in one request.
   * Auto-chunks if more than 100 items.
   *
   * @param locations - Array of PLSS legal land descriptions.
   * @param options - Optional chunk size.
   * @returns Array of SearchResult or null for each input.
   */
  async batchSearch(
    locations: string[],
    options?: BatchSearchOptions
  ): Promise<(SearchResult | null)[]> {
    const chunkSize = Math.min(options?.chunkSize ?? MAX_BATCH_SIZE, MAX_BATCH_SIZE);
    const results: (SearchResult | null)[] = [];

    for (let i = 0; i < locations.length; i += chunkSize) {
      const chunk = locations.slice(i, i + chunkSize);
      const data = await this.request<(GeoJSONFeatureCollection | null)[]>(
        "/batch/legal-location",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chunk)
        }
      );

      for (const fc of data) {
        if (!fc || !fc.features?.length) {
          results.push(null);
        } else {
          results.push(toSearchResult(fc));
        }
      }
    }

    return results;
  }

  /**
   * Find PLSS descriptions for multiple coordinate pairs in one request.
   * Auto-chunks if more than 100 items.
   *
   * @param coordinates - Array of [longitude, latitude] pairs.
   * @param options - Optional unit filter and chunk size.
   * @returns Array of SearchResult or null for each input.
   */
  async batchReverse(
    coordinates: [number, number][],
    options?: BatchReverseOptions
  ): Promise<(SearchResult | null)[]> {
    const chunkSize = Math.min(options?.chunkSize ?? MAX_BATCH_SIZE, MAX_BATCH_SIZE);
    const results: (SearchResult | null)[] = [];

    for (let i = 0; i < coordinates.length; i += chunkSize) {
      const chunk = coordinates.slice(i, i + chunkSize);
      const body: Record<string, unknown> = { coordinates: chunk };
      if (options?.unit) {
        body.unit = options.unit;
      }

      const data = await this.request<
        (GeoJSONFeatureCollection | null)[] | GeoJSONFeatureCollection
      >("/batch/coordinates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (Array.isArray(data)) {
        for (const fc of data) {
          if (!fc || !fc.features?.length) {
            results.push(null);
          } else {
            results.push(toSearchResult(fc));
          }
        }
      } else if (data && "features" in data) {
        // unit=all returns a single FeatureCollection — split by legal_location
        const groups = new Map<string, typeof data.features>();
        for (const feature of data.features) {
          const key = JSON.stringify(feature.properties.search_term);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(feature);
        }
        for (const features of groups.values()) {
          results.push(toSearchResult({ type: "FeatureCollection", features }));
        }
      }
    }

    return results;
  }

  // --- Convenience ---

  /**
   * Get the boundary polygon for a legal land description.
   *
   * @param legalLocation - e.g. "NW 25 24N 1E 6th Meridian"
   * @returns The boundary GeoJSON Polygon, or null if not found.
   */
  async boundary(legalLocation: string): Promise<GeoJSONPolygon | null> {
    const result = await this.search(legalLocation);
    return result.boundary;
  }

  /**
   * Get the raw GeoJSON FeatureCollection for a legal land description.
   *
   * @param legalLocation - e.g. "NW 25 24N 1E 6th Meridian"
   * @returns The raw GeoJSON FeatureCollection from the API.
   */
  async raw(legalLocation: string): Promise<GeoJSONFeatureCollection> {
    const params = new URLSearchParams({ location: legalLocation });
    const data = await this.request<GeoJSONFeatureCollection | Record<string, never>>(
      `/search/legal-location?${params}`
    );

    if (!("features" in data)) {
      return { type: "FeatureCollection", features: [] };
    }

    return data as GeoJSONFeatureCollection;
  }
}
