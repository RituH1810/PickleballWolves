/** One Photon (OpenStreetMap) search hit -- only the properties we use. */
export type PhotonFeature = {
  properties: { name?: string; housenumber?: string; street?: string; city?: string; town?: string; village?: string; district?: string; state?: string; postcode?: string; country?: string; countrycode?: string };
};

export type PlaceSuggestion = { label: string; detail: string };

/**
 * A readable address from a Photon hit: the place name (e.g. "Lancaster YMCA") as the label, and
 * the street, city, and state as detail. Pieces repeated across parts are dropped.
 */
export function formatPlace(feature: PhotonFeature): PlaceSuggestion | null {
  const p = feature.properties;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const city = p.city ?? p.town ?? p.village ?? p.district;
  const region = [p.state, p.countrycode?.toUpperCase() === "US" ? null : p.country].filter(Boolean).join(", ");
  const name = p.name ?? street;
  if (!name) return null;
  const detail = [street && street !== name ? street : null, city && city !== name ? city : null, region || null].filter(Boolean).join(", ");
  return { label: name, detail };
}

/** The text saved into the location field: "Lancaster YMCA, 572 N Queen St, Lancaster, Pennsylvania". */
export function placeText(suggestion: PlaceSuggestion) {
  return suggestion.detail ? `${suggestion.label}, ${suggestion.detail}` : suggestion.label;
}

/** Turn-by-turn directions in Google Maps (a plain link -- free, no API key). Works on phones too. */
export function directionsUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/** Unique suggestions, in order. */
export function dedupePlaces(suggestions: (PlaceSuggestion | null)[]) {
  const seen = new Set<string>();
  return suggestions.filter((entry): entry is PlaceSuggestion => {
    if (!entry) return false;
    const key = placeText(entry).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
