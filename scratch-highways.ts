import { fetchNearestHighways } from "./src/lib/fetch-highways.ts";
fetchNearestHighways(17.4129805, 78.465693).then(console.log).catch(console.error);
