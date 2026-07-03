import re

with open('src/components/BrochureDialog.tsx', 'r') as f:
    content = f.read()

# Replace mapImageUrl ? with mapImageUrls.length > 0 ?
content = content.replace('mapImageUrl ?', 'mapImageUrls.length > 0 ?')

# Replace all mapImageUrl with mapImageUrls[0] (except where it says mapImageUrls)
content = re.sub(r'\bmapImageUrl\b(?!s)', 'mapImageUrls[0]', content)

# But wait, we need to implement the Carousel in instagram-square, instagram-portrait, and whatsapp.
# The common map rendering looks like:
# <img src={mapImageUrls[0]} crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
# or objectFit: "contain"

# Let's create a Carousel component string to replace the img tags for those templates.
# Actually, since the carousel has dots and labels, we can define a helper at the top or just replace it inline.
# Since it's inline in 3 places, it's easier to create a helper function.
helper = """
function CarouselMapDisplay({ mapImageUrls, agentPhoto, activeSlide, objectFit = "cover" }: { mapImageUrls: string[], agentPhoto: string, activeSlide: number, objectFit?: "cover" | "contain" }) {
  if (mapImageUrls.length === 0) return null;
  const isCarousel = mapImageUrls.length > 1;

  return (
    <>
      <div style={{
        display: "flex", width: isCarousel ? "200%" : "100%", height: "100%",
        transform: isCarousel ? `translateX(-${activeSlide * 50}%)` : "none",
        transition: "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)"
      }}>
        {/* Slide 1: POI Map */}
        <div style={{ width: isCarousel ? "50%" : "100%", height: "100%", position: "relative" }}>
          <img src={mapImageUrls[0]} crossOrigin={agentPhoto.startsWith("data:") ? undefined : "anonymous"} style={{ width: "100%", height: "100%", objectFit, objectPosition: "top", display: "block" }} />
          {isCarousel && (
            <div style={{ position: "absolute", bottom: 44, left: 24, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(4px)", padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#1a1814", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
              📍 Locality View <span style={{ opacity: 0.4 }}>→</span> 🛣️ Highway Access
            </div>
          )}
        </div>
        {/* Slide 2: Highway Map */}
        {isCarousel && (
          <div style={{ width: "50%", height: "100%", position: "relative" }}>
            <img src={mapImageUrls[1]} crossOrigin={agentPhoto.startsWith("data:") ? undefined : "anonymous"} style={{ width: "100%", height: "100%", objectFit, objectPosition: "top", display: "block" }} />
            <div style={{ position: "absolute", bottom: 44, left: 24, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(4px)", padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#1a1814", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
              🛣️ Highway Access <span style={{ opacity: 0.4 }}>←</span> 📍 Locality View
            </div>
          </div>
        )}
      </div>

      {/* Dot Indicators */}
      {isCarousel && (
        <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6, zIndex: 20 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: activeSlide === 0 ? "#1a1814" : "rgba(26,24,20,0.25)" }} />
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: activeSlide === 1 ? "#1a1814" : "rgba(26,24,20,0.25)" }} />
        </div>
      )}
    </>
  );
}
"""

# Insert helper after the `Spinner` definition
content = content.replace('// ── Template thumbnail ────────────────────────────────────────────────────────', helper + '\n\n// ── Template thumbnail ────────────────────────────────────────────────────────')

# WhatsApp map replace:
# <img src={mapImageUrls[0]}crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
# Instagram Square map replace:
# <img\n                            src={mapImageUrls[0]}\n                            alt="Property map"\n                            crossOrigin={agentPhoto.startsWith("data:") ? undefined : "anonymous"}\n                            style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "top", display: "block" }}\n                          />

with open('src/components/BrochureDialog.tsx', 'w') as f:
    f.write(content)
