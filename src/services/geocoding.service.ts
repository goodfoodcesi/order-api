/**
 * Geocoding service using French GeoAPI (data.geopf.fr)
 * Converts addresses to GPS coordinates
 */

interface Address {
    street: string;
    city: string;
    zipCode: string;
}

interface Coordinates {
    latitude: number;
    longitude: number;
}

interface GeoAPIResponse {
    type: string;
    features: Array<{
        type: string;
        geometry: {
            type: string;
            coordinates: [number, number]; // [longitude, latitude]
        };
        properties: {
            label: string;
            score: number;
            housenumber?: string;
            street?: string;
            postcode?: string;
            city?: string;
        };
    }>;
    query: string;
}

/**
 * Geocode an address using French GeoAPI
 * @param address Address object with street, city, and zipCode
 * @returns Coordinates object with latitude and longitude, or null if geocoding fails
 */
export async function geocodeAddress(address: Address): Promise<Coordinates | null> {
    try {
        // Format address for API query
        const query = `${address.street} ${address.zipCode} ${address.city}`;
        const encodedQuery = encodeURIComponent(query);

        // Call GeoAPI
        const url = `https://data.geopf.fr/geocodage/search?q=${encodedQuery}&autocomplete=1&index=address&limit=1&returntruegeometry=false`;

        const response = await fetch(url, {
            headers: {
                'accept': 'application/json',
            }
        });

        if (!response.ok) {
            console.error('GeoAPI request failed:', response.status);
            return null;
        }

        const data: GeoAPIResponse = await response.json();

        // Check if we got results
        if (!data.features || data.features.length === 0) {
            console.warn('No geocoding results for address:', query);
            return null;
        }

        const feature = data.features[0];

        // GeoAPI returns [longitude, latitude], we need to swap
        const [longitude, latitude] = feature.geometry.coordinates;

        console.log(`✅ Geocoded: ${query} → [${latitude}, ${longitude}] (score: ${feature.properties.score})`);

        return {
            latitude,
            longitude
        };
    } catch (error) {
        console.error('Error geocoding address:', error);
        return null;
    }
}

/**
 * Geocode multiple addresses in parallel
 * @param addresses Array of address objects
 * @returns Array of coordinates (or null for failed geocoding)
 */
export async function geocodeAddresses(addresses: Address[]): Promise<(Coordinates | null)[]> {
    return Promise.all(addresses.map(addr => geocodeAddress(addr)));
}
