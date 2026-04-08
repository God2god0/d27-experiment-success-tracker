const { buildLiveData } = require("../lib/build-live-data.cjs");

module.exports = async (req, res) => {
  try {
    const data = await buildLiveData([]);
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=3600");
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      error: "Failed to load live data",
      details: error.message
    });
  }
};
