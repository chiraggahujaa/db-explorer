export interface CitiesResponse {
  cities: string[];
}

export interface CityCoordinates {
  name: string;
  latitude: number;
  longitude: number;
}

export interface CityCoordinatesResponse {
  success: boolean;
  data: CityCoordinates;
}

export type GetCitiesOptions = {
  lat?: number;
  lon?: number;
  prefer?: string; // optional city name hint
};