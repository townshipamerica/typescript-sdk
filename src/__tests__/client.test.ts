import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TownshipClient } from "../client.js";
import {
  AuthenticationError,
  NotFoundError,
  PayloadTooLargeError,
  RateLimitError,
  TownshipError,
  ValidationError
} from "../errors.js";
import type { GeoJSONFeatureCollection } from "../types.js";

const SEARCH_RESPONSE: GeoJSONFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-104.013432, 41.077909],
            [-104.013424, 41.074288],
            [-104.025062, 41.081578],
            [-104.013432, 41.077909]
          ]
        ]
      },
      properties: {
        shape: "grid",
        search_term: "NW 25 24N 1E 6th Meridian",
        legal_location: "NW 25 24N 1E 6th Meridian",
        alternate_legal_location: "NW 25 T24N R1E 6th PM",
        unit: "First Division",
        survey_system: "PLSS",
        county: "Weld",
        state: "Colorado"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-104.01924, 41.077932]
      },
      properties: {
        shape: "centroid",
        search_term: "NW 25 24N 1E 6th Meridian",
        legal_location: "NW 25 24N 1E 6th Meridian",
        alternate_legal_location: "NW 25 T24N R1E 6th PM",
        unit: "First Division",
        survey_system: "PLSS",
        county: "Weld",
        state: "Colorado"
      }
    }
  ]
};

const AUTOCOMPLETE_RESPONSE: GeoJSONFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-104.01924, 41.077932]
      },
      properties: {
        shape: "centroid",
        search_term: "NW 25",
        legal_location: "NW 25 24N 1E 6th Meridian",
        alternate_legal_location: "NW 25 T24N R1E 6th PM",
        unit: "First Division",
        survey_system: "PLSS",
        county: "Weld",
        state: "Colorado"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-104.025, 41.08]
      },
      properties: {
        shape: "centroid",
        search_term: "NW 25",
        legal_location: "NW 25 24N 1W 6th Meridian",
        alternate_legal_location: "NW 25 T24N R1W 6th PM",
        unit: "First Division",
        survey_system: "PLSS",
        county: "Weld",
        state: "Colorado"
      }
    }
  ]
};

function mockFetch(response: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(response)
  });
}

