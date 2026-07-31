// Mountain Path — card and band data
// NOTE: each predefined card's `label` is the statement students see; keep the
// wording stable — placements reference cards by `id`.

// Pronoun sets for the few places the QTVI narrates *about* the student (third
// person). The path and quotes stay in the student's own first-person voice.
export const PRONOUNS = {
    they: { label: "they / them", subject: "they", object: "them", possessive: "their" },
    she:  { label: "she / her",   subject: "she",  object: "her",  possessive: "her"  },
    he:   { label: "he / him",    subject: "he",   object: "him",  possessive: "his"  },
};

// The five stations on the path, from the gentle start to the steep summit.
// `color`/`tint` follow the app's muted status palette — used as thin borders
// and dots, never as solid fills.
export const BANDS = [
    { band: 1, label: "Very Comfortable", color: "#15803d", tint: "#eefaf1" },
    { band: 2, label: "Comfortable",      color: "#4d7c0f", tint: "#f4f8e8" },
    { band: 3, label: "Moderate",         color: "#b45309", tint: "#fdf3e7" },
    { band: 4, label: "Challenging",      color: "#c2410c", tint: "#fdf0e8" },
    { band: 5, label: "Very Challenging", color: "#b91c1c", tint: "#fdeeee" },
];

export const BAND_BY_NUM = Object.fromEntries(BANDS.map((b) => [b.band, b]));

export const QUOTE_TAGS = {
    comfort:   { label: "Going well", color: "#15803d" },
    challenge: { label: "Tricky",     color: "#b91c1c" },
    "":        { label: "General",    color: "#8a8077" },
};

// Fallback ideas offered for custom cards (and any card without its own list).
export const DEFAULT_SUGGESTIONS = [
    "Break the task into smaller steps",
    "Ask for extra time",
    "Use different lighting",
    "Request alternative formats",
];

