const lat = 17.4182004;
const lng = 78.378889;

const query = `
[out:json][timeout:25];
(
  way["highway"~"^(motorway|trunk)$"]["ref"](around:25000,${lat},${lng});
  way["highway"~"^(motorway|trunk)$"]["name"](around:25000,${lat},${lng});
);
out body geom;
`;

fetch("https://overpass.kumi.systems/api/interpreter", {
  method: "POST",
  body: `data=${encodeURIComponent(query.trim())}`,
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "LocalityInsightsApp/1.0"
  }
}).then(r => r.json()).then(json => {
  console.log("Elements with name but no ref:", json.elements?.filter(e => !e.tags?.ref && e.tags?.name).map(e => e.tags?.name).slice(0, 5));
  console.log("Elements with ref:", json.elements?.filter(e => e.tags?.ref).map(e => e.tags?.ref).slice(0, 5));
}).catch(e => console.error("Error:", e.message));
