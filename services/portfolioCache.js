const { Storage } = require("@google-cloud/storage");

const storage = new Storage({ keyFilename: process.env.GOOGLE_SERVICE });
const bucketName = "all-weather-portfolio";
const cacheFolder = "portfolio-cache";

const storeCache = async (key, data, timestamp) => {
  const fileName = `${cacheFolder}/${key}.json`;
  await storage.bucket(bucketName).file(fileName).save(
    JSON.stringify({
      data,
      timestamp,
    }),
  );
};

const getCache = async (key) => {
  const fileName = `${cacheFolder}/${key}.json`;
  try {
    const [content] = await storage
      .bucket(bucketName)
      .file(fileName)
      .download();
    return JSON.parse(content);
  } catch (error) {
    // If file doesn't exist, return null
    if (error.code === 404) {
      return null;
    }
    throw error;
  }
};

const deleteCache = async (key) => {
  const [files] = await storage.bucket(bucketName).getFiles({
    prefix: `${cacheFolder}/${key}`,
  });

  for (const file of files) {
    await storage.bucket(bucketName).file(file.name).delete();
  }
};

module.exports = {
  storeCache,
  getCache,
  deleteCache,
};
