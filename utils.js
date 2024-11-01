const castStringToDate = (dateStr) => {
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

module.exports = { castStringToDate };
