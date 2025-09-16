// ================= STABLECOIN CONFIGURATION =================

export const stablecoins = [
  {
    name: "USDS + DAI",
    symbol: "USDS_DAI",
    coingeckoIds: ["dai", "usds"], // Multiple tokens for combined tracking
    contractAddresses: {
      dai: "0x6b175474e89094c44da98b954eedeac495271d0f",
      usds: "0xdC035D45d973E3EC169d2276DDab16f1e407384F"
    },
    category: "maker_ecosystem"
  },
  {
    name: "USDe",
    symbol: "USDe",
    coingeckoIds: ["ethena-usde"],
    contractAddresses: {
      usde: "0x4c9edd5852cd905f086c759e8383e09bff1e68b3"
    },
    category: "synthetic"
  },
  {
    name: "USR",
    symbol: "USR",
    coingeckoIds: ["usr"], // Will need to verify this ID
    contractAddresses: {
      usr: "0x0000000000000000000000000000000000000000" // Placeholder - need actual address
    },
    category: "real_world_assets"
  },
  {
    name: "deUSD",
    symbol: "deUSD",
    coingeckoIds: ["deusd"], // Will need to verify this ID
    contractAddresses: {
      deusd: "0x0000000000000000000000000000000000000000" // Placeholder - need actual address
    },
    category: "decentralized"
  },
  {
    name: "crvUSD",
    symbol: "crvUSD",
    coingeckoIds: ["crvusd"],
    contractAddresses: {
      crvusd: "0xf939e0a03fb07f59a73314e73794be0e57ac1b4e"
    },
    category: "curve_ecosystem"
  },
  {
    name: "USDO",
    symbol: "USDO",
    coingeckoIds: ["usdo"], // Will need to verify this ID
    contractAddresses: {
      usdo: "0x0000000000000000000000000000000000000000" // Placeholder - need actual address
    },
    category: "omnichain"
  },
  {
    name: "fxUSD",
    symbol: "fxUSD",
    coingeckoIds: ["fxusd"], // Will need to verify this ID
    contractAddresses: {
      fxusd: "0x0000000000000000000000000000000000000000" // Placeholder - need actual address
    },
    category: "fx_protocol"
  },
  {
    name: "reUSD",
    symbol: "reUSD",
    coingeckoIds: ["reusd"], // Will need to verify this ID
    contractAddresses: {
      reusd: "0x0000000000000000000000000000000000000000" // Placeholder - need actual address
    },
    category: "reserve_protocol"
  }
];