// The predefined statement cards. `suggestions` are starting points the student
// can tap to build their own "what would help" ideas.
export const CARDS = [
    {
        id: "pace",
        label: "Keeping up with the pace of visual information",
        suggestions: [
            "Ask teacher to slow down presentations",
            "Record lessons to review later",
            "Use a buddy to share notes",
            "Request breaks during visually intensive tasks",
        ],
    },
    {
        id: "discussions",
        label: "Joining in with class discussions",
        suggestions: [
            "Raise hand early to get noticed",
            "Write thoughts down first",
            "Ask for thinking time before responding",
            "Use a visual signal to indicate wanting to speak",
        ],
    },
    {
        id: "whiteboard",
        label: "Reading from the Interactive whiteboard",
        suggestions: [
            "Sit closer to the front of the classroom",
            "Use a monocular or magnifier",
            "Ask teacher to use larger font and high contrast colors",
            "Request printed copies of board content",
        ],
    },
    {
        id: "partner",
        label: "Working with a partner",
        suggestions: [
            "Choose partners who understand my visual needs",
            "Explain my visual needs at the start",
            "Use verbal descriptions more",
            "Position ourselves where lighting is best",
        ],
    },
    {
        id: "asking-help",
        label: "Asking for help with work",
        suggestions: [
            "Use a help signal card on desk",
            "Practice what to say beforehand",
            "Ask for help early, not when stuck",
            "Establish a signal with teacher for discrete help",
        ],
    },
    {
        id: "worksheets",
        label: "Using worksheets/books/resources",
        suggestions: [
            "Use a reading ruler or line guide",
            "Enlarge worksheets on photocopier or digitally",
            "Use colored paper instead of white to reduce glare",
            "Request digital versions for screen reading",
        ],
    },
    {
        id: "explaining-needs",
        label: "Explaining visual needs/requirements",
        suggestions: [
            "Prepare a simple explanation card",
            "Show examples of what helps",
            "Use analogies others can understand",
            "Create a one-page profile of needs",
        ],
    },
    {
        id: "distractions",
        label: "Filtering out distractions i.e. sounds",
        suggestions: [
            "Use noise-cancelling headphones",
            "Sit away from noisy areas like doors or windows",
            "Use ear defenders during tests",
            "Request a quiet space for focused work",
        ],
    },
    {
        id: "listen-watch",
        label: "Listening to instructions and watching at the same time",
        suggestions: [
            "Ask for instructions to be repeated",
            "Focus on listening first, then looking",
            "Request written backup of verbal instructions",
            "Use voice recording for complex instructions",
        ],
    },
    {
        id: "navigating",
        label: "Navigating between classroom spaces",
        suggestions: [
            "Walk with a buddy during transitions",
            "Use consistent, familiar routes",
            "Allow extra time for movement",
            "Use high-contrast markers on key landmarks",
        ],
    },
    {
        id: "handwriting",
        label: "Reading handwritten notes or feedback",
        suggestions: [
            "Request typed feedback",
            "Use a document camera to enlarge",
            "Ask teacher to read feedback aloud",
            "Request feedback in consistent, clear font",
        ],
    },
    {
        id: "group-activities",
        label: "Participating in group activities",
        suggestions: [
            "Assign specific roles that suit strengths",
            "Use clear verbal communication",
            "Position myself where I can see everyone",
            "Use written notes to track group decisions",
        ],
    },
    {
        id: "assessment-time",
        label: "Managing time during assessments",
        suggestions: [
            "Request extra time allowance",
            "Use a timer with visual/audio alerts",
            "Practice with timed activities",
            "Break assessment into smaller chunks",
        ],
    },
    {
        id: "digital-platforms",
        label: "Using digital learning platforms",
        suggestions: [
            "Adjust screen brightness and contrast",
            "Use text-to-speech features",
            "Increase font size in settings",
            "Use browser extensions for accessibility",
        ],
    },
    {
        id: "demonstrations",
        label: "Following demonstrations or experiments",
        suggestions: [
            "Stand closer to demonstrations",
            "Request step-by-step verbal explanations",
            "Review video recordings afterward",
            "Have materials described before handling them",
        ],
    },
    {
        id: "pe-games",
        label: "Joining in with fast-moving activities (PE/ball games)",
        suggestions: [
            "Use brightly colored balls with ribbons attached for tracking",
            "Ask for auditory countdown before ball is thrown",
            "Use balls with bells or sound inside",
            "Practice with stationary ball first, then slow-moving",
            "Use high-contrast colored bibs to identify team members",
            "Position in areas with less visual complexity",
        ],
    },
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

// ---------------------------------------------------------------------------
// The day path — the second way of building a path with a student. Instead of
// sorting cards, the student shapes the terrain of their own school day.
// ---------------------------------------------------------------------------

export const DAY_LABELS = [
    "Home", "Bus", "Arrival", "Reg.", "Maths",
    "Break", "Literacy", "Lunch", "Topic", "Reading",
];

// Light guidance for the QTVI — used on screen, never printed.
export const DAY_PROMPTS = [
    {
        heading: "Opening",
        text: "I'd like to hear about your day at school. We're going to use this path to show what it's like — the flat bits are the easy parts, and the steep bits are the harder parts.",
    },
    {
        heading: "For each part of the day",
        text: "Tell me about this time. What's it like? Is it easy or hard? What happens with your eyes?",
    },
    {
        heading: "Looking for what helps",
        text: "What makes this bit easier? Is there anything that helps?",
    },
    {
        heading: "Looking for what makes it harder",
        text: "What makes this bit harder? Is there anything you find tricky?",
    },
    {
        heading: "Closing",
        text: "If you could change one thing about your day to make it easier for your eyes, what would it be?",
    },
];

export const CLOSING_QUESTION = "If you could change one thing about your day to make it easier for your eyes, what would it be?";

export const MAX_HERO_QUOTES = 3;
