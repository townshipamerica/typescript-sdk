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
import type {
  EnergyReport,
  FederalLandReport,
  GeoJSONFeatureCollection,
  TexasProduction,
  TexasReport,
  TexasWell
} from "../types.js";

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

const TX_SEARCH_RESPONSE: GeoJSONFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-103.5, 31.2],
              [-103.4, 31.2],
              [-103.4, 31.3],
              [-103.5, 31.3],
              [-103.5, 31.2]
            ]
          ]
        ]
      },
      properties: {
        shape: "grid",
        search_term: "A-175 Reeves County",
        legal_location: "Abstract 175 Reeves County Texas",
        alternate_legal_location: "A-175 Reeves Co Texas",
        unit: null,
        survey_system: "TXSS",
        county: "Reeves",
        state: "TX",
        abstract_no: "175"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-103.45, 31.25]
      },
      properties: {
        shape: "centroid",
        search_term: "A-175 Reeves County",
        legal_location: "Abstract 175 Reeves County Texas",
        alternate_legal_location: "A-175 Reeves Co Texas",
        unit: null,
        survey_system: "TXSS",
        county: "Reeves",
        state: "TX",
        abstract_no: "175"
      }
    }
  ]
};

const TX_AUTOCOMPLETE_RESPONSE: GeoJSONFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-103.45, 31.25] },
      properties: {
        shape: "centroid",
        search_term: "A-175",
        legal_location: "Abstract 175 Reeves County Texas",
        survey_system: "TXSS",
        county: "Reeves",
        state: "TX"
      }
    }
  ]
};

const emptySection = { total: 0, returned: 0, truncated: false, more: false, rows: [] };

const ENERGY_REPORT_RESPONSE: EnergyReport = {
  legal_location: "25 24N 1E 6th Meridian",
  resolved_legal_location: "25 24N 1E 6th Meridian",
  alternate_legal_location: "25 T24N R1E 6th PM",
  unit: "First Division",
  state: "Colorado",
  state_code: "CO",
  county: "Weld",
  parcel: { centroid: { lng: -104.01924, lat: 41.077932 }, geometry: null },
  summary: {
    wells_in_section: 2,
    wells_nearby: 5,
    operators_nearby: 2,
    federal_leases: 1,
    orphaned_wells: 0,
    pipelines_within_radius: 1,
    fracfocus_disclosures: 1
  },
  wells: {
    in_section: {
      total: 2,
      returned: 2,
      truncated: false,
      more: false,
      rows: [
        {
          api_number: "05-123-45678",
          source_state: "CO",
          operator: { name: "EXAMPLE ENERGY LLC" },
          status: "PR",
          spud_date: "2019-06-01",
          formation: "NIOBRARA",
          location: { lng: -104.02, lat: 41.078 },
          distance_miles: 0.12
        },
        {
          api_number: "05-123-45679",
          source_state: "CO",
          operator: { name: "EXAMPLE ENERGY LLC" },
          status: "PR",
          spud_date: "2020-02-14",
          formation: "CODELL",
          location: { lng: -104.021, lat: 41.079 },
          distance_miles: 0.19
        }
      ]
    },
    nearby: { radius_mi: 1, total: 5, returned: 5, truncated: false, more: false, rows: [] }
  },
  operators: {
    radius_mi: 1,
    total: 2,
    returned: 2,
    truncated: false,
    more: false,
    rows: [{ operator: { name: "EXAMPLE ENERGY LLC" }, well_count: 4 }]
  },
  leases: {
    total: 1,
    returned: 1,
    truncated: false,
    more: false,
    rows: [
      {
        serial: "COC123456",
        status: "AUTHORIZED",
        holder: { name: "EXAMPLE ENERGY LLC" },
        effective_date: "2015-05-01",
        expiration_date: "2025-04-30",
        acreage: 640,
        commodity: "Oil & Gas",
        location: { lng: -104.02, lat: 41.077 }
      }
    ]
  },
  royalties: {
    scope: "county",
    state: "Colorado",
    county: "Weld",
    years: 10,
    total_usd: 1234567.89,
    royalties: [{ commodity: "Oil", royalty_usd: 1234567.89 }]
  },
  orphaned_wells: emptySection,
  pipelines: {
    radius_mi: 5,
    total: 1,
    returned: 1,
    truncated: false,
    more: false,
    rows: [
      {
        kind: "gas",
        kind_raw: "Gas",
        operator: { name: "EXAMPLE MIDSTREAM" },
        label: "Interstate",
        status: "Active",
        distance_miles: 2.31
      }
    ]
  },
  fracfocus: {
    radius_mi: 1,
    total: 1,
    returned: 1,
    truncated: false,
    more: false,
    rows: [
      {
        api_number: "05-123-45678",
        operator: { name: "EXAMPLE ENERGY LLC" },
        well_name: "EXAMPLE 1-25",
        state: "CO",
        county: "Weld",
        disclosure_date: "2021-08-15",
        total_water_gal: 8000000,
        total_proppant_lbs: 10000000,
        location: { lng: -104.02, lat: 41.078 },
        distance_miles: 0.12
      }
    ]
  },
  constraints: {
    split_estate: {
      is_split_estate: true,
      surface: { type: "private", agency: null, coverage_pct: 0.01 },
      subsurface: { type: "federal", agency: "BLM", coverage_pct: 0.97 }
    },
    sage_grouse: { in_habitat: false, habitat_count: 0, habitats: [] },
    renewable_siting: {
      nrel_score: 62.5,
      blm_solar_zone: null,
      wind_turbines_within_2mi: 3,
      notes: ["3 wind turbines within 2 miles"]
    }
  },
  meta: {
    unavailable: [],
    sources: { wells: { name: "State regulators (CO ECMC, ND DMR, OK OCC, WY WOGCC, NM OCD)", as_of: null } }
  }
};

