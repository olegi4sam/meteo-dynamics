# Meteo Dynamics

**English** · [Русский](README.ru.md)

**Track how weather forecasts change.** A mobile-first, frontend-only service that shows you
**not the weather, but the behaviour of the forecast** — how the prediction for one specific hour
shifted as the model released new updates.

A normal weather app answers "how warm will it be at noon". This one answers a different question,
and for athletes and agronomists a more important one: **how much can you trust that number right
now?** If a week ago the model promised 0 mm of rain, then 2.9 mm, and today 0 again — the forecast
has not settled, and it is too early to plan work around it.

**Live: [olegi4sam.github.io/meteo-dynamics](https://olegi4sam.github.io/meteo-dynamics/)**

---

## Quick start

No build step: no npm, no bundler, no backend. Three files and a browser.

**Live Server in VS Code — recommended**

1. Install the **Live Server** extension (Ritwick Dey).
2. Right-click `index.html` → **Open with Live Server**.

**Any static server**

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

**Double-clicking `index.html`** works too — Open-Meteo sends `Access-Control-Allow-Origin: *`,
so requests from `file://` are not blocked. With one caveat below.

> **About automatic location detection.** Browsers only grant geolocation in a secure context —
> `https://` or `localhost`. Opened via `file://`, auto-detection silently does nothing and the app
> stays on the default city (Riga); you can still pick a city by hand. For auto-detection to work,
> serve the page over Live Server or a local server.
>
> The same applies to **adding to the home screen**: the `beforeinstallprompt` event only fires
> over `https`. On `localhost` and `file://` the banner falls back to manual instructions.

> **If your edits don't show up after a reload** — the browser is holding `app.js` in cache.
> Live Server handles this itself; a plain `http.server` sends no cache headers, so do a
> cache-ignoring reload (**Ctrl/Cmd + Shift + R**).

---

## Project layout

| File | Purpose |
|------|---------|
| `index.html` | Markup: header with location, date strip, hour list, legend footer |
| `styles.css` | Styling: theme tokens, sticky headers, grids, responsive from 320 px |
| `app.js` | Logic: requests, hour indexing, per-update summaries, SVG charts, geolocation |
| `README.md` | This file (`README.ru.md` — Russian) |

Zero external dependencies. Charts are hand-drawn SVG; icons are an inline SVG sprite.

---

## How the interface works

```
(📍 Rīga ▾)      (EN) (↑) (⚙)      ← everything in a "pill" is tappable
default
─────────────────────────────────
[Thu 30.07][Fri 31.07][Sat 01.08]… ← date strip, scrolls sideways
[Temp.][Cloud][Precip.][Wind]      ← which metrics to show
─────────────────────────────────
 ⊞ Add to home screen           ×  ← banner, at most 5 times
─────────────────────────────────
            🌡️      ☁️      💧      💨
 12:00   19.6°↘  22%↗   0.0→   0.7↘   ← lowest value
         24.5°   100%   1.5    3.9    ← highest value
─────────────────────────────────
 13:00   …tap to open the charts…
```

The header has the location on the left and three buttons on the right: **EN** (appears whenever
the language is not English), **share**, and the **gear** with settings.

Everything interactive shares one look — a rounded, outlined pill: location, EN, language, theme,
dates, metrics. The legend at the bottom of the page deliberately sits flat on the background with
no card behind it, so it is not mistaken for a button.

### Two numbers and an arrow

Each cell holds **not a single value but the spread across every model update** for that hour:

* **upper number** — the lowest value among the updates;
* **lower number** — the highest;
* **arrow** — which way the forecast moved from the earliest update to the current one
  (↗ up, ↘ down, → unchanged).

Both numbers are set in the same weight. There is nothing to emphasise: the minimum and the maximum
are equally important, and bolding one of them would read as "this value matters more", which is
not true.

A wide spread means the forecast is still drifting. A narrow one means the model is confident. The
arrow can be flat while the spread is wide — that means the forecast swung one way and came back.

### Opening an hour

Tapping a row opens a chart for every enabled metric. The X axis is the **date the update was
issued**, oldest on the left (7 days ago), current on the right. The line is stepped on purpose:
an update's value holds until the next one is released.

Hovering (or touching on a phone) shows a tooltip covering **all enabled metrics at once** for that
update — temperature, cloud cover, precipitation and wind in one place.

### Terminology

The model recomputes the forecast once a day, so several different answers exist for the same hour.
Each answer is called a **forecast update** here. In English the technical term is "model run", but
the interface has no use for jargon. Tooltips reduce it to the plainest form: "Forecast from 28.07".

### Metrics

Four columns — temperature, cloud cover, precipitation, wind — all on by default. Any of them can be
switched off in the metric bar; you cannot switch them all off, at least one stays. Four columns fit
even on a 375 px screen.

---

## Settings, sharing and installing

### The gear menu

Language, units and theme live in one place, behind the gear in the header. Units used to be hidden
inside the language menu, which made them hard to find.

The theme has three states rather than a toggle: **system**, light, dark. "System" is the default —
the page follows the OS setting until the user picks something else.

### Share

The button next to the gear hands out a link to the service. What actually gets sent is the app
name, the tagline and one explanatory sentence — many messengers ignore the `title` field and show
only `text` and `url`, so everything essential goes into `text`:

> **Meteo Dynamics — Track how weather forecasts change.** Shows the spread between model updates
> for every hour, so you can see how much to trust the forecast.

The order of attempts:

1. `navigator.share` — on a phone this opens the system share sheet;
2. failing that, the link is copied to the clipboard and a confirmation appears;
3. failing that too (no permission), the link is shown in a message so it can be copied by hand.

### Add to home screen

The app checks whether it is already running as an installed app
(`display-mode: standalone` or `navigator.standalone`) — if so, the banner never appears.

If the browser supports installation and fires `beforeinstallprompt`, the banner shows a real
**Add** button that opens the system install dialog. Where that is impossible — Safari on iOS has
no such API — the banner shows platform-specific instructions instead: "Share → Add to Home Screen"
or "browser menu → Install app".

**Show counter.** The banner appears at most **5 times**, once per page load, and says which show
this is: "Reminder 3 of 5 — then it stops". After the fifth it never returns. The × closes it for
good immediately.

The manifest is assembled in `injectManifest()` and attached as a `data:` URL. A separate
`manifest.json` with real icons would make installation more reliable, but would break the
"exactly four files" constraint. If a browser refuses to read that manifest, installation simply
falls back to the manual instructions — the banner works either way.

### Languages

16 languages are supported: English, Russian, Ukrainian, German, French, Spanish, Portuguese,
Italian, Polish, Latvian, Lithuanian, Estonian, Turkish, Chinese, Japanese and Arabic (with full
right-to-left support).

How the language is chosen on first open:

1. the user's saved choice, if there is one;
2. otherwise the **language of the country detected by geolocation** (Latvia → Latvian,
   Lithuania → Lithuanian, Kazakhstan → Russian, and so on);
3. otherwise the browser language;
4. otherwise English.

**The "EN" button is always in sight** next to the language switcher — one tap and the interface is
in English, even if the user cannot read the current language and cannot find the right menu entry.
The button hides itself once English is active.

As soon as a language is chosen by hand it is pinned: changing the city no longer overrides it.
Until then, the language follows the country automatically.

Weekday names and the decimal separator come from `Intl` for the selected language — "Sat" and
`18.4` in English, "сб" and `18,4` in Russian. They need no separate translation.

### Units

| Quantity | Options |
|---|---|
| Temperature | °C · °F |
| Wind | km/h · m/s · mph · knots |
| Precipitation | mm · inches |

Units also follow the country: the US gets °F, mph, inches; the UK gets °C but mph; Russia, the
Baltics, Scandinavia, China and Japan get m/s for wind; everyone else km/h. A manual choice is
pinned and survives a change of location.

Conversion happens **on the client**: the API is always queried in °C, km/h and mm, and converting
to other units is plain arithmetic over data already in memory. Switching is therefore instant and
costs no network request. Precision is not invented along the way: inches show two decimals,
everything else one.

### What is stored on the device

All via `localStorage`, keys prefixed `wf-`:

| Key | Contents |
|---|---|
| `wf-lang` | chosen language (only when picked by hand) |
| `wf-units` | units (only when picked by hand) |
| `wf-theme` | `auto`, `light` or `dark` |
| `wf-place` | last location |
| `wf-install-shows` | how many times the install banner has appeared (up to 5) |
| `wf-install-off` | banner dismissed with the × — never show again |
| `wf-installed` | app already added to the home screen |

Verified: after a page reload every setting is restored and nothing resets. The banner counter was
checked step by step — on the fifth load it reads "5 of 5", on the sixth the banner is gone and the
counter stops growing.

---

## Choosing a location

1. **Automatic detection on first open.** The app quietly asks for browser geolocation, turns the
   coordinates into a city name via reverse geocoding, and fills it in. If access is denied or the
   context is insecure, it quietly stays on the default city — no nagging messages.
2. **Correct it by hand.** Tapping the city name opens a panel: a button to detect again, search by
   name, and quick presets.
3. **The choice is remembered** in `localStorage` and restored on the next visit — geolocation is
   not requested again.

What goes where: coordinates are sent to Open-Meteo (for the weather) and to BigDataCloud (for the
city name). Both requests go straight from the browser; the app has no server of its own and logs
nothing.

---

## How the data works

### Source

[Open-Meteo **Previous Model Runs API**](https://open-meteo.com/en/docs/previous-runs-api):

```
https://previous-runs-api.open-meteo.com/v1/forecast
```

The key capability is variables like `temperature_2m_previous_day3`: the value for the **very same
hour**, but taken from the update issued 3 days ago.

Plus two keyless helper services: [geocoding-api.open-meteo.com](https://open-meteo.com/en/docs/geocoding-api)
for city search by name, and [BigDataCloud](https://www.bigdatacloud.com/) for reverse geocoding.

### One request for everything

Changing location fires **exactly one** request: 4 metrics × 8 updates × 10 days × 24 hours. That
is about **40 KB** — once loaded, switching dates and opening hours happens instantly from memory
with no network calls (measured: a date switch takes ≈ 140 ms).

### Where the numbers come from and how to check them

Everything the app shows arrives in a single GET request. Here it is in full for Riga — paste it
into a browser address bar and you will see the raw JSON:

```
https://previous-runs-api.open-meteo.com/v1/forecast?latitude=56.9460&longitude=24.1059&hourly=temperature_2m,temperature_2m_previous_day1,temperature_2m_previous_day3,wind_speed_10m,wind_speed_10m_previous_day3&timezone=auto&past_days=2&forecast_days=8&wind_speed_unit=kmh
```

How to verify: find the timestamp you want in the `hourly.time` array (say `2026-08-01T09:00`), note
its index, and read the value at the same index from `hourly.temperature_2m` — that is the "now"
update. Values in `..._previous_day1…7` are the same hours from updates issued 1–7 days ago. The
minimum and maximum of those eight numbers are what the app prints in the hour row.

#### Two time axes — easy to confuse

The data has two independent time dimensions, and their steps differ:

| | **Which hour the forecast is for** (valid time) | **When the forecast was issued** (run time) |
|---|---|---|
| Step | **1 hour** | **24 hours** |
| Number of points | 240 (10 days) | 8 (current + 7 previous) |
| Where from | elements of the `hourly.time` array | the `previous_day1…7` variables |
| Where visible in the UI | rows of the hour list | points on the chart inside an opened row |

**Hourly resolution is never lost:** every hour of the day is its own row, with no grouping by day.
Only the second axis — archive depth — is daily.

And that is a limit of the API itself, not rounding in the app: the endpoint rejects the names
`previous_hour1` and `previous_run1` with an error and accepts only `previous_dayN`; it accepts the
name `previous_day8` but returns empty values. Models physically run 2–4 times a day, so
intermediate updates exist between adjacent daily slices — this endpoint does not expose them.

#### Other parameters

| Parameter | Value | How it was confirmed |
|---|---|---|
| Model | `best_match` — Open-Meteo picks the best one per location | for Riga it matches `metno_seamless`; elsewhere it will differ |
| Temperature precision | 0.1 °C | maximum decimals in the response |
| Wind precision | 0.1 km/h | same |
| Precipitation precision | 0.1 mm | same |
| Cloud cover precision | whole percent | the response contains integers only |

The app never adds digits beyond what the API returned: cloud cover prints as integers,
precipitation with one decimal. There is no smoothing, interpolation or derivation anywhere — only
picking the minimum, the maximum, and the difference between the outermost updates.

### How much these numbers can be trusted

Three caveats worth keeping in mind.

**This is model output, not measurement.** No weather stations are involved. A forecast for hours
already past is still a forecast, not a fact; you cannot use this app to compare it against what
actually happened.

**Different models disagree at least as much as different updates do.** For Riga at the same hour,
01.08 12:00, the models gave: ICON-EU 20.3 °C, UKMO 22.0 °C, KNMI HARMONIE 22.6 °C,
DMI HARMONIE 22.8 °C, ECMWF IFS 21.4 °C, MET Norway 23.6 °C. A 3.3 °C spread — comparable to what
the app measures between updates. In other words, the choice of model affects the result about as
much as a forecast update does.

The app uses `best_match` (Open-Meteo's default). Which model sits behind it is not stated in the
API response — it can only be identified by comparing against explicit models. If you need a fixed
model, add `&models=ecmwf_ifs025` (or another) to the request in `buildUrl()` inside `app.js`.

**The value belongs to a grid cell, not to a point.** The archive API answers on a 0.25° grid: a
request for 56.946, 24.106 returns cell 57.00, 24.00 — roughly 6 km away. The `elevation` field
shows the altitude the calculation is tied to; if it differs sharply from the real altitude of your
point, the temperature will be biased. In mountainous terrain the discrepancy is most noticeable.

### Archive limit

**Real archived updates are available for 1–7 days.** Open-Meteo keeps previous updates no deeper
than that, so a depth of 8 updates (current + 7) is the ceiling of the source, not of the app.

### Guard against false confidence

There is a non-obvious trap. When an old update could not physically cover the target hour (the
event is far in the future and a week-old update did not reach that far), the API returns not `null`
but **the values of the current update**. A naive implementation would compare the forecast with
itself, see zero spread, and display perfect stability where there is nothing to compare.

The app catches this: if every update matches to the last digit across all metrics, opening the hour
shows a plain warning instead of a false "all stable". Four independent updates practically never
agree to 0.1 °C simultaneously across temperature, cloud cover, precipitation and wind, so there are
no false positives on real data.

The practical takeaway: **for a date more than ~7–10 days out it is too early to look at the
dynamics** — come back in a few days, once independent updates have accumulated.

---

## Design and accessibility

* Mobile-first; from 660 px the layout centres itself and does not stretch further.
* Light and dark themes; the switch remembers the choice and defaults to the system setting.
* Line colours (orange / blue / green / violet) were validated for colour-blind distinguishability
  and for contrast against the background in both themes.
* Colour is never the only carrier of meaning: every chart has a caption, and the arrows differ in
  glyph shape, not just in colour.
* Sticky header and date strip; `env(safe-area-inset-*)` safe zones for display cutouts.
* The search field is 15 px, so iOS does not zoom the page on focus.
* `prefers-reduced-motion` is respected; print and `forced-colors` styles are included.
* No horizontal page scroll at any width; the date and metric strips scroll inside themselves.
  Verified for right-to-left too: Arabic does not stretch the document sideways.
* Arabic sets `dir="rtl"` and mirrors the whole interface. Charts stay left-to-right — a time axis
  reads that way in every language.

---

## Known limitations

* The update archive covers 7 days (a limit of the source).
* 16 languages, not "all". Each added language is another object of ~60 lines in `T` inside
  `app.js` plus an entry in `LANG_NAMES`; the mechanism is ready, but machine-translating into a
  hundred languages without review would produce text whose quality nobody could vouch for. City
  names, meanwhile, arrive in the chosen language from the Open-Meteo geocoder and need no
  translation.
* The forecast comes from Open-Meteo's multi-model `best_match`; there is no picker for a specific
  model (ICON, GFS, ECMWF).
* Data is not cached between reloads — every visit makes a fresh request.
* Reverse geocoding depends on a third-party service; if it is unavailable the location shows as
  coordinates, while the weather keeps working normally.

---

## Data and licence

Weather from [Open-Meteo](https://open-meteo.com/), **CC BY 4.0**, free and keyless for
non-commercial use.
