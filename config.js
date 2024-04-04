const { config } = require("dotenv");
config();
const fs = require("fs");
const GOOGLE_SERVICE_ACCOUNT = JSON.parse(
  fs.readFileSync(process.env.GOOGLE_SERVICE),
);

module.exports = { GOOGLE_SERVICE_ACCOUNT };
