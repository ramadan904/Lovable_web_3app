import type {
  AuthUser,
  AvailabilityRule,
  BookingInput,
  BusyRange,
  Guide,
  GuideBriefing,
  LetterEnvelope,
  ReflectiveAnswer,
  Session,
  SessionType,
  Threshold,
} from "../types";

/**
 * Everything the interface needs from a backend.
 * Implemented twice: against Supabase (production) and an in-browser seeded
 * store (instant, zero-setup demo). Both enforce the same rules.
 */
export interface ThresholdApi {
  readonly mode: "demo" | "supabase";

  listThresholds(): Promise<Threshold[]>;
  listSessionTypes(): Promise<SessionType[]>;
  listGuides(): Promise<Guide[]>;
  listAvailability(guideId: string): Promise<AvailabilityRule[]>;
  busyRanges(guideId: string, from: Date, to: Date): Promise<BusyRange[]>;

  getUser(): Promise<AuthUser | null>;
  onAuthChange(cb: (user: AuthUser | null) => void): () => void;
  signUp(email: string, password: string, displayName: string): Promise<{ user: AuthUser | null; needsConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;

  book(input: BookingInput): Promise<string>;
  mySessions(): Promise<Session[]>;
  myAnswers(sessionId: string): Promise<ReflectiveAnswer[]>;
  myLetters(): Promise<LetterEnvelope[]>;
  openLetter(letterId: string): Promise<void>;
  cancelSession(sessionId: string): Promise<void>;

  guideBriefings(from: Date, to: Date): Promise<GuideBriefing[]>;
  updateAvailability(guideId: string, rules: Omit<AvailabilityRule, "id" | "guide_id">[]): Promise<void>;

  resetDemo?(): Promise<void>;
}
