const apiKey = process.env.GOOGLE_PLACES_KEY || "AIzaSyAxxt-4r6Z6R6qovZJXEzGrqT2-bwZflpc";
async function run() {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.location,places.rating,places.types',
    },
    body: JSON.stringify({
      locationRestriction: {
        circle: {
          center: { latitude: 17.7186198, "longitude": 83.3314418 },
          radius: 5000
        }
      },
      includedTypes: ["hospital"],
      maxResultCount: 5,
    }),
  });
  console.log(res.status, await res.json());
}
run();
