import { LETTER_SEAL_HOURS, MIN_NOTICE_HOURS, dateKeyInZone, placeSeedSession, toMinutes } from "../time";
import {
  BookingError,
  type AuthUser,
  type AvailabilityRule,
  type BookingInput,
  type Guide,
  type LetterEnvelope,
  type ReflectiveAnswer,
  type Role,
  type Session,
} from "../types";
import type { ThresholdApi } from "./api";
import {
  DEMO_USERS,
  REFLECTIVE_PROMPTS,
  SEED_GUIDES,
  SEED_SESSIONS,
  SEED_SESSION_TYPES,
  SEED_THRESHOLDS,
  SEED_VERSION,
} from "./seed";

/*
 * The demo store: a faithful, in-browser stand-in for the Supabase backend.
 * It seeds itself relative to the moment it is first opened, persists to
 * localStorage, and enforces the same booking rules as book_session().
 */

const DB_KEY = "threshold.demo.db";
const AUTH_KEY = "threshold.demo.auth";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

interface DemoUser {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  role: Role;
  guide_id: string | null;
  timezone: string | null;
}

interface DemoAnswer extends ReflectiveAnswer {
  session_id: string;
  client_id: string;
}

interface DemoLetter {
  id: string;
  session_id: string;
  client_id: string;
  body: string;
  unlocks_at: string;
  opened_at: string | null;
  created_at: string;
}

interface DemoDB {
  version: number;
  seeded_at: string;
  users: DemoUser[];
  guides: Guide[];
  availability: AvailabilityRule[];
  sessions: Session[];
  answers: DemoAnswer[];
  letters: DemoLetter[];
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Real networks have texture. A little latency keeps loading states honest. */
const latency = () => wait(180 + Math.random() * 260);

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));

async function hash(password: string): Promise<string> {
  // Demo-only credential storage. Never used when a real backend is configured.
  const data = new TextEncoder().encode(`threshold:${password}`);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return btoa(`threshold:${password}`);
}

/** localStorage when it's there; memory when it isn't (private mode, tests), so the demo never breaks. */
const memory = new Map<string, string>();
const safeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* fall through */
    }
    memory.delete(key);
  },
};

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

