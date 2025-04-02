import AcrossBridge from "./across.js";
async function getTheBestBridge() {
  const rates = await checkRatesBetweenBridges();
  return rates[0];
}
async function checkRatesBetweenBridges() {
  let rates = [];
  // const squid = new SquidBridge();
  // await squid.init();
  // rates.push(squid);
  const across = new AcrossBridge();
  await across.init();
  rates.push(across);
  // we need to sort bridges by rates in the future
  return rates;
}

export default getTheBestBridge;
