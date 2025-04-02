import { BasePortfolio } from "../BasePortfolio.js";
import assert from "assert";

const WEIGHT_EPSILON = 0.00001; // Single source of truth for weight comparison precision

class VaultStrategy {
  constructor(strategy, scaleFactor = 1) {
    this.originalStrategy = strategy;
    this.scaleFactor = scaleFactor;
  }

  getScaledWeights() {
    const scaled = {};
    for (const [category, chains] of Object.entries(this.originalStrategy)) {
      scaled[category] = {};
      for (const [chain, protocols] of Object.entries(chains)) {
        scaled[category][chain] = protocols.map((protocol) => ({
          ...protocol,
          weight: protocol.weight * this.scaleFactor,
        }));
      }
    }
    return scaled;
  }
}

// Example of how to use it in a balanced portfolio
export class BaseVault extends BasePortfolio {
  constructor(strategies, weightMapping, name) {
    // Transform imports first
    const transformedStrategies = BaseVault._transformImports(strategies);

    // First validate weightMapping
    const validatedWeightMapping =
      BaseVault._validateWeightMapping(weightMapping);

    // Validate no duplicates
    BaseVault._validateNoDuplicates(transformedStrategies);

    // Then normalize weights within each category
    const normalizedStrategies = BaseVault._normalizeStrategyWeights(
      transformedStrategies,
    );

    // Then scale according to normalized weightMapping
    const scaledStrategy = {};

    for (const [category, allocation] of Object.entries(
      validatedWeightMapping,
    )) {
      if (normalizedStrategies[category]) {
        const strategy = new VaultStrategy(
          { [category]: normalizedStrategies[category] },
          allocation,
        );
        Object.assign(scaledStrategy, strategy.getScaledWeights());
      }
    }

    super(scaledStrategy, validatedWeightMapping, name);

    // Move validation here, after super()
    this.validateStrategyWeights();
  }

  static _transformImports(strategies) {
    const transformed = { ...strategies }; // Shallow clone first level

    for (const [category, data] of Object.entries(transformed)) {
      if (data.imports) {
        // For each import, merge its strategies into the main strategy
        data.imports.forEach(({ strategy, weight }) => {
          for (const [chain, protocols] of Object.entries(strategy)) {
            if (!data[chain]) {
              data[chain] = [];
            }
            // Add protocols while preserving the original protocol instances
            data[chain].push(
              ...protocols.map((protocol) => ({
                interface: protocol.interface, // Keep the original protocol instance
                weight: protocol.weight * weight,
              })),
            );
          }
        });
        // Remove the imports property
        delete data.imports;
      }
    }

    return transformed;
  }

  static _validateNoDuplicates(strategies) {
    for (const [category, data] of Object.entries(strategies)) {
      const seen = new Set();

      // Handle all protocols (imports are already transformed)
      for (const [chain, protocols] of Object.entries(data)) {
        protocols.forEach((protocol) => {
          const identifier = protocol.interface?.uniqueId();
          if (seen.has(identifier)) {
            throw new Error(
              `Duplicate protocol found in ${category}/${chain}: ${identifier}`,
            );
          }
          seen.add(identifier);
        });
      }
    }
  }
  // Renamed from _normalizeWeightMapping to _validateWeightMapping
  static _validateWeightMapping(weightMapping) {
    // Calculate total allocation
    const total = Object.values(weightMapping).reduce(
      (sum, weight) => sum + weight,
      0,
    );

    // Validate that weights sum to 1
    if (Math.abs(total - 1) >= WEIGHT_EPSILON) {
      throw new Error(`Weight mapping must sum to 1, got ${total}`);
    }

    return weightMapping;
  }

  static _normalizeStrategyWeights(strategies) {
    const normalized = { ...strategies };

    // For each category
    Object.entries(normalized).forEach(([category, chains]) => {
      // Calculate total weight across all chains in this category
      let categoryTotal = 0;
      Object.values(chains).forEach((protocols) => {
        protocols.forEach((protocol) => {
          categoryTotal += protocol.weight;
        });
      });

      // Skip normalization if total is already 1 (within epsilon)
      if (Math.abs(categoryTotal - 1) < WEIGHT_EPSILON) {
        return;
      }

      // Normalize weights by dividing by total
      Object.entries(chains).forEach(([chain, protocols]) => {
        normalized[category][chain] = protocols.map((protocol) => ({
          ...protocol,
          weight: protocol.weight / categoryTotal,
        }));
      });

      // Verify normalization
      let verifyTotal = 0;
      Object.values(normalized[category]).forEach((protocols) => {
        protocols.forEach((protocol) => {
          verifyTotal += protocol.weight;
        });
      });
    });

    return normalized;
  }

  validateStrategyWeights() {
    Object.entries(this.strategy).forEach(([category, chainStrategies]) => {
      let categoryTotal = 0;
      Object.entries(chainStrategies).forEach(([chain, protocols]) => {
        protocols.forEach((protocol) => {
          categoryTotal += protocol.weight;
        });
      });

      const expectedWeight = this.weightMapping[category];

      assert(
        Math.abs(categoryTotal - expectedWeight) < WEIGHT_EPSILON,
        `Category ${category} weights sum to ${categoryTotal}, expected ${expectedWeight}`,
      );
    });
  }
}
