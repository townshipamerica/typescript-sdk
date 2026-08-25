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
  EnergyReport,
  EnergyReportOptions,
  FederalLandReport,
  FederalLandReportOptions,
  GeoJSONBoundary,
  GeoJSONFeatureCollection,
  ReverseOptions,
  SearchResult,
  TexasProduction,
  TexasProductionOptions,
  TexasReport,
  TexasReportOptions,
  TexasWell,
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
    boundary: grid ? (grid.geometry as GeoJSONBoundary) : null,
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
          "User-Agent": "townshipamerica-js/2.0.0",
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
    let code: string | null = null;
    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string } | string;
        message?: string;
      };
      // Energy/Federal Land/Texas v1 error bodies are {"error": {"code", "message"}}
      if (body.error && typeof body.error === "object") {
        message = body.error.message ?? response.statusText;
        code = body.error.code ?? null;
      } else {
        message =
          (typeof body.error === "string" ? body.error : undefined) ??
          body.message ??
          response.statusText;
      }
    } catch {
      message = response.statusText;
    }

    const status = response.status;
    if (status === 400) throw new ValidationError(message, code);
    if (status === 401) throw new AuthenticationError(message, code);
    if (status === 404) throw new NotFoundError(message, code);
    if (status === 413) throw new PayloadTooLargeError(message, code);
    if (status === 429) throw new RateLimitError(message, code);
    throw new TownshipError(message, status, code);
  }

  // --- Search ---

  /**
   * Convert a PLSS or Texas TXSS legal land description to GPS coordinates.
   *
   * @param legalLocation - e.g. "NW 25 24N 1E 6th Meridian" or "A-175 Reeves County"
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
   * Find the legal land description at the given GPS coordinates (PLSS or Texas TXSS).
   *
   * @param longitude - Longitude (x) coordinate.
   * @param latitude - Latitude (y) coordinate.
   * @param options - Optional PLSS unit filter (ignored for TXSS results).
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
   * Get autocomplete suggestions for a partial PLSS or Texas TXSS description.
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
   * Convert multiple legal land descriptions to GPS coordinates in one request.
   * Auto-chunks if more than 100 items. Mix PLSS and Texas TXSS inputs freely.
   *
   * @param locations - Array of legal land descriptions.
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
   * Find legal land descriptions for multiple coordinate pairs in one request.
   * Auto-chunks if more than 100 items.
   *
   * @param coordinates - Array of [longitude, latitude] pairs.
   * @param options - Optional PLSS unit filter and chunk size.
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
  async boundary(legalLocation: string): Promise<GeoJSONBoundary | null> {
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

  // --- Energy API ---

  /**
   * Get the energy parcel report for a PLSS section. Covers state-regulator
   * wells, operators, federal leases, county royalties, orphaned wells,
   * pipelines, FracFocus disclosures, and development constraints.
   *
   * @param legalLocation - A PLSS legal description, e.g. "NW 25 24N 1E 6th Meridian"
   * @param options - Optional section projection (`include`)
   * @returns The energy report
   *
   * @example
   * ```ts
   * const report = await client.energyReport('25 24N 1E 6th Meridian')
   * console.log(report.summary.wells_in_section)
   * console.log(report.wells?.in_section.rows[0]?.api_number)
   *
   * // Only the sections you need — the rest are never queried
   * const slim = await client.energyReport('25 24N 1E 6th Meridian', {
   *   include: ['wells', 'pipelines']
   * })
   * ```
   */
  async energyReport(legalLocation: string, options?: EnergyReportOptions): Promise<EnergyReport> {
    const params = new URLSearchParams({ legal_location: legalLocation });
    if (options?.include?.length) params.set("include", options.include.join(","));
    return this.request<EnergyReport>(`/energy/report?${params}`);
  }

  // --- Federal Land API ---

  /**
   * Get the federal-land parcel report for a PLSS tract. Covers surface
   * management, BLM leases and rights-of-way, flood zones, mining claims,
   * wetlands, firesheds, soils, crop history, orphaned wells, critical
   * habitat, public access, wildfire risk, and elevation.
   *
   * @param legalLocation - A PLSS legal description, e.g. "NW 25 24N 1E 6th Meridian"
   * @param options - Optional section projection (`include`)
   * @returns The federal-land report
   *
   * @example
   * ```ts
   * const report = await client.federalLandReport('NW 25 24N 1E 6th Meridian')
   * console.log(report.surface_management?.rows[0]?.agency)
   *
   * // Only the sections you need — the pruned layers' queries never run
   * const slim = await client.federalLandReport('NW 25 24N 1E 6th Meridian', {
   *   include: ['og_leases', 'flood_zones']
   * })
   * ```
   */
  async federalLandReport(
    legalLocation: string,
    options?: FederalLandReportOptions
  ): Promise<FederalLandReport> {
    const params = new URLSearchParams({ legal_location: legalLocation });
    if (options?.include?.length) params.set("include", options.include.join(","));
    return this.request<FederalLandReport>(`/federal-land/report?${params}`);
  }

  // --- Texas API ---

  /**
   * Get the Texas abstract report for a TXSS legal description. Covers GLO
   * state leases and units, PSF lands, RRC wells and pipelines, pending
   * permits, coastal erosion, federal overlays, and RRC lease production.
   *
   * @param legalLocation - A Texas legal description, e.g. "A-175 Reeves County"
   * @param options - Optional section projection (`include`)
   * @returns The Texas report
   *
   * @example
   * ```ts
   * const report = await client.texasReport('A-175 Reeves County')
   * console.log(report.active_wells?.rows[0]?.api_number)
   * console.log(report.production?.summary.total_cum_boe)
   *
   * // Only the sections you need — the rest are never queried
   * const slim = await client.texasReport('A-175 Reeves County', {
   *   include: ['state_leases', 'production']
   * })
   * ```
   */
  async texasReport(legalLocation: string, options?: TexasReportOptions): Promise<TexasReport> {
    const params = new URLSearchParams({ legal_location: legalLocation });
    if (options?.include?.length) params.set("include", options.include.join(","));
    return this.request<TexasReport>(`/texas/report?${params}`);
  }

  /**
   * Get RRC lease production for a Texas abstract — per-lease lifetime
   * totals, trailing-12-month volumes, and the 60-month monthly series.
   * Production is reported by RRC at the LEASE level: rows are the leases
   * whose wells fall on the abstract, never sub-allocated to the tract.
   *
   * @param options - Either `{legalLocation}` or `{countyFips, abstractNo, blockNo?}`
   * @returns The abstract production rollup
   *
   * @example
   * ```ts
   * const byLocation = await client.texasProduction({ legalLocation: 'A-175 Reeves County' })
   * const byKeys = await client.texasProduction({ countyFips: '48389', abstractNo: '175' })
   * console.log(byKeys.summary.total_cum_boe)
   * ```
   */
  async texasProduction(options: TexasProductionOptions): Promise<TexasProduction> {
    const params = new URLSearchParams();
    if (options.legalLocation != null) {
      params.set("legal_location", options.legalLocation);
    } else if (options.countyFips != null && options.abstractNo != null) {
      params.set("county_fips", options.countyFips);
      params.set("abstract_no", options.abstractNo);
      if (options.blockNo != null) params.set("block_no", options.blockNo);
    } else {
      throw new TownshipError(
        "texasProduction requires either legalLocation or countyFips + abstractNo"
      );
    }
    return this.request<TexasProduction>(`/texas/production?${params}`);
  }

  /**
   * Get per-well allocated production for a Texas well by API number —
   * summary scalars for every lease edge, the monthly series (when
   * provisioned), and an Arps decline fit. Volumes are allocated estimates:
   * RRC reports production by lease, never by well.
   *
   * @param api - API-8 or API-14 number (e.g. "42-389-32345" or "42389323450000")
   * @returns The well's units, series, and decline analysis
   *
   * @example
   * ```ts
   * const well = await client.texasWell('42-389-32345')
   * console.log(well.units[0]?.cum_boe)
   * console.log(well.decline.available && well.decline.value?.di)
   * ```
   */
  async texasWell(api: string): Promise<TexasWell> {
    return this.request<TexasWell>(`/texas/wells/${encodeURIComponent(api)}`);
  }
}
