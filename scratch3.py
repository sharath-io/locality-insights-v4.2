import re

with open('src/components/BrochureDialog.tsx', 'r') as f:
    content = f.read()

# Find the download buttons container
target = '{/* Primary Download */}'
replacement = """{mapImageUrls.length > 1 && (
                    <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                      <button onClick={() => setActiveSlide(0)} style={{ flex: 1, padding: "8px", background: activeSlide === 0 ? accentColor : "white", color: activeSlide === 0 ? textColor : "#5a5248", borderRadius: 8, border: "1.5px solid #e8e3d8", fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>📍 POI Map</button>
                      <button onClick={() => setActiveSlide(1)} style={{ flex: 1, padding: "8px", background: activeSlide === 1 ? accentColor : "white", color: activeSlide === 1 ? textColor : "#5a5248", borderRadius: 8, border: "1.5px solid #e8e3d8", fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>🛣️ Highways</button>
                    </div>
                  )}
                  {/* Primary Download */}"""

content = content.replace(target, replacement)

with open('src/components/BrochureDialog.tsx', 'w') as f:
    f.write(content)
