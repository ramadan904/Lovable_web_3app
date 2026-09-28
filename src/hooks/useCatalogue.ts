import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/data";

const FOREVER = Infinity;

export const useThresholds = () =>
  useQuery({ queryKey: ["thresholds"], queryFn: () => api.listThresholds(), staleTime: FOREVER });

export const useSessionTypes = () =>
  useQuery({ queryKey: ["session-types"], queryFn: () => api.listSessionTypes(), staleTime: FOREVER });

export const useGuides = () =>
  useQuery({ queryKey: ["guides"], queryFn: () => api.listGuides(), staleTime: 5 * 60_000 });

export const useAvailability = (guideId: string | null) =>
  useQuery({
    queryKey: ["availability", guideId],
    queryFn: () => api.listAvailability(guideId!),
    enabled: !!guideId,
    staleTime: 60_000,
  });
