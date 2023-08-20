const express = require('express');
const bodyParser = require('body-parser');
const { Router, toAddress, MarketEntity } = require('@pendle/sdk-v2');
const { ethers } = require("ethers");
const { config } = require('dotenv');
config();
require('events').EventEmitter.defaultMaxListeners = 20; // or another number that suits your needs

const app = express();
const port = 3002;
const provider = new ethers.providers.JsonRpcProvider(process.env.API_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);    


// Middleware to parse JSON requests
app.use(bodyParser.json());

// GET endpoint to return a welcome message
app.get('/', (req, res) => {
  res.send('Welcome to the basic backend service!');
});

// POST endpoint to accept JSON data
app.get('/pendle/zapIn', async (req, res) => {
  const chainId = req.query.chainId;
  const poolAddress = req.query.poolAddress;
  const amount = req.query.amount;
  const slippage = req.query.slippage;
  const tokenInAddress = req.query.tokenInAddress;
  const pendleZapInData = await getPendleZapInData(parseInt(chainId, 10), poolAddress, ethers.utils.parseEther(amount), parseFloat(slippage), tokenInAddress)
  res.json(pendleZapInData);
});

app.get('/pendle/zapOut', async (req, res) => {
  const chainId = req.query.chainId;
  const poolAddress = req.query.poolAddress;
  const tokenOutAddress = req.query.tokenOutAddress;
  const amount = req.query.amount;
  const slippage = req.query.slippage;
  const pendleZapOutData = await getPendleZapOutData(chainId, poolAddress, tokenOutAddress, amount, slippage)
  res.json(pendleZapOutData);
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

async function getPendleZapInData(chainId, poolAddress, amount, slippage, tokenInAddress) {
    const router = Router.getRouterWithKyberAggregator({
      chainId: chainId,
      provider,
      signer,
    });
  
    const GLP_POOL_ADDRESS = toAddress(poolAddress);
    const TOKEN_IN_ADDRESS = toAddress(tokenInAddress);
    return await router.addLiquiditySingleToken(
      GLP_POOL_ADDRESS,
      TOKEN_IN_ADDRESS,
      amount,
      slippage,
      { method: 'extractParams' }
    );
  }
  async function getPendleZapOutData(chainId, poolAddress, tokenOutAddress, amount, slippage) {
    const marketContract = new MarketEntity(toAddress(poolAddress), {
      chainId: chainId,
      provider,
      signer: signer
    });
    const router = Router.getRouterWithKyberAggregator({
      chainId: chainId,
      provider,
      signer,
    });
    // TODO(david): ask pendle team about this. Is it possible to extract Param before approving contract?
    // await marketContract.approve(router.address, amount).then((tx)=> tx.wait());
    // await marketContract.approve(router.address, ethers.BigNumber.from('115792089237316195423570985008687907853269984665640564039457')).then((tx) => tx.wait());
  
    return await router.removeLiquiditySingleToken(
      toAddress(poolAddress),
      amount,
      toAddress(tokenOutAddress),
      slippage,
      { method: 'extractParams' }
    );
  }
