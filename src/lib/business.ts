// Fernhill Mobile Detail: the business, its rules and its quirks, in one place.
// Everything the scheduling engine enforces is defined here and nowhere else.

export const BUSINESS = {
  name: "Fernhill Mobile Detail",
  short: "Fernhill",
  owner: "Dario Reyes",
  ownerFirst: "Dario",
  city: "Portland, Oregon",
  neighborhood: "Alberta Arts, NE Portland",
  tz: "America/Los_Angeles",
  van: "Bertha",
  phone: "(503) 555-0147",
  tagline: "We come to you. Dry days first.",
} as const;

export type VehicleKind = "sedan" | "suv" | "truck" | "van";
export type ServiceKey = "express" | "interior" | "full" | "showroom";
export type AddonKey = "pet" | "mud" | "headlights" | "sealant" | "odor";
export type ZoneKey = "NE" | "SE" | "N" | "NW" | "SW" | "W";
export type Parking = "garage" | "carport" | "driveway" | "street";

// Schedule -------------------------------------------------------------------
/** 0 = Sunday. Dario works Tuesday to Saturday; Monday is van maintenance and admin. */
export const OPEN_WEEKDAYS = [2, 3, 4, 5, 6];
export const DAY_START_MIN = 8 * 60;
export const DAY_END_MIN = 17 * 60 + 30;
/** Loading the van and checking the water before the first drive. */
export const LOAD_MIN = 15;
/** The tank holds two full jobs of water. The third needs a refill stop first. */
export const REFILL_MIN = 30;
export const MAX_JOBS_PER_DAY = 3;
export const GRID_MIN = 30;
export const MIN_NOTICE_H = 12;
export const HORIZON_DAYS = 21;

// Money & policy ---------------------------------------------------------------
export const DEPOSIT_CENTS = 2500;
/** Free to move or cancel up to this many hours before the start. */
export const FREE_CHANGE_H = 24;
/** Outdoor jobs move automatically when the forecast reaches this chance of rain. */
export const RAIN_LIMIT = 70;
/** Rain offers are sent this many hours before the start. */
export const RAIN_CHECK_H = 48;
/** If the customer doesn't choose, the earliest dry option is applied after this. */
export const RAIN_AUTO_H = 6;
export const CONFIRM_NUDGE_H = 6;
export const RELEASE_H = 3;
export const WAITLIST_OFFER_H = 2;
/** Ceramic spray sealant needs about four dry hours to cure. Outdoors, that means a dry day. */
export const CURE_RAIN_LIMIT = 40;
/** Repeat customers ("care plans"): how often, and the saving on every visit after the first. */
export const PLAN_WEEKS = [4, 6, 8] as const;
export const PLAN_DISCOUNT = 0.1;
/** The longest delay Dario can report in one go; beyond this he should call people. */
export const MAX_DELAY_MIN = 120;

// Zones -----------------------------------------------------------------------
export interface Zone {
  key: ZoneKey;
  name: string;
  areas: string;
  feeCents: number;
}

export const ZONES: Record<ZoneKey, Zone> = {
  NE: { key: "NE", name: "Northeast", areas: "Alberta, Irvington, Hollywood, Concordia", feeCents: 0 },
  SE: { key: "SE", name: "Southeast", areas: "Hawthorne, Sellwood, Woodstock, Montavilla", feeCents: 0 },
  N: { key: "N", name: "North", areas: "St. Johns, Kenton, Overlook, Portsmouth", feeCents: 0 },
  NW: { key: "NW", name: "Northwest", areas: "The Pearl, Nob Hill, Forest Park", feeCents: 1000 },
  SW: { key: "SW", name: "Southwest", areas: "Hillsdale, Multnomah Village, Downtown", feeCents: 1000 },
  W: { key: "W", name: "Westside", areas: "Beaverton, Tigard, Aloha", feeCents: 2000 },
};

export const HOME_ZONE: ZoneKey = "NE";

