// Domain types shared by the demo store and the Supabase adapter.

export type PresenceType = "still" | "steady" | "direct" | "tender";
export type SessionTypeKey = "solo" | "witnessed" | "aftermath";
export type SessionStatus = "held" | "completed" | "cancelled";
export type Role = "client" | "guide";

export interface Threshold {
  slug: string;
  name: string;
  line: string;
  keywords: string[];
  sort_order: number;
}

export interface SessionType {
  key: SessionTypeKey;
  name: string;
  duration_min: number;
  line: string;
  sort_order: number;
}

export interface Guide {
  id: string;
  slug: string;
  name: string;
  pronouns: string | null;
  presence: PresenceType;
  statement: string;
  background: string;
  location: string;
  timezone: string;
  years_holding: number;
  tags: string[];
  languages: string[];
  max_sessions_per_day: number;
  buffer_min: number;
  accepting: boolean;
  thresholds: string[];
}

export interface AvailabilityRule {
  id: string;
  guide_id: string;
  weekday: number; // 0 = Sunday, in the Guide's timezone
  start_local: string; // "09:00"
  end_local: string; // "18:00"
}

/** A held span on a Guide's calendar, stripped of every detail but time. */
export interface BusyRange {
  blocked_start: string;
  blocked_end: string;
  starts_at: string;
  ends_at: string;
}

export interface ReflectiveAnswer {
  position: number;
  prompt: string;
  answer: string | null;
}

export interface Session {
  id: string;
  client_id: string;
  guide_id: string;
  threshold_slug: string | null;
  threshold_words: string | null;
  session_type: SessionTypeKey;
  status: SessionStatus;
  starts_at: string;
  ends_at: string;
  buffer_before_min: number;
  buffer_after_min: number;
  client_name: string;
  client_timezone: string;
  created_at: string;
  cancelled_at: string | null;
  /** The original start, if the client has moved the session themselves. */
  rescheduled_from: string | null;
  rescheduled_at: string | null;
}

export interface LetterEnvelope {
  id: string;
  session_id: string;
  unlocks_at: string;
  opened_at: string | null;
  created_at: string;
  word_count: number;
  is_open: boolean;
  body: string | null; // present only once unsealed
}

export interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
  role: Role;
  guide_id: string | null;
}

export interface BookingInput {
  guide_id: string;
  threshold_slug: string | null;
  threshold_words: string | null;
  session_type: SessionTypeKey;
  starts_at: string; // ISO, UTC
  client_name: string;
  client_timezone: string;
  answers: ReflectiveAnswer[];
  letter: string | null;
}

/** What a Guide sees before a session. Letters are never part of it. */
export interface GuideBriefing extends Session {
  answers: ReflectiveAnswer[];
}

export type BookingErrorCode =
  | "auth_required"
  | "guide_unavailable"
  | "unknown_form"
  | "too_soon"
  | "too_far"
  | "off_grid"
  | "outside_availability"
  | "day_full"
  | "client_overlap"
  | "slot_taken"
  | "not_reschedulable"
  | "too_late"
  | "unknown";

export class BookingError extends Error {
  code: BookingErrorCode;
  constructor(code: BookingErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "BookingError";
  }
}
