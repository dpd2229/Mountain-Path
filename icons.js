// Mountain Path — inline SVG icon set (stroke-based, Lucide-style).
// All icons inherit colour via currentColor and are decorative (aria-hidden);
// a visible text label always accompanies them.

const svg = (inner, viewBox = "0 0 24 24") =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;

export const ICONS = {
    // ---- brand + tool icons ----
    mountain: svg('<path d="M3 20h18L14 6l-3.2 6.2L8.6 9z"/><path d="M10.8 12.2 8.6 9 3 20"/>'),
    flag: svg('<path d="M4 22V4"/><path d="M4 4h11l-1.5 3.5L15 11H4z"/>'),
    route: svg('<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h5a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h5"/>'),
    quote: svg('<path d="M9 7H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v1a3 3 0 0 1-3 3"/><path d="M20 7h-4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v1a3 3 0 0 1-3 3"/>'),
    clipboard: svg('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h4"/>'),
    person: svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    grip: svg('<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>'),
    lightbulb: svg('<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.1 14a5 5 0 1 0-6.2 0c.6.5 1.1 1.2 1.1 2h4c0-.8.5-1.5 1.1-2z"/>'),

    // ---- UI icons ----
    check: svg('<polyline points="20 6 9 17 4 12"/>'),
    star: svg('<polygon points="12 2.8 15 9.1 21.8 10 16.9 14.7 18.1 21.4 12 18.2 5.9 21.4 7.1 14.7 2.2 10 9 9.1"/>'),
    plus: svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    x: svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
    printer: svg('<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
    save: svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'),
    folder: svg('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
    copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    trash: svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>'),
    eraser: svg('<path d="M20 20H7L3 16a2 2 0 0 1 0-2.83l9.17-9.17a2 2 0 0 1 2.83 0l5 5a2 2 0 0 1 0 2.83L13 19"/><line x1="9" y1="9" x2="15" y2="15"/>'),
    lock: svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    users: svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
    calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="16" y1="3" x2="16" y2="7"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="3" y1="11" x2="21" y2="11"/>'),
};

// The big decorative opening quote mark used behind printed pull-quotes.
// Filled (not stroked) so it reads as a typographic ornament, not an icon.
export const QUOTE_ORNAMENT =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M10 5.5c-4 1.6-6.5 4.7-6.5 8.4 0 2.9 1.7 4.6 3.9 4.6 2 0 3.5-1.5 3.5-3.4 0-1.9-1.3-3.2-3.1-3.2-.3 0-.7 0-1 .2.5-1.9 2-3.5 4-4.4zm10.5 0c-4 1.6-6.5 4.7-6.5 8.4 0 2.9 1.7 4.6 3.9 4.6 2 0 3.5-1.5 3.5-3.4 0-1.9-1.3-3.2-3.1-3.2-.3 0-.7 0-1 .2.5-1.9 2-3.5 4-4.4z"/></svg>`;