/** Drive minutes between zones, including parking. Symmetric. */
const TRAVEL: Record<ZoneKey, Record<ZoneKey, number>> = {
  NE: { NE: 10, SE: 20, N: 15, NW: 25, SW: 25, W: 35 },
  SE: { NE: 20, SE: 10, N: 30, NW: 30, SW: 20, W: 40 },
  N: { NE: 15, SE: 30, N: 10, NW: 20, SW: 30, W: 35 },
  NW: { NE: 25, SE: 30, N: 20, NW: 10, SW: 20, W: 25 },
  SW: { NE: 25, SE: 20, N: 30, NW: 20, SW: 10, W: 20 },
  W: { NE: 35, SE: 40, N: 35, NW: 25, SW: 20, W: 10 },
};
export const travelMin = (a: ZoneKey, b: ZoneKey) => TRAVEL[a][b];

const ZIP_ZONES: Record<string, ZoneKey> = {
  "97211": "NE", "97212": "NE", "97213": "NE", "97232": "NE", "97220": "NE", "97218": "NE",
  "97202": "SE", "97206": "SE", "97214": "SE", "97215": "SE", "97222": "SE", "97266": "SE", "97236": "SE",
  "97203": "N", "97217": "N", "97231": "N",
  "97209": "NW", "97210": "NW", "97229": "NW",
  "97201": "SW", "97205": "SW", "97219": "SW", "97221": "SW", "97239": "SW",
  "97005": "W", "97006": "W", "97007": "W", "97008": "W", "97223": "W", "97224": "W", "97225": "W", "97062": "W",
};
export const zoneForZip = (zip: string): ZoneKey | null => ZIP_ZONES[zip.trim().slice(0, 5)] ?? null;

/** Words people use in a message, mapped to a zone. */
export const NEIGHBORHOODS: Record<string, ZoneKey> = {
  alberta: "NE", irvington: "NE", hollywood: "NE", concordia: "NE", "ne portland": "NE", "northeast": "NE",
  hawthorne: "SE", sellwood: "SE", woodstock: "SE", montavilla: "SE", division: "SE", "se portland": "SE", southeast: "SE", "mt tabor": "SE",
  "st johns": "N", "st. johns": "N", kenton: "N", overlook: "N", portsmouth: "N",
  pearl: "NW", "nob hill": "NW", northwest: "NW", "nw portland": "NW",
  hillsdale: "SW", multnomah: "SW", downtown: "SW", "south waterfront": "SW", southwest: "SW",
  beaverton: "W", tigard: "W", aloha: "W", "lake oswego": "W", westside: "W", "west side": "W",
};

// Vehicles, services, add-ons ---------------------------------------------------
export interface Vehicle {
  key: VehicleKind;
  name: string;
  examples: string;
  timeX: number;
  priceX: number;
}
export const VEHICLES: Record<VehicleKind, Vehicle> = {
  sedan: { key: "sedan", name: "Car", examples: "Sedan, coupe, hatchback", timeX: 1, priceX: 1 },
  suv: { key: "suv", name: "SUV or wagon", examples: "Outback, RAV4, CR-V", timeX: 1.25, priceX: 1.2 },
  truck: { key: "truck", name: "Truck or large SUV", examples: "Tacoma, F-150, Tahoe", timeX: 1.4, priceX: 1.3 },
  van: { key: "van", name: "Van or minivan", examples: "Sienna, Transit, Sprinter", timeX: 1.5, priceX: 1.4 },
};

