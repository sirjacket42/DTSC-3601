export function flagEmoji(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 3) return "";
  // OpenF1 uses 3-letter IOC-style codes; map the common ones to ISO-2 for flag emoji.
  const map: Record<string, string> = {
    AUS: "AU", AUT: "AT", BRN: "BH", BEL: "BE", BRA: "BR", CAN: "CA",
    CHN: "CN", DEN: "DK", ESP: "ES", FIN: "FI", FRA: "FR", GBR: "GB",
    GER: "DE", HUN: "HU", ITA: "IT", JPN: "JP", MEX: "MX", MON: "MC",
    NED: "NL", NZL: "NZ", POL: "PL", QAT: "QA", RSA: "ZA", RUS: "RU",
    SUI: "CH", SWE: "SE", THA: "TH", UAE: "AE", USA: "US", ARG: "AR",
    ARE: "AE",
  };
  const iso2 = map[countryCode];
  if (!iso2) return "";
  return String.fromCodePoint(
    ...[...iso2].map((c) => 127397 + c.charCodeAt(0))
  );
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3);
  return `${m}:${s.padStart(6, "0")}`;
}

export function ordinal(n: number | null): string {
  if (n === null) return "—";
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}
