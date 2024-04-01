const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const { GOOGLE_SERVICE_ACCOUNT } = require("../config");
async function emailSubscription(req, res) {
  const SPREADSHEET_ID = "1eaLxSs5AvwGuIZXRDl_kIrdEIMrI_kQS8uHFpfCAkCo";
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
    res.status(409).json({ status: "Already Exists!" });
    return;
  }
  console.log(existingRows.concat(inputData));
  await sheet.addRows([inputData]);
  res.status(200).json({ status: "Successfully Created!" });
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
module.exports = emailSubscription;
