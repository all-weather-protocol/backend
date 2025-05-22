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

async function fetchAndUploadProtocols(storage, bucketName, fileName) {
  try {
    const response = await fetch('https://api.llama.fi/protocols');
    const protocols = await response.json();
    
    // Upload to GCS
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    await file.save(JSON.stringify(protocols));
    
    return protocols;
  } catch (error) {
    console.error('Error fetching/uploading protocols:', error);
    throw error;
  }
}

app.get("/protocols", async (req, res) => {
  const storage = new Storage({ keyFilename: process.env.GOOGLE_SERVICE });
  const bucketName = "all-weather-portfolio";
  const fileName = "protocols.json";

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    
    // Check if file exists
    const [exists] = await file.exists();
    
    if (!exists) {
      // If file doesn't exist, fetch and upload it
      const protocols = await fetchAndUploadProtocols(storage, bucketName, fileName);
      return res.json(protocols);
    }

    // If file exists, download and return it
    const [contents] = await file.download();
    res.json(JSON.parse(contents.toString()));
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch protocols" });
  }
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
