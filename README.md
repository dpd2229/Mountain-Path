# Mountain Path

A studio for capturing a student's own view of school — what feels comfortable, what feels like a climb, and what they think would help — and turning it into a child-centred report and action plan.

Built as a sibling to **Vision in 60 Seconds**: same visual language, same live-preview-to-PDF approach, same privacy story.

## Running it

There is no build step and nothing to install. The files need to be *served* over http rather than opened straight off the disk, because browsers block ES modules on `file://` URLs (the same is true of Vision in 60 Seconds).

- **Deployed:** publish the folder to GitHub Pages — or any static host — and visit the URL.
- **Locally:** from the project folder run `python3 -m http.server` and open `http://localhost:8000`.

The only external request the page makes is for the Google Fonts stylesheet.

**Everything stays on the device.** Sessions are saved to `localStorage` only; nothing is ever sent anywhere.

## The studio

The tools are deliberately not a wizard. A QTVI can use any of them, in any order, and whatever they fill in flows into the same report:

- **About this session** — the student's name or initials, class, and the key message they most want school to hear.
- **The path** — the heart of it. Place cards along a five-station path from *Very Comfortable* to *Very Challenging*. Tap a card then tap a station, or drag it across. Open any placed card to record what the student thinks would help, with suggestion chips as starting points. Comparing two subjects is opt-in.
- **In their own words** — verbatim quotes, typeset as pull quotes in the report. A single quote gets a whole page to itself.
- **Action plan** — the part school acts on. Send a card across from the path, or add actions from scratch. Leave *Who / What / When* blank and they print as ruled lines to complete together in a meeting.
- **Saved sessions** — name, load, duplicate and delete sessions held on this device.

## The report

The preview panel is a live, true-to-size render of the printed A4 pages — the same markup that prints, so what you see is what you get. Use **Print / Save as PDF**, then in the browser's print dialog choose *Save as PDF*, paper size **A4**, and turn **headers & footers off**.

Pages are generated as needed: the path figure, the full "what would help" list (optional), the quotes pages, and the action plan.

## Files

| File | What's in it |
| --- | --- |
| `index.html` | Page shell, studio panels, preview pane, dialogs |
| `styles.css` | Part 1 screen UI · Part 2 document · Part 3 print |
| `app.js` | State, storage, the tools, and document rendering |
| `data.js` | Card statements, band definitions, suggestions |
| `icons.js` | Inline SVG icon set |

---

Mountain Path © D. Downes 2025