const FEDERAL_LAND_REPORT_RESPONSE: FederalLandReport = {
  legal_location: "NW 25 24N 1E 6th Meridian",
  resolved_legal_location: "NW 25 24N 1E 6th Meridian",
  alternate_legal_location: "NW 25 T24N R1E 6th PM",
  unit: "Second Division",
  state: "Colorado",
  county: "Weld",
  report_scope: "parcel",
  parcel: { centroid: { lng: -104.01924, lat: 41.077932 }, geometry: null },
  surface_management: {
    total: 1,
    returned: 1,
    truncated: false,
    more: false,
    rows: [{ agency: "BLM", admin_unit: "Royal Gorge Field Office" }]
  },
  og_leases: {
    total: 1,
    returned: 1,
    truncated: false,
    more: false,
    rows: [
      {
        serial: "COC123456",
        status: "AUTHORIZED",
        lessee: "EXAMPLE ENERGY LLC",
        expiration: "2025-04-30",
        location: { lng: -104.02, lat: 41.077 }
      }
    ]
  },
  geothermal_leases: emptySection,
  rights_of_way: emptySection,
  flood_zones: {
    total: 1,
    returned: 1,
    truncated: false,
    more: false,
    rows: [{ zone: "AE", subtype: "FLOODWAY", sfha: true, bfe: 1520 }]
  },
  mining_claims: emptySection,
  wetlands: emptySection,
  fireshed: emptySection,
  soils: emptySection,
  crop_history: {
    year: 2024,
    dominant_crop: "Winter Wheat",
    dominant_crop_pct: 61.2,
    distribution: { "Winter Wheat": 61.2, Fallow: 38.8 }
  },
  orphaned_wells: emptySection,
  critical_habitat: emptySection,
  public_access: emptySection,
  wildfire_risk_communities: emptySection,
  elevation: {
    elev_min_m: 1502.1,
    elev_mean_m: 1520.4,
    elev_max_m: 1541.7,
    slope_mean_deg: 1.8,
    aspect_dominant: "E",
  },
  meta: {
    unavailable: [{ section: "fireshed", reason: "no_state_coverage" }],
    sources: { surface_management: { name: "BLM Surface Management Agency (SMA)", as_of: null } }
  }
};

const TEXAS_PRODUCTION_BLOCK = {
  abstract: { county_fips: "48389", abstract_no: "175" },
  summary: {
    producing_lease_count: 1,
    total_cum_boe: 125000,
    total_cum_oil_bbl: 100000,
    total_cum_gas_mcf: 150000,
    ttm_boe: 9000,
    first_month: "2018-03",
    last_month: "2026-05"
  },
  leases: {
    total: 1,
    returned: 1,
    truncated: false,
    more: false,
    rows: [
      {
        operator: { name: "EXAMPLE OPERATING CO" },
        district_no: "08",
        lease_no: "12345",
        oil_gas_code: "O",
        cum_oil_bbl: 100000,
        cum_gas_mcf: 150000,
        cum_boe: 125000,
        ttm_oil_bbl: 8000,
        ttm_gas_mcf: 6000,
        first_month: "2018-03",
        last_month: "2026-05",
        peak_month: "2018-09",
        months_producing: 96,
        monthly: [{ ym: "2026-05", oil_bbl: 900, gas_mcf: 700, water_bbl: 1200 }]
      }
    ]
  }
};

