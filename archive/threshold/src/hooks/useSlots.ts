import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/data";
import { HORIZON_DAYS, generateSlots, type SlotResult } from "@/lib/time";
import type { Guide } from "@/lib/types";
import { useAvailability } from "./useCatalogue";
import { useNow } from "./useNow";

export const busyKey = (guideId: string | null) => ["busy", guideId] as const;

/** Busy spans for one Guide, kept fresh while the client is choosing. */
export function useBusy(guideId: string | null) {
  return useQuery({
    queryKey: busyKey(guideId),
    queryFn: () => {
      const from = new Date(Date.now() - 24 * 3600_000);
      const to = new Date(Date.now() + (HORIZON_DAYS + 2) * 24 * 3600_000);
      return api.busyRanges(guideId!, from, to);
    },
    enabled: !!guideId,
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useGuideSlots(guide: Guide | null | undefined, durationMin: number | null, ignoreStart: string | null = null) {
  const availability = useAvailability(guide?.id ?? null);
  const busy = useBusy(guide?.id ?? null);
  const now = useNow(60_000);

  const result = useMemo<SlotResult | null>(() => {
    if (!guide || !durationMin || !availability.data || !busy.data) return null;
    return generateSlots({
      timezone: guide.timezone,
      bufferMin: guide.buffer_min,
      maxPerDay: guide.max_sessions_per_day,
      rules: availability.data,
      durationMin,
      // When moving a session, its own span must not block the hours around it.
      busy: ignoreStart ? busy.data.filter((b) => new Date(b.starts_at).getTime() !== new Date(ignoreStart).getTime()) : busy.data,
      now,
    });
  }, [guide, durationMin, availability.data, busy.data, now, ignoreStart]);

  return {
    result,
    busy: busy.data,
    isLoading: availability.isLoading || busy.isLoading,
    isError: availability.isError || busy.isError,
    isFetching: busy.isFetching,
    refetch: () => busy.refetch(),
  };
}
