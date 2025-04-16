const { Storage } = require("@google-cloud/storage");

const storage = new Storage({ keyFilename: process.env.GOOGLE_SERVICE });
const bucketName = "all-weather-portfolio";
const cacheFolder = "portfolio-cache";

const storeCache = async (key, data, timestamp) => {
  const fileName = `${cacheFolder}/${key}-${timestamp}.json`;
  await storage.bucket(bucketName).file(fileName).save(
    JSON.stringify({
      data,
      timestamp,
    }),
  );
};

const getCache = async (key) => {
  const [files] = await storage.bucket(bucketName).getFiles({
    prefix: `${cacheFolder}/${key}-`,
  });

  if (files.length === 0) {
    return null;
  }

  const mostRecentFile = files.reduce((latest, current) => {
    const currentTimestamp = parseInt(
      current.name.split("-").pop().replace(".json", ""),
    );
    const latestTimestamp = parseInt(
      latest.name.split("-").pop().replace(".json", ""),
    );
    return currentTimestamp > latestTimestamp ? current : latest;
  });

  const [content] = await mostRecentFile.download();
  return JSON.parse(content);
};

module.exports = {
  storeCache,
  getCache,
};