const TEXAS_REPORT_RESPONSE: TexasReport = {
  legal_location: "A-175 Reeves County",
  resolved_legal_location: "Abstract 175 Reeves County Texas",
  alternate_legal_location: "A-175 Reeves Co Texas",
  county_fips: "48389",
  county: "Reeves",
  state: "TX",
  abstract_no: "175",
  block_no: null,
  survey_name: "H&GN RR CO",
  parcel: { acreage: 640, centroid: { lng: -103.45, lat: 31.25 }, geometry: null },
  state_leases: {
    total: 1,
    returned: 1,
    truncated: false,
    more: false,
    rows: [
      {
        lease_no: "MF123456",
        lessee: "EXAMPLE OPERATING CO",
        status: "Active",
        mineral_type: "Oil & Gas",
        expiration: "2027-01-31",
        royalty_rate: 0.25
      }
    ]
  },
  state_units: emptySection,
  psf_lands: emptySection,
  state_agency_lands: emptySection,
  upland_leases: emptySection,
  active_wells: {
    total: 1,
    returned: 1,
    truncated: false,
    more: false,
    rows: [
      {
        api_number: "42-389-32345",
        operator: "EXAMPLE OPERATING CO",
        lease_name: "EXAMPLE UNIT",
        well_number: "1H",
        status: "Producing",
        status_raw: "P",
        formation: "WOLFCAMP",
        field: "PHANTOM (WOLFCAMP)",
        location: { lng: -103.45, lat: 31.25 }
      }
    ]
  },
  pipelines: emptySection,
  pending_permits: emptySection,
  coastal_erosion: emptySection,
  flood_zones: emptySection,
  wetlands: emptySection,
  fireshed: emptySection,
  soils: emptySection,
  orphaned_wells: emptySection,
  critical_habitat: emptySection,
  wildfire_risk_communities: emptySection,
  elevation: null,
  production: TEXAS_PRODUCTION_BLOCK,
  meta: {
    unavailable: [],
    sources: { state_leases: { name: "Texas GLO Active O&G Leases", as_of: null } }
  }
};

const TEXAS_PRODUCTION_RESPONSE: TexasProduction = {
  county_fips: "48389",
  county: "Reeves",
  abstract_no: "175",
  block_no: null,
  ...TEXAS_PRODUCTION_BLOCK,
  meta: { unavailable: [] }
};

