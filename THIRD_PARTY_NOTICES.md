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

ภาพประกอบท่าออกกำลังกายสร้างด้วย AI (OpenAI image generation ผ่าน Codex)
Exercise illustrations are AI-generated using OpenAI image generation through Codex. Approved pairs record their tool and creation date in `app/data/illustrations.json`. This notice does not assign an open-source licence to generated artwork. See `docs/ROUND9_VALIDATION.md` for the generated and approved inventory.

The owner-only conversion script uses sharp (Apache-2.0), installed under `scripts/`; it is not shipped in the static app. Package licence notices are distributed with its npm package and transitive dependencies.

## Round 10 browser dependencies

- Zod v4 (bundled from zod 3.25.76), MIT, Copyright (c) 2025 Colin McDonnell. License: `app/js/vendor/ZOD_LICENSE.txt`. Shared structured-output validation uses this same bundle in the browser and Worker.
- qrcode-generator 1.4.4, MIT, Copyright (c) 2009 Kazuhiko Arase. License: `app/js/vendor/QRCODE_LICENSE.txt`. The existing PromptPay QR renderer is now vendored for offline use. Source: https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js

## Round 14 exercise sources

[Exercise data by RepDB (repdb.co)](https://repdb.co/). Runtime-only free-tier data, pinned to `b407c5951a027a27817fb2a5cee9ec9feffc4dc7`, schema 3. [Licence](https://github.com/RepDB/exercise-dataset/blob/b407c5951a027a27817fb2a5cee9ec9feffc4dc7/LICENSE-DATA.md). No RepDB dataset or standalone artwork is vendored in this repository; only original mappings, Thai names and aliases. RepDB images are never used as generative inputs. Premium samples are excluded. Browser runtime caching supports offline use after first library load.

ภาพ 3D ของท่าหลักสร้างด้วย AI (OpenAI image generation ผ่าน Codex). Original text-only prompts; no external image references. Theme settings offer 3D / Illustration / Animation. Approved 3D pairs fall back to existing illustrations and animated figures. See `docs/ROUND14_VALIDATION.md` and `docs/round14-screens/ex3d.html` for reviewed coverage.

## Round 15 animated 3D

- **3D character and motion: mesh2motion (CC0)**. The two public `motions/cc0/mesh2motion/human-{base,addon}-animations.glb` files in AssiamahS/opengym3d at `ea3a60130fdcfb3c4771e44d09f84ebab4ee9bae`. Only Walk, Jog, Sprint, Pushup and Jumping Jacks are retained. See `licenses/mesh2motion-CC0.txt` and `app/3d/SOURCES.json`.
- **3D keyframes adapted from opengym3d (MIT)**. Copyright (c) 2026 SylvesterAssiamahGK. Twelve keyframes-only exercise specs, with the complete MIT notice in `licenses/opengym3d-MIT.txt`. Adaptations include dumbbell-row elbow limits, bridge arm placement and a supinated curl grip. The remaining 23 keyframe files are original Fixmee work derived from `app/js/exercises.js`. No Mixamo clip, FBX or private motion repository is used.
- **three.js 0.180.0 (MIT)**, including GLTFLoader, OrbitControls and BufferGeometryUtils. Complete notice: `app/js/vendor/three/LICENSE-three.txt`.
- **meshoptimizer 0.24.0 (MIT)**, including the vendored matching meshopt decoder. Complete notice: `app/js/vendor/three/LICENSE-meshoptimizer.txt`.
- **glTF Transform 4.2.1 (MIT)** is a development dependency for the reproducible asset build, not vendored runtime code. Its licence is distributed with the npm packages.

## fflate 0.8.2 (MIT)

Browser-only streaming Apple Health ZIP import. Vendored from the already installed three.js distribution (`examples/jsm/libs/fflate.module.js`).

Copyright (c) 2020 Arjun Barrett

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
