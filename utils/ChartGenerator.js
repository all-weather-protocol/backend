const axios = require("axios");
const fs = require("fs");
const path = require("path");

/**
 * Utility class to generate chart images for email reports
 * using the QuickChart API instead of local canvas rendering
 */
class ChartGenerator {
  /**
   * Generate a chart image using QuickChart API
   *
   * @param {Object} options - Chart configuration options
   * @param {Array} options.data - The chart data points
   * @param {string} options.title - The chart title
   * @param {string} options.xField - The field name for x-axis values (default: 'date')
   * @param {string} options.yField - The field name for y-axis values
   * @param {string} options.address - User address for file naming
   * @param {string} options.chartType - Type of chart ('line' or 'column')
   * @returns {Object} Object containing the image buffer, filename, and path
   */
  static async generateChart({
    data,
    title,
    xField = "date",
    yField,
    address,
    chartType = "line",
  }) {
    // Reverse the data array to show newest data first
    const reversedData = [...data].reverse();

    // Format dates for x-axis
    const labels = reversedData.map((item) => {
      // Handle date format 'Date(2025,0,3)'
      let date;
      if (
        typeof item[xField] === "string" &&
        item[xField].startsWith("Date(")
      ) {
        // Extract the date components from the string
        const dateString = item[xField];
        const dateComponents = dateString
          .substring(5, dateString.length - 1)
          .split(",")
          .map(Number);

        // JavaScript months are 0-indexed, so January is 0
        date = new Date(
          dateComponents[0],
          dateComponents[1],
          dateComponents[2],
        );
      } else {
        date = new Date(item[xField]);
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.error("Invalid date:", item[xField]);
        return "Invalid date";
      }

      return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    // Prepare dataset values
    const values = reversedData.map((item) => Number(item[yField]));
    // Calculate min and max values for y-axis
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    // Create Chart.js configuration
    const chartConfig = {
      type: chartType === "line" ? "line" : "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: yField,
            data: values,
            fill: false,
            borderColor: "#3fb57d",
            backgroundColor:
              chartType === "line"
                ? "#3fb57d"
                : values.map((value) => (value >= 0 ? "#3fb57d" : "#ff4d4f")),
            tension: 0.4,
            borderWidth: chartType === "line" ? 2 : 0,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: title,
            color: "#ffffff",
            font: {
              size: 16,
              weight: "bold",
            },
          },
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Date",
              color: "#ffffff",
            },
            ticks: {
              color: "#ffffff",
              maxTicksLimit: 5,
            },
            grid: {
              color: "rgba(48, 48, 48, 0.5)",
            },
          },
          y: {
            title: {
              display: true,
              text: yField,
              color: "#ffffff",
            },
            min: minValue,
            max: maxValue,
            ticks: {
              color: "#ffffff",
            },
            grid: {
              color: "rgba(48, 48, 48, 0.5)",
              lineWidth: 1,
              borderDash: [4, 5],
            },
          },
        },
      },
    };

    // Create directory if it doesn't exist
    const tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate filename
    const fileName = `chart-${address.substring(0, 8)}-${Date.now()}.png`;
    const filePath = path.join(tempDir, fileName);
    try {
      // Use QuickChart API to generate the chart
      const response = await axios({
        method: "GET",
        url: "https://quickchart.io/chart",
        params: {
          c: JSON.stringify(chartConfig),
          backgroundColor: "#141414",
        },
        responseType: "arraybuffer",
      });

      // Save the image to file
      fs.writeFileSync(filePath, response.data);

      return {
        buffer: response.data,
        fileName,
        filePath,
        contentId: `chart-${address.substring(0, 8)}`,
      };
    } catch (error) {
      console.error("Error generating chart:", error);
      throw new Error(`Failed to generate chart: ${error.message}`);
    }
  }

  /**
   * Generate a historical balance chart for email reports
   *
   * @param {Array} balanceData - Array of balance data points
   * @param {string} address - User wallet address
   * @returns {Object} Chart image details
   */
  static async generateHistoricalBalanceChart(balanceData, address) {
    return this.generateChart({
      data: balanceData,
      title: "Historical Portfolio Balance",
      xField: "date",
      yField: "usd_value",
      address,
      chartType: "line",
    });
  }

  /**
   * Generate a daily PnL chart for email reports
   *
   * @param {Array} pnlData - Array of daily PnL data points
   * @param {string} address - User wallet address
   * @returns {Object} Chart image details
   */
  static async generateDailyPnLChart(pnlData, address) {
    return this.generateChart({
      data: pnlData,
      title: "Daily PnL",
      xField: "date",
      yField: "pnl",
      address,
      chartType: "column",
    });
  }

  /**
   * Generate a ROI chart for email reports
   *
   * @param {Array} roiData - Array of ROI data points
   * @param {string} address - User wallet address
   * @returns {Object} Chart image details
   */
  static async generateROIChart(roiData, address) {
    return this.generateChart({
      data: roiData,
      title: "Return on Investment",
      xField: "date",
      yField: "roi",
      address,
      chartType: "column",
    });
  }
}

module.exports = ChartGenerator;
