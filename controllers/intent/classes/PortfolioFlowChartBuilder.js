export class PortfolioFlowChartBuilder {
  constructor(portfolio) {
    this.portfolio = portfolio;
  }

  _isRebalanceAction(actionName) {
    return ["rebalance", "crossChainRebalance", "localRebalance"].includes(
      actionName,
    );
  }

  _buildStandardFlowChart(actionName, actionParams, flowChartData, chainNodes) {
    const chainSet = new Set();
    for (const [category, protocolsInThisCategory] of Object.entries(
      this.portfolio.strategy,
    )) {
      for (const [chain, protocolsOnThisChain] of Object.entries(
        protocolsInThisCategory,
      )) {
        let chainNode;
        if (!chainSet.has(chain)) {
          chainSet.add(chain);
          chainNode = {
            id: chain,
            name: actionName,
            chain: chain,
            category: category,
            imgSrc: `/chainPicturesWebp/${chain}.webp`,
          };
          chainNodes.push(chainNode);
        } else {
          chainNode = chainNodes.find((node) => node.id === chain);
        }

        for (const protocol of protocolsOnThisChain) {
          let stepsData = [];
          if (protocol.weight === 0) continue;
          if (actionName === "zapIn") {
            stepsData = protocol.interface.getZapInFlowChartData(
              actionParams.tokenInSymbol,
              actionParams.tokenInAddress,
              protocol.weight,
            );
          } else if (actionName === "stake") {
            stepsData = protocol.interface.getStakeFlowChartData();
          } else if (actionName === "transfer") {
            stepsData = protocol.interface.getTransferFlowChartData(
              protocol.weight,
            );
          } else if (actionName === "zapOut") {
            stepsData = protocol.interface.getZapOutFlowChartData(
              actionParams.outputToken,
              actionParams.outputTokenAddress,
              protocol.weight,
            );
          } else if (actionName === "claimAndSwap") {
            stepsData = protocol.interface.getClaimFlowChartData(
              actionParams.outputToken,
              actionParams.outputTokenAddress,
            );
          } else {
            throw new Error(`Invalid action name ${actionName}`);
          }
          const currentChainToProtocolNodeEdge = {
            id: `edge-${chainNode.id}-${protocol.interface.uniqueId()}`,
            source: chainNode.id,
            target: stepsData.nodes[0].id,
            data: {
              ratio: protocol.weight,
            },
          };
          flowChartData.nodes = flowChartData.nodes.concat(stepsData.nodes);
          flowChartData.edges = flowChartData.edges.concat(
            stepsData.edges.concat(currentChainToProtocolNodeEdge),
          );
        }
      }
    }
  }

  buildFlowChart(actionName, actionParams) {
    let flowChartData = {
      nodes: [],
      edges: [],
    };
    const chainNodes = [];
    if (this._isRebalanceAction(actionName)) {
      const chainSet = new Set();
      let chainNode;
      let endOfZapOutNodeOnThisChain;
      let middleTokenConfig;
      const zapOutChains =
        actionParams.rebalancableUsdBalanceDict.metadata.rebalanceActionsByChain
          .filter((action) => this._isRebalanceAction(action.actionName))
          .map((action) => action.chain);
      for (const [key, protocolObj] of Object.entries(
        actionParams.rebalancableUsdBalanceDict,
      )) {
        if (
          key === "pendingRewards" ||
          key === "metadata" ||
          !zapOutChains.includes(protocolObj.chain)
        )
          continue;
        if (protocolObj.weightDiff > this.portfolio.rebalanceThreshold()) {
          if (!chainSet.has(protocolObj.chain)) {
            chainSet.add(protocolObj.chain);
            chainNode = {
              id: protocolObj.chain,
              name: actionName,
              chain: protocolObj.chain,
              imgSrc: `/chainPicturesWebp/${protocolObj.chain}.webp`,
            };
            endOfZapOutNodeOnThisChain = {
              id: `endOfZapOutOn${protocolObj.chain}`,
              name: "Start Zapping In",
              chain: protocolObj.chain,
              imgSrc: `/chainPicturesWebp/${protocolObj.chain}.webp`,
            };
            chainNodes.push(chainNode);
            flowChartData.nodes.push(endOfZapOutNodeOnThisChain);
            middleTokenConfig = this.portfolio._getRebalanceMiddleTokenConfig(
              protocolObj.chain,
            );
          }
          const rebalanceRatio =
            protocolObj.weightDiff / protocolObj.positiveWeigtDiffSum;
          const stepsData =
            protocolObj.protocol.interface.getZapOutFlowChartData(
              middleTokenConfig.symbol,
              middleTokenConfig.address,
              rebalanceRatio,
            );
          const currentChainToProtocolNodeEdge = {
            id: `edge-${
              chainNode.id
            }-${protocolObj.protocol.interface.uniqueId()}`,
            source: chainNode.id,
            target: stepsData.nodes[0].id,
            data: {
              ratio: rebalanceRatio,
            },
          };
          const endOfZapOutOfThisProtocolToEndOfZapOutNodeEdge = {
            id: `edge-${
              stepsData.nodes[stepsData.nodes.length - 1].id
            }-endOfZapOut`,
            source: stepsData.nodes[stepsData.nodes.length - 1].id,
            target: endOfZapOutNodeOnThisChain.id,
            data: {
              ratio: rebalanceRatio,
            },
          };
          flowChartData.nodes = flowChartData.nodes.concat(stepsData.nodes);
          flowChartData.edges = flowChartData.edges.concat(
            stepsData.edges.concat([
              currentChainToProtocolNodeEdge,
              endOfZapOutOfThisProtocolToEndOfZapOutNodeEdge,
            ]),
          );
        }
      }
      // Start Zap In
      for (const [key, protocolObj] of Object.entries(
        actionParams.rebalancableUsdBalanceDict,
      )) {
        if (key === "pendingRewards" || key === "metadata") continue;
        if (protocolObj.weightDiff < 0) {
          const zapInRatio =
            -protocolObj.weightDiff / protocolObj.negativeWeigtDiffSum;
          const stepsData =
            protocolObj.protocol.interface.getZapInFlowChartData(
              actionParams.tokenInSymbol,
              actionParams.tokenInAddress,
              zapInRatio,
            );
          if (!chainSet.has(protocolObj.chain)) {
            chainSet.add(protocolObj.chain);
            chainNode = {
              id: protocolObj.chain,
              name: `Bridge to ${protocolObj.chain}`,
              chain: protocolObj.chain,
              imgSrc: `/chainPicturesWebp/${protocolObj.chain}.webp`,
            };
            const bridgeEdge = {
              id: `edge-${endOfZapOutNodeOnThisChain.id}-${chainNode.id}`,
              source: endOfZapOutNodeOnThisChain.id,
              target: chainNode.id,
              data: {
                ratio: zapInRatio,
              },
            };
            chainNodes.push(chainNode);
            flowChartData.edges.push(bridgeEdge);
          }
          const endOfZapOutNodeToZapInNodeEdge = {
            id: `edge-${
              endOfZapOutNodeOnThisChain.id
            }-${protocolObj.protocol.interface.uniqueId()}`,
            source:
              actionParams.chainMetadata.name
                .toLowerCase()
                .replace(" one", "")
                .replace(" mainnet", "") === protocolObj.chain
                ? endOfZapOutNodeOnThisChain.id
                : protocolObj.chain,
            target: stepsData.nodes[0].id,
            data: {
              ratio: zapInRatio,
            },
          };
          flowChartData.nodes = flowChartData.nodes.concat(stepsData.nodes);
          flowChartData.edges = flowChartData.edges.concat(
            stepsData.edges.concat([endOfZapOutNodeToZapInNodeEdge]),
          );
        }
      }
    } else {
      this._buildStandardFlowChart(
        actionName,
        actionParams,
        flowChartData,
        chainNodes,
      );
    }
    return {
      nodes: chainNodes.concat(flowChartData.nodes),
      edges: flowChartData.edges,
    };
  }
}
