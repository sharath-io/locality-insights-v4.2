import re

with open('src/components/BrochureDialog.tsx', 'r') as f:
    content = f.read()

# For instagram-square, whatsapp, facebook, instagram-portrait, etc.
# There is a check: `mapImageUrls.length > 0 ? (`
# Let's just find the img tags and replace them with <CarouselMapDisplay mapImageUrls={mapImageUrls} agentPhoto={agentPhoto} activeSlide={activeSlide} />
# But we might need to change the condition to handle the empty state correctly if we replace the whole block.
# Actually, since I replaced `mapImageUrl ?` with `mapImageUrls.length > 0 ?`, the blocks look like:
# {mapImageUrls.length > 0 ? (
#   <img src={mapImageUrls[0]} crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
# ) : (

# And for instagram-square it has `objectFit: "contain"`.

def replace_img(match):
    block = match.group(0)
    # determine object fit
    fit = "cover"
    if "contain" in block:
        fit = "contain"
    return f'<CarouselMapDisplay mapImageUrls={{mapImageUrls}} agentPhoto={{agentPhoto}} activeSlide={{activeSlide}} objectFit="{fit}" />'

# Find all <img> tags that use mapImageUrls[0]
content = re.sub(r'<img[^>]*src={mapImageUrls\[0\]}[^>]*/>', replace_img, content)

with open('src/components/BrochureDialog.tsx', 'w') as f:
    f.write(content)
