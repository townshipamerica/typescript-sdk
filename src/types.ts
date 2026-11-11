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

// --- Report Types (Energy, Federal Land & Texas APIs) ---

/** A point as `{lng, lat}` (report payloads use this, not GeoJSON). */
export interface LatLng {
  lng: number | null;
  lat: number | null;
}

/** A company reference wherever an operator/holder is named: `{name}`. */
export interface EntityRef {
  name: string | null;
  [key: string]: unknown;
}

/**
 * Envelope every embedded array section of a report uses.
 * `total` is the true count, `truncated` (and `more`) flag that
 * `returned < total` — silent truncation is never allowed.
 */
export interface SectionEnvelope<Row> {
  total: number;
  returned: number;
  truncated: boolean;
  more: boolean;
  rows: Row[];
  [key: string]: unknown;
}

/** A section that could not be served, listed under `meta.unavailable`. */
export interface UnavailableSection {
  section: string;
  reason: "source_error" | "timeout" | "no_state_coverage" | "not_available" | (string & {});
  [key: string]: unknown;
}

/** Upstream source of one report section. `as_of` is null until vintage metadata ships. */
export interface SectionSource {
  name: string | null;
  as_of: string | null;
  [key: string]: unknown;
}

/** The `meta` block every report response carries. */
export interface ReportMeta {
  unavailable: UnavailableSection[];
  sources?: Record<string, SectionSource>;
  /** Present on Texas production/well responses (allocation caveat). */
  note?: string;
  [key: string]: unknown;
}

/** Parcel block shared by the reports: centroid + opt-in geometry. */
export interface ReportParcel {
  centroid: LatLng | null;
  /** GeoJSON when requested with `include: ["geometry", ...]`, otherwise null */
  geometry: GeoJSONBoundary | null;
  /** Reported acreage (Texas abstracts only). */
  acreage?: number | null;
  [key: string]: unknown;
}

// --- Energy API Types ---

/** Sections of the energy report addressable through `include=`. */
export type EnergyReportSection =
  | "wells"
  | "operators"
  | "leases"
  | "royalties"
  | "orphaned_wells"
  | "pipelines"
  | "fracfocus"
  | "constraints"
  | "renewables"
  | "geometry";

/** Options for `energyReport`. */
export interface EnergyReportOptions {
  /**
   * Return only these sections (the omitted sections are never queried).
   * `geometry` is a section name: include it to attach the parcel boundary
   * under `parcel.geometry`. Omitted returns the full report (no geometry).
   */
  include?: EnergyReportSection[];
}

/** One state-regulator well row (CO ECMC, ND DMR, OK OCC, WY WOGCC, NM OCD). */
export interface EnergyWellRow {
  api_number: string | null;
  source_state: string | null;
  operator: EntityRef | null;
  status: string | null;
  /** Date-only fact, "YYYY-MM-DD" */
  spud_date: string | null;
  formation: string | null;
  location: LatLng | null;
  distance_miles: number | null;
  [key: string]: unknown;
}

/** One USGS documented orphaned well row (Energy API). */
export interface EnergyOrphanedWellRow {
  well_id: string | null;
  state: string | null;
  operator: EntityRef | null;
  status: string | null;
  api_number: string | null;
  location: LatLng | null;
  distance_miles: number | null;
  [key: string]: unknown;
}

/** One BLM MLRS federal O&G lease row. */
export interface EnergyLeaseRow {
  serial: string | null;
  status: string | null;
  holder: EntityRef | null;
  effective_date: string | null;
  expiration_date: string | null;
  acreage: number | null;
  commodity: string | null;
  /** Representative point of the lease polygon. */
  location: LatLng | null;
  [key: string]: unknown;
}

/** One distinct operator by well count near the parcel. */
export interface EnergyOperatorRow {
  operator: EntityRef;
  well_count: number;
  [key: string]: unknown;
}

/** One commodity's county royalty rollup. */
export interface EnergyRoyaltyItem {
  commodity: string;
  royalty_usd: number;
  [key: string]: unknown;
}

/**
 * ONRR county-level federal royalty rollup. County-wide, never
 * parcel-precise — `scope` is always "county" and labelled as such.
 */
export interface EnergyRoyalties {
  scope: "county" | (string & {});
  state: string | null;
  county: string | null;
  years: number;
  total_usd: number;
  royalties: EnergyRoyaltyItem[];
  [key: string]: unknown;
}

