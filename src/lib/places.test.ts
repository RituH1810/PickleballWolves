import { describe, expect, it } from "vitest";
import { dedupePlaces, directionsUrl, formatPlace, placeText } from "./places";

describe("formatPlace", () => {
  it("uses the place name as the label and the address as detail", () => {
    const place = formatPlace({ properties: { name: "Lancaster Family YMCA", housenumber: "572", street: "North Queen Street", city: "Lancaster", state: "Pennsylvania", country: "United States", countrycode: "US" } });
    expect(place).toEqual({ label: "Lancaster Family YMCA", detail: "572 North Queen Street, Lancaster, Pennsylvania" });
    expect(placeText(place!)).toBe("Lancaster Family YMCA, 572 North Queen Street, Lancaster, Pennsylvania");
  });

  it("falls back to the street address and keeps the country outside the US", () => {
    expect(formatPlace({ properties: { housenumber: "10", street: "High St", town: "Oxford", state: "England", country: "United Kingdom", countrycode: "GB" } })).toEqual({ label: "10 High St", detail: "Oxford, England, United Kingdom" });
  });

  it("skips hits with nothing to show", () => {
    expect(formatPlace({ properties: { city: "Lancaster" } })).toBeNull();
  });
});

describe("dedupePlaces", () => {
  it("drops repeats and nulls", () => {
    const a = { label: "Buchanan Park", detail: "Lancaster, Pennsylvania" };
    expect(dedupePlaces([a, null, { ...a }, { label: "Buchanan Park", detail: "Lancaster, Ohio" }])).toHaveLength(2);
  });
});

describe("directionsUrl", () => {
  it("builds a Google Maps directions link", () => {
    expect(directionsUrl("Buchanan Park, Lancaster, PA")).toBe("https://www.google.com/maps/dir/?api=1&destination=Buchanan%20Park%2C%20Lancaster%2C%20PA");
  });
});
