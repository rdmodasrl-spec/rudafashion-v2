type MerchantMapDestination = {
  name: string;
  streetAddress?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

const placeholderLocation = /待完善|未填写|待补充|待填写|未提供|demo|example|non specificat[oa]|not provided|unknown|n\/a/i;

function locationPart(value?: string | null): string {
  const normalized = value?.trim() || '';
  return normalized && !placeholderLocation.test(normalized) ? normalized : '';
}

function validCoordinate(value: number | string | null | undefined, min: number, max: number): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max ? coordinate : null;
}

export function buildMerchantMapUrl(destination: MerchantMapDestination): { url: string; hasExactLocation: boolean } {
  const latitude = validCoordinate(destination.latitude, -90, 90);
  const longitude = validCoordinate(destination.longitude, -180, 180);
  const city = locationPart(destination.city);
  const country = locationPart(destination.country);
  const streetAddress = locationPart(destination.streetAddress);

  if (latitude !== null && longitude !== null) {
    const params = new URLSearchParams({
      api: '1',
      destination: `${latitude},${longitude}`,
      travelmode: 'driving'
    });
    return { url: `https://www.google.com/maps/dir/?${params}`, hasExactLocation: true };
  }

  if (streetAddress) {
    const address = [streetAddress, city, country].filter(Boolean).join(', ');
    const params = new URLSearchParams({
      api: '1',
      destination: address,
      travelmode: 'driving'
    });
    return { url: `https://www.google.com/maps/dir/?${params}`, hasExactLocation: true };
  }

  const query = [city, country].filter(Boolean).join(', ') || locationPart(destination.name);
  const params = new URLSearchParams({ api: '1', query });
  return { url: `https://www.google.com/maps/search/?${params}`, hasExactLocation: false };
}
