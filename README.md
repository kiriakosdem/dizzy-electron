# Dizzy Electron

A static Greek learning website with interactive physics simulations. Pages use plain HTML, CSS and JavaScript; there is no build or dependency installation step.

## Preview locally

From the repository root, with Python 3 installed:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765/>. Stop the server with Ctrl+C. Some pages load fonts, maths rendering or libraries from external CDNs, so a full preview needs an internet connection.

## Where files belong

| Location | Purpose |
| --- | --- |
| `index.html` | Homepage and featured available lessons |
| `contents/index.html` | Catalogue of available and coming-soon lessons |
| `lessons/physics/` | Lesson text, activities, navigation and simulation embeds |
| `simulations/<topic>/index.html` | Standalone interactive simulation |
| `simulations/<topic>/tests/` | Tests and retained validation reports for that simulation |
| `assets/css/common.css` | Shared typography, navigation and footer styles |
| `assets/css/cards.css` | All lesson card layout, icons, flip and coming-soon styles |
| `assets/css/home.css`, `contents.css`, `lesson.css` | Page-specific styles |
| `assets/css/simulation-lesson.css` | Lesson iframe, fullscreen and accessibility styles |
| `assets/css/main-page.css` | Retained legacy stylesheet; currently unused |
| `assets/js/` | Shared site behaviour |
| `assets/icons/` | Topic SVGs for lesson cards |
| `assets/brand/logo.png` | Approved logo; CSS makes it white on dark backgrounds |
| `assets/images/` | Site photographs and illustrations, including retained older assets |
| `assets/vendor/` | Bundled third-party libraries and their source maps |
| `resources/geogebra/` | GeoGebra project files |
| `examples/example-lesson.html` | Original lesson example for reference |
| `design/logo-explorations/` | Earlier logo candidates and generation prompts |
| `scripts/check-links.py` | Local file and fragment link checks |

The `bouncing-balls` and `falling-blocks` simulation folders contain legacy JavaScript sketches rather than standalone pages. The example lesson uses the bouncing-balls sketch.

## Editing conventions

- Use lowercase filenames with hyphens for authored files. Preserve third-party distribution filenames.
- Add subject folders under `lessons/` when their first lesson is ready.
- Keep a simulation's code, documentation and tests together. Lesson pages embed its `index.html`.
- Load `common.css` and `cards.css` before lesson-specific styles. Keep all card spacing changes in `cards.css`.
- Use relative paths so the site works both at a domain root and under a hosting subdirectory. Paths in CSS resolve relative to the stylesheet, while iframe paths resolve relative to the lesson page.
- Keep the homepage, catalogue and related cards in sync when changing a lesson's title, description, icon or availability. They remain plain HTML; shared templates and a central catalogue would be a separate build-system change.
- Keep design experiments separate from the assets referenced by live pages. Do not edit bundled vendor code for site styling.

## Checks

Check all local HTML/CSS file references and HTML fragment targets, without accessing external websites:

```sh
python3 scripts/check-links.py
```

Run the simulation suites with Node.js 18 or later (no npm packages required):

```sh
node --test simulations/*/tests/*.test.cjs
```

Retained JSON validation reports describe earlier checks; running the suites does not regenerate them. After a layout or path change, also preview the homepage, catalogue, lesson embeds and mobile layout in a browser.

## Page locations

Use `index.html` for the homepage, `contents/index.html` for the catalogue, `lessons/physics/` for lessons and `simulations/<topic>/index.html` for standalone labs. The original example is in `examples/example-lesson.html`.

All navigation and embeds use these locations directly. Legacy root HTML pages and the old animation URLs have been removed; old bookmarks should be updated to the new paths. Only the homepage HTML remains in the repository root.

The project retains `_config.yml` for its existing hosting setup. No hosting or deployment settings were changed.
