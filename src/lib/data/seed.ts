/**
 * Threshold seed data — the single source of truth.
 *
 * The in-browser demo store reads this directly; `npm run seed:sql` renders the
 * same data into supabase/seed.sql. Session times are relative to "today" in each
 * Guide's timezone so the product always feels alive, whenever it is opened.
 *
 * Every person here is fictional. Names are first names or initials only.
 */
import type { PresenceType, SessionTypeKey } from "../types";

export const SEED_VERSION = 3;

export const REFLECTIVE_PROMPTS = [
  {
    position: 1,
    prompt: "What is ending?",
    hint: "A sentence is enough. Name it plainly, the way you would to someone who already knows.",
  },
  {
    position: 2,
    prompt: "What are you afraid to lose — or afraid to keep?",
    hint: "There is no right side of this question.",
  },
  {
    position: 3,
    prompt: "What should your Guide know before you arrive?",
    hint: "Anything that would help them meet you: what you can't bear to hear, what you need them not to do.",
  },
] as const;

export const PRESENCE: Record<PresenceType, { name: string; line: string }> = {
  still: { name: "Still", line: "Speaks little. Holds long silences without rushing to fill them." },
  steady: { name: "Steady", line: "Even and unhurried. Keeps the structure so you don't have to." },
  direct: { name: "Direct", line: "Names what is happening, plainly, without cushioning it." },
  tender: { name: "Tender", line: "Close, warm attention. Makes room for grief to be loud." },
};

export const SEED_THRESHOLDS = [
  {
    slug: "divorce",
    name: "Finalizing a divorce",
    line: "The legal end of a life that was shared for many years.",
    keywords: ["divorce", "marriage", "married", "separation", "separating", "husband", "wife", "spouse", "decree", "ex", "partner"],
  },
  {
    slug: "surgery",
    name: "Before gender-affirming surgery",
    line: "The last days before your body becomes more truly yours.",
    keywords: ["surgery", "transition", "gender", "trans", "affirming", "top surgery", "bottom surgery", "operation", "body"],
  },
  {
    slug: "career",
    name: "Leaving a defining career",
    line: "Walking away from the work that told you who you were.",
    keywords: ["career", "job", "retire", "retiring", "retirement", "quit", "resign", "work", "profession", "leaving work", "vocation"],
  },
  {
    slug: "empty-nest",
    name: "Becoming an empty-nester",
    line: "The house after the last child has gone.",
    keywords: ["children", "child", "kids", "leaving home", "empty", "nest", "parent", "university", "college", "son", "daughter"],
  },
  {
    slug: "release",
    name: "The first months after release",
    line: "Coming home from prison to a world that kept moving.",
    keywords: ["prison", "release", "released", "incarceration", "jail", "parole", "sentence", "inside", "custody", "served"],
  },
  {
    slug: "diagnosis",
    name: "Receiving a terminal diagnosis",
    line: "When the future you were planning becomes a number.",
    keywords: ["terminal", "diagnosis", "diagnosed", "cancer", "dying", "prognosis", "illness", "palliative", "months to live", "death"],
  },
  {
    slug: "fertility",
    name: "Ending fertility treatment",
    line: "Choosing to stop, and grieving a child who never arrived.",
    keywords: ["fertility", "ivf", "pregnancy", "pregnant", "embryo", "childless", "treatment", "miscarriage", "trying", "conceive"],
  },
  {
    slug: "disability",
    name: "Moving into permanent disability",
    line: "The day a temporary situation is named permanent.",
    keywords: ["disability", "disabled", "wheelchair", "chronic", "injury", "mobility", "sight", "hearing", "paralysis", "permanent", "accident"],
  },
  {
    slug: "name",
    name: "Legally changing your name",
    line: "Signing away the name you were given for the one you chose.",
    keywords: ["name", "deed poll", "legal name", "rename", "renaming", "identity", "surname", "maiden"],
  },
].map((t, i) => ({ ...t, sort_order: i + 1 }));

export const SEED_SESSION_TYPES: { key: SessionTypeKey; name: string; duration_min: number; line: string; sort_order: number }[] = [
  {
    key: "solo",
    name: "Solo",
    duration_min: 90,
    line: "Ninety minutes. You and your Guide, and nothing else in the room.",
    sort_order: 1,
  },
  {
    key: "witnessed",
    name: "Witnessed",
    duration_min: 120,
    line: "Bring one person to stand beside you. They witness; they do not have to speak.",
    sort_order: 2,
  },
  {
    key: "aftermath",
    name: "Threshold + Practical Aftermath",
    duration_min: 150,
    line: "Ninety minutes held, then an hour on what must be done next — the forms, the calls, the words for other people.",
    sort_order: 3,
  },
];

