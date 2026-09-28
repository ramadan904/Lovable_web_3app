// Mirrors `supabase gen types typescript` for supabase/migrations/20260928000000_threshold_core.sql.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type PresenceType = "still" | "steady" | "direct" | "tender";
type SessionType = "solo" | "witnessed" | "aftermath";
type SessionStatus = "held" | "completed" | "cancelled";
type AppRole = "client" | "guide";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null; timezone: string | null; role: AppRole; created_at: string };
        Insert: { id: string; display_name?: string | null; timezone?: string | null; role?: AppRole; created_at?: string };
        Update: { display_name?: string | null; timezone?: string | null };
        Relationships: [];
      };
      thresholds: {
        Row: { slug: string; name: string; line: string; keywords: string[]; sort_order: number };
        Insert: { slug: string; name: string; line: string; keywords?: string[]; sort_order?: number };
        Update: { name?: string; line?: string; keywords?: string[]; sort_order?: number };
        Relationships: [];
      };
      session_types: {
        Row: { key: SessionType; name: string; duration_min: number; line: string; sort_order: number };
        Insert: { key: SessionType; name: string; duration_min: number; line: string; sort_order?: number };
        Update: { name?: string; duration_min?: number; line?: string; sort_order?: number };
        Relationships: [];
      };
      guides: {
        Row: {
          id: string;
          user_id: string | null;
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
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["guides"]["Row"]> & {
          slug: string;
          name: string;
          presence: PresenceType;
          statement: string;
          background: string;
          location: string;
          timezone: string;
        };
        Update: Partial<Database["public"]["Tables"]["guides"]["Row"]>;
        Relationships: [];
      };
      guide_thresholds: {
        Row: { guide_id: string; threshold_slug: string };
        Insert: { guide_id: string; threshold_slug: string };
        Update: { guide_id?: string; threshold_slug?: string };
        Relationships: [
          { foreignKeyName: "guide_thresholds_guide_id_fkey"; columns: ["guide_id"]; isOneToOne: false; referencedRelation: "guides"; referencedColumns: ["id"] },
        ];
      };
      availability_rules: {
        Row: { id: string; guide_id: string; weekday: number; start_local: string; end_local: string };
        Insert: { id?: string; guide_id: string; weekday: number; start_local: string; end_local: string };
        Update: { weekday?: number; start_local?: string; end_local?: string };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          client_id: string;
          guide_id: string;
          threshold_slug: string | null;
          threshold_words: string | null;
          session_type: SessionType;
          status: SessionStatus;
          starts_at: string;
          ends_at: string;
          buffer_before_min: number;
          buffer_after_min: number;
          blocked_range: string;
          client_name: string;
          client_timezone: string;
          created_at: string;
          cancelled_at: string | null;
          rescheduled_from: string | null;
          rescheduled_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      reflective_answers: {
        Row: { id: string; session_id: string; client_id: string; position: number; prompt: string; answer: string | null };
        Insert: never;
        Update: never;
        Relationships: [
          { foreignKeyName: "reflective_answers_session_id_fkey"; columns: ["session_id"]; isOneToOne: false; referencedRelation: "sessions"; referencedColumns: ["id"] },
        ];
      };
      future_self_letters: {
        Row: {
          id: string;
          session_id: string;
          client_id: string;
          body: string;
          unlocks_at: string;
          opened_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      guide_busy_ranges: {
        Args: { p_guide_id: string; p_from: string; p_to: string };
        Returns: { blocked_start: string; blocked_end: string; starts_at: string; ends_at: string }[];
      };
      book_session: {
        Args: {
          p_guide_id: string;
          p_threshold_slug: string | null;
          p_threshold_words: string | null;
          p_session_type: SessionType;
          p_starts_at: string;
          p_client_name: string;
          p_client_timezone: string;
          p_answers: Json;
          p_letter: string | null;
        };
        Returns: string;
      };
      cancel_session: { Args: { p_session_id: string }; Returns: undefined };
      reschedule_session: { Args: { p_session_id: string; p_starts_at: string }; Returns: undefined };
      my_letters: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          session_id: string;
          unlocks_at: string;
          opened_at: string | null;
          created_at: string;
          word_count: number;
          is_open: boolean;
          body: string | null;
        }[];
      };
      open_letter: { Args: { p_letter_id: string }; Returns: undefined };
      is_guide_of: { Args: { p_guide_id: string }; Returns: boolean };
    };
    Enums: {
      presence_type: PresenceType;
      session_type: SessionType;
      session_status: SessionStatus;
      app_role: AppRole;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
