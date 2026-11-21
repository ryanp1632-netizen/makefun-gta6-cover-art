# Sample photos

The "Try samples" button loads an 8-person demo cast. **Every sample photo shows a fictional person made by an image
model; none of them is a photo of a real person.** They are here only so the studio can be tried without your own
photos. Your own photos are read locally in the browser and never uploaded.

## Kit photos (from the make.fun bounty kit, unchanged)

| File | Name tag | What it shows | How it was made |
| --- | --- | --- | --- |
| `boulevard.jpg` | The Driver | A woman in sunglasses leaning on a red convertible on a palm boulevard at sunset | Made with an image model for make.fun; free to use |
| `pier.jpg` | The Captain | A smiling grey-bearded man in a bucket hat fishing from a pier over turquoise sea | Made with an image model for make.fun; free to use |

## Demo cast (`cast/`)

Made with the free Pollinations image API (no key, no account), whose EXIF data names the model as **sana** (the
Sana text-to-image model). Requests went one at a time, at least 50 seconds apart (a request that got a temporary
error reply was retried once after a minute), in this form:

```
image.pollinations.ai/prompt/<url-encoded prompt>?width=1024&height=1280&seed=<seed>&nologo=true
```

The service returns 686 × 858 JPEGs. Each kept image was cropped by cutting the bottom 8% (which removes the
service's small corner mark) and re-encoded without metadata:

```
ffmpeg -i in.jpg -vf "crop=iw:ih*0.92:0:0" -q:v 3 -map_metadata -1 cast/<role>.jpg
```

so the files in `cast/` are 686 × 789 and 40–57 KB each.

### How the cast was chosen

For each re-shot role, two new candidates were requested and looked at side by side with the file already in
`cast/`. The single image that looked most like a real photograph (natural skin texture, believable eyes, sharp and
well-lit face, no painterly or plastic look, no text or logo, face whole) was kept; where both new candidates were
worse, the existing file stayed.

v4 (prompts "candid 35mm film photograph ..."):

- **Boss, Rider, Mechanic, Lookout**: replaced by a new candidate (seeds 8101, 8302, 8402, 8502).
- **Courier**: kept the v3 file (seed 7606). Candidate 8602 had lettering on the shirt; 8601 looked doll-like.
- **Fixer**: kept the v3 file (seed 7707). Both new candidates (8701, 8702) came out airbrushed and painterly.

v5 (prompts "candid 35mm film still ... unretouched"; the Fixer moved to a neon-lit street at night so the poster
gets one cool neon-night panel among the golden-hour ones):

- **Fixer**: replaced by seed 9702 (sharp eyes, freckles and moles, magenta and cyan city bokeh). Seed 9701 was soft
  and painterly, with the face turned away.
- **Lookout**: replaced by seed 9501 (natural side light, visible skin texture). Seed 9502 showed a small, soft face.
- **Rider**: kept the v4 file (seed 8302). Seed 9301 looked plastic and computer-generated (and has hair rather
  than a shaved head); seed 9302 had a distorted eye area and a painterly face.

### Files in `cast/`

| File | Name tag | Seed | Prompt |
| --- | --- | --- | --- |
| `cast/boss.jpg` | The Boss | 8101 | candid 35mm film photograph, head and shoulders portrait of a fictional man in his sixties with slicked silver hair and a trimmed grey beard, cream linen suit, open-collar black shirt, on a rooftop at dusk, blurred warm city lights behind him, natural skin texture with pores and wrinkles, sharp focus on the eyes, golden rim light, shot on Kodak Portra 400, cinematic crime drama still, no text |
| `cast/rider.jpg` | The Rider | 8302 | candid 35mm film photograph, waist-up portrait of a fictional muscular man in his thirties with a shaved head and a short black beard, white tank top, palm trees and a pink sunset sky behind him, natural skin texture, sharp focus on the eyes, warm golden light on his face, shot on Kodak Portra 400, cinematic crime drama still, no text |
| `cast/mechanic.jpg` | The Mechanic | 8402 | candid 35mm film photograph, head and shoulders portrait of a fictional woman mechanic in her forties with short curly red hair and freckles, grease-smudged denim work shirt, in a garage lit by pink and blue neon tubes, natural skin texture with pores, sharp focus on the eyes, realistic proportions, shot on Kodak Portra 800, cinematic crime drama still, no text |
| `cast/lookout.jpg` | The Lookout | 9501 | candid 35mm film still, waist-up portrait of a fictional man around thirty with short curly dark hair and a few days of stubble, loose white linen shirt half unbuttoned, binoculars hanging at his chest, on a beach boardwalk at sunset, warm orange side light on his face, natural weathered skin texture with visible pores, slight film grain, sharp focus on the eyes, realistic adult proportions, shot on Kodak Portra 400, unretouched, cinematic crime drama, no text |
| `cast/courier.jpg` | The Courier | 7606 | photorealistic portrait photo of a fictional young woman in her twenties with long box braids in a colorful floral short-sleeve shirt, on a neon-lit city street at night, magenta and cyan light on her face, head and shoulders, face clearly visible, cinematic crime drama still, no text |
| `cast/fixer.jpg` | The Fixer | 9702 | candid 35mm film still, head and shoulders portrait of a fictional woman in her thirties with sleek black hair pulled back and small gold hoop earrings, red blazer over a black top, standing on a city street at night, magenta and cyan neon signs blurred behind her, neon light on one side of her face, natural skin texture with visible pores and faint freckles, slight film grain, sharp focus on the eyes, shot on Cinestill 800T, unretouched, cinematic crime drama, no text |

The model did not follow every detail of the prompts (for example, the Boss wears a grey suit and white shirt, the
Mechanic's garage has no neon, the Lookout has no binoculars, and the Fixer wears her hair down and an off-shoulder
black top instead of a red blazer); the photos were kept as generated.
