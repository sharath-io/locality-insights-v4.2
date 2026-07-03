const lat = 17.4182004;
const lng = 78.378889;
const query = `[out:json][timeout:25];way["highway"~"^(motorway|trunk)$"]["ref"](around:25000,${lat},${lng});out body geom;`;
fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  body: `data=${encodeURIComponent(query.trim())}`,
  headers: { "Content-Type": "application/x-www-form-urlencoded" }
}).then(r => r.json()).then(json => {
  console.log("Success with overpass-api.de. Elements:", json.elements?.length);
}).catch(e => console.error("Error:", e.message));