/** One nearby HIFLD gas / NGL / crude trunk line row. */
export interface EnergyPipelineRow {
  kind: string | null;
  kind_raw: string | null;
  operator: EntityRef | null;
  label: string | null;
  status: string | null;
  distance_miles: number | null;
  [key: string]: unknown;
}

/** One FracFocus frac-job chemical disclosure row. */
export interface FracFocusRow {
  api_number: string | null;
  operator: EntityRef | null;
  well_name: string | null;
  state: string | null;
  county: string | null;
  disclosure_date: string | null;
  total_water_gal: number | null;
  total_proppant_lbs: number | null;
  location: LatLng | null;
  distance_miles: number | null;
  [key: string]: unknown;
}

/** Surface or subsurface half of the split-estate check. */
export interface EnergySplitEstateSide {
  type: string;
  agency: string | null;
  coverage_pct: number;
  [key: string]: unknown;
}

/** Split-estate check: surface vs subsurface ownership. */
export interface EnergySplitEstate {
  is_split_estate: boolean;
  surface: EnergySplitEstateSide;
  subsurface: EnergySplitEstateSide;
  [key: string]: unknown;
}

/** One BLM Sage-Grouse habitat overlay row. */
export interface EnergySageGrouseHabitat {
  designation: string | null;
  area_acres: number | null;
  overlap_acres: number | null;
  [key: string]: unknown;
}

/** BLM Sage-Grouse habitat context. */
export interface EnergySageGrouse {
  in_habitat: boolean;
  habitat_count: number;
  habitats: EnergySageGrouseHabitat[];
  [key: string]: unknown;
}

/** NREL + BLM Solar + wind-turbine context for renewable siting. */
export interface EnergyRenewableSiting {
  nrel_score: number | null;
  blm_solar_zone: string | null;
  wind_turbines_within_2mi: number;
  notes: string[];
  [key: string]: unknown;
}

/** Development-constraint context. Each block degrades to null independently. */
export interface EnergyConstraints {
  split_estate: EnergySplitEstate | null;
  sage_grouse: EnergySageGrouse | null;
  renewable_siting: EnergyRenewableSiting | null;
  [key: string]: unknown;
}

// --- Energy API: renewables section ---

/** Nearest ORNL/HIFLD transmission line of one voltage class. */
export interface EnergyTransmissionLine {
  /** "100-161", "220-287", "345", "500", "735 AND ABOVE", or "DC" */
  volt_class: string | null;
  voltage_kv: number | null;
  owner: EntityRef | null;
  status: string | null;
  distance_miles: number | null;
  /** True when the line runs through the section (distance under 1 m). */
  crosses_section: boolean;
  [key: string]: unknown;
}

/**
 * A substation inferred from ORNL/HIFLD transmission-line endpoints. No open
 * federal substation layer exists, so every row is inferred (`inferred: true`).
 */
export interface EnergyInferredSubstation {
  name: string | null;
  max_voltage_kv: number | null;
  max_volt_class: string | null;
  line_count: number;
  distance_miles: number | null;
  inferred: true;
  [key: string]: unknown;
}

/** Grid proximity: nearest line per kV class + inferred substations. */
export interface EnergyRenewablesGrid {
  radius_mi: number;
  /** Nearest line per voltage class within `radius_mi`, ordered by class. */
  transmission_by_class: EnergyTransmissionLine[];
  /** Nearest AC line of 100 kV or more (DC lines excluded). */
  nearest_line_100kv_plus: EnergyTransmissionLine | null;
  /** Up to five nearest inferred substations. */
  substations: EnergyInferredSubstation[];
  nearest_substation_230kv_plus: EnergyInferredSubstation | null;
  nearest_substation_345kv_plus: EnergyInferredSubstation | null;
  [key: string]: unknown;
}

/** Generator group an EIA-860M energy source rolls up to. */
export type EnergyGeneratorGroup =
  | "solar"
  | "wind"
  | "storage"
  | "hydro"
  | "geothermal"
  | "gas"
  | "nuclear"
  | "coal"
  | "other"
  | (string & {});

/** Operating vs planned nameplate MW for one generator group. */
export interface EnergyGeneratorTotals {
  operating: number;
  planned: number;
  [key: string]: unknown;
}

/** One EIA-860M plant (operating or planned) near the section. */
export interface EnergyPlant {
  eia_plant_id: number;
  name: string | null;
  operator: EntityRef | null;
  inventory: "operating" | "planned" | (string & {});
  /** The group holding the plant's largest share of capacity. */
  group: EnergyGeneratorGroup;
  technologies: string[];
  capacity_mw: number;
  capacity_mw_by_group: Partial<Record<EnergyGeneratorGroup, number>>;
  online_year: number | null;
  status: string | null;
  distance_miles: number | null;
  [key: string]: unknown;
}

