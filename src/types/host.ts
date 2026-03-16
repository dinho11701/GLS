export type Host = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  services: string[];
  rating: number;
  isActive?: boolean;
};