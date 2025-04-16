const portfolioCacheService = require("../services/portfolioCache");

const storeCache = async (req, res) => {
  try {
    const { key, data, timestamp } = req.body;

    if (!key || !data) {
      return res.status(400).json({ error: "Key and data are required" });
    }

    await portfolioCacheService.storeCache(key, data, timestamp);
    res.status(200).json({ message: "Cache stored successfully" });
  } catch (error) {
    console.error("Error storing portfolio cache:", error);
    res.status(500).json({ error: "Failed to store portfolio cache" });
  }
};

const getCache = async (req, res) => {
  try {
    const { key } = req.params;

    if (!key) {
      return res.status(400).json({ error: "Key is required" });
    }

    const cacheData = await portfolioCacheService.getCache(key);
    if (!cacheData) {
      return res.status(404).json({ error: "Cache not found" });
    }
    res.status(200).json(cacheData);
  } catch (error) {
    console.error("Error retrieving portfolio cache:", error);
    res.status(500).json({ error: "Failed to retrieve portfolio cache" });
  }
};

module.exports = {
  storeCache,
  getCache,
};
