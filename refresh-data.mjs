import fs from "node:fs/promises";
import liveDataModule from "./lib/build-live-data.cjs";

const { buildLiveData } = liveDataModule;
const OUTPUT_PATH = new URL("./data.json", import.meta.url);
const HISTORY_PATH = new URL("./data-history.json", import.meta.url);

async function main() {
  let history = [];
  try {
    const historyRaw = await fs.readFile(HISTORY_PATH, "utf8");
    history = JSON.parse(historyRaw);
    if (!Array.isArray(history)) history = [];
  } catch (_error) {
    history = [];
  }

  const data = await buildLiveData(history);

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(data, null, 2));
  await fs.writeFile(HISTORY_PATH, JSON.stringify(data.history ?? [], null, 2));
  console.log(`Refreshed live data from ${data.sourceUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
