import { fetchNearestHighways } from "./src/lib/fetch-highways.ts";
fetchNearestHighways(17.4475, 78.6844).then(console.log).catch(console.error);
