export type CircuitInfo = {
  lat: number;
  lng: number;
  country: string;
  countryCode: string;
  circuit: string;
};

export const CIRCUITS: Record<string, CircuitInfo> = {
  Austin: { lat: 30.1328, lng: -97.6411, country: "United States", countryCode: "US", circuit: "Circuit of the Americas" },
  Baku: { lat: 40.3725, lng: 49.8533, country: "Azerbaijan", countryCode: "AZ", circuit: "Baku City Circuit" },
  Barcelona: { lat: 41.57, lng: 2.2611, country: "Spain", countryCode: "ES", circuit: "Circuit de Barcelona-Catalunya" },
  Budapest: { lat: 47.5789, lng: 19.2486, country: "Hungary", countryCode: "HU", circuit: "Hungaroring" },
  Imola: { lat: 44.3439, lng: 11.7167, country: "Italy", countryCode: "IT", circuit: "Autodromo Enzo e Dino Ferrari" },
  Jeddah: { lat: 21.6319, lng: 39.1044, country: "Saudi Arabia", countryCode: "SA", circuit: "Jeddah Corniche Circuit" },
  "Las Vegas": { lat: 36.1147, lng: -115.1728, country: "United States", countryCode: "US", circuit: "Las Vegas Strip Circuit" },
  Lusail: { lat: 25.49, lng: 51.4542, country: "Qatar", countryCode: "QA", circuit: "Lusail International Circuit" },
  "Marina Bay": { lat: 1.2914, lng: 103.864, country: "Singapore", countryCode: "SG", circuit: "Marina Bay Street Circuit" },
  Melbourne: { lat: -37.8497, lng: 144.968, country: "Australia", countryCode: "AU", circuit: "Albert Park Circuit" },
  "Mexico City": { lat: 19.4042, lng: -99.0907, country: "Mexico", countryCode: "MX", circuit: "Autódromo Hermanos Rodríguez" },
  Miami: { lat: 25.9581, lng: -80.2389, country: "United States", countryCode: "US", circuit: "Miami International Autodrome" },
  "Miami Gardens": { lat: 25.9581, lng: -80.2389, country: "United States", countryCode: "US", circuit: "Miami International Autodrome" },
  Monaco: { lat: 43.7347, lng: 7.4206, country: "Monaco", countryCode: "MC", circuit: "Circuit de Monaco" },
  "Monte Carlo": { lat: 43.7347, lng: 7.4206, country: "Monaco", countryCode: "MC", circuit: "Circuit de Monaco" },
  Montréal: { lat: 45.5, lng: -73.5228, country: "Canada", countryCode: "CA", circuit: "Circuit Gilles Villeneuve" },
  Monza: { lat: 45.6156, lng: 9.2811, country: "Italy", countryCode: "IT", circuit: "Autodromo Nazionale Monza" },
  Sakhir: { lat: 26.0325, lng: 50.5106, country: "Bahrain", countryCode: "BH", circuit: "Bahrain International Circuit" },
  Shanghai: { lat: 31.3389, lng: 121.2197, country: "China", countryCode: "CN", circuit: "Shanghai International Circuit" },
  Silverstone: { lat: 52.0786, lng: -1.0169, country: "United Kingdom", countryCode: "GB", circuit: "Silverstone Circuit" },
  "Spa-Francorchamps": { lat: 50.4372, lng: 5.9714, country: "Belgium", countryCode: "BE", circuit: "Circuit de Spa-Francorchamps" },
  Spielberg: { lat: 47.2197, lng: 14.7647, country: "Austria", countryCode: "AT", circuit: "Red Bull Ring" },
  Suzuka: { lat: 34.8431, lng: 136.5407, country: "Japan", countryCode: "JP", circuit: "Suzuka International Racing Course" },
  "São Paulo": { lat: -23.7036, lng: -46.6997, country: "Brazil", countryCode: "BR", circuit: "Autódromo José Carlos Pace" },
  "Yas Island": { lat: 24.4672, lng: 54.6031, country: "United Arab Emirates", countryCode: "AE", circuit: "Yas Marina Circuit" },
  Zandvoort: { lat: 52.3888, lng: 4.5409, country: "Netherlands", countryCode: "NL", circuit: "Circuit Zandvoort" },
};

export function getCircuitInfo(location: string): CircuitInfo | null {
  return CIRCUITS[location] ?? null;
}