/** One USGS/LBNL USPVDB solar-array footprint. */
export interface EnergyPvFootprint {
  uspvdb_case_id: number | null;
  eia_plant_id: number | null;
  name: string | null;
  capacity_ac_mw: number | null;
  online_year: number | null;
  on_section: boolean;
  distance_miles: number | null;
  [key: string]: unknown;
}

/** USGS wind-turbine (USWTDB) counts near the section. */
export interface EnergyWindTurbines {
  within_2mi: number;
  within_5mi: number;
  projects_within_5mi: string[];
  [key: string]: unknown;
}

/** Existing + planned generators, solar footprints, and turbines. */
export interface EnergyRenewablesProjects {
  radius_mi: number;
  totals_mw: Partial<Record<EnergyGeneratorGroup, EnergyGeneratorTotals>>;
  /** Up to 40 nearest plants. */
  plants: EnergyPlant[];
  pv_footprints: EnergyPvFootprint[];
  wind_turbines: EnergyWindTurbines;
  [key: string]: unknown;
}

/**
 * NREL 2024 supply-curve cell nearest the section, one per technology.
 * Values describe the surrounding 11.5 km cell, not the section itself.
 * NREL values are CC-BY 4.0.
 */
export interface EnergyNrelCell {
  technology: "solar" | "wind" | (string & {});
  sc_point_gid: number | null;
  resource: number | null;
  /** "kWh/m2/day (GHI)" for solar, "m/s (115 m hub height)" for wind */
  resource_unit: string;
  capacity_factor_pct: number | null;
  lcoe_all_in_usd_per_mwh: number | null;
  lcoe_site_usd_per_mwh: number | null;
  /** National percentile of all-in LCOE within the technology (0 = cheapest). */
  lcoe_percentile: number | null;
  capacity_ac_mw: number | null;
  dist_spur_miles: number | null;
  dist_reinforcement_miles: number | null;
  cell_distance_miles: number | null;
  [key: string]: unknown;
}

/** One WAFWA CHAT habitat category overlapping the section. */
export interface EnergyLpcCategory {
  chat_category: number;
  label: string | null;
  overlap_acres: number | null;
  [key: string]: unknown;
}

/**
 * Lesser prairie-chicken range-wide plan habitat (WAFWA CHAT). Not ESA
 * critical habitat.
 */
export interface EnergyLesserPrairieChicken {
  in_occupied_range: boolean;
  ecoregion: string | null;
  /** Lowest (highest-priority) CHAT category on the section. */
  top_category: number | null;
  categories: EnergyLpcCategory[];
  status_note: string;
  [key: string]: unknown;
}

/** An airspace floor or ceiling. */
export interface EnergyAltitude {
  /** Feet; null when the source unit is not feet. */
  value_ft: number | null;
  /** "SFC", "AGL", "MSL", or the raw source code */
  reference: string | null;
  label: string;
  [key: string]: unknown;
}

/** One FAA military training route near the section. */
export interface EnergyMilitaryTrainingRoute {
  ident: string | null;
  floor: EnergyAltitude | null;
  ceiling: EnergyAltitude | null;
  inside_corridor: boolean;
  centerline_distance_miles: number | null;
  [key: string]: unknown;
}

/** One FAA special use airspace overlapping the section. */
export interface EnergySpecialUseAirspace {
  name: string | null;
  type_code: string | null;
  floor: EnergyAltitude | null;
  ceiling: EnergyAltitude | null;
  times_of_use: string | null;
  controlling_agency: string | null;
  [key: string]: unknown;
}

/** FAA military training routes + special use airspace. */
export interface EnergyRenewablesAviation {
  military_training_routes: EnergyMilitaryTrainingRoute[];
  special_use_airspace: EnergySpecialUseAirspace[];
  [key: string]: unknown;
}

/** One BLM Solar Energy Zone the section sits in. */
export interface EnergySolarEnergyZone {
  name: string | null;
  status: string | null;
  state_office: string | null;
  [key: string]: unknown;
}

/** One BLM Section 368 energy corridor near the section. */
export interface EnergySection368Corridor {
  name: string | null;
  status: string | null;
  width_feet: number | null;
  distance_miles: number | null;
  [key: string]: unknown;
}

/** One BLM solar/wind right-of-way case near the section. */
export interface EnergyRenewableRowCase {
  serial_number: string | null;
  case_type: string | null;
  status: string | null;
  holder: EntityRef | null;
  acres: number | null;
  on_section: boolean;
  [key: string]: unknown;
}

/** BLM Solar Energy Zones, Section 368 corridors, and renewable ROW cases. */
export interface EnergyRenewablesBlm {
  solar_energy_zones: EnergySolarEnergyZone[];
  section_368_corridors: EnergySection368Corridor[];
  renewable_row_cases: EnergyRenewableRowCase[];
  [key: string]: unknown;
}

/** Group an FAA Digital Obstacle File obstacle type rolls up to. */
export type EnergyObstacleGroup =
  | "wind_turbine"
  | "met_tower"
  | "transmission_tower"
  | "tower"
  | "stack"
  | "other"
  | (string & {});

/** The tallest obstacle within the obstacle radius. */
export interface EnergyTallestObstacle {
  type: string | null;
  agl_ft: number | null;
  distance_miles: number | null;
  faa_study: string | null;
  [key: string]: unknown;
}

/** FAA Digital Obstacle File summary near the section. */
export interface EnergyObstacles {
  radius_mi: number;
  total: number;
  at_least_200ft_agl: number;
  on_section: number;
  by_group: Partial<Record<EnergyObstacleGroup, number>>;
  tallest: EnergyTallestObstacle | null;
  /** Nearest meteorological tower within 10 miles. */
  nearest_met_tower_miles: number | null;
  [key: string]: unknown;
}

/** USGS whooping crane migration corridor. */
export interface EnergyWhoopingCrane {
  /** Narrowest corridor band (percent) the section falls in; null when outside. */
  band_pct: number | null;
  note: string;
  [key: string]: unknown;
}

/** One active LBNL Queued Up interconnection request in the county. */
export interface EnergyQueueProject {
  name: string | null;
  type: string | null;
  mw: number | null;
  point_of_interconnection: string | null;
  ia_phase: string | null;
  proposed_year: number | null;
  developer: EntityRef | null;
  transmission_provider: string | null;
  [key: string]: unknown;
}

/**
 * LBNL Queued Up interconnection queue, county-wide (never parcel-precise).
 * LBNL values are CC-BY 4.0.
 */
export interface EnergyInterconnectionQueue {
  scope: "county" | (string & {});
  county: string;
  state_code: string;
  vintage: string | null;
  active_requests: number;
  active_mw_by_type: Record<string, number>;
  withdrawn_requests: number;
  operational_requests: number;
  /** Up to 10 largest active requests. */
  active_projects: EnergyQueueProject[];
  [key: string]: unknown;
}

/**
 * Renewable-siting section. Every part degrades on its own: a failed part is
 * null and listed in `meta.unavailable` as `{section: "renewables.<part>"}`.
 */
export interface EnergyRenewables {
  grid: EnergyRenewablesGrid | null;
  projects: EnergyRenewablesProjects | null;
  /** Up to one cell per technology (solar, wind) within 12 km. */
  nrel: EnergyNrelCell[] | null;
  lesser_prairie_chicken: EnergyLesserPrairieChicken | null;
  aviation: EnergyRenewablesAviation | null;
  blm: EnergyRenewablesBlm | null;
  obstacles: EnergyObstacles | null;
  whooping_crane: EnergyWhoopingCrane | null;
  /** Also null when the section has no state/county to match on. */
  interconnection_queue: EnergyInterconnectionQueue | null;
  [key: string]: unknown;
}

/** Per-section counts. A null count means that section was not fetched. */
export interface EnergySummary {
  wells_in_section: number | null;
  wells_nearby: number | null;
  operators_nearby: number | null;
  federal_leases: number | null;
  orphaned_wells: number | null;
  pipelines_within_radius: number | null;
  fracfocus_disclosures: number | null;
  /** From `renewables.grid`; null when not fetched or nothing within range. */
  nearest_transmission_100kv_plus_miles: number | null;
  /** From `renewables.grid`; null when not fetched or nothing within range. */
  nearest_substation_230kv_plus_miles: number | null;
  [key: string]: unknown;
}

/** Wells section: in-section rows + the nearby radius envelope. */
export interface EnergyWells {
  in_section: SectionEnvelope<EnergyWellRow>;
  nearby: { radius_mi: number } & SectionEnvelope<EnergyWellRow>;
  [key: string]: unknown;
}

/**
 * Per-parcel energy report, keyed at PLSS section grain.
 * Sections degrade independently: a failed section lands in
 * `meta.unavailable` instead of failing the report. Sections are optional
 * because `include=` projections omit the sections not requested.
 */
export interface EnergyReport {
  /** The legal location as submitted */
  legal_location: string;
  /** The stored section the report describes */
  resolved_legal_location: string | null;
  alternate_legal_location: string | null;
  unit: string | null;
  state: string | null;
  state_code: string | null;
  county: string | null;
  /** Present only on tracts whose boundary was computed by subdivision. */
  derived?: boolean;
  parcel: ReportParcel;
  summary: EnergySummary;
  wells?: EnergyWells;
  operators?: { radius_mi: number } & SectionEnvelope<EnergyOperatorRow>;
  leases?: SectionEnvelope<EnergyLeaseRow>;
  royalties?: EnergyRoyalties | null;
  orphaned_wells?: SectionEnvelope<EnergyOrphanedWellRow>;
  pipelines?: { radius_mi: number } & SectionEnvelope<EnergyPipelineRow>;
  fracfocus?: { radius_mi: number } & SectionEnvelope<FracFocusRow>;
  constraints?: EnergyConstraints | null;
  renewables?: EnergyRenewables | null;
  meta: ReportMeta;
  [key: string]: unknown;
}

// --- Federal Land API Types ---

/** Sections of the federal-land report addressable through `include=`. */
export type FederalLandReportSection =
  | "surface_management"
  | "og_leases"
  | "geothermal_leases"
  | "rights_of_way"
  | "flood_zones"
  | "mining_claims"
  | "wetlands"
  | "fireshed"
  | "soils"
  | "crop_history"
  | "orphaned_wells"
  | "critical_habitat"
  | "public_access"
  | "wildfire_risk_communities"
  | "elevation"
  | "geometry";

/** Options for `federalLandReport`. */
export interface FederalLandReportOptions {
  /**
   * Return only these sections (the pruned layers' spatial queries are
   * skipped entirely). `geometry` is a section name: include it to attach
   * the parcel boundary under `parcel.geometry`.
   */
  include?: FederalLandReportSection[];
}

/** One BLM Surface Management Agency row. */
export interface SurfaceManagementRow {
  agency: string | null;
  admin_unit: string | null;
  [key: string]: unknown;
}

/** One BLM MLRS lease row (O&G and geothermal share this shape). */
export interface FederalLeaseRow {
  serial: string | null;
  status: string | null;
  lessee: string | null;
  expiration: string | null;
  location: LatLng | null;
  [key: string]: unknown;
}

/** One BLM MLRS right-of-way row. */
export interface RightOfWayRow {
  serial: string | null;
  use_type: string | null;
  holder: string | null;
  status: string | null;
  location: LatLng | null;
  [key: string]: unknown;
}

/** One FEMA flood-zone row. */
export interface FloodZoneRow {
  zone: string | null;
  subtype: string | null;
  sfha: boolean | null;
  bfe: number | null;
  [key: string]: unknown;
}

/** One BLM MLRS mining-claim row. */
export interface MiningClaimRow {
  case_id: string | null;
  case_type: string | null;
  claimant: string | null;
  status: string | null;
  [key: string]: unknown;
}

/** One USFWS wetland row. */
export interface WetlandRow {
  wetland_type: string | null;
  attribute: string | null;
  acres: number | null;
  [key: string]: unknown;
}

/** One USFS fireshed row. */
export interface FireshedRow {
  name: string | null;
  exposure_class: string | null;
  exposure_pct: number | null;
  homes_at_risk: number | null;
  [key: string]: unknown;
}

/** One NRCS SSURGO soil map-unit row. */
export interface SoilRow {
  mukey: string | null;
  name: string | null;
  prime_farmland: string | null;
  hydric: string | null;
  [key: string]: unknown;
}

/**
 * One USGS documented orphaned well row (Federal Land / Texas APIs —
 * `operator` is a plain string here; `location` is absent on Texas rows).
 */
export interface OrphanedWellRow {
  well_id: string | null;
  name: string | null;
  operator: string | null;
  status: string | null;
  api_number: string | null;
  location?: LatLng | null;
  [key: string]: unknown;
}

/** One USFWS critical-habitat row. */
export interface CriticalHabitatRow {
  common_name: string | null;
  scientific_name: string | null;
  listing_status: string | null;
  unit_name: string | null;
  feature_kind: string | null;
  [key: string]: unknown;
}