// Metrics structure definition
export const metricsStructure = {
  supplyMetrics: {
    title: "Supply Metrics",
    metrics: [
      {
        key: "totalSupply",
        label: "Total Supply",
        description: "Total amount of stablecoin in circulation",
        dataSource: "blockchain"
      },
      {
        key: "supplySecuredByBridge",
        label: "Supply secured by bridge",
        description: "Amount of supply backed by bridge collateral",
        dataSource: "bridge_apis"
      },
      {
        key: "mainnetSupply",
        label: "Mainnet Supply",
        description: "Supply on Ethereum mainnet",
        dataSource: "blockchain"
      },
      {
        key: "exclLendingMarketsOtherNetworks",
        label: "Excl. lending markets, other networks",
        description: "Supply excluding lending markets and other networks",
        dataSource: "calculated"
      }
    ]
  },
  mainnetLiquidity: {
    title: "Mainnet Liquidity",
    metrics: [
      {
        key: "curveTVL",
        label: "Curve",
        description: "TVL in Curve pools",
        dataSource: "curve_api"
      },
      {
        key: "balancerTVL",
        label: "Balancer",
        description: "TVL in Balancer pools",
        dataSource: "balancer_subgraph"
      },
      {
        key: "uniswapTVL",
        label: "Uniswap",
        description: "TVL in Uniswap pools",
        dataSource: "uniswap_subgraph"
      },
      {
        key: "sushiswapTVL",
        label: "Sushiswap",
        description: "TVL in Sushiswap pools",
        dataSource: "sushiswap_subgraph"
      },
      {
        key: "totalMainnetLiquidity",
        label: "Total mainnet liquidity",
        description: "Sum of all mainnet DEX liquidity",
        dataSource: "calculated"
      }
    ]
  },
  competitorMarkets: {
    title: "Competitor Markets",
    metrics: [
      {
        key: "aaveCollateral",
        label: "Aave Collateral",
        description: "Amount used as collateral in Aave",
        dataSource: "aave_api"
      },
      {
        key: "morphoCollateral",
        label: "Morpho Collateral",
        description: "Amount used as collateral in Morpho",
        dataSource: "morpho_api"
      },
      {
        key: "eulerCollateral",
        label: "Euler Collateral",
        description: "Amount used as collateral in Euler",
        dataSource: "euler_api"
      },
      {
        key: "fluidCollateral",
        label: "Fluid Collateral",
        description: "Amount used as collateral in Fluid",
        dataSource: "fluid_api"
      },
      {
        key: "totalLendingMarkets",
        label: "Total lending markets",
        description: "Sum of all lending market usage",
        dataSource: "calculated"
      }
    ]
  },
  safetyBuffer: {
    title: "Safety Buffer",
    metrics: [
      {
        key: "insuranceLayerFund",
        label: "Insurance Layer/Fund",
        description: "Insurance fund backing the stablecoin",
        dataSource: "protocol_api"
      },
      {
        key: "collateralizationRatio",
        label: "CR",
        description: "Collateralization Ratio",
        dataSource: "protocol_api"
      },
      {
        key: "stakedSupply",
        label: "Staked Supply",
        description: "Amount of supply that is staked",
        dataSource: "staking_contracts"
      },
      {
        key: "supplyOnMainnetPercent",
        label: "% Supply on Mainnet",
        description: "Percentage of total supply on mainnet",
        dataSource: "calculated"
      },
      {
        key: "factorOfSafety",
        label: "Factor of Safety",
        description: "Overall safety factor calculation",
        dataSource: "calculated"
      }
    ]
  }
};

// Helper function to get all metrics as a flat array
export function getAllMetrics() {
  const allMetrics = [];
  Object.values(metricsStructure).forEach(section => {
    allMetrics.push(...section.metrics);
  });
  return allMetrics;
}

// Helper function to get metrics by section
export function getMetricsBySection(sectionKey) {
  return metricsStructure[sectionKey]?.metrics || [];
}

// Helper function to format large numbers for stablecoin amounts
export function formatStablecoinAmount(num) {
  if (num === null || num === undefined || isNaN(num)) return "N/A";
  
  if (num >= 1e9) {
    return `$${(num / 1e9).toFixed(2)}B`;
  } else if (num >= 1e6) {
    return `$${(num / 1e6).toFixed(2)}M`;
  } else if (num >= 1e3) {
    return `$${(num / 1e3).toFixed(2)}K`;
  } else {
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

// Helper function to format percentages
export function formatPercentage(ratio) {
  if (ratio === null || ratio === undefined || isNaN(ratio)) return "N/A";
  return `${(ratio * 100).toFixed(1)}%`;
}

// Helper function to format ratios
export function formatRatio(ratio) {
  if (ratio === null || ratio === undefined || isNaN(ratio)) return "N/A";
  return ratio.toFixed(2);
}

// Data source endpoints and configurations
export const dataSourceConfig = {
  bridge_apis: {
    // Configuration for bridge data APIs
    endpoints: {
      // Add specific bridge API endpoints here
    }
  },
  lending_markets: {
    aave: {
      subgraph: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3",
      contractAddresses: {
        // Aave V3 contract addresses
      }
    },
    morpho: {
      api: "https://api.morpho.org",
      contractAddresses: {
        // Morpho contract addresses
      }
    },
    euler: {
      api: "https://api.euler.finance",
      contractAddresses: {
        // Euler contract addresses
      }
    },
    fluid: {
      api: "https://api.fluid.instadapp.io",
      contractAddresses: {
        // Fluid contract addresses
      }
    }
  },
  staking_contracts: {
    // Staking contract addresses for each stablecoin
  }
};
