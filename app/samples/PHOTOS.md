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
Sana text-to-image model). Each photo was requested once, one request at a time, in this form:

```
image.pollinations.ai/prompt/<url-encoded prompt>?width=1024&height=1280&seed=<seed>&nologo=true
```

The service returned 686 × 858 JPEGs. Each was then cropped by cutting the bottom 8% (which removes the service's
small corner mark) and re-encoded without metadata:

```
ffmpeg -i in.jpg -vf "crop=iw:ih*0.92:0:0" -q:v 3 -map_metadata -1 cast/<role>.jpg
```

so the files in `cast/` are 686 × 789 and 38–53 KB each. All six first results had clear, whole, well-lit faces with no
text or logo, so no seed was re-rolled.

| File | Name tag | Seed | Prompt |
| --- | --- | --- | --- |
| `cast/boss.jpg` | The Boss | 7101 | photorealistic portrait photo of a fictional sharp older man in his sixties with slicked silver hair and a trimmed grey beard, cream linen suit and open-collar black shirt, standing on a rooftop at dusk with blurred city lights behind him, warm golden rim light, head and shoulders, face clearly visible and well lit, cinematic crime drama still, 85mm lens, no text |
| `cast/rider.jpg` | The Rider | 7303 | photorealistic portrait photo of a fictional muscular man in his thirties with a shaved head and a short black beard, white tank top, palm trees and a pink sunset sky behind him, waist-up, face clearly visible and well lit, cinematic crime drama still, no text |
| `cast/mechanic.jpg` | The Mechanic | 7404 | photorealistic portrait photo of a fictional woman mechanic in her forties with short curly red hair and a grease-smudged denim work shirt, standing in a garage lit by pink and blue neon tubes, head and shoulders, face clearly visible and well lit, cinematic crime drama still, no text |
| `cast/lookout.jpg` | The Lookout | 7505 | photorealistic portrait photo of a fictional young man in his twenties with curly hair and a loose linen shirt holding binoculars at his chest, on a beach at sunset, orange light on his face, waist-up, face clearly visible, cinematic crime drama still, no text |
| `cast/courier.jpg` | The Courier | 7606 | photorealistic portrait photo of a fictional young woman in her twenties with long box braids in a colorful floral short-sleeve shirt, on a neon-lit city street at night, magenta and cyan light on her face, head and shoulders, face clearly visible, cinematic crime drama still, no text |
| `cast/fixer.jpg` | The Fixer | 7707 | photorealistic portrait photo of a fictional woman in her thirties with sleek black hair pulled back and gold hoop earrings, red blazer over a black top, standing at a marina at golden hour with blurred boats behind her, warm sunlight on her face, head and shoulders, confident look, face clearly visible and well lit, cinematic crime drama still, no text |

The model did not follow every detail of the prompts (for example, the Fixer's blazer came out brown and the Rider
kept his hair); the photos were kept as generated.
