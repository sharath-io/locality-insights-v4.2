import { fetchNearestHighways } from "./src/lib/fetch-highways.ts";
async function test() {
  const result = await fetchNearestHighways(17.4182004, 78.378889);
  console.log("Returned Top 3:");
  console.log(result);
}
test();
