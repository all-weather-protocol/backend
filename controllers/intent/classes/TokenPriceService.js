import axios from "axios";

class PriceService {
  static STATIC_PRICES = {
    usd: 1,
    usdc: 1,
    usdt: 1,
    dai: 1,
    frax: 0.997,
    usde: 1,
    usdx: 0.9971,
    gho: 0.9986,
    susd: 0.9837,
  };

  constructor(apiUrl) {
    this.apiUrl = apiUrl;
  }

  async fetchPrice(token, priceID) {
    const { key, provider, uniqueId } = this._getPriceServiceInfo(priceID);

    // Check static prices first
    if (token.toLowerCase() in PriceService.STATIC_PRICES) {
      return PriceService.STATIC_PRICES[token.toLowerCase()];
    }

    try {
      const endpoint = this._buildEndpoint(provider, key);
      const response = await axios.get(endpoint, {
        timeout: 30000,
        validateStatus: (status) => status >= 200 && status < 500,
      });

      if (response.data?.price != null) {
        return response.data.price;
      }
      throw new Error("Invalid price data received");
    } catch (error) {
      console.error(`Failed to fetch price for ${token}:`, error.message);
      return this._getFallbackPrice(token);
    }
  }

  _getFallbackPrice(token) {
    return PriceService.STATIC_PRICES[token.toLowerCase()] || null;
  }

  _getPriceServiceInfo(priceID) {
    if (priceID?.coinmarketcapApiId) {
      return {
        key: priceID.coinmarketcapApiId,
        provider: "coinmarketcap",
        uniqueId: priceID.coinmarketcapApiId,
      };
    } else if (priceID?.geckoterminal) {
      return {
        key: priceID.geckoterminal,
        provider: "geckoterminal",
        uniqueId: priceID.geckoterminal.chain + priceID.geckoterminal.address,
      };
    }
    throw new Error(`Invalid price ID format: ${JSON.stringify(priceID)}`);
  }

  _buildEndpoint(provider, key) {
    if (provider === "coinmarketcap") {
      return `${this.apiUrl}/token/${key}/price`;
    } else if (provider === "geckoterminal") {
      return `${this.apiUrl}/token/${key.chain}/${key.address}/price`;
    }
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

class TokenPriceBatcher {
  constructor(priceService) {
    this.priceService = priceService;
  }

  async fetchPrices(tokensToFetch) {
    const prices = { ...PriceService.STATIC_PRICES };
    const promises = tokensToFetch.map(async ([token, priceID]) => {
      const price = await this.priceService.fetchPrice(token, priceID);
      prices[token] = price;
    });

    await Promise.all(promises);
    return prices;
  }
}

export { TokenPriceBatcher, PriceService };
