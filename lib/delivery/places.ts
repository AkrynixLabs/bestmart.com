// Approximate centres (WGS84, about a kilometre of accuracy) of Ghanaian
// towns and the main neighbourhoods of Accra-Tema and Kumasi. Used only to
// estimate delivery distance when a map pin is missing, so close enough is
// fine. Add places freely; keep names as people write them in addresses.

import type { GhanaRegionValue } from "@/lib/validation/common"

export type Place = {
  name: string
  kind: "area" | "town"
  region: GhanaRegionValue
  lat: number
  lng: number
  aliases?: string[]
}

const area = (name: string, region: GhanaRegionValue, lat: number, lng: number, aliases?: string[]): Place => ({ name, kind: "area", region, lat, lng, aliases })
const town = (name: string, region: GhanaRegionValue, lat: number, lng: number, aliases?: string[]): Place => ({ name, kind: "town", region, lat, lng, aliases })

export const PLACES: Place[] = [
  // Greater Accra: neighbourhoods
  area("Accra Central", "greater_accra", 5.548, -0.206, ["makola", "central accra", "james town", "jamestown"]),
  area("Osu", "greater_accra", 5.556, -0.177),
  area("Labone", "greater_accra", 5.564, -0.168),
  area("Cantonments", "greater_accra", 5.575, -0.175, ["cantonment"]),
  area("Airport Residential", "greater_accra", 5.604, -0.177, ["airport", "airport residential area", "airport city"]),
  area("East Legon", "greater_accra", 5.637, -0.16, ["east legon hills"]),
  area("Legon", "greater_accra", 5.651, -0.187, ["university of ghana"]),
  area("Madina", "greater_accra", 5.678, -0.165),
  area("Adenta", "greater_accra", 5.705, -0.164, ["adentan"]),
  area("Spintex", "greater_accra", 5.628, -0.11, ["spintex road"]),
  area("Teshie", "greater_accra", 5.585, -0.1),
  area("Nungua", "greater_accra", 5.601, -0.078),
  area("Labadi", "greater_accra", 5.56, -0.147, ["la"]),
  area("Dzorwulu", "greater_accra", 5.61, -0.2),
  area("Achimota", "greater_accra", 5.62, -0.22),
  area("Kaneshie", "greater_accra", 5.57, -0.235),
  area("Dansoman", "greater_accra", 5.547, -0.27),
  area("Lapaz", "greater_accra", 5.605, -0.25, ["abeka lapaz", "la paz", "abeka la paz"]),
  area("Tesano", "greater_accra", 5.6, -0.229),
  area("Dome", "greater_accra", 5.65, -0.235),
  area("Haatso", "greater_accra", 5.665, -0.205),
  area("Taifa", "greater_accra", 5.66, -0.25),
  area("Weija", "greater_accra", 5.562, -0.333),
  area("Sakumono", "greater_accra", 5.615, -0.045),
  area("Abokobi", "greater_accra", 5.733, -0.196),
  area("Amasaman", "greater_accra", 5.702, -0.301),
  area("Kokrobite", "greater_accra", 5.498, -0.372),
  area("Ashaiman", "greater_accra", 5.695, -0.03),
  area("Tema Community 25", "greater_accra", 5.735, -0.01, ["community 25"]),
  // Greater Accra: towns
  town("Accra", "greater_accra", 5.556, -0.197),
  town("Tema", "greater_accra", 5.67, -0.017, ["tema new town", "community 1"]),
  town("Dodowa", "greater_accra", 5.882, -0.098),
  town("Prampram", "greater_accra", 5.713, 0.11),
  town("Ada", "greater_accra", 5.786, 0.632, ["ada foah"]),

  // Ashanti: Kumasi neighbourhoods
  area("Adum", "ashanti", 6.693, -1.624),
  area("Kejetia", "ashanti", 6.699, -1.625),
  area("Asokwa", "ashanti", 6.667, -1.61),
  area("Bantama", "ashanti", 6.704, -1.638),
  area("Ahodwo", "ashanti", 6.665, -1.625),
  area("Suame", "ashanti", 6.725, -1.625),
  area("Tafo", "ashanti", 6.735, -1.61),
  area("KNUST", "ashanti", 6.675, -1.572, ["kwame nkrumah university"]),
  area("Ayeduase", "ashanti", 6.67, -1.56),
  area("Santasi", "ashanti", 6.665, -1.655),
  // Ashanti: towns
  town("Kumasi", "ashanti", 6.689, -1.624),
  town("Ejisu", "ashanti", 6.723, -1.47),
  town("Obuasi", "ashanti", 6.202, -1.666),
  town("Mampong", "ashanti", 7.063, -1.4),
  town("Konongo", "ashanti", 6.617, -1.217),

  // Other regions
  town("Kasoa", "central", 5.534, -0.417),
  town("Cape Coast", "central", 5.105, -1.247),
  town("Elmina", "central", 5.085, -1.35),
  town("Winneba", "central", 5.351, -0.623),
  town("Agona Swedru", "central", 5.534, -0.7, ["swedru"]),
  town("Mankessim", "central", 5.273, -1.015),
  town("Saltpond", "central", 5.209, -1.067),
  town("Dunkwa-on-Offin", "central", 5.963, -1.781, ["dunkwa"]),

  town("Takoradi", "western", 4.898, -1.76, ["sekondi-takoradi", "sekondi takoradi"]),
  town("Sekondi", "western", 4.934, -1.709),
  town("Tarkwa", "western", 5.3, -1.995),
  town("Prestea", "western", 5.433, -2.143),
  town("Axim", "western", 4.867, -2.24),
  town("Half Assini", "western", 5.05, -2.88),

  town("Sefwi Wiawso", "western_north", 6.205, -2.485, ["wiawso"]),
  town("Bibiani", "western_north", 6.463, -2.319),

  town("Koforidua", "eastern", 6.094, -0.259),
  town("Nsawam", "eastern", 5.809, -0.35),
  town("Suhum", "eastern", 6.04, -0.45),
  town("Nkawkaw", "eastern", 6.55, -0.766),
  town("Akosombo", "eastern", 6.29, 0.05),
  town("Somanya", "eastern", 6.105, -0.015),
  town("Akim Oda", "eastern", 5.926, -0.985, ["oda"]),
  town("Kade", "eastern", 6.089, -0.836),

  town("Ho", "volta", 6.601, 0.471),
  town("Hohoe", "volta", 7.151, 0.473),
  town("Kpando", "volta", 6.996, 0.293),
  town("Aflao", "volta", 6.117, 1.194),
  town("Keta", "volta", 5.918, 0.987),

  town("Dambai", "oti", 8.066, 0.18),
  town("Nkwanta", "oti", 8.262, 0.518),

  town("Tamale", "northern", 9.401, -0.839),
  town("Yendi", "northern", 9.443, -0.01),
  town("Bimbilla", "northern", 8.857, -0.057),

  town("Damongo", "savannah", 9.083, -1.817),
  town("Salaga", "savannah", 8.55, -0.519),

  town("Nalerigu", "north_east", 10.527, -0.364),

  town("Bolgatanga", "upper_east", 10.786, -0.851, ["bolga"]),
  town("Bawku", "upper_east", 11.06, -0.24),
  town("Navrongo", "upper_east", 10.894, -1.092),

  town("Wa", "upper_west", 10.06, -2.51),
  town("Tumu", "upper_west", 10.879, -1.986),
  town("Lawra", "upper_west", 10.647, -2.899),

  town("Sunyani", "bono", 7.335, -2.312),
  town("Berekum", "bono", 7.453, -2.584),

  town("Techiman", "bono_east", 7.586, -1.938),
  town("Kintampo", "bono_east", 8.056, -1.73),
  town("Atebubu", "bono_east", 7.75, -0.983),

  town("Goaso", "ahafo", 6.804, -2.517),
]

/** Regional capitals: the last-resort estimate when no area or town matches. */
export const REGION_CAPITAL: Record<GhanaRegionValue, string> = {
  greater_accra: "Accra",
  ashanti: "Kumasi",
  western: "Takoradi",
  western_north: "Sefwi Wiawso",
  central: "Cape Coast",
  eastern: "Koforidua",
  volta: "Ho",
  oti: "Dambai",
  northern: "Tamale",
  savannah: "Damongo",
  north_east: "Nalerigu",
  upper_east: "Bolgatanga",
  upper_west: "Wa",
  bono: "Sunyani",
  bono_east: "Techiman",
  ahafo: "Goaso",
}
