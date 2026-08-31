"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DriverListItem } from "@/lib/types";

export function DriverSelector({
  drivers,
  selectedId,
}: {
  drivers: DriverListItem[];
  selectedId: number;
}) {
  const router = useRouter();
  const byId = new Map(drivers.map((d) => [String(d.id), d]));

  return (
    <Select
      value={String(selectedId)}
      onValueChange={(value) => router.push(`/?driver=${value}`)}
    >
      <SelectTrigger className="w-[240px] hud-card">
        <SelectValue placeholder="Select a driver">
          {(value: string | null) =>
            value && byId.has(value)
              ? `${byId.get(value)!.full_name} · ${byId.get(value)!.team_name}`
              : "Select a driver"
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {drivers.map((d) => (
          <SelectItem key={d.id} value={String(d.id)}>
            <div className="flex items-center gap-2">
              {d.headshot_url ? (
                <Image
                  src={d.headshot_url}
                  alt=""
                  width={20}
                  height={20}
                  className="rounded-full object-cover size-5"
                  unoptimized
                />
              ) : (
                <span
                  className="size-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                  style={{ background: d.team_color, color: "#000" }}
                >
                  {d.name_acronym ?? "?"}
                </span>
              )}
              <span>{d.full_name}</span>
              <span className="text-muted-foreground text-xs">
                {d.team_name}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