describe("TownshipClient", () => {
  let client: TownshipClient;

  beforeEach(() => {
    client = new TownshipClient({ apiKey: "test-key" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws if apiKey is empty", () => {
    expect(() => new TownshipClient({ apiKey: "" })).toThrow(TownshipError);
  });

  describe("search", () => {
    it("returns a SearchResult with centroid and boundary", async () => {
      vi.stubGlobal("fetch", mockFetch(SEARCH_RESPONSE));

      const result = await client.search("NW 25 24N 1E 6th Meridian");

      expect(result.legalLocation).toBe("NW 25 24N 1E 6th Meridian");
      expect(result.latitude).toBeCloseTo(41.077932);
      expect(result.longitude).toBeCloseTo(-104.01924);
      expect(result.state).toBe("Colorado");
      expect(result.county).toBe("Weld");
      expect(result.unit).toBe("First Division");
      expect(result.surveySystem).toBe("PLSS");
      expect(result.alternateLegalLocation).toBe("NW 25 T24N R1E 6th PM");
      expect(result.boundary).not.toBeNull();
      expect(result.boundary!.type).toBe("Polygon");
      expect(result.raw.type).toBe("FeatureCollection");
    });

    it("sends the correct URL and headers", async () => {
      const fetchMock = mockFetch(SEARCH_RESPONSE);
      vi.stubGlobal("fetch", fetchMock);

      await client.search("NW 25 24N 1E 6th Meridian");

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("/search/legal-location?location=NW+25+24N+1E+6th+Meridian");
      expect(init.headers["X-API-Key"]).toBe("test-key");
    });

    it("throws NotFoundError when API returns empty object", async () => {
      vi.stubGlobal("fetch", mockFetch({}));
      await expect(client.search("INVALID")).rejects.toThrow(NotFoundError);
    });
  });

  describe("reverse", () => {
    it("returns a SearchResult", async () => {
      vi.stubGlobal("fetch", mockFetch(SEARCH_RESPONSE));

      const result = await client.reverse(-104.01924, 41.077932);

      expect(result).not.toBeInstanceOf(Array);
      const single = result as Awaited<ReturnType<typeof client.search>>;
      expect(single.legalLocation).toBe("NW 25 24N 1E 6th Meridian");
    });

    it("passes unit param to URL", async () => {
      const fetchMock = mockFetch(SEARCH_RESPONSE);
      vi.stubGlobal("fetch", fetchMock);

      await client.reverse(-104.01924, 41.077932, { unit: "Township" });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("unit=Township");
    });

    it("returns array of SearchResults when unit=all", async () => {
      const allResponse: GeoJSONFeatureCollection = {
        type: "FeatureCollection",
        features: [
          ...SEARCH_RESPONSE.features,
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-104, 41],
                  [-104, 42],
                  [-103, 42],
                  [-104, 41]
                ]
              ]
            },
            properties: {
              shape: "grid",
              search_term: "NW 25 24N 1E 6th Meridian",
              legal_location: "25 24N 1E 6th Meridian",
              unit: "Township",
              survey_system: "PLSS",
              county: "Weld",
              state: "Colorado"
            }
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [-104.01, 41.08] },
            properties: {
              shape: "centroid",
              search_term: "NW 25 24N 1E 6th Meridian",
              legal_location: "25 24N 1E 6th Meridian",
              unit: "Township",
              survey_system: "PLSS",
              county: "Weld",
              state: "Colorado"
            }
          }
        ]
      };
      vi.stubGlobal("fetch", mockFetch(allResponse));

      const results = await client.reverse(-104.01924, 41.077932, { unit: "all" });

      expect(Array.isArray(results)).toBe(true);
      expect((results as unknown[]).length).toBe(2);
    });

    it("throws NotFoundError when API returns empty object", async () => {
      vi.stubGlobal("fetch", mockFetch({}));
      await expect(client.reverse(0, 0)).rejects.toThrow(NotFoundError);
    });
  });

  describe("autocomplete", () => {
    it("returns a GeoJSON FeatureCollection", async () => {
      vi.stubGlobal("fetch", mockFetch(AUTOCOMPLETE_RESPONSE));

      const result = await client.autocomplete("NW 25");

      expect(result.type).toBe("FeatureCollection");
      expect(result.features).toHaveLength(2);
      expect(result.features[0].properties.legal_location).toBe("NW 25 24N 1E 6th Meridian");
    });

    it("passes limit and proximity params", async () => {
      const fetchMock = mockFetch(AUTOCOMPLETE_RESPONSE);
      vi.stubGlobal("fetch", fetchMock);

      await client.autocomplete("NW 25", {
        limit: 5,
        proximity: [-104.07, 41.04]
      });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("location=NW+25");
      expect(url).toContain("limit=5");
      expect(url).toContain("proximity=-104.07%2C41.04");
    });
  });

  describe("batchSearch", () => {
    it("returns array of SearchResult or null", async () => {
      const batchResponse = [SEARCH_RESPONSE, null, SEARCH_RESPONSE];
      vi.stubGlobal("fetch", mockFetch(batchResponse));

      const results = await client.batchSearch([
        "NW 25 24N 1E 6th Meridian",
        "INVALID LOCATION",
        "NE 12 4N 5E Indian Meridian"
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]).not.toBeNull();
      expect(results[0]!.legalLocation).toBe("NW 25 24N 1E 6th Meridian");
      expect(results[1]).toBeNull();
      expect(results[2]).not.toBeNull();
    });

    it("sends body as JSON array of strings", async () => {
      const fetchMock = mockFetch([SEARCH_RESPONSE]);
      vi.stubGlobal("fetch", fetchMock);

      await client.batchSearch(["NW 25 24N 1E 6th Meridian"]);

      const [, init] = fetchMock.mock.calls[0];
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body[0]).toBe("NW 25 24N 1E 6th Meridian");
    });

    it("auto-chunks when over 100 items", async () => {
      const fetchMock = mockFetch(Array.from({ length: 100 }, () => SEARCH_RESPONSE));
      vi.stubGlobal("fetch", fetchMock);

      const locations = Array.from({ length: 150 }, (_, i) => `Location ${i}`);
      await client.batchSearch(locations);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const body1 = JSON.parse(fetchMock.mock.calls[0][1].body);
      const body2 = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body1).toHaveLength(100);
      expect(body2).toHaveLength(50);
    });
  });

  describe("batchReverse", () => {
    it("returns array of SearchResult or null", async () => {
      const batchResponse = [SEARCH_RESPONSE, null];
      vi.stubGlobal("fetch", mockFetch(batchResponse));

      const results = await client.batchReverse([
        [-104.01924, 41.077932],
        [0, 0]
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]).not.toBeNull();
      expect(results[1]).toBeNull();
    });

    it("sends coordinates and unit in body", async () => {
      const fetchMock = mockFetch([SEARCH_RESPONSE]);
      vi.stubGlobal("fetch", fetchMock);

      await client.batchReverse([[-104.01924, 41.077932]], { unit: "Township" });

      const [, init] = fetchMock.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.coordinates).toEqual([[-104.01924, 41.077932]]);
      expect(body.unit).toBe("Township");
    });
  });

  describe("boundary", () => {
    it("returns the grid polygon", async () => {
      vi.stubGlobal("fetch", mockFetch(SEARCH_RESPONSE));

      const polygon = await client.boundary("NW 25 24N 1E 6th Meridian");

      expect(polygon).not.toBeNull();
      expect(polygon!.type).toBe("Polygon");
    });
  });

  describe("raw", () => {
    it("returns the raw FeatureCollection", async () => {
      vi.stubGlobal("fetch", mockFetch(SEARCH_RESPONSE));

      const fc = await client.raw("NW 25 24N 1E 6th Meridian");

      expect(fc.type).toBe("FeatureCollection");
      expect(fc.features).toHaveLength(2);
    });

    it("returns empty FeatureCollection when no match", async () => {
      vi.stubGlobal("fetch", mockFetch({}));

      const fc = await client.raw("INVALID");

      expect(fc.type).toBe("FeatureCollection");
      expect(fc.features).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("throws AuthenticationError on 401", async () => {
      vi.stubGlobal("fetch", mockFetch({ error: "Invalid API key" }, 401));
      await expect(client.search("test")).rejects.toThrow(AuthenticationError);
    });

    it("throws ValidationError on 400", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch({ error: "Bad Request. Missing parameter 'location'." }, 400)
      );
      await expect(client.search("test")).rejects.toThrow(ValidationError);
    });

    it("throws RateLimitError on 429", async () => {
      vi.stubGlobal("fetch", mockFetch({ error: "Rate limit exceeded" }, 429));
      await expect(client.search("test")).rejects.toThrow(RateLimitError);
    });

    it("throws PayloadTooLargeError on 413", async () => {
      vi.stubGlobal("fetch", mockFetch({ error: "Payload too large" }, 413));
      await expect(client.batchSearch(["test"])).rejects.toThrow(PayloadTooLargeError);
    });

    it("throws TownshipError on 500", async () => {
      vi.stubGlobal("fetch", mockFetch({ error: "Internal Server Error" }, 500));
      await expect(client.search("test")).rejects.toThrow(TownshipError);
    });
  });
});