export async function buildSeed(now: Date = new Date()): Promise<DemoDB> {
  const guides: Guide[] = SEED_GUIDES.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    pronouns: g.pronouns,
    presence: g.presence,
    statement: g.statement,
    background: g.background,
    location: g.location,
    timezone: g.timezone,
    years_holding: g.years_holding,
    tags: g.tags,
    languages: g.languages,
    max_sessions_per_day: g.max_sessions_per_day,
    buffer_min: 45,
    accepting: true,
    thresholds: g.thresholds,
  }));

  const availability: AvailabilityRule[] = SEED_GUIDES.flatMap((g) =>
    g.availability.map(([weekday, start_local, end_local], i) => ({
      id: `${g.id.slice(0, -2)}${String(i).padStart(2, "0")}`,
      guide_id: g.id,
      weekday,
      start_local,
      end_local,
    })),
  );

  const pw = await hash("threshold");
  const users: DemoUser[] = [
    { ...pick(DEMO_USERS.client), password_hash: pw, role: "client", guide_id: null },
    { ...pick(DEMO_USERS.guide), password_hash: pw, role: "guide", guide_id: SEED_GUIDES[0].id },
    { ...pick(DEMO_USERS.community), password_hash: await hash(DEMO_USERS.community.password), role: "client", guide_id: null },
  ];

  const sessions: Session[] = [];
  const answers: DemoAnswer[] = [];
  const letters: DemoLetter[] = [];

  for (const seed of SEED_SESSIONS) {
    const guide = SEED_GUIDES.find((g) => g.slug === seed.guide)!;
    const type = SEED_SESSION_TYPES.find((t) => t.key === seed.session_type)!;
    const taken = sessions
      .filter((x) => x.guide_id === guide.id)
      .map((x) => ({
        start: new Date(x.starts_at).getTime() - x.buffer_before_min * MINUTE,
        end: new Date(x.ends_at).getTime() + x.buffer_after_min * MINUTE,
      }));
    const start = placeSeedSession({
      timezone: guide.timezone,
      bufferMin: 45,
      rules: guide.availability.map(([weekday, start_local, end_local]) => ({ weekday, start_local, end_local })),
      dayOffset: seed.day_offset,
      localTime: seed.local_time,
      durationMin: type.duration_min,
      taken,
      now,
    });
    if (!start) continue;
    const end = new Date(start.getTime() + type.duration_min * MINUTE);
    const clientId = seed.client === "client" ? DEMO_USERS.client.id : DEMO_USERS.community.id;

    sessions.push({
      id: seed.id,
      client_id: clientId,
      guide_id: guide.id,
      threshold_slug: seed.threshold_slug,
      threshold_words: seed.threshold_words ?? null,
      session_type: seed.session_type,
      status: "held",
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      buffer_before_min: 45,
      buffer_after_min: 45,
      client_name: seed.client_name,
      client_timezone: seed.client_timezone,
      created_at: new Date(Math.min(now.getTime(), start.getTime()) - 12 * 24 * HOUR).toISOString(),
      cancelled_at: null,
      rescheduled_from: null,
      rescheduled_at: null,
    });

    seed.answers.forEach((answer, i) =>
      answers.push({
        session_id: seed.id,
        client_id: clientId,
        position: i + 1,
        prompt: REFLECTIVE_PROMPTS[i].prompt,
        answer,
      }),
    );

    if (seed.letter) {
      letters.push({
        id: seed.id.replace(/^2/, "3"),
        session_id: seed.id,
        client_id: clientId,
        body: seed.letter,
        unlocks_at: new Date(end.getTime() + LETTER_SEAL_HOURS * HOUR).toISOString(),
        opened_at: null,
        created_at: new Date(start.getTime() - 9 * 24 * HOUR).toISOString(),
      });
    }
  }

  return { version: SEED_VERSION, seeded_at: now.toISOString(), users, guides, availability, sessions, answers, letters };
}

function pick(u: { id: string; email: string; display_name: string; timezone: string }) {
  return { id: u.id, email: u.email, display_name: u.display_name, timezone: u.timezone };
}

// ---------------------------------------------------------------------------
// The one validator — mirrors public.assert_slot_open() in the database.
// ---------------------------------------------------------------------------

