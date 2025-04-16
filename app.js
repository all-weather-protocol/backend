const express = require("express");
const bodyParser = require("body-parser");
const { ethers } = require("ethers");
const { config } = require("dotenv");
const cors = require("cors");
const PublicGoogleSheetsParser = require("public-google-sheets-parser");
const { Storage } = require("@google-cloud/storage");
const {
  emailSubscription,
  checkEmailSubscriptionStatus,
  unsubscribeEmail,
} = require("./controllers/emailSubscription");
const {
  fetchReferralList,
  createReferrer,
} = require("./controllers/referralProgram");
const {
  fetchBalancesHistory,
  insertBalance,
} = require("./controllers/userBalances");
const { castStringToDate } = require("./utils");
const { sendPnLReport } = require("./controllers/reportSender");

// Import routes
const portfolioCacheRoutes = require("./routes/portfolioCache");

config();
require("events").EventEmitter.defaultMaxListeners = 20; // or another number that suits your needs
const app = express();
// Enable CORS for all routes
app.use(cors());

const port = 3002;

// Increase payload size limit to 10MB
app.use(bodyParser.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Use routes
app.use("/portfolio-cache", portfolioCacheRoutes);

// Initialize Google Cloud Storage
const storage = new Storage({ keyFilename: process.env.GOOGLE_SERVICE });
const bucketName = "all-weather-portfolio";
const cacheFolder = "portfolio-cache";

// GET endpoint to return a welcome message
app.get("/", (req, res) => {
  res.send("Welcome to the basic backend service!");
});

app.get("/apr/:portfolioName/historical-data", async (req, res) => {
  const portfolioName = req.params.portfolioName;
  const spreadsheetId = "1iLrdDwXG3VBNGcFlGuCxDhXs8L2lTZCj3spYRdAeEyE";
  const parser = new PublicGoogleSheetsParser(spreadsheetId, {
    sheetName: encodeURIComponent(portfolioName),
  });
  const data = await parser.parse(spreadsheetId);
  res.json(
    data.map((row) => ({
      ...row,
      Date: castStringToDate(row.Date),
    })),
  );
});

app.get("/rewards/historical-data", async (req, res) => {
  const spreadsheetId = "13oiutsSY1tpE4-pg0Grhk6cz4zpvJzlj2Ix0muOaTm0";
  const parser = new PublicGoogleSheetsParser(spreadsheetId);
  const userSheet = req.query.claimableUser;
  const data = await parser.parse(spreadsheetId, userSheet);
  const rowOfBundleAddresses = data[1];
  const key = Object.keys(rowOfBundleAddresses).find(
    (key) => key !== "bundle_addresses",
  );
  const value = rowOfBundleAddresses[key];
  const newData = await _transformData(value);
  res.json(newData);
});

app.get("/protocols", async (req, res) => {
  const storage = new Storage({ keyFilename: process.env.GOOGLE_SERVICE });
  const bucketName = "all-weather-portfolio";
  const fileName = "protocols.json";

  const metadata = await new Promise((resolve, reject) => {
    storage
      .bucket(bucketName)
      .file(fileName)
      .download((err, contents) => {
        if (err) {
          console.error("Error:", err);
          reject(err);
        } else {
          resolve(contents.toString());
        }
      });
  });
  res.json(metadata);
});

app.post("/subscriptions/email", async (req, res) => {
  return await emailSubscription(req, res);
});
app.get("/subscriptions", async (req, res) => {
  // TODO:
  // 1. need to provide an wallet signature to prove the ownership of the address
  // 2. need to check if the address is subscribed by payment not email

  // pseudo code:
  // const signature = req.query.signature;
  // const address = req.params.address;
  // validityOfSIgnature = validateSignature(signature, address);
  // if (!validityOfSIgnature) {
  //   return res.status(401).json({ error: "Invalid Signature" });
  // }
  // await checkPaymentSubscriptionStatus(address);
  return await checkEmailSubscriptionStatus(req.query.address, res);
});
app.put("/subscriptions/email", async (req, res) => {
  return await unsubscribeEmail(req, res);
});
app.get("/referral/:address/referees", async (req, res) => {
  const address = req.params.address;
  if (ethers.utils.isAddress(address) === false) {
    return res.status(400).json({ error: "Invalid Address", referees: [] });
  }
  return await fetchReferralList(address, res);
});

app.post("/referral/:address/referrer", async (req, res) => {
  const address = req.params.address;
  if (ethers.utils.isAddress(address) === false) {
    return res.status(400).json({ error: "Invalid Address" });
  } else if (req.body.referrer.toLowerCase() === address.toLowerCase()) {
    return res
      .status(400)
      .json({ error: "Referrer and Referee cannot be the same" });
  }
  return await createReferrer(address, req.body.referrer, res);
});

app.get("/balances/:address/history", async (req, res) => {
  const address = req.params.address;
  if (ethers.utils.isAddress(address) === false) {
    return res.status(400).json({ error: "Invalid Address", history: [] });
  }
  return await fetchBalancesHistory(address, res);
});

app.post("/balances/:address", async (req, res) => {
  const address = req.params.address;
  if (ethers.utils.isAddress(address) === false) {
    return res.status(400).json({ error: "Invalid Address" });
  }
  return await insertBalance(address, res);
});

let fetch;
(async () => {
  fetch = (await import("node-fetch")).default;
})();

app.post("/discord/webhook", async (req, res) => {
  try {
    const errorMsg = req.body.errorMsg;
    if (!errorMsg) {
      return res.status(400).json({ error: "Error message is required" });
    }

    const response = await fetch(process.env.DISCORD_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: errorMsg,
      }),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.statusText}`);
    }

    res.status(200).json({ message: "Error notification sent to Discord" });
  } catch (error) {
    console.error("Discord webhook error:", error);
    res.status(500).json({ error: "Failed to send notification to Discord" });
  }
});
app.post("/reports/weekly-pnl", async (req, res) => {
  return await sendPnLReport(req, res);
});

// Portfolio Cache Endpoints
app.post("/portfolio-cache", async (req, res) => {
  try {
    const { key, data, timestamp } = req.body;

    if (!key || !data) {
      return res.status(400).json({ error: "Key and data are required" });
    }

    // Create a unique filename using the key and timestamp
    const fileName = `${cacheFolder}/${key}-${timestamp}.json`;

    // Upload the data to Google Cloud Storage
    await storage.bucket(bucketName).file(fileName).save(
      JSON.stringify({
        data,
        timestamp,
      }),
    );

    res.status(200).json({ message: "Cache stored successfully" });
  } catch (error) {
    console.error("Error storing portfolio cache:", error);
    res.status(500).json({ error: "Failed to store portfolio cache" });
  }
});

app.get("/portfolio-cache/:key", async (req, res) => {
  try {
    const { key } = req.params;

    if (!key) {
      return res.status(400).json({ error: "Key is required" });
    }

    // List all files in the cache folder for this key
    const [files] = await storage.bucket(bucketName).getFiles({
      prefix: `${cacheFolder}/${key}-`,
    });

    if (files.length === 0) {
      return res.status(404).json({ error: "Cache not found" });
    }

    // Get the most recent file
    const mostRecentFile = files.reduce((latest, current) => {
      const currentTimestamp = parseInt(
        current.name.split("-").pop().replace(".json", ""),
      );
      const latestTimestamp = parseInt(
        latest.name.split("-").pop().replace(".json", ""),
      );
      return currentTimestamp > latestTimestamp ? current : latest;
    });

    // Download and return the data
    const [content] = await mostRecentFile.download();
    const cacheData = JSON.parse(content);

    res.status(200).json(cacheData);
  } catch (error) {
    console.error("Error retrieving portfolio cache:", error);
    res.status(500).json({ error: "Failed to retrieve portfolio cache" });
  }
});

// Start the server with increased payload limits
const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

// Increase server limits
server.maxHttpBufferSize = 10 * 1024 * 1024; // 10MB
server.maxPayload = 10 * 1024 * 1024; // 10MB

const _transformData = async (dataArray) => {
  const newArray = JSON.parse(dataArray);
  return newArray.map((item) => {
    const parts = item.split(",");
    const date = parts[0];
    const rewards = parseFloat(parts[1]);
    return { Date: date, Rewards: rewards };
  });
};