/** One BLM Public Land Access Data row. */
export interface PublicAccessRow {
  plad_id: string | null;
  access_class: string | null;
  access_method: string | null;
  acres: number | null;
  admin_unit: string | null;
  [key: string]: unknown;
}

/** One USFS Wildfire Risk to Communities block row. */
export interface WildfireRiskRow {
  block_geoid: string | null;
  risk_to_homes: number | null;
  burn_probability: number | null;
  exposure_type: string | null;
  housing_units: number | null;
  [key: string]: unknown;
}

/** USDA NASS Cropland Data Layer summary (single object, never truncates). */
export interface CropHistory {
  year: number | null;
  dominant_crop: string | null;
  dominant_crop_pct: number | null;
  distribution: Record<string, unknown> | null;
  [key: string]: unknown;
}

/** USGS 3DEP elevation summary (single object, never truncates). */
export interface Elevation {
  elev_min_m: number | null;
  elev_mean_m: number | null;
  elev_max_m: number | null;
  slope_mean_deg: number | null;
  aspect_dominant: string | null;
  [key: string]: unknown;
}

/**
 * Federal-land parcel report for one stored PLSS tract.
 * `report_scope` is "parcel" when layer rows describe the resolved tract
 * itself, or "containing_section" when the tract is finer than the stored
 * grid (the section is named by `report_section`). Sections are optional
 * because `include=` projections omit the sections not requested.
 */
export interface FederalLandReport {
  legal_location: string;
  resolved_legal_location: string | null;
  alternate_legal_location: string | null;
  unit: string | null;
  state: string | null;
  county: string | null;
  /** Present only on tracts whose boundary was computed by subdivision. */
  derived?: boolean;
  report_scope: "parcel" | "containing_section" | (string & {});
  report_section?: string;
  parcel: ReportParcel;
  surface_management?: SectionEnvelope<SurfaceManagementRow>;
  og_leases?: SectionEnvelope<FederalLeaseRow>;
  geothermal_leases?: SectionEnvelope<FederalLeaseRow>;
  rights_of_way?: SectionEnvelope<RightOfWayRow>;
  flood_zones?: SectionEnvelope<FloodZoneRow>;
  mining_claims?: SectionEnvelope<MiningClaimRow>;
  wetlands?: SectionEnvelope<WetlandRow>;
  fireshed?: SectionEnvelope<FireshedRow>;
  soils?: SectionEnvelope<SoilRow>;
  crop_history?: CropHistory | null;
  orphaned_wells?: SectionEnvelope<OrphanedWellRow>;
  critical_habitat?: SectionEnvelope<CriticalHabitatRow>;
  public_access?: SectionEnvelope<PublicAccessRow>;
  wildfire_risk_communities?: SectionEnvelope<WildfireRiskRow>;
  elevation?: Elevation | null;
  meta: ReportMeta;
  [key: string]: unknown;
}

// --- Texas API Types ---

/** Sections of the Texas report addressable through `include=`. */
export type TexasReportSection =
  | "state_leases"
  | "state_units"
  | "psf_lands"
  | "state_agency_lands"
  | "upland_leases"
  | "active_wells"
  | "pipelines"
  | "pending_permits"
  | "coastal_erosion"
  | "flood_zones"
  | "wetlands"
  | "fireshed"
  | "soils"
  | "orphaned_wells"
  | "critical_habitat"
  | "wildfire_risk_communities"
  | "elevation"
  | "production"
  | "geometry";

/** Options for `texasReport`. */
export interface TexasReportOptions {
  /**
   * Return only these sections (the pruned layers' spatial queries are
   * skipped entirely). `geometry` is a section name: include it to attach
   * the abstract boundary under `parcel.geometry`.
   */
  include?: TexasReportSection[];
}

/** One Texas GLO active O&G state lease row. */
export interface TexasStateLeaseRow {
  lease_no: string | null;
  lessee: string | null;
  status: string | null;
  mineral_type: string | null;
  expiration: string | null;
  royalty_rate: number | null;
  [key: string]: unknown;
}

/** One Texas GLO pooled-unit row. */
export interface TexasStateUnitRow {
  lease_no: string | null;
  unit_name: string | null;
  lease_status: string | null;
  lease_type: string | null;
  [key: string]: unknown;
}

/** One Texas GLO Permanent School Fund land row. */
export interface TexasPsfLandRow {
  control_number: string | null;
  survey: string | null;
  deed_acres: number | null;
  [key: string]: unknown;
}

