import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { BookingError, type AuthUser, type BookingErrorCode, type Guide, type Session } from "../types";
import type { ThresholdApi } from "./api";

const BOOKING_CODES: BookingErrorCode[] = [
  "auth_required",
  "guide_unavailable",
  "unknown_form",
  "too_soon",
  "too_far",
  "off_grid",
  "outside_availability",
  "day_full",
  "client_overlap",
  "slot_taken",
  "not_reschedulable",
  "too_late",
];

function toBookingError(message: string | undefined): BookingError {
  const code = BOOKING_CODES.find((c) => message?.includes(c));
  return new BookingError(code ?? "unknown", message);
}

const trimTime = (t: string) => t.slice(0, 5);

export function createSupabaseApi(sb: SupabaseClient<Database>): ThresholdApi {
  async function resolveUser(user: User | null): Promise<AuthUser | null> {
    if (!user) return null;
    const [{ data: profile }, { data: guide }] = await Promise.all([
      sb.from("profiles").select("display_name, role").eq("id", user.id).maybeSingle(),
      sb.from("guides").select("id").eq("user_id", user.id).maybeSingle(),
    ]);
    return {
      id: user.id,
      email: user.email ?? "",
      display_name: profile?.display_name ?? (user.user_metadata?.display_name as string | undefined) ?? null,
      role: guide ? "guide" : (profile?.role ?? "client"),
      guide_id: guide?.id ?? null,
    };
  }

  return {
    mode: "supabase",

    async listThresholds() {
      const { data, error } = await sb.from("thresholds").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },

    async listSessionTypes() {
      const { data, error } = await sb.from("session_types").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },

    async listGuides() {
      const { data, error } = await sb
        .from("guides")
        .select("*, guide_thresholds(threshold_slug)")
        .eq("accepting", true)
        .order("name");
      if (error) throw error;
      return (data as unknown as (Database["public"]["Tables"]["guides"]["Row"] & { guide_thresholds: { threshold_slug: string }[] })[]).map<Guide>(
        ({ guide_thresholds, user_id: _u, created_at: _c, ...g }) => ({
          ...g,
          thresholds: guide_thresholds.map((t) => t.threshold_slug),
        }),
      );
    },

    async listAvailability(guideId) {
      const { data, error } = await sb.from("availability_rules").select("*").eq("guide_id", guideId).order("weekday");
      if (error) throw error;
      return data.map((r) => ({ ...r, start_local: trimTime(r.start_local), end_local: trimTime(r.end_local) }));
    },

    async busyRanges(guideId, from, to) {
      const { data, error } = await sb.rpc("guide_busy_ranges", {
        p_guide_id: guideId,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      });
      if (error) throw error;
      return data ?? [];
    },

    async getUser() {
      const { data } = await sb.auth.getSession();
      return resolveUser(data.session?.user ?? null);
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => {
        // Defer: never await Supabase calls inside the auth callback itself.
        setTimeout(() => void resolveUser(session?.user ?? null).then(cb), 0);
      });
      return () => data.subscription.unsubscribe();
    },

    async signUp(email, password, displayName) {
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/begin`,
          data: { display_name: displayName.trim() },
        },
      });
      if (error) throw error;
      if (!data.session) return { user: null, needsConfirmation: true };
      return { user: await resolveUser(data.user), needsConfirmation: false };
    },

    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error("That email and password don't match a record here.");
      const u = await resolveUser(data.user);
      if (!u) throw new Error("Could not open your record.");
      return u;
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async book(input) {
      const { data, error } = await sb.rpc("book_session", {
        p_guide_id: input.guide_id,
        p_threshold_slug: input.threshold_slug,
        p_threshold_words: input.threshold_words,
        p_session_type: input.session_type,
        p_starts_at: input.starts_at,
        p_client_name: input.client_name,
        p_client_timezone: input.client_timezone,
        p_answers: input.answers.map((a) => ({ position: a.position, prompt: a.prompt, answer: a.answer })),
        p_letter: input.letter,
      });
      if (error) throw toBookingError(error.message);
      return data as string;
    },

    async mySessions() {
      const { data: auth } = await sb.auth.getSession();
      if (!auth.session) return [];
      const { data, error } = await sb
        .from("sessions")
        .select("*")
        .eq("client_id", auth.session.user.id)
        .order("starts_at");
      if (error) throw error;
      return data.map(({ blocked_range: _b, ...s }) => s as Session);
    },

    async myAnswers(sessionId) {
      const { data, error } = await sb
        .from("reflective_answers")
        .select("position, prompt, answer")
        .eq("session_id", sessionId)
        .order("position");
      if (error) throw error;
      return data;
    },

    async myLetters() {
      const { data, error } = await sb.rpc("my_letters");
      if (error) throw error;
      return data ?? [];
    },

    async openLetter(letterId) {
      await sb.rpc("open_letter", { p_letter_id: letterId });
    },

    async reschedule(sessionId, startsAt) {
      const { error } = await sb.rpc("reschedule_session", { p_session_id: sessionId, p_starts_at: startsAt });
      if (error) throw toBookingError(error.message);
    },

    async cancelSession(sessionId) {
      const { error } = await sb.rpc("cancel_session", { p_session_id: sessionId });
      if (error) throw new Error(error.message);
    },

    async guideBriefings(from, to) {
      const { data: auth } = await sb.auth.getSession();
      if (!auth.session) return [];
      const { data: guide } = await sb.from("guides").select("id").eq("user_id", auth.session.user.id).maybeSingle();
      if (!guide) return [];
      const { data, error } = await sb
        .from("sessions")
        .select("*, reflective_answers(position, prompt, answer)")
        .eq("guide_id", guide.id)
        .gte("ends_at", new Date(from.getTime() - 2 * 3600_000).toISOString())
        .lte("starts_at", new Date(to.getTime() + 2 * 3600_000).toISOString())
        .order("starts_at");
      if (error) throw error;
      return (data as unknown as (Session & { blocked_range?: string; reflective_answers: { position: number; prompt: string; answer: string | null }[] })[]).map(
        ({ reflective_answers, blocked_range: _b, ...s }) => ({
          ...s,
          answers: [...reflective_answers].sort((a, b) => a.position - b.position),
        }),
      );
    },

    async updateAvailability(guideId, rules) {
      const { error: delError } = await sb.from("availability_rules").delete().eq("guide_id", guideId);
      if (delError) throw delError;
      if (rules.length) {
        const { error } = await sb.from("availability_rules").insert(rules.map((r) => ({ ...r, guide_id: guideId })));
        if (error) throw error;
      }
    },
  };
}
