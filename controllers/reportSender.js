const nodemailer = require("nodemailer");
const { promisify } = require("util");
const PublicGoogleSheetsParser = require("public-google-sheets-parser");

async function sendPnLReport(req, res) {
  try {
    // Validate input
    const { address, email } = req.body;
    if (!address || !email) {
      return res.status(400).json({ error: "Address and email are required" });
    }

    // Fetch historical data (similar to existing endpoint)
    const spreadsheetId = "1ccCvnPfN-COcIpljie65dQddFP5HCsdJV66YnZdZ-2o";
    const parser = new PublicGoogleSheetsParser(spreadsheetId);
    const data = await parser.parse(spreadsheetId);

    // Filter rows for the specified address
    const addressRows = data.filter(
      (row) => row[Object.keys(row)[0]] === address,
    );

    if (addressRows.length === 0) {
      return res.status(404).json({ error: "No data found for this address" });
    }

    // Sort by date in descending order (newest first)
    const sortedRows = addressRows.sort((a, b) => {
      // Extract date components from strings like "Date(2025,0,16)"
      const extractDate = (dateStr) => {
        const [year, month, day] = dateStr
          .replace("Date(", "")
          .replace(")", "")
          .split(",")
          .map(Number);
        return new Date(year, month, day);
      };

      const dateAObj = extractDate(a.date);
      const dateBObj = extractDate(b.date);
      return dateBObj.getTime() - dateAObj.getTime();
    });
    // Get latest balance (first row after sorting)
    const currentBalance = parseFloat(Object.values(sortedRows[0])[1]);

    // Get balance from 7 days ago (if exists)
    const lastWeekBalance =
      sortedRows.length > 1 ? parseFloat(Object.values(sortedRows[1])[1]) : 0;

    // Calculate week-over-week PnL
    const weeklyPnL = currentBalance - lastWeekBalance;

    // Calculate ROI
    const annualROI =
      lastWeekBalance !== 0 ? ((weeklyPnL * 52) / lastWeekBalance) * 100 : 0;

    // Remove the historical data processing since we only need the PnL
    const result = {
      weeklyPnL,
      currentBalance,
      lastWeekBalance,
      annualROI,
    };

    // Configure email transporter
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD, // Use App Password instead of regular password
      },
    });

    // Prepare email content
    const emailContent = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "All Weather Protocol - Weekly PnL Report",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #333; text-align: center; border-bottom: 2px solid #eee; padding-bottom: 10px;">All Weather Protocol - Weekly PnL Report</h2>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p style="color: #666; margin: 5px 0;">Address:</p>
            <p style="word-break: break-all; margin: 5px 0;">${address}</p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
            <div style="text-align: center; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
              <p style="color: #666; margin: 5px 0;">Current Balance</p>
              <p style="font-size: 18px; font-weight: bold; margin: 5px 0;">$${result.currentBalance.toFixed(2)}</p>
            </div>
            <div style="text-align: center; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
              <p style="color: #666; margin: 5px 0;">Last Week's Balance</p>
              <p style="font-size: 18px; font-weight: bold; margin: 5px 0;">$${result.lastWeekBalance.toFixed(2)}</p>
            </div>
          </div>

          <div style="text-align: center; padding: 20px; margin: 20px 0; background-color: #f8f9fa; border-radius: 5px;">
            <p style="color: #666; margin: 5px 0;">Weekly PnL</p>
            <h1 style="font-size: 32px; margin: 10px 0; color: ${result.weeklyPnL >= 0 ? "#22c55e" : "#ef4444"};">
              ${result.weeklyPnL >= 0 ? "+" : ""}$${result.weeklyPnL.toFixed(2)}
            </h1>
            <p style="color: #666; margin: 5px 0;">Estimated Annual ROI</p>
            <h1 style="font-size: 32px; margin: 10px 0; color: ${result.annualROI >= 0 ? "#22c55e" : "#ef4444"};">
              ${result.annualROI >= 0 ? "+" : ""}${result.annualROI.toFixed(2)}%
            </h1>
          </div>

          <div style="text-align: center; margin: 20px 0;">
            <a href="https://app.awp-capital.com/profile/?address=${address}" 
               style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Details
            </a>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; text-align: center;">
            <p>⚠️ Security Notice: We'll never ask for your private key or password.</p>
            <p style="margin-top: 10px;">
              <a href="https://app.awp-capital.com/unsubscribe?email=${encodeURIComponent(email)}&address=${encodeURIComponent(address)}" 
                 style="color: #666; text-decoration: underline;">
                Unsubscribe from these reports
              </a>
            </p>
          </div>
        </div>
      `,
    };

    // Send email
    try {
      await promisify(transporter.sendMail.bind(transporter))(emailContent);
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      return res.status(500).json({
        error: "Failed to send email",
        details: emailError.message,
      });
    }

    res.status(200).json({
      message: "PnL report has been sent to your email",
      data: result,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      error: "Failed to fetch and send historical data",
      details: error.message,
    });
  }
}
module.exports = { sendPnLReport };