export interface SeedGuide {
  id: string;
  user_id: string | null;
  slug: string;
  name: string;
  pronouns: string;
  presence: PresenceType;
  statement: string;
  background: string;
  location: string;
  timezone: string;
  years_holding: number;
  tags: string[];
  languages: string[];
  max_sessions_per_day: number;
  thresholds: string[];
  /** weekday (0 = Sunday) → [start, end] in the Guide's local time */
  availability: [number, string, string][];
}

export const DEMO_USERS = {
  client: {
    id: "00000000-0000-4000-8000-0000000000a1",
    email: "ines@threshold.demo",
    password: "threshold",
    display_name: "Inês",
    timezone: "Europe/Lisbon",
  },
  guide: {
    id: "00000000-0000-4000-8000-0000000000b1",
    email: "mara@threshold.demo",
    password: "threshold",
    display_name: "Mara",
    timezone: "Europe/Lisbon",
  },
  community: {
    id: "00000000-0000-4000-8000-0000000000c1",
    email: "community@threshold.demo",
    password: "threshold-community-seed",
    display_name: "Community",
    timezone: "UTC",
  },
} as const;

const weekdays = (days: number[], start: string, end: string): [number, string, string][] =>
  days.map((d) => [d, start, end]);

export const SEED_GUIDES: SeedGuide[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    user_id: DEMO_USERS.guide.id,
    slug: "mara",
    name: "Mara Okafor-Lindqvist",
    pronouns: "she/her",
    presence: "still",
    statement: "I won't tell you it will be fine. I'll stay in the room while it is enormous.",
    background: "Fourteen years as a hospice chaplain in Gothenburg and Lisbon.",
    location: "Lisbon",
    timezone: "Europe/Lisbon",
    years_holding: 14,
    tags: ["Former hospice chaplain", "Comfortable with long silence", "Non-religious practice"],
    languages: ["English", "Portuguese", "Swedish"],
    max_sessions_per_day: 2,
    thresholds: ["diagnosis", "divorce", "career", "empty-nest", "fertility"],
    availability: [...weekdays([1, 2, 4], "09:00", "18:00"), [5, "09:00", "14:30"]],
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    user_id: null,
    slug: "tobias",
    name: "Tobias Reinholt",
    pronouns: "he/him",
    presence: "steady",
    statement: "Big days need a shape. I bring the shape, so you can bring everything else.",
    background: "Eleven years in probation services, then a decade as a family mediator.",
    location: "Berlin",
    timezone: "Europe/Berlin",
    years_holding: 10,
    tags: ["Former probation officer", "Mediator", "Structured sessions"],
    languages: ["English", "German"],
    max_sessions_per_day: 2,
    thresholds: ["release", "career", "divorce", "disability"],
    availability: weekdays([1, 2, 3, 4], "08:00", "16:00"),
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    user_id: null,
    slug: "imani",
    name: "Imani Castellanos",
    pronouns: "they/them",
    presence: "direct",
    statement: "You don't need to explain yourself to me. We can start where you actually are.",
    background: "Trans peer advocate; supported hundreds of people through surgery and legal change.",
    location: "Mexico City",
    timezone: "America/Mexico_City",
    years_holding: 8,
    tags: ["Trans-led practice", "Peer advocate", "Plain speech"],
    languages: ["English", "Spanish"],
    max_sessions_per_day: 2,
    thresholds: ["surgery", "name", "release", "disability"],
    availability: weekdays([2, 3, 4, 5, 6], "10:00", "19:00"),
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    user_id: null,
    slug: "ruth",
    name: "Ruth Adeyemi",
    pronouns: "she/her",
    presence: "tender",
    statement: "Grief is allowed to be loud here. I have sat with a great deal of it, and I'm not afraid of yours.",
    background: "Twenty years as a neonatal nurse, then bereavement support.",
    location: "Toronto",
    timezone: "America/Toronto",
    years_holding: 9,
    tags: ["Former NICU nurse", "Bereavement support", "Parents"],
    languages: ["English", "Yoruba"],
    max_sessions_per_day: 2,
    thresholds: ["fertility", "empty-nest", "diagnosis", "surgery"],
    availability: [...weekdays([1, 3, 5], "09:00", "17:00"), [6, "10:00", "14:30"]],
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    user_id: null,
    slug: "soren",
    name: "Søren Achterberg",
    pronouns: "he/him",
    presence: "still",
    statement: "I hold one threshold a day, in the morning, and nothing after it.",
    background: "Became paraplegic at thirty-one. Has guided others across the same line since.",
    location: "Melbourne",
    timezone: "Australia/Melbourne",
    years_holding: 12,
    tags: ["Lived experience of disability", "One session a day", "Early mornings"],
    languages: ["English", "Danish"],
    max_sessions_per_day: 1,
    thresholds: ["disability", "diagnosis", "career"],
    availability: weekdays([1, 2, 3, 4, 5], "07:30", "13:00"),
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    user_id: null,
    slug: "noor",
    name: "Noor Haddad",
    pronouns: "she/her",
    presence: "direct",
    statement: "I practised family law for fifteen years. I know what the paperwork does not say.",
    background: "Former family lawyer; left practice to sit on the other side of the table.",
    location: "New York",
    timezone: "America/New_York",
    years_holding: 6,
    tags: ["Former family lawyer", "Evening hours", "Practical aftermath"],
    languages: ["English", "Arabic", "French"],
    max_sessions_per_day: 2,
    thresholds: ["divorce", "name", "empty-nest", "fertility"],
    availability: weekdays([1, 2, 3, 4], "11:00", "20:00"),
  },
  {
    id: "10000000-0000-4000-8000-000000000007",
    user_id: null,
    slug: "ash",
    name: "Ash Delacroix-Mbeki",
    pronouns: "they/them",
    presence: "steady",
    statement: "I have crossed a few of these myself. I'll walk at your pace, not mine.",
    background: "Social worker in re-entry programmes; changed their own name at forty.",
    location: "Nairobi",
    timezone: "Africa/Nairobi",
    years_holding: 7,
    tags: ["Re-entry social worker", "Lived experience", "Swahili & French"],
    languages: ["English", "Swahili", "French"],
    max_sessions_per_day: 2,
    thresholds: ["surgery", "name", "release", "diagnosis"],
    availability: weekdays([1, 3, 4, 6], "09:00", "17:00"),
  },
];

