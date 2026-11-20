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
Sana text-to-image model). Each image was requested once, one request at a time, in this form:

```
image.pollinations.ai/prompt/<url-encoded prompt>?width=1024&height=1280&seed=<seed>&nologo=true
```

The service returns 686 × 858 JPEGs. Each kept image was cropped by cutting the bottom 8% (which removes the
service's small corner mark) and re-encoded without metadata:

```
ffmpeg -i in.jpg -vf "crop=iw:ih*0.92:0:0" -q:v 3 -map_metadata -1 cast/<role>.jpg
```

so the files in `cast/` are 686 × 789 and 40–56 KB each.

### How the cast was chosen (v4)

For v4, two new candidates were requested for each role with "candid 35mm film photograph" prompts that ask for
natural skin texture and sharp eyes. For each role the single image that looked most like a real photograph
(natural skin, believable eyes, sharp and well-lit face, no painterly look, no text or logo) was kept; where both new
candidates were worse than the v3 file, the v3 file stayed. Results:

- **Boss, Rider, Mechanic, Lookout**: replaced by a new candidate (seeds 8101, 8302, 8402, 8502).
- **Courier**: kept the v3 file (seed 7606). Candidate 8602 had lettering on the shirt; 8601 looked doll-like.
- **Fixer**: kept the v3 file (seed 7707). Both new candidates (8701, 8702) came out airbrushed and painterly.

### Files in `cast/`

| File | Name tag | Seed | Prompt |
| --- | --- | --- | --- |
| `cast/boss.jpg` | The Boss | 8101 | candid 35mm film photograph, head and shoulders portrait of a fictional man in his sixties with slicked silver hair and a trimmed grey beard, cream linen suit, open-collar black shirt, on a rooftop at dusk, blurred warm city lights behind him, natural skin texture with pores and wrinkles, sharp focus on the eyes, golden rim light, shot on Kodak Portra 400, cinematic crime drama still, no text |
| `cast/rider.jpg` | The Rider | 8302 | candid 35mm film photograph, waist-up portrait of a fictional muscular man in his thirties with a shaved head and a short black beard, white tank top, palm trees and a pink sunset sky behind him, natural skin texture, sharp focus on the eyes, warm golden light on his face, shot on Kodak Portra 400, cinematic crime drama still, no text |
| `cast/mechanic.jpg` | The Mechanic | 8402 | candid 35mm film photograph, head and shoulders portrait of a fictional woman mechanic in her forties with short curly red hair and freckles, grease-smudged denim work shirt, in a garage lit by pink and blue neon tubes, natural skin texture with pores, sharp focus on the eyes, realistic proportions, shot on Kodak Portra 800, cinematic crime drama still, no text |
| `cast/lookout.jpg` | The Lookout | 8502 | candid 35mm film photograph, waist-up portrait of a fictional man in his late twenties with short curly dark hair and light stubble, loose white linen shirt, binoculars hanging at his chest, on a beach at sunset, warm orange light on his face, natural skin texture, sharp focus on the eyes, realistic adult proportions, shot on Kodak Portra 400, cinematic crime drama still, no text |
| `cast/courier.jpg` | The Courier | 7606 | photorealistic portrait photo of a fictional young woman in her twenties with long box braids in a colorful floral short-sleeve shirt, on a neon-lit city street at night, magenta and cyan light on her face, head and shoulders, face clearly visible, cinematic crime drama still, no text |
| `cast/fixer.jpg` | The Fixer | 7707 | photorealistic portrait photo of a fictional woman in her thirties with sleek black hair pulled back and gold hoop earrings, red blazer over a black top, standing at a marina at golden hour with blurred boats behind her, warm sunlight on her face, head and shoulders, confident look, face clearly visible and well lit, cinematic crime drama still, no text |

The model did not follow every detail of the prompts (for example, the Boss wears a grey suit and white shirt, the
Mechanic's garage has no neon, the Lookout has no binoculars and the Fixer's blazer came out brown); the photos were
kept as generated.
