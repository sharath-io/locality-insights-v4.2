const lat = 17.4182004;
const lng = 78.378889;
const query = `[out:json][timeout:25];way["highway"~"^(motorway|trunk)$"]["ref"](around:25000,${lat},${lng});out body geom;`;
fetch("https://overpass.kumi.systems/api/interpreter", {
  method: "POST",
  body: `data=${encodeURIComponent(query.trim())}`,
  headers: { 
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  }
}).then(r => r.json()).then(json => {
  console.log("Success with kumi.systems using browser UA. Elements:", json.elements?.length);
}).catch(e => console.error("Error:", e.message));
