const express = require("express");
const bodyParser = require("body-parser");
const { Router, toAddress } = require("@pendle/sdk-v2");
const { ethers } = require("ethers");
const { config } = require("dotenv");
const cors = require("cors");
const PublicGoogleSheetsParser = require("public-google-sheets-parser");
const { Storage } = require("@google-cloud/storage");
const {
  emailSubscription,
  checkEmailSubscriptionStatus,
} = require("./controllers/emailSubscription");
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

app.get("/pendle/zapIn", async (req, res) => {
  try {
    const chainId = parseInt(req.query.chainId, 10);
    const poolAddress = req.query.poolAddress;
    const amount = req.query.amount;
    const slippage = parseFloat(req.query.slippage);
    const tokenInAddress = req.query.tokenInAddress;

    if (
      isNaN(chainId) ||
      isNaN(slippage) ||
      !ethers.utils.isAddress(poolAddress) ||
      !ethers.utils.isAddress(tokenInAddress) ||
      isNaN(ethers.utils.parseEther(amount))
    ) {
      throw new Error("Invalid input");
    }

    const pendleZapInData = await getPendleZapInData(
      chainId,
      poolAddress,
      ethers.BigNumber.from(amount),
      slippage,
      tokenInAddress,
    );
    res.json(pendleZapInData);
  } catch (error) {
    console.error(error);
    res
      .status(400)
      .json({ error: "Invalid input or an unexpected error occurred." });
  }
});

app.get("/pendle/zapOut", async (req, res) => {
  const chainId = req.query.chainId;
  const poolAddress = req.query.poolAddress;
  const tokenOutAddress = req.query.tokenOutAddress;
  const amount = req.query.amount;
  const slippage = req.query.slippage;
  const pendleZapOutData = await getPendleZapOutData(
    chainId,
    poolAddress,
    tokenOutAddress,
    amount,
    slippage,
  );
  res.json(pendleZapOutData);
});

app.get("/apr/historical-data", async (req, res) => {
  const spreadsheetId = "1iLrdDwXG3VBNGcFlGuCxDhXs8L2lTZCj3spYRdAeEyE";
  const parser = new PublicGoogleSheetsParser(spreadsheetId);
  const data = await parser.parse(spreadsheetId);
  res.json(
    data.map((row) => ({
      ...row,
      Date: _castStringToDate(row.Date),
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

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

async function getPendleZapInData(
  chainId,
  poolAddress,
  amount,
  slippage,
  tokenInAddress,
) {
  const provider = new ethers.providers.JsonRpcProvider(process.env.API_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const router = Router.getRouterWithKyberAggregator({
    chainId: chainId,
    provider,
    signer,
  });

  const GLP_POOL_ADDRESS = toAddress(poolAddress);
  const TOKEN_IN_ADDRESS = toAddress(tokenInAddress);
  return await router.addLiquiditySingleToken(
    GLP_POOL_ADDRESS,
    TOKEN_IN_ADDRESS,
    amount,
    slippage,
    { method: "extractParams" },
  );
}

const _castStringToDate = (dateStr) => {
  const dateMatch = dateStr.match(/\d+/g); // Extract the numeric values
  if (dateMatch && dateMatch.length === 3) {
    const year = parseInt(dateMatch[0]);
    const month = parseInt(dateMatch[1]);
    const day = parseInt(dateMatch[2]);
    const date = new Date(year, month, day);
    // Format the Date object as 'YYYY-MM-DD'
    return date.toISOString().split("T")[0];
  } else {
    throw new Error("Invalid date string");
  }
};

const _transformData = async (dataArray) => {
  const newArray = JSON.parse(dataArray);
  return newArray.map((item) => {
    const parts = item.split(",");
    const date = parts[0];
    const rewards = parseFloat(parts[1]);
    return { Date: date, Rewards: rewards };
  });
};
