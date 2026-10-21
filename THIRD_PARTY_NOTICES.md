# Third-party notices

## Free Exercise DB — Unlicense

Source: https://github.com/yuhonas/free-exercise-db
Pinned commit: `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`.
Used: exercise metadata, English instructions and remotely loaded photos. Adapted muscle IDs and original Thai names/cues are recorded by the import script. Complete licence: [licenses/free-exercise-db.txt](licenses/free-exercise-db.txt).

## Lyftr — MIT

Source: https://github.com/Cawlumm/lyftr
Used as an idea credit for free workout logging and personal records. No source code copied. The MIT copyright and permission notice is retained verbatim in [licenses/lyftr-MIT.txt](licenses/lyftr-MIT.txt).

## Open Food Facts — ODbL 1.0

Source: https://world.openfoodfacts.org/ — https://opendatacommons.org/licenses/odbl/1-0/
The existing barcode lookup retrieves database facts. Attribution displayed with these data: “ข้อมูลจาก Open Food Facts (ODbL)”. Local saved facts retain provenance. No new OFF image redistribution is introduced in this round.

## MediaPipe — Apache-2.0

Source: https://github.com/google-ai-edge/mediapipe
Used by the existing on-device form-check feature. Complete licence: [licenses/mediapipe-Apache-2.0.txt](licenses/mediapipe-Apache-2.0.txt). No MediaPipe source was copied or modified in this round.

## Original work and excluded sources

The muscle SVG, recovery model, calculator implementations, PR code, Thai recipe data, Thai exercise translations and UI are original work for Fixmee. No Anatome SVG/code was used. No code, data or images were copied from wger, openGym, Granite, PoseFit, waistline, gerardtorres/muscle-map, Sasha-s-Body-Map, exercises-dataset, Mealie or Tandoor. Recipe/meal-prep concepts are generic; no external recipe collection was imported. Other permitted projects were not reused.

This round does not replace licences of pre-existing package dependencies; their notices remain in their distributions.

## Round 9 exercise artwork and optional AI illustrations

The animated muscle-belly paths and front/back muscle-map contours are original Fixmee drawings. No commercial anatomy illustration or third-party SVG was copied for this round.

ภาพประกอบบางท่าสร้างด้วย AI (kie.ai, model ตามข้อมูลของแต่ละภาพที่อนุมัติ)
Some exercise illustrations may be AI-generated with kie.ai. The exact model and creation date are recorded per approved pair in `app/data/illustrations.json`; the model is also displayed beside the images in the exercise sheet. The initial manifest is empty. No AI images were generated in Round 9. Provider output rights and owner-supplied reference rights must be checked by the owner before publication; this notice does not assert a third-party open-source licence for generated images.

The owner-only conversion script uses sharp (Apache-2.0), installed under `scripts/`; it is not shipped in the static app. Package licence notices are distributed with its npm package and transitive dependencies.
