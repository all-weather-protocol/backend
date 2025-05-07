const nodemailer = require("nodemailer");
const { promisify } = require("util");
const PublicGoogleSheetsParser = require("public-google-sheets-parser");
const ChartGenerator = require("../utils/ChartGenerator");
const fs = require("fs");
const minDataPointsThreshold = 7;
// Date utilities
class DateUtils {
  static extractDate(dateStr) {
    const [year, month, day] = dateStr
      .replace("Date(", "")
      .replace(")", "")
      .split(",")
      .map(Number);
    return new Date(year, month, day);
  }

  static getDateBefore(date, days) {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() - days);
    return newDate;
  }

  static getDaysDifference(date1, date2) {
    return Math.max(1, Math.round((date1 - date2) / (1000 * 60 * 60 * 24)));
  }
}

// Balance utilities
class BalanceUtils {
  static getBalance(row) {
    return parseFloat(Object.values(row)[1]);
  }

  static async findBalanceAtDate(rows, targetDate) {
    const entry = rows.find((row) => {
      const rowDate = DateUtils.extractDate(row.date);
      return rowDate <= targetDate;
    });

    if (!entry) {
      await this.handleMissingBalance(rows, targetDate);
      // Return oldest available entry as fallback
      return {
        balance: this.getBalance(rows[rows.length - 1]),
        date: DateUtils.extractDate(rows[rows.length - 1].date),
      };
    }

    return {
      balance: this.getBalance(entry),
      date: DateUtils.extractDate(entry.date),
    };
  }

  static async handleMissingBalance(rows, targetDate) {
    const errorMsg = [
      `No balance found before or at date: ${targetDate.toISOString()}`,
      `Earliest available date: ${DateUtils.extractDate(rows[rows.length - 1].date).toISOString()}`,
      `Latest available date: ${DateUtils.extractDate(rows[0].date).toISOString()}`,
    ].join("\n");

    console.error(errorMsg);

    try {
      await fetch(process.env.DISCORD_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: errorMsg }),
      });
    } catch (error) {
      console.error("Failed to send Discord alert:", error);
    }
  }
}

// Performance metrics calculator
class PerformanceCalculator {
  constructor(sortedRows) {
    this.sortedRows = sortedRows;
    this.currentEntry = {
      balance: BalanceUtils.getBalance(sortedRows[0]),
      date: DateUtils.extractDate(sortedRows[0].date),
    };
  }

  async calculateMetrics() {
    const [weeklyMetrics, monthlyMetrics] = await Promise.all([
      this.calculateWeeklyMetrics(),
      this.calculateMonthlyMetrics(),
    ]);
    return {
      ...weeklyMetrics,
      ...monthlyMetrics,
      balanceHistory: this.sortedRows,
    };
  }

  async calculateWeeklyMetrics() {
    const lastWeekDate = DateUtils.getDateBefore(this.currentEntry.date, 7);
    const lastWeekEntry = await BalanceUtils.findBalanceAtDate(
      this.sortedRows,
      lastWeekDate,
    );

    return {
      weeklyPnL: this.currentEntry.balance - lastWeekEntry.balance,
      currentBalance: this.currentEntry.balance,
      lastWeekBalance: lastWeekEntry.balance,
    };
  }

  async calculateMonthlyMetrics() {
    const lastMonthDate = DateUtils.getDateBefore(this.currentEntry.date, 30);
    const monthlyEntry = await BalanceUtils.findBalanceAtDate(
      this.sortedRows,
      lastMonthDate,
    );
    const daysDiff = DateUtils.getDaysDifference(
      this.currentEntry.date,
      monthlyEntry.date,
    );

    const annualROI =
      monthlyEntry.balance !== 0
        ? Math.max(
            -100,
            (((this.currentEntry.balance - monthlyEntry.balance) * 365) /
              (monthlyEntry.balance * daysDiff)) *
              100,
          )
        : 0;

    return {
      annualROI,
      daysDiff,
    };
  }
}

// Email configuration
class EmailConfig {
  static createTransporter() {
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });
  }
}

class ReportController {
  static async validateInput(req) {
    const { address, email } = req.body;
    if (!address || !email) {
      throw new Error("Address and email are required");
    }
    return { address, email };
  }

  static async fetchAndProcessData(address) {
    const spreadsheetId = "1ccCvnPfN-COcIpljie65dQddFP5HCsdJV66YnZdZ-2o";
    const parser = new PublicGoogleSheetsParser(spreadsheetId);
    const data = await parser.parse(spreadsheetId);

    const addressRows = data.filter(
      (row) => row[Object.keys(row)[0]] === address,
    );
    if (addressRows.length === 0) {
      throw new Error("No data found for this address");
    }
    
    if (addressRows.length < minDataPointsThreshold) {
      throw new Error("Insufficient data points. Need at least 7 data points to generate a report.");
    }

    return addressRows.sort((a, b) => {
      const dateAObj = DateUtils.extractDate(a.date);
      const dateBObj = DateUtils.extractDate(b.date);
      return dateBObj.getTime() - dateAObj.getTime();
    });
  }

