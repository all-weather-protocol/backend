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
config();
require("events").EventEmitter.defaultMaxListeners = 20; // or another number that suits your needs
const app = express();
// Enable CORS for all routes
app.use(cors());

const port = 3002;

// Middleware to parse JSON requests
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// GET endpoint to return a welcome message
app.get("/", (req, res) => {
  res.send("Welcome to the basic backend service!");
});

app.get("/apr/:portfolioName/historical-data", async (req, res) => {
  const portfolioName = req.params.portfolioName;

  const spreadsheetId = "1iLrdDwXG3VBNGcFlGuCxDhXs8L2lTZCj3spYRdAeEyE";
  const parser = new PublicGoogleSheetsParser(spreadsheetId, {
    sheetName: portfolioName,
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

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

const _transformData = async (dataArray) => {
  const newArray = JSON.parse(dataArray);
  return newArray.map((item) => {
    const parts = item.split(",");
    const date = parts[0];
    const rewards = parseFloat(parts[1]);
    return { Date: date, Rewards: rewards };
  });
};
