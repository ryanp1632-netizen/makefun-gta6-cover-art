# Sample photos

Golden Mile Cover Studio's **Try samples** button loads these eight photos, all bundled here so the app works
offline. **None of them shows a real person**: every face was invented by an image model.

## Kit photos

| File | How it was made | Name tag |
| --- | --- | --- |
| `boulevard.jpg` | Made with an image model for make.fun and shipped with the bounty's starter kit; free to use. Unchanged. | The Driver |
| `pier.jpg` | Made with an image model for make.fun and shipped with the bounty's starter kit; free to use. Unchanged. | The Angler |

## Demo cast (`cast/`)

Six fictional characters made with the free Pollinations image API (no key, no account), one request at a time,
each as `image.pollinations.ai/prompt/<url-encoded prompt>?width=1024&height=1280&seed=<seed>&nologo=true`.
The service used its default model; the JPEGs it returned name it `sana` in their EXIF data, and arrived at
686 x 858 pixels. Each image was checked by eye (face whole, sharp enough, no text or logo). The bottom 8% of every
image was cropped off to remove the service's small corner mark (`ffmpeg -vf "crop=iw:ih*0.92:0:0" -q:v 3`), which
leaves 686 x 789 pixels, metadata stripped. One earlier result (a driver in glasses who looked too much like the
kit's driver) was discarded and replaced by the fixer below.

| File | Seed | Prompt | Name tag |
| --- | --- | --- | --- |
| `cast/boss.jpg` | 7101 | photorealistic portrait photo of a fictional sharp older man in his sixties with slicked silver hair and a trimmed grey beard, cream linen suit and open-collar black shirt, standing on a rooftop at dusk with blurred city lights behind him, warm golden rim light, head and shoulders, face clearly visible and well lit, cinematic crime drama still, 85mm lens, no text | The Boss |
| `cast/rider.jpg` | 7303 | photorealistic portrait photo of a fictional muscular man in his thirties with a shaved head and a short black beard, white tank top, palm trees and a pink sunset sky behind him, waist-up, face clearly visible and well lit, cinematic crime drama still, no text | The Rider |
| `cast/mechanic.jpg` | 7404 | photorealistic portrait photo of a fictional woman mechanic in her forties with short curly red hair and a grease-smudged denim work shirt, standing in a garage lit by pink and blue neon tubes, head and shoulders, face clearly visible and well lit, cinematic crime drama still, no text | The Mechanic |
| `cast/lookout.jpg` | 7505 | photorealistic portrait photo of a fictional young man in his twenties with curly hair and a loose linen shirt holding binoculars at his chest, on a beach at sunset, orange light on his face, waist-up, face clearly visible, cinematic crime drama still, no text | The Lookout |
| `cast/courier.jpg` | 7606 | photorealistic portrait photo of a fictional young woman in her twenties with long box braids in a colorful floral short-sleeve shirt, on a neon-lit city street at night, magenta and cyan light on her face, head and shoulders, face clearly visible, cinematic crime drama still, no text | The Courier |
| `cast/fixer.jpg` | 7707 | photorealistic portrait photo of a fictional woman in her thirties with sleek black hair pulled back and gold hoop earrings, red blazer over a black top, standing at a marina at golden hour with blurred boats behind her, warm sunlight on her face, head and shoulders, confident look, face clearly visible and well lit, cinematic crime drama still, no text | The Fixer |

The model did not follow every detail (the rider kept his hair, the lookout's binoculars are out of frame, the
fixer's blazer came out brown); the images were kept because the faces are whole, well lit and clearly different
people. The prompts name no real person, character, brand, logo, game or weapon.
