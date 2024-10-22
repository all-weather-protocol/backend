const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const PublicGoogleSheetsParser = require("public-google-sheets-parser");
const { GOOGLE_SERVICE_ACCOUNT } = require("../config");
const SPREADSHEET_ID = "1ZDqREWm4g68Toq8bUXSEL1UfUdR2TKA5V4Etp2oF5Kw";

async function createReferrer(address, referrer, res) {
  const serviceAccountAuth = new JWT({
    email: GOOGLE_SERVICE_ACCOUNT["client_email"],
    key: GOOGLE_SERVICE_ACCOUNT["private_key"],
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
  await doc.loadInfo(); // loads document properties and worksheets
  const sheet = doc.sheetsByTitle["Sheet1"];
  const existingRows = await sheet.getRows(); // can pass in { limit, offset }
  if (_checkExistingReferee(address, referrer, existingRows) === true) {
    res.status(400).json({
      status:
        "Referrer Already Exists! Or Your referrer cannot be referred by you",
    });
    return;
  }
  await sheet.addRows([{ referrer, referee: address }]);
  res.status(200).json({ status: "Successfully Referred, Happy Earning!" });
}

async function fetchReferralList(address, res) {
  const addressInLowerCase = address.toLowerCase();
  const parser = new PublicGoogleSheetsParser(SPREADSHEET_ID);
  const data = await parser.parse();
  // Find the matching row using filter instead of map with conditional
  const referralRows = data.filter(
    (row) => row.referrer.toLowerCase() === addressInLowerCase,
  );
  const referrer = data.filter(
    (row) => row.referee.toLowerCase() === addressInLowerCase,
  )[0];
  if (!referralRows) {
    return res.status(200).json({ referees: [] });
  }

  return res
    .status(200)
    .json({ referees: referralRows, referrer: referrer?.referrer || "" });
}

function _checkExistingReferee(referee, referrer, existingRows) {
  for (const row of existingRows) {
    if (row.get("referee") === referee) {
      return true;
    } else if (
      row.get("referee") === referrer &&
      row.get("referrer") === referee
    ) {
      // your referrer cannot be referred by you
      return true;
    }
  }
  return false;
}

module.exports = { fetchReferralList, createReferrer };