// ---------------------------------------------------------------------------
// Seeded sessions
// ---------------------------------------------------------------------------

export interface SeedSession {
  id: string;
  guide: string; // guide slug
  client: "client" | "community";
  /** Days from today (Guide-local). The first matching open day on or after this is used. */
  day_offset: number;
  local_time: string;
  session_type: SessionTypeKey;
  threshold_slug: string;
  threshold_words?: string;
  client_name: string;
  client_timezone: string;
  answers: [string | null, string | null, string | null];
  letter?: string;
}

const s = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const SEED_SESSIONS: SeedSession[] = [
  // --- Inês, the demo client ------------------------------------------------
  {
    id: s(1),
    guide: "mara",
    client: "client",
    day_offset: -7,
    local_time: "10:00",
    session_type: "solo",
    threshold_slug: "career",
    threshold_words: "Retiring from air traffic control after twenty-six years.",
    client_name: "Inês",
    client_timezone: "Europe/Lisbon",
    answers: [
      "Twenty-six years in the tower at Humberto Delgado. My last shift is the Friday before we meet.",
      "Afraid to lose the version of me who is needed at 6:40 every morning. Afraid to keep the vigilance — I don't sleep without it.",
      "Please don't congratulate me. Everyone keeps congratulating me.",
    ],
    letter: `Inês —

By the time you read this the badge will be gone, and the lanyard will be in a drawer you'll pretend you don't know about. Twenty-six years. You were the person who knew where every aircraft was. Now you are a person who doesn't have to know.

Remember that you were frightened on Tuesday morning, and that you went anyway. Remember that Mara didn't tell you it would be fine. She let it be enormous, and it was, and you were still there at the end of it.

You are allowed to miss it. You are allowed to not miss it. Both will happen, sometimes before lunch.

Go and stand at the window at 6:40, when the first departures used to come through. Just once. Then make coffee on no one's schedule but yours.

— I.`,
  },
  {
    id: s(2),
    guide: "ruth",
    client: "client",
    day_offset: 9,
    local_time: "10:00",
    session_type: "witnessed",
    threshold_slug: "empty-nest",
    threshold_words: "My youngest leaves for Edinburgh in two weeks.",
    client_name: "Inês",
    client_timezone: "Europe/Lisbon",
    answers: [
      "Twenty-three years of someone coming home at the end of the day.",
      null,
      "My sister Lúcia will be there as my witness. She raised four; she knows.",
    ],
    letter: `To the woman in the quiet house —

You were afraid the silence would be an accusation. I hope by now it has become a room you are allowed to sit in.

Call him on Sunday, not before. Let him miss you a little.

— I.`,
  },

  // --- Mara's week (the demo Guide) ----------------------------------------
  {
    id: s(10),
    guide: "mara",
    client: "community",
    day_offset: -2,
    local_time: "11:00",
    session_type: "solo",
    threshold_slug: "fertility",
    client_name: "Dev",
    client_timezone: "Europe/London",
    answers: [
      "Our eighth transfer. We have decided it is the last.",
      "Afraid to keep hoping. It has become a second job.",
      null,
    ],
  },
  {
    id: s(11),
    guide: "mara",
    client: "community",
    day_offset: 1,
    local_time: "10:00",
    session_type: "solo",
    threshold_slug: "diagnosis",
    client_name: "Hanne",
    client_timezone: "Europe/Copenhagen",
    answers: [
      "The oncologist said months, and then she said 'probably not a year'. I keep hearing 'probably'.",
      "Afraid to lose the ability to plan anything at all. I'm a planner.",
      "I don't want to talk about treatment. My family does enough of that. I want to talk about what's left that's mine.",
    ],
  },
  {
    id: s(12),
    guide: "mara",
    client: "community",
    day_offset: 1,
    local_time: "14:00",
    session_type: "witnessed",
    threshold_slug: "divorce",
    threshold_words: "The decree absolute arrives this week. Nineteen years.",
    client_name: "R.",
    client_timezone: "Europe/London",
    answers: [
      "Nineteen years of marriage, officially, on a piece of paper that arrives by email.",
      "Afraid to keep the anger. It's the only thing that feels like him now.",
      "My friend Callum is coming as witness. He was best man. He's on my side but he loved us both.",
    ],
  },
  {
    id: s(13),
    guide: "mara",
    client: "community",
    day_offset: 3,
    local_time: "11:00",
    session_type: "aftermath",
    threshold_slug: "fertility",
    client_name: "Sofía",
    client_timezone: "Europe/Madrid",
    answers: [
      "Six years of injections, calendars and waiting rooms.",
      "Afraid to lose the future I've been furnishing in my head since I was thirty.",
      "In the practical hour I need help with what to tell my mother. And the clinic still has two embryos.",
    ],
  },
  {
    id: s(14),
    guide: "mara",
    client: "community",
    day_offset: 7,
    local_time: "13:00",
    session_type: "solo",
    threshold_slug: "career",
    client_name: "Ingrid",
    client_timezone: "Europe/Oslo",
    answers: [
      "Thirty-one years as a surgeon. My hands aren't steady enough any more.",
      "Afraid to lose being the person in the room who knows what to do.",
      "I will probably be very composed. It isn't how I feel.",
    ],
  },
  {
    id: s(15),
    guide: "mara",
    client: "community",
    day_offset: 10,
    local_time: "10:00",
    session_type: "witnessed",
    threshold_slug: "diagnosis",
    client_name: "Jonah",
    client_timezone: "America/New_York",
    answers: [
      "ALS. I told my kids on Sunday.",
      null,
      "My brother Eli will be there. I talk slowly now; please wait for me.",
    ],
  },

  // --- Everyone else's calendars: realistic, already-held times ------------
  { id: s(20), guide: "tobias", client: "community", day_offset: 2, local_time: "09:00", session_type: "solo", threshold_slug: "release", client_name: "Marcus", client_timezone: "America/Chicago", answers: ["Eleven years inside. Out on the 3rd.", "Afraid to lose the routine. Afraid to keep the way I watch doors.", null] },
  { id: s(21), guide: "tobias", client: "community", day_offset: 5, local_time: "12:00", session_type: "aftermath", threshold_slug: "career", client_name: "Petra", client_timezone: "Europe/Vienna", answers: ["Closing the bakery my grandfather opened.", "Afraid to keep the guilt.", "Please help me write the notice for the window."] },
  { id: s(22), guide: "tobias", client: "community", day_offset: 11, local_time: "09:30", session_type: "witnessed", threshold_slug: "divorce", client_name: "Lena", client_timezone: "Europe/Berlin", answers: ["Twelve years.", null, "My daughter (22) will witness."] },
  { id: s(23), guide: "imani", client: "community", day_offset: 2, local_time: "12:00", session_type: "solo", threshold_slug: "name", client_name: "Kit", client_timezone: "America/Los_Angeles", answers: ["The name my parents chose.", "Afraid to keep the flinch when someone says it.", null] },
  { id: s(24), guide: "imani", client: "community", day_offset: 6, local_time: "15:00", session_type: "solo", threshold_slug: "surgery", client_name: "Theo", client_timezone: "America/Mexico_City", answers: ["Surgery on the 14th.", "Afraid I'll feel nothing and that will mean something.", "I'm fine with swearing."] },
  { id: s(25), guide: "imani", client: "community", day_offset: 10, local_time: "11:00", session_type: "witnessed", threshold_slug: "surgery", client_name: "Ari", client_timezone: "America/Bogota", answers: ["Waiting eight years for this date.", null, "My partner will be there."] },
  { id: s(26), guide: "ruth", client: "community", day_offset: 3, local_time: "10:00", session_type: "solo", threshold_slug: "fertility", client_name: "Claire", client_timezone: "America/Toronto", answers: ["We're stopping.", "Afraid to lose my marriage too.", null] },
  { id: s(27), guide: "ruth", client: "community", day_offset: 12, local_time: "13:00", session_type: "solo", threshold_slug: "diagnosis", client_name: "Paul", client_timezone: "America/Vancouver", answers: ["Stage four.", "Afraid to keep pretending for my wife.", "I cry easily. Don't mind it."] },
  { id: s(28), guide: "soren", client: "community", day_offset: 1, local_time: "09:30", session_type: "solo", threshold_slug: "disability", client_name: "Grace", client_timezone: "Australia/Sydney", answers: ["The specialist wrote 'permanent'.", "Afraid to lose running. It was how I thought.", null] },
  { id: s(29), guide: "soren", client: "community", day_offset: 4, local_time: "08:30", session_type: "solo", threshold_slug: "career", client_name: "Hamish", client_timezone: "Australia/Melbourne", answers: ["Forty years on the farm. Selling it.", null, "I'm not much of a talker."] },
  { id: s(30), guide: "soren", client: "community", day_offset: 8, local_time: "09:30", session_type: "solo", threshold_slug: "diagnosis", client_name: "Wen", client_timezone: "Asia/Singapore", answers: ["Motor neurone disease.", "Afraid to lose my voice before I've said things.", null] },
  { id: s(31), guide: "noor", client: "community", day_offset: 2, local_time: "12:00", session_type: "aftermath", threshold_slug: "divorce", client_name: "Dana", client_timezone: "America/New_York", answers: ["Signing on Thursday.", "Afraid to keep his last name.", "Practical hour: the name change and the kids' school forms."] },
  { id: s(32), guide: "noor", client: "community", day_offset: 4, local_time: "15:00", session_type: "solo", threshold_slug: "name", client_name: "Priya", client_timezone: "America/Chicago", answers: ["My father's name.", null, null] },
  { id: s(33), guide: "noor", client: "community", day_offset: 13, local_time: "17:00", session_type: "solo", threshold_slug: "fertility", client_name: "Mel", client_timezone: "America/Denver", answers: ["Ten years of trying.", "Afraid to lose my body's purpose, as I understood it.", null] },
  { id: s(34), guide: "ash", client: "community", day_offset: 3, local_time: "10:00", session_type: "solo", threshold_slug: "surgery", client_name: "Zawadi", client_timezone: "Africa/Nairobi", answers: ["Surgery in Bangkok next month.", "Afraid to keep hiding.", null] },
  { id: s(35), guide: "ash", client: "community", day_offset: 6, local_time: "13:00", session_type: "aftermath", threshold_slug: "release", client_name: "Omar", client_timezone: "Africa/Cairo", answers: ["Seven years.", null, "Practical hour: ID documents and a bank account."] },
  { id: s(36), guide: "ash", client: "community", day_offset: 15, local_time: "11:00", session_type: "solo", threshold_slug: "name", client_name: "Jules", client_timezone: "Europe/Paris", answers: ["My deadname.", "Afraid to lose my grandmother's way of saying it.", null] },
];
