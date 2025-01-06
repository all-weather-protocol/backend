const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const PublicGoogleSheetsParser = require("public-google-sheets-parser");
const { GOOGLE_SERVICE_ACCOUNT } = require("../config");
const SPREADSHEET_ID = "1ccCvnPfN-COcIpljie65dQddFP5HCsdJV66YnZdZ-2o";
const { castStringToDate } = require("../utils");
const fetch = require("node-fetch");
async function insertBalance(address, res) {
  const serviceAccountAuth = new JWT({
    email: GOOGLE_SERVICE_ACCOUNT["client_email"],
    key: GOOGLE_SERVICE_ACCOUNT["private_key"],
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
  await doc.loadInfo(); // loads document properties and worksheets
  const sheet = doc.sheetsByTitle["Sheet1"];
  const resp = await fetch(
    `https://pro-openapi.debank.com/v1/user/total_balance?id=${address}`,
    {
      method: "GET", // Optional, for explicitness
      headers: {
        accept: "application/json",
        AccessKey: process.env.DEBANK_ACCESSKEY,
      },
    },
  );
  const data = await resp.json();
  const usd_value = data && data.total_usd_value ? data.total_usd_value : 0;
  const today = new Date();
  const formattedDate = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
  await sheet.addRows([
    {
      address,
      usd_value,
      date: formattedDate,
    },
  ]);
  res.status(200).json({ success: true });
}

async function fetchBalancesHistory(address, res) {
  const addressInLowerCase = address.toLowerCase();
  const parser = new PublicGoogleSheetsParser(SPREADSHEET_ID);
  const data = await parser.parse();
  // Find the matching row using filter instead of map with conditional
  const userRows = data
    .filter((row) => row.address.toLowerCase() === addressInLowerCase)
    .map((row) => ({
      date: castStringToDate(row.date),
      usd_value: row.usd_value,
    }));
  if (!userRows) {
    return res.status(200).json([]);
  }

  return res.status(200).json(userRows);
}

module.exports = { fetchBalancesHistory, insertBalance };