/** One Texas state-agency land row. */
export interface TexasStateAgencyLandRow {
  control_number: string | null;
  land_name: string | null;
  land_type: string | null;
  [key: string]: unknown;
}

/** One Texas GLO upland surface lease row. */
export interface TexasUplandLeaseRow {
  lease_number: string | null;
  lease_status: string | null;
  activity: string | null;
  primary_lessee: string | null;
  [key: string]: unknown;
}

/** One Texas RRC well row (surface locations). */
export interface TexasActiveWellRow {
  api_number: string | null;
  operator: string | null;
  lease_name: string | null;
  well_number: string | null;
  status: string | null;
  status_raw: string | null;
  formation: string | null;
  field: string | null;
  location: LatLng | null;
  [key: string]: unknown;
}

/** One Texas RRC T-4 pipeline row. */
export interface TexasPipelineRow {
  pipeline_id: string | null;
  operator_no: string | null;
  commodity: string | null;
  diameter_in: number | null;
  status: string | null;
  /** Nearest point of the line to the parcel. */
  overlap_point: LatLng | null;
  [key: string]: unknown;
}

/** One Texas RRC pending drilling permit row. */
export interface TexasPendingPermitRow {
  permit_no: string | null;
  operator_name: string | null;
  [key: string]: unknown;
}

/** One Texas GLO critical erosion area row. */
export interface TexasCoastalErosionRow {
  site: string | null;
  rate_ep_ft_yr: number | null;
  rate_lr_ft_yr: number | null;
  r_squared: number | null;
  [key: string]: unknown;
}

/** One month of a lease's 60-month production sparkline. */
export interface TexasMonthlyVolume {
  /** Month fact, "YYYY-MM" */
  ym: string | null;
  oil_bbl: number;
  gas_mcf: number;
  water_bbl: number;
  [key: string]: unknown;
}

/**
 * One RRC lease production rollup. Production is reported by RRC at the
 * LEASE level (not per tract): the rows are the leases whose wells fall on
 * the abstract with their full lifetime totals.
 */
export interface TexasProductionLease {
  operator: EntityRef | null;
  district_no: string | null;
  lease_no: string | null;
  oil_gas_code: string | null;
  cum_oil_bbl: number;
  cum_gas_mcf: number;
  cum_boe: number;
  ttm_oil_bbl: number;
  ttm_gas_mcf: number;
  first_month: string | null;
  last_month: string | null;
  peak_month: string | null;
  months_producing: number;
  monthly: TexasMonthlyVolume[];
  [key: string]: unknown;
}

/** The abstract the production rollup describes. */
export interface TexasAbstractRef {
  county_fips: string;
  abstract_no: string;
  [key: string]: unknown;
}

/** Abstract-level production summary across the returned leases. */
export interface TexasProductionSummary {
  producing_lease_count: number;
  total_cum_boe: number;
  total_cum_oil_bbl: number;
  total_cum_gas_mcf: number;
  ttm_boe: number;
  first_month: string | null;
  last_month: string | null;
  [key: string]: unknown;
}

/** The production block embedded in the Texas report. */
export interface TexasProductionBlock {
  abstract: TexasAbstractRef;
  summary: TexasProductionSummary;
  leases: SectionEnvelope<TexasProductionLease>;
  [key: string]: unknown;
}

/** `GET /texas/production` response: identity + the production rollup. */
export interface TexasProduction extends TexasProductionBlock {
  county_fips: string | null;
  county: string | null;
  abstract_no: string | null;
  block_no: string | null;
  meta: ReportMeta;
}

/**
 * Full Texas abstract report, keyed on the Abstract/Block/Survey grid.
 * Sections are optional because `include=` projections omit the sections
 * not requested.
 */
