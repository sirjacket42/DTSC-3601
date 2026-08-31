import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Weather } from "@/lib/types";

export function WeatherWidget({
  weather,
  location,
  teamColor,
}: {
  weather: Weather | null;
  location: string;
  teamColor: string;
}) {
  return (
    <Card
      className="hud-card"
      style={{ "--team-color": teamColor } as React.CSSProperties}
    >
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
          {location} conditions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {weather ? (
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <div>
              <div className="text-3xl font-black tabular-nums">
                {weather.airTemp}&deg;C
              </div>
              <div className="text-xs text-muted-foreground">Air temp</div>
            </div>
            <div>
              <div className="text-3xl font-black tabular-nums">
                {weather.trackTemp}&deg;C
              </div>
              <div className="text-xs text-muted-foreground">Track temp</div>
            </div>
            <div>
              <div className="font-semibold tabular-nums">{weather.humidity}%</div>
              <div className="text-xs text-muted-foreground">Humidity</div>
            </div>
            <div>
              <div className="font-semibold tabular-nums">{weather.windSpeed} m/s</div>
              <div className="text-xs text-muted-foreground">Wind</div>
            </div>
            <div className="col-span-2 text-xs text-muted-foreground">
              {weather.rainfall ? "Rain recorded during the session" : "Dry session"}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No weather telemetry available for this session.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