function assertSlotOpen(live: DemoDB, guide: Guide, start: Date, durationMin: number, clientId: string, excludeId: string | null) {
  const now = Date.now();
  if (start.getTime() < now + MIN_NOTICE_HOURS * HOUR) throw new BookingError("too_soon");
  if (start.getTime() > now + 60 * 24 * HOUR) throw new BookingError("too_far");
  if (start.getUTCSeconds() !== 0 || start.getUTCMinutes() % 15 !== 0) throw new BookingError("off_grid");

  const end = new Date(start.getTime() + durationMin * MINUTE);
  const bStart = start.getTime() - guide.buffer_min * MINUTE;
  const bEnd = end.getTime() + guide.buffer_min * MINUTE;
  const localKeyStart = dateKeyInZone(new Date(bStart), guide.timezone);
  const localKeyEnd = dateKeyInZone(new Date(bEnd), guide.timezone);
  const localMin = (t: number) => {
    const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: guide.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .format(new Date(t))
      .split(":")
      .map(Number);
    return h * 60 + m;
  };
  const weekday = new Date(`${localKeyStart}T12:00:00Z`).getUTCDay();
  const inWindow =
    localKeyStart === localKeyEnd &&
    live.availability.some(
      (r) =>
        r.guide_id === guide.id &&
        r.weekday === weekday &&
        toMinutes(r.start_local) <= localMin(bStart) &&
        toMinutes(r.end_local) >= localMin(bEnd),
    );
  if (!inWindow) throw new BookingError("outside_availability");

  const others = live.sessions.filter((s) => s.status !== "cancelled" && s.id !== excludeId);
  const guideSessions = others.filter((s) => s.guide_id === guide.id);
  const clash = guideSessions.some((s) => {
    const sb = new Date(s.starts_at).getTime() - s.buffer_before_min * MINUTE;
    const se = new Date(s.ends_at).getTime() + s.buffer_after_min * MINUTE;
    return bStart < se && sb < bEnd;
  });
  if (clash) throw new BookingError("slot_taken");
  const dayKey = dateKeyInZone(start, guide.timezone);
  if (guideSessions.filter((s) => dateKeyInZone(new Date(s.starts_at), guide.timezone) === dayKey).length >= guide.max_sessions_per_day) {
    throw new BookingError("day_full");
  }
  if (others.some((s) => s.client_id === clientId && start < new Date(s.ends_at) && new Date(s.starts_at) < end)) {
    throw new BookingError("client_overlap");
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export function createDemoApi(): ThresholdApi {
  let db: DemoDB | null = null;
  let loading: Promise<DemoDB> | null = null;
  const listeners = new Set<(u: AuthUser | null) => void>();

  async function load(): Promise<DemoDB> {
    if (db) return db;
    if (loading) return loading;
    loading = (async () => {
      const raw = safeStorage.get(DB_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as DemoDB;
          if (parsed.version === SEED_VERSION) {
            db = parsed;
            return parsed;
          }
        } catch {
          /* reseed */
        }
      }
      db = await buildSeed();
      persist();
      return db;
    })();
    return loading;
  }

  function persist() {
    if (db) safeStorage.set(DB_KEY, JSON.stringify(db));
  }

  /** Re-read the store so writes from another tab are seen (the "already booked" case). */
  async function fresh(): Promise<DemoDB> {
    const d = await load();
    const raw = safeStorage.get(DB_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DemoDB;
        if (parsed.version === SEED_VERSION) db = parsed;
      } catch {
        /* keep memory copy */
      }
    }
    return db ?? d;
  }

  function currentUserId(): string | null {
    return safeStorage.get(AUTH_KEY);
  }

  function toAuthUser(u: DemoUser): AuthUser {
    return { id: u.id, email: u.email, display_name: u.display_name, role: u.role, guide_id: u.guide_id };
  }

  async function me(): Promise<DemoUser | null> {
    const d = await load();
    const id = currentUserId();
    return id ? d.users.find((u) => u.id === id) ?? null : null;
  }

  async function requireMe(): Promise<DemoUser> {
    const u = await me();
    if (!u) throw new BookingError("auth_required");
    return u;
  }

  async function emit() {
    const u = await me();
    listeners.forEach((cb) => cb(u ? toAuthUser(u) : null));
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === DB_KEY) {
        db = null;
        loading = null;
      }
      if (e.key === AUTH_KEY || e.key === DB_KEY) void emit();
    });
  }

  const api: ThresholdApi = {
    mode: "demo",

    async listThresholds() {
      await latency();
      return SEED_THRESHOLDS;
    },

    async listSessionTypes() {
      return SEED_SESSION_TYPES;
    },

    async listGuides() {
      const d = await load();
      await latency();
      return d.guides.filter((g) => g.accepting);
    },

    async listAvailability(guideId) {
      const d = await load();
      return d.availability.filter((r) => r.guide_id === guideId);
    },

    async busyRanges(guideId, from, to) {
      const d = await load();
      await latency();
      // Re-read storage so a booking from another tab is visible (the "already booked" case).
      const fresh = safeStorage.get(DB_KEY);
      if (fresh) {
        try {
          db = JSON.parse(fresh) as DemoDB;
        } catch {
          /* keep memory copy */
        }
      }
      return (db ?? d).sessions
        .filter((s) => s.guide_id === guideId && s.status !== "cancelled")
        .map((s) => ({
          starts_at: s.starts_at,
          ends_at: s.ends_at,
          blocked_start: new Date(new Date(s.starts_at).getTime() - s.buffer_before_min * MINUTE).toISOString(),
          blocked_end: new Date(new Date(s.ends_at).getTime() + s.buffer_after_min * MINUTE).toISOString(),
        }))
        .filter((b) => new Date(b.blocked_end) > from && new Date(b.blocked_start) < to)
        .sort((a, b) => a.blocked_start.localeCompare(b.blocked_start));
    },

    async getUser() {
      const u = await me();
      return u ? toAuthUser(u) : null;
    },

    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    async signUp(email, password, displayName) {
      const d = await load();
      await latency();
      const normalized = email.trim().toLowerCase();
      if (d.users.some((u) => u.email === normalized)) {
        throw new Error("An account with this email already exists. Sign in instead.");
      }
      if (password.length < 8) throw new Error("Choose a password of at least eight characters.");
      const user: DemoUser = {
        id: uuid(),
        email: normalized,
        password_hash: await hash(password),
        display_name: displayName.trim() || null,
        role: "client",
        guide_id: null,
        timezone: null,
      };
      d.users.push(user);
      persist();
      safeStorage.set(AUTH_KEY, user.id);
      await emit();
      return { user: toAuthUser(user), needsConfirmation: false };
    },

    async signIn(email, password) {
      const d = await load();
      await latency();
      const u = d.users.find((x) => x.email === email.trim().toLowerCase());
      if (!u || u.password_hash !== (await hash(password)) || u.id === DEMO_USERS.community.id) {
        throw new Error("That email and password don't match a record here.");
      }
      safeStorage.set(AUTH_KEY, u.id);
      await emit();
      return toAuthUser(u);
    },

    async signOut() {
      safeStorage.remove(AUTH_KEY);
      await emit();
    },

    async book(input: BookingInput) {
      await load();
      const user = await requireMe();
      await wait(650 + Math.random() * 350);
      const live = await fresh();

      const guide = live.guides.find((g) => g.id === input.guide_id);
      if (!guide || !guide.accepting) throw new BookingError("guide_unavailable");
      const type = SEED_SESSION_TYPES.find((t) => t.key === input.session_type);
      if (!type) throw new BookingError("unknown_form");

      const start = new Date(input.starts_at);
      assertSlotOpen(live, guide, start, type.duration_min, user.id, null);
      const end = new Date(start.getTime() + type.duration_min * MINUTE);

      const id = uuid();
      live.sessions.push({
        id,
        client_id: user.id,
        guide_id: guide.id,
        threshold_slug: input.threshold_slug,
        threshold_words: input.threshold_words?.trim() || null,
        session_type: input.session_type,
        status: "held",
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        buffer_before_min: guide.buffer_min,
        buffer_after_min: guide.buffer_min,
        client_name: input.client_name.trim() || "Unnamed",
        client_timezone: input.client_timezone,
        created_at: new Date().toISOString(),
        cancelled_at: null,
        rescheduled_from: null,
        rescheduled_at: null,
      });
      for (const a of input.answers) {
        live.answers.push({ ...a, answer: a.answer?.trim() || null, session_id: id, client_id: user.id });
      }
      if (input.letter && input.letter.trim()) {
        live.letters.push({
          id: uuid(),
          session_id: id,
          client_id: user.id,
          body: input.letter,
          unlocks_at: new Date(end.getTime() + LETTER_SEAL_HOURS * HOUR).toISOString(),
          opened_at: null,
          created_at: new Date().toISOString(),
        });
      }
      const u = live.users.find((x) => x.id === user.id);
      if (u) {
        u.display_name = u.display_name ?? (input.client_name.trim() || null);
        u.timezone = input.client_timezone;
      }
      db = live;
      persist();
      return id;
    },

    async mySessions() {
      const d = await load();
      const u = await me();
      await latency();
      if (!u) return [];
      return d.sessions.filter((s) => s.client_id === u.id).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    },

    async myAnswers(sessionId) {
      const d = await load();
      const u = await me();
      if (!u) return [];
      return d.answers
        .filter((a) => a.session_id === sessionId && a.client_id === u.id)
        .sort((a, b) => a.position - b.position)
        .map(({ position, prompt, answer }) => ({ position, prompt, answer }));
    },

    async myLetters() {
      const d = await load();
      const u = await me();
      await latency();
      if (!u) return [];
      const now = Date.now();
      return d.letters
        .filter((l) => l.client_id === u.id)
        .map<LetterEnvelope>((l) => {
          const open = new Date(l.unlocks_at).getTime() <= now;
          return {
            id: l.id,
            session_id: l.session_id,
            unlocks_at: l.unlocks_at,
            opened_at: l.opened_at,
            created_at: l.created_at,
            word_count: l.body.trim().split(/\s+/).filter(Boolean).length,
            is_open: open,
            body: open ? l.body : null,
          };
        })
        .sort((a, b) => a.unlocks_at.localeCompare(b.unlocks_at));
    },

    async openLetter(letterId) {
      const d = await load();
      const u = await me();
      const l = d.letters.find((x) => x.id === letterId && x.client_id === u?.id);
      if (l && new Date(l.unlocks_at).getTime() <= Date.now() && !l.opened_at) {
        l.opened_at = new Date().toISOString();
        persist();
      }
    },

    async reschedule(sessionId, startsAt) {
      await load();
      const user = await requireMe();
      await wait(600 + Math.random() * 300);
      const live = await fresh();
      const session = live.sessions.find((x) => x.id === sessionId && x.client_id === user.id && x.status === "held");
      if (!session) throw new BookingError("not_reschedulable");
      if (new Date(session.starts_at).getTime() < Date.now() + MIN_NOTICE_HOURS * HOUR) throw new BookingError("too_late");
      const guide = live.guides.find((g) => g.id === session.guide_id)!;
      const duration = (new Date(session.ends_at).getTime() - new Date(session.starts_at).getTime()) / MINUTE;
      const start = new Date(startsAt);
      if (start.getTime() === new Date(session.starts_at).getTime()) return;
      assertSlotOpen(live, guide, start, duration, user.id, session.id);
      const end = new Date(start.getTime() + duration * MINUTE);
      session.rescheduled_from = session.rescheduled_from ?? session.starts_at;
      session.rescheduled_at = new Date().toISOString();
      session.starts_at = start.toISOString();
      session.ends_at = end.toISOString();
      const letter = live.letters.find((l) => l.session_id === session.id);
      if (letter) letter.unlocks_at = new Date(end.getTime() + LETTER_SEAL_HOURS * HOUR).toISOString();
      db = live;
      persist();
    },

    async cancelSession(sessionId) {
      const d = await load();
      const u = await requireMe();
      await wait(450);
      const s = d.sessions.find((x) => x.id === sessionId && x.client_id === u.id);
      if (!s || s.status !== "held" || new Date(s.starts_at).getTime() <= Date.now()) {
        throw new Error("not_cancellable");
      }
      s.status = "cancelled";
      s.cancelled_at = new Date().toISOString();
      const letter = d.letters.find((l) => l.session_id === sessionId);
      if (letter) letter.unlocks_at = new Date().toISOString();
      persist();
    },

    async guideBriefings(from, to) {
      const d = await load();
      const u = await me();
      await latency();
      if (!u?.guide_id) return [];
      return d.sessions
        .filter(
          (s) =>
            s.guide_id === u.guide_id &&
            new Date(s.ends_at) > new Date(from.getTime() - 2 * HOUR) &&
            new Date(s.starts_at) < new Date(to.getTime() + 2 * HOUR),
        )
        .map((s) => ({
          ...s,
          answers: d.answers
            .filter((a) => a.session_id === s.id)
            .sort((a, b) => a.position - b.position)
            .map(({ position, prompt, answer }) => ({ position, prompt, answer })),
        }))
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    },

    async updateAvailability(guideId, rules) {
      const d = await load();
      const u = await requireMe();
      if (u.guide_id !== guideId) throw new Error("Only a Guide can change their own availability.");
      await wait(400);
      d.availability = [
        ...d.availability.filter((r) => r.guide_id !== guideId),
        ...rules.map((r) => ({ ...r, id: uuid(), guide_id: guideId })),
      ];
      persist();
    },

    async resetDemo() {
      safeStorage.remove(DB_KEY);
      safeStorage.remove(AUTH_KEY);
      db = null;
      loading = null;
      await load();
      await emit();
    },
  };

  return api;
}