export interface TexasReport {
  legal_location: string;
  resolved_legal_location: string | null;
  alternate_legal_location: string | null;
  county_fips: string | null;
  county: string | null;
  state: "TX" | (string & {});
  abstract_no: string | null;
  block_no: string | null;
  survey_name: string | null;
  parcel: ReportParcel;
  state_leases?: SectionEnvelope<TexasStateLeaseRow>;
  state_units?: SectionEnvelope<TexasStateUnitRow>;
  psf_lands?: SectionEnvelope<TexasPsfLandRow>;
  state_agency_lands?: SectionEnvelope<TexasStateAgencyLandRow>;
  upland_leases?: SectionEnvelope<TexasUplandLeaseRow>;
  active_wells?: SectionEnvelope<TexasActiveWellRow>;
  pipelines?: SectionEnvelope<TexasPipelineRow>;
  pending_permits?: SectionEnvelope<TexasPendingPermitRow>;
  coastal_erosion?: SectionEnvelope<TexasCoastalErosionRow>;
  flood_zones?: SectionEnvelope<FloodZoneRow>;
  wetlands?: SectionEnvelope<WetlandRow>;
  fireshed?: SectionEnvelope<FireshedRow>;
  soils?: SectionEnvelope<SoilRow>;
  orphaned_wells?: SectionEnvelope<OrphanedWellRow>;
  critical_habitat?: SectionEnvelope<CriticalHabitatRow>;
  wildfire_risk_communities?: SectionEnvelope<WildfireRiskRow>;
  elevation?: Elevation | null;
  production?: TexasProductionBlock | null;
  meta: ReportMeta;
  [key: string]: unknown;
}

/** Options for `texasProduction`: a legal description OR the registry keys. */
export type TexasProductionOptions =
  | {
      /** A Texas legal description, e.g. "A-175 Reeves County". */
      legalLocation: string;
      countyFips?: never;
      abstractNo?: never;
      blockNo?: never;
    }
  | {
      legalLocation?: never;
      /** 5-digit county FIPS code, e.g. "48389". */
      countyFips: string;
      /** Abstract number, e.g. "175". */
      abstractNo: string;
      /** Block number, when the abstract is keyed by block. */
      blockNo?: string;
    };

/** The subject well's own location and formation context. */
export interface TexasWellLocation {
  api_number: string | null;
  location: LatLng | null;
  operator: EntityRef | null;
  lease_name: string | null;
  well_number: string | null;
  field: string | null;
  formation: string | null;
  status: string | null;
  spud_date: string | null;
  district: string | null;
  county_fips: string | null;
  abstract_no: string | null;
  [key: string]: unknown;
}

/**
 * One reporting unit (RRC lease edge) of a well. Volumes are ALLOCATED
 * ESTIMATES — RRC reports production by lease, never by well.
 * `denominator_basis` records whether the allocation used the
 * completion-date denominator or fell back to a static split.
 */
export interface TexasWellUnit {
  district_no: string | null;
  lease_no: string | null;
  oil_gas_code: string | null;
  operator: EntityRef | null;
  peak_oil_bbl: number;
  cum_boe: number;
  well_count: number;
  denominator_basis: "static" | "time_varying" | (string & {});
  [key: string]: unknown;
}

/** One month of a well's allocated production series. */
export interface TexasWellSeriesPoint {
  /** Month fact, "YYYY-MM" */
  ym: string;
  oil_bbl: number;
  gas_mcf: number;
  [key: string]: unknown;
}

/** The fitted Arps decline parameters. */
export interface TexasDeclineFit {
  qi: number;
  di: number;
  b: number;
  r2: number;
  points: number;
  [key: string]: unknown;
}

/**
 * Arps decline fit on the well's post-peak oil series. Withheld
 * (`available: false`) when the fit quality is below threshold — a
 * confident-looking forecast off a noisy allocated series is worse than none.
 */
export interface TexasDecline {
  available: boolean;
  reason?: "insufficient_points" | "no_valid_fit" | "fit_quality_below_threshold" | (string & {});
  detail?: { r2: number; required: number; [key: string]: unknown };
  value?: TexasDeclineFit;
  [key: string]: unknown;
}

/** One point of the fitted decline curve, on the same months as the series. */
export interface TexasDeclineCurvePoint {
  ym: string;
  q: number;
  [key: string]: unknown;
}

/** The reporting unit a well's monthly series is scoped to. */
export interface TexasWellSeriesUnit {
  district_no: string | null;
  lease_no: string | null;
  oil_gas_code: string | null;
  [key: string]: unknown;
}

/**
 * `GET /texas/wells/{api}` response: per-well units, the monthly allocated
 * series (when provisioned), and an Arps decline fit.
 */
export interface TexasWell {
  api8: string;
  location: TexasWellLocation | null;
  units: TexasWellUnit[];
  series: TexasWellSeriesPoint[];
  /** The series is scoped to the well's PRIMARY unit. */
  series_unit: TexasWellSeriesUnit | null;
  series_covers_all_units: boolean;
  decline: TexasDecline;
  decline_curve: TexasDeclineCurvePoint[] | null;
  meta: ReportMeta;
  [key: string]: unknown;
}
