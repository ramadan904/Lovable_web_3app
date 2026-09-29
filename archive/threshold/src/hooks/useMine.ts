import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/data";
import { useAuth } from "./useAuth";

export function useMySessions() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["mine", "sessions", user?.id], queryFn: () => api.mySessions(), enabled: !!user });
}

export function useMyLetters() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["mine", "letters", user?.id], queryFn: () => api.myLetters(), enabled: !!user, refetchInterval: 60_000 });
}

export function useMyAnswers(sessionId: string, enabled: boolean) {
  return useQuery({ queryKey: ["mine", "answers", sessionId], queryFn: () => api.myAnswers(sessionId), enabled });
}
