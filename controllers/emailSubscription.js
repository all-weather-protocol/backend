const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const PublicGoogleSheetsParser = require("public-google-sheets-parser");
const { GOOGLE_SERVICE_ACCOUNT } = require("../config");
const SPREADSHEET_ID = "1eaLxSs5AvwGuIZXRDl_kIrdEIMrI_kQS8uHFpfCAkCo";
async function emailSubscription(req, res) {
  const serviceAccountAuth = new JWT({
    email: GOOGLE_SERVICE_ACCOUNT["client_email"],
    key: GOOGLE_SERVICE_ACCOUNT["private_key"],
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
  await doc.loadInfo(); // loads document properties and worksheets
  const sheet = doc.sheetsByTitle["emails"];
  const existingRows = await sheet.getRows(); // can pass in { limit, offset }
  const inputData = req.body;
  if (_checkExistingEmail(inputData, existingRows) === true) {
    res.status(200).json({ status: "Already Exists!" });
    return;
  }
  await sheet.addRows([inputData]);
  res.status(200).json({ status: "Successfully Subscribed, Happy Earning!" });
}

async function checkEmailSubscriptionStatus(address, res) {
  const addressInLowerCase = address.toLowerCase();
  const parser = new PublicGoogleSheetsParser(SPREADSHEET_ID);
  const data = await parser.parse();
  // Find the matching row using filter instead of map with conditional
  const subscribedRow = data.filter(
    (row) => row.address.toLowerCase() === addressInLowerCase,
  )[0];

  if (!subscribedRow) {
    return res.status(200).json({ subscriptionStatus: false });
  }

  return res.status(200).json({ subscriptionStatus: true });
}

const _checkExistingEmail = (inputData, existingRows) => {
  for (const row of existingRows) {
    if (
      row.get("address") === inputData.address &&
      row.get("email") === inputData.email
    ) {
      return true;
    }
  }
  return false;
};

async function unsubscribeEmail(req, res) {
  const serviceAccountAuth = new JWT({
    email: GOOGLE_SERVICE_ACCOUNT["client_email"],
    key: GOOGLE_SERVICE_ACCOUNT["private_key"],
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle["emails"];
  const existingRows = await sheet.getRows();

  const inputData = req.body;
  // Find the row with matching email and address
  const rowToUpdate = existingRows.find(
    (row) =>
      row.get("email") === inputData.email &&
      row.get("address") === inputData.address,
  );

  if (!rowToUpdate) {
    return res.status(404).json({ status: "Email subscription not found" });
  }

  // Update the subscription status to false
  rowToUpdate.set("subscription", false);
  await rowToUpdate.save();

  return res.status(200).json({ status: "Successfully unsubscribed" });
}

module.exports = {
  emailSubscription,
  checkEmailSubscriptionStatus,
  unsubscribeEmail,
};
