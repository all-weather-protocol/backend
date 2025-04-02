import { approve } from "../../../../utils/general.js";

class BaseBridge {
  sdk;
  constructor(name) {
    this.name = name;
  }
  async getBridgeTxns(
    owner,
    fromChainId,
    toChainId,
    fromToken,
    toToken,
    amount,
    updateProgress,
  ) {
    try {
      const [customBridgeTxn, bridgeAddress] = await this.customBridgeTxn(
        owner,
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        amount,
        updateProgress,
      );
      const approveTxn = approve(
        fromToken,
        bridgeAddress,
        amount,
        updateProgress,
        fromChainId,
      );

      return [approveTxn, customBridgeTxn];
    } catch (error) {
      console.error("Error in getBridgeTxns:", error);
      return [];
    }
  }

  async customBridgeTxn(
    owner,
    fromChainId,
    toChainId,
    fromToken,
    toToken,
    amount,
    updateProgress,
  ) {
    // Implementation
    throw new Error("Method 'customBridgeTxn()' must be implemented.");
  }
}

export default BaseBridge;