export interface Service {
  key: ServiceKey;
  name: string;
  line: string;
  includes: string[];
  baseMin: number;
  baseCents: number;
}
export const SERVICES: Record<ServiceKey, Service> = {
  express: {
    key: "express", name: "Express Wash", line: "Hand wash, wheels and glass. Looks clean in an hour.",
    includes: ["Hand wash and dry", "Wheels and tires", "Windows inside and out"], baseMin: 60, baseCents: 8500,
  },
  interior: {
    key: "interior", name: "Interior Reset", line: "Vacuum, wipe and condition everything you touch.",
    includes: ["Full vacuum", "Dash, doors and console", "Seats and mats", "Windows inside"], baseMin: 90, baseCents: 13000,
  },
  full: {
    key: "full", name: "Full Refresh", line: "Inside and out, plus a hand wax. Our most-booked.",
    includes: ["Everything in Express and Interior", "Hand wax", "Trim and tire dressing"], baseMin: 150, baseCents: 21000,
  },
  showroom: {
    key: "showroom", name: "Showroom Detail", line: "Clay bar, sealant and a deep interior. Before you sell, or after a long winter.",
    includes: ["Everything in Full Refresh", "Clay bar decontamination", "Paint sealant", "Steam-cleaned interior"], baseMin: 240, baseCents: 34000,
  },
};

export interface Addon {
  key: AddonKey;
  name: string;
  line: string;
  min: number;
  cents: number;
}
export const ADDONS: Record<AddonKey, Addon> = {
  pet: { key: "pet", name: "Pet hair removal", line: "Rubber-brush and vacuum pass on every fabric surface", min: 30, cents: 3500 },
  mud: { key: "mud", name: "Heavy mud or road salt", line: "Underbody and wheel-well rinse", min: 30, cents: 3000 },
  headlights: { key: "headlights", name: "Headlight restoration", line: "Cloudy lenses, wet-sanded and sealed", min: 30, cents: 4500 },
  sealant: { key: "sealant", name: "Ceramic spray sealant", line: "Months of water beading. Outdoors it needs a dry day to cure", min: 20, cents: 4000 },
  odor: { key: "odor", name: "Odor treatment", line: "Ozone and steam for smoke, pets or gym bags", min: 20, cents: 3000 },
};

export const PARKING: Record<Parking, { name: string; line: string; covered: boolean }> = {
  garage: { name: "Garage", line: "Covered, so rain never moves you", covered: true },
  carport: { name: "Carport or covered spot", line: "Covered, so rain never moves you", covered: true },
  driveway: { name: "Driveway", line: "Outdoors. We'll watch the forecast for you", covered: false },
  street: { name: "Street", line: "Outdoors. We'll watch the forecast for you", covered: false },
};
export const isCovered = (p: Parking) => PARKING[p].covered;

/** Sealant cures for about four hours: outdoors, only a dry day will do. */
export const needsDryDay = (addons: readonly AddonKey[] | undefined, parking: Parking) => !isCovered(parking) && !!addons?.includes("sealant");
/** How much rain chance moves a job: 70% normally, 40% when it has sealant to cure outdoors. */
export const rainLimitFor = (addons: readonly AddonKey[] | undefined, parking: Parking) => (needsDryDay(addons, parking) ? CURE_RAIN_LIMIT : RAIN_LIMIT);

export const roundUp15 = (m: number) => Math.ceil(m / 15) * 15;
const roundTo5 = (cents: number) => Math.round(cents / 500) * 500;

export interface Quote {
  durationMin: number;
  serviceCents: number;
  addonCents: number;
  feeCents: number;
  totalCents: number;
}

export function quote(vehicle: VehicleKind, service: ServiceKey, addons: AddonKey[], zone: ZoneKey | null): Quote {
  const v = VEHICLES[vehicle];
  const s = SERVICES[service];
  const durationMin = roundUp15(s.baseMin * v.timeX + addons.reduce((n, a) => n + ADDONS[a].min, 0));
  const serviceCents = roundTo5(s.baseCents * v.priceX);
  const addonCents = addons.reduce((n, a) => n + ADDONS[a].cents, 0);
  const feeCents = zone ? ZONES[zone].feeCents : 0;
  return { durationMin, serviceCents, addonCents, feeCents, totalCents: serviceCents + addonCents + feeCents };
}

export const dollars = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export const hoursLabel = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
};