  static async sendEmail(email, address, metrics) {
    const transporter = EmailConfig.createTransporter();

    try {
      // Generate charts
      const balanceChart = await ChartGenerator.generateHistoricalBalanceChart(
        metrics.balanceHistory,
        address,
      );

      const emailContent = {
        from: `"All Weather Protocol" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your Weekly PnL Report",
        html: this.generateEmailHTML(
          address,
          metrics,
          email,
          balanceChart.contentId,
        ),
        attachments: [
          {
            filename: balanceChart.fileName,
            content: balanceChart.buffer,
            cid: balanceChart.contentId,
          },
        ],
      };

      await promisify(transporter.sendMail.bind(transporter))(emailContent);

      // Clean up temp files
      if (balanceChart?.filePath && fs.existsSync(balanceChart.filePath)) {
        fs.unlinkSync(balanceChart.filePath);
      }
    } catch (error) {
      console.error("Email sending error:", error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  static generateEmailHTML(address, metrics, email, balanceChartCid) {
    // Calculate the weekly PnL percentage correctly
    const weeklyPnLPercentage =
      metrics.lastWeekBalance > 0
        ? (metrics.weeklyPnL / metrics.lastWeekBalance) * 100
        : 0;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; text-align: center; padding-bottom: 10px;">Your Weekly Performance Report</h2>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 200px;">
            <p style="color: #666; margin: 5px 0;">Address:</p>
            <p style="word-break: break-all; margin: 5px 0;">${address.substring(0, 6)}...${address.substring(address.length - 4)}</p>
          </div>
          <div style="margin: 10px 0; text-align: right;">
            <a href="https://app.awp-capital.com/profile/?address=${address}" 
               style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Dashboard
            </a>
          </div>
        </div>
    
        <!-- Balance Chart -->
        <div style="margin-bottom: 30px;">
          <h3 style="color: #333; text-align: center;">Portfolio Balance</h3>
          <div style="text-align: center;">
            <img src="cid:${balanceChartCid}" alt="Historical Balance Chart" style="max-width: 100%; height: auto; border-radius: 5px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
          <div style="text-align: center; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
            <p style="color: #666; margin: 5px 0;">Current Balance</p>
            <p style="font-size: 18px; font-weight: bold; margin: 5px 0;">$${metrics.currentBalance?.toFixed(2)}</p>
          </div>
          <div style="text-align: center; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
            <p style="color: #666; margin: 5px 0;">Last Week's Balance</p>
            <p style="font-size: 18px; font-weight: bold; margin: 5px 0;">$${metrics.lastWeekBalance?.toFixed(2)}</p>
          </div>
        </div>

        <div style="text-align: center; padding: 20px; margin: 20px 0; background-color: #f8f9fa; border-radius: 5px;">
          <p style="color: #666; margin: 5px 0;">Weekly PnL</p>
          <h1 style="font-size: 32px; margin: 10px 0; color: ${metrics.weeklyPnL >= 0 ? "#22c55e" : "#ef4444"};">
            ${metrics.weeklyPnL >= 0 ? "+" : ""}$${metrics.weeklyPnL?.toFixed(2)}
            <span style="font-size: 18px;">
              (${weeklyPnLPercentage >= 0 ? "+" : ""}${weeklyPnLPercentage.toFixed(2)}%)
            </span>
          </h1>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; text-align: center;">
          <p>This is an automated report for your All Weather Protocol account. If you didn't request this, you can safely ignore it.</p>
          <p style="margin: 10px 0;">Contact us at support@awp-capital.com if you have any questions.</p>
          <p>
            <a href="https://app.awp-capital.com/unsubscribe?email=${encodeURIComponent(email)}&address=${encodeURIComponent(address)}" 
               style="color: #666;">
              Unsubscribe
            </a>
          </p>
          
          <div style="margin-top: 20px; text-align: center;">
            <p style="color: #666; margin-bottom: 10px;">Follow us:</p>
            <a href="https://twitter.com/all_weather_p" style="color: #666; text-decoration: none; margin: 0 10px;" target="_blank">Twitter</a>
            <a href="https://discord.gg/sNsMmtsCCV" style="color: #666; text-decoration: none; margin: 0 10px;" target="_blank">Discord</a>
            <a href="https://all-weather-protocol.gitbook.io/" style="color: #666; text-decoration: none; margin: 0 10px;" target="_blank">Documentation</a>
          </div>
        </div>
      </div>
    `;
  }

  static async handleError(error, res) {
    console.error("Error:", error);

    try {
      const errorMsg = [
        "🚨 Report Sender Error:",
        `Message: ${error.message}`,
        `Stack: ${error.stack}`,
        `Time: ${new Date().toISOString()}`,
      ].join("\n");

      await fetch(process.env.DISCORD_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: errorMsg }),
      });
    } catch (discordError) {
      console.error("Failed to send Discord alert:", discordError);
    }

    const statusCode = error.message.includes("required")
      ? 400
      : error.message.includes("No data found")
        ? 404
        : 500;

    res.status(statusCode).json({
      error: error.message,
      details: error.stack,
    });
  }

  static async sendPnLReport(req, res) {
    try {
      // Validate input
      const { address, email } = await this.validateInput(req);

      // Fetch and process data
      const sortedRows = await this.fetchAndProcessData(address);

      // Calculate metrics
      const metrics = await new PerformanceCalculator(
        sortedRows,
      ).calculateMetrics();
      // Send email
      await this.sendEmail(email, address, metrics);

      res.status(200).json({
        message: "PnL report has been sent to your email",
        data: metrics,
      });
    } catch (error) {
      await this.handleError(error, res);
    }
  }
}

module.exports = {
  sendPnLReport: ReportController.sendPnLReport.bind(ReportController),
};