const TEXAS_WELL_RESPONSE: TexasWell = {
  api8: "42389323",
  location: {
    api_number: "42-389-32345",
    location: { lng: -103.45, lat: 31.25 },
    operator: { name: "EXAMPLE OPERATING CO" },
    lease_name: "EXAMPLE UNIT",
    well_number: "1H",
    field: "PHANTOM (WOLFCAMP)",
    formation: "WOLFCAMP",
    status: "Producing",
    spud_date: "2018-01-15",
    district: "08",
    county_fips: "48389",
    abstract_no: "175"
  },
  units: [
    {
      district_no: "08",
      lease_no: "12345",
      oil_gas_code: "O",
      operator: { name: "EXAMPLE OPERATING CO" },
      peak_oil_bbl: 15000,
      cum_boe: 125000,
      well_count: 1,
      denominator_basis: "time_varying"
    }
  ],
  series: [
    { ym: "2018-03", oil_bbl: 12000, gas_mcf: 9000 },
    { ym: "2018-04", oil_bbl: 15000, gas_mcf: 11000 },
    { ym: "2018-05", oil_bbl: 13000, gas_mcf: 10000 }
  ],
  series_unit: { district_no: "08", lease_no: "12345", oil_gas_code: "O" },
  series_covers_all_units: true,
  decline: { available: true, value: { qi: 15000, di: 0.08, b: 0.5, r2: 0.91, points: 24 } },
  decline_curve: [{ ym: "2018-04", q: 15000 }],
  meta: {
    unavailable: [],
    note: "Volumes are allocated estimates — RRC reports production by lease, never by well."
  }
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

    it("returns TXSS SearchResult with MultiPolygon boundary", async () => {
      vi.stubGlobal("fetch", mockFetch(TX_SEARCH_RESPONSE));

      const result = await client.search("A-175 Reeves County");

      expect(result.surveySystem).toBe("TXSS");
      expect(result.state).toBe("TX");
      expect(result.county).toBe("Reeves");
      expect(result.unit).toBeNull();
      expect(result.boundary?.type).toBe("MultiPolygon");
      expect(result.raw.features[0].properties.abstract_no).toBe("175");
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

    it("returns TXSS autocomplete suggestions", async () => {
      vi.stubGlobal("fetch", mockFetch(TX_AUTOCOMPLETE_RESPONSE));

      const result = await client.autocomplete("A-175");

      expect(result.features[0].properties.survey_system).toBe("TXSS");
      expect(result.features[0].properties.state).toBe("TX");
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

    it("handles mixed PLSS and TXSS batch results", async () => {
      const batchResponse = [SEARCH_RESPONSE, TX_SEARCH_RESPONSE, null];
      vi.stubGlobal("fetch", mockFetch(batchResponse));

      const results = await client.batchSearch([
        "NW 25 24N 1E 6th Meridian",
        "A-175 Reeves County",
        "INVALID"
      ]);

      expect(results[0]?.surveySystem).toBe("PLSS");
      expect(results[1]?.surveySystem).toBe("TXSS");
      expect(results[2]).toBeNull();
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

  describe("energyReport", () => {
    it("returns the report and sends legal_location", async () => {
      const fetchMock = mockFetch(ENERGY_REPORT_RESPONSE);
      vi.stubGlobal("fetch", fetchMock);

      const report = await client.energyReport("25 24N 1E 6th Meridian");

      expect(report.resolved_legal_location).toBe("25 24N 1E 6th Meridian");
      expect(report.summary.wells_in_section).toBe(2);
      expect(report.wells?.in_section.rows[0]?.api_number).toBe("05-123-45678");
      expect(report.wells?.nearby.radius_mi).toBe(1);
      expect(report.royalties?.scope).toBe("county");
      expect(report.constraints?.split_estate?.is_split_estate).toBe(true);
      expect(report.meta.unavailable).toEqual([]);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("/energy/report?legal_location=25+24N+1E+6th+Meridian");
      expect(init.headers["X-API-Key"]).toBe("test-key");
    });

    it("passes include as a comma-separated list", async () => {
      const fetchMock = mockFetch(ENERGY_REPORT_RESPONSE);
      vi.stubGlobal("fetch", fetchMock);

      await client.energyReport("25 24N 1E 6th Meridian", {
        include: ["wells", "pipelines", "geometry"]
      });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("include=wells%2Cpipelines%2Cgeometry");
    });
  });

  describe("federalLandReport", () => {
    it("returns the report with array-section envelopes", async () => {
      const fetchMock = mockFetch(FEDERAL_LAND_REPORT_RESPONSE);
      vi.stubGlobal("fetch", fetchMock);

      const report = await client.federalLandReport("NW 25 24N 1E 6th Meridian");

      expect(report.report_scope).toBe("parcel");
      expect(report.surface_management?.total).toBe(1);
      expect(report.surface_management?.rows[0]?.agency).toBe("BLM");
      expect(report.flood_zones?.rows[0]?.sfha).toBe(true);
      expect(report.elevation?.elev_mean_m).toBe(1520.4);
      expect(report.meta.unavailable[0]?.reason).toBe("no_state_coverage");

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("/federal-land/report?legal_location=NW+25+24N+1E+6th+Meridian");
    });

    it("passes include as a comma-separated list", async () => {
      const fetchMock = mockFetch(FEDERAL_LAND_REPORT_RESPONSE);
      vi.stubGlobal("fetch", fetchMock);

      await client.federalLandReport("NW 25 24N 1E 6th Meridian", {
        include: ["og_leases", "flood_zones"]
      });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("include=og_leases%2Cflood_zones");
    });
  });

  describe("texasReport", () => {
    it("returns the report with identity and production", async () => {
      const fetchMock = mockFetch(TEXAS_REPORT_RESPONSE);
      vi.stubGlobal("fetch", fetchMock);

      const report = await client.texasReport("A-175 Reeves County");

      expect(report.state).toBe("TX");
      expect(report.abstract_no).toBe("175");
      expect(report.state_leases?.rows[0]?.lease_no).toBe("MF123456");
      expect(report.active_wells?.rows[0]?.location?.lat).toBeCloseTo(31.25);
      expect(report.production?.summary.total_cum_boe).toBe(125000);
      expect(report.production?.leases.rows[0]?.monthly[0]?.oil_bbl).toBe(900);

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("/texas/report?legal_location=A-175+Reeves+County");
    });

    it("passes include as a comma-separated list", async () => {
      const fetchMock = mockFetch(TEXAS_REPORT_RESPONSE);
      vi.stubGlobal("fetch", fetchMock);

      await client.texasReport("A-175 Reeves County", {
        include: ["state_leases", "production"]
      });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("include=state_leases%2Cproduction");
    });
  });

  describe("texasProduction", () => {
    it("queries by legal_location", async () => {
      const fetchMock = mockFetch(TEXAS_PRODUCTION_RESPONSE);
      vi.stubGlobal("fetch", fetchMock);

      const production = await client.texasProduction({ legalLocation: "A-175 Reeves County" });

      expect(production.summary.producing_lease_count).toBe(1);
      expect(production.leases.rows[0]?.cum_boe).toBe(125000);

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("/texas/production?legal_location=A-175+Reeves+County");
    });

    it("queries by registry keys", async () => {
      const fetchMock = mockFetch(TEXAS_PRODUCTION_RESPONSE);
      vi.stubGlobal("fetch", fetchMock);

      await client.texasProduction({ countyFips: "48389", abstractNo: "175", blockNo: "4" });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("county_fips=48389");
      expect(url).toContain("abstract_no=175");
      expect(url).toContain("block_no=4");
    });

    it("throws when neither input form is given", async () => {
      vi.stubGlobal("fetch", mockFetch(TEXAS_PRODUCTION_RESPONSE));
      await expect(
        client.texasProduction({} as Parameters<typeof client.texasProduction>[0])
      ).rejects.toThrow(TownshipError);
    });
  });

  describe("texasWell", () => {
    it("returns the well analytics and encodes the API number", async () => {
      const fetchMock = mockFetch(TEXAS_WELL_RESPONSE);
      vi.stubGlobal("fetch", fetchMock);

      const well = await client.texasWell("42-389-32345");

      expect(well.api8).toBe("42389323");
      expect(well.units[0]?.denominator_basis).toBe("time_varying");
      expect(well.decline.available).toBe(true);
      expect(well.decline.value?.b).toBe(0.5);
      expect(well.series_covers_all_units).toBe(true);

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("/texas/wells/42-389-32345");
    });
  });

  describe("error handling", () => {
    it("throws AuthenticationError on 401", async () => {
      vi.stubGlobal("fetch", mockFetch({ error: "Invalid API key" }, 401));
      await expect(client.search("test")).rejects.toThrow(AuthenticationError);
    });

    it("parses v1 error bodies ({error: {code, message}}) with code", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch(
          { error: { code: "plss_not_supported", message: "PLSS not covered by the Texas API." } },
          400
        )
      );
      const err = await client.texasReport("NW 25 24N 1E 6th Meridian").catch((e) => e);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.code).toBe("plss_not_supported");
      expect(err.message).toBe("PLSS not covered by the Texas API.");
    });

    it("maps v1 404 to NotFoundError with code", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch(
          { error: { code: "not_found", message: "No Texas abstract matches this location." } },
          404
        )
      );
      const err = await client.texasWell("42389323").catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.code).toBe("not_found");
    });

    it("maps v1 429 to RateLimitError with code", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetch(
          { error: { code: "rate_limit_exceeded", message: "You've exceeded your quota." } },
          429
        )
      );
      const err = await client.energyReport("25 24N 1E 6th Meridian").catch((e) => e);
      expect(err).toBeInstanceOf(RateLimitError);
      expect(err.code).toBe("rate_limit_exceeded");
    });

    it("still parses legacy string error bodies (code stays null)", async () => {
      vi.stubGlobal("fetch", mockFetch({ error: "Bad Request" }, 400));
      const err = await client.search("test").catch((e) => e);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.message).toBe("Bad Request");
      expect(err.code).toBeNull();
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
