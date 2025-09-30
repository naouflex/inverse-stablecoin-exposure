// ================= STABLECOIN CONFIGURATION =================

export const stablecoins = [
  {
    name: "USDS + DAI",
    symbol: "USDS_DAI",
    coingeckoIds: ["usds"], // Multiple tokens - will sum their values
    contractAddresses: {
      dai: "0x6b175474e89094c44da98b954eedeac495271d0f",
      usds: "0xdc035d45d973e3ec169d2276ddab16f1e407384f",
      susds: "0xa3931d71877c0e7a3148cb7eb4463524fec27fbd"
    },
    stakedCoingeckoIds: ["susds"], // sUSDS for staked supply
    stakedContractAddress: "0xa3931d71877c0e7a3148cb7eb4463524fec27fbd", // sUSDS contract
    insuranceFund: {
      monitoredAddresses: [
      ],
      tokensToMonitor: [
      ],
      lpTokensToMonitor: [
        {
          lpTokenAddress: "", // sDAI/USDS Curve LP
          poolAddress: "",
          underlyingTokens: [
            "",
            "" 
          ],
          protocol: "curve"
        }
      ]
    },
    manualDataSources: {
      bridgeSupply: {
        dataUrl: "https://info.sky.money/multichain", // URL where operator can find bridge supply data
        description: "Check Sky Money app for cross-chain supply"
      },
      collateralizationRatio: {
        dataUrl: "https://info.sky.money/collateral", // URL where operator can find CR data
        description: "DAI Stats dashboard for collateralization ratio"
      }
    },
    category: "sky"
  },
  {
    name: "USDe",
    symbol: "USDe",
    coingeckoIds: ["ethena-usde"],
    contractAddresses: {
      usde: "0x4c9edd5852cd905f086c759e8383e09bff1e68b3",
      susde: "0x9d39a5de30e57443bff2a8307a4256c8797a3497"
    },
    stakedCoingeckoIds: ["ethena-staked-usde"], // sUSDe for staked supply
    stakedContractAddress: "0x9d39a5de30e57443bff2a8307a4256c8797a3497", // sUSDe contract
    insuranceFund: {
      monitoredAddresses: [
        "0x2b5ab59163a6e93b4486f6055d33ca4a115dd4d5" 
      ],
      tokensToMonitor: [
        "0xc139190f447e929f090edeb554d95abb8b18ac1c", // USDtb
      ],
      lpTokensToMonitor: [
        {
          lpTokenAddress: "0xC2921134073151490193AC7369313c8e0b08e1E7", // USDtb/USDC
          poolAddress: "0xC2921134073151490193AC7369313c8e0b08e1E7",
          underlyingTokens: [
            "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDe
            "0xC139190F447e929f090Edeb554D95AbB8b18aC1C"  // FRAX
          ],
          protocol: "curve"
        }
      ]
    },
    manualDataSources: {
      bridgeSupply: {
        dataUrl: "https://layerzeroscan.com/oft/USDe/Ethena",
        description: "Check Ethena app for cross-chain supply"
      },
      collateralizationRatio: {
        dataUrl: "https://app.ethena.fi/dashboards/transparency",
        description: "Ethena transparency dashboard"
      }
    },
    category: "ethena"
  },
  {
    name: "USR",
    symbol: "USR",
    coingeckoIds: ["resolv-usr"], // May need to verify
    contractAddresses: {
      usr: "0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110" // Placeholder - need actual address
    },
    stakedCoingeckoIds: ["resolv-wstusr"], // No staked version available
    stakedContractAddress: "0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055",
    insuranceFund: {
      type: "fdv",
      rlpTokenAddress: "0x4956b52ae2ff65d74ca2d61207523288e4528f96", // Resolv RLP token contract
      rlpCoingeckoId: "resolv-rlp", // CoinGecko ID for RLP token (needs verification)
      monitoredAddresses: [],
      tokensToMonitor: [],
      lpTokensToMonitor: []
    },
    manualDataSources: {
      bridgeSupply: {
        dataUrl: "https://layerzeroscan.com/oft/USR/Resolv%20Labs",
        description: "Check Resolv app for cross-chain supply"
      },
      collateralizationRatio: {
        dataUrl: "https://app.resolv.xyz/collateral-pool",
        description: "Resolv app dashboard"
      }
    },
    category: "resolv"
  },
  {
    name: "deUSD",
    symbol: "deUSD",
    coingeckoIds: ["elixir-deusd"], // May need to verify
    contractAddresses: {
      deusd: "0x15700b564ca08d9439c58ca5053166e8317aa138",
      sdeusd: "0x5c5b196abe0d54485975d1ec29617d42d9198326"
    },
    stakedCoingeckoIds: ["elixir-staked-deusd"], // sdeUSD for staked supply
    stakedContractAddress: "0x5c5b196abe0d54485975d1ec29617d42d9198326", // sdeUSD contract
    insuranceFund: {
      monitoredAddresses: [
      ],
      tokensToMonitor: [
      ],
      lpTokensToMonitor: [
        {
          lpTokenAddress: "", // sDAI/USDS Curve LP
          poolAddress: "",
          underlyingTokens: [
            "",
            "" 
          ],
          protocol: "curve"
        }
      ]
    },
    manualDataSources: {
      bridgeSupply: {
        dataUrl: "https://snowtrace.io/token/0xB57B25851fE2311CC3fE511c8F10E868932e0680?type=erc20&chainid=43114",
        description: "Check Elixir platform for cross-chain supply"
      },
      collateralizationRatio: {
        dataUrl: "https://www.elixir.xyz/deusd/dashboard",
        description: "Elixir dashboard for collateralization data"
      }
    },
    category: "elixir"
  },
  {
    name: "crvUSD",
    symbol: "crvUSD",
    coingeckoIds: ["crvusd"],
    contractAddresses: {
      crvusd: "0xf939e0a03fb07f59a73314e73794be0e57ac1b4e",
      scrvusd: "0x0655977feb2f289a4ab78af67bab0d17aab84367"
    },
    stakedCoingeckoIds: ["savings-crvusd"], // scrvUSD for staked supply
    stakedContractAddress: "0x0655977feb2f289a4ab78af67bab0d17aab84367", // scrvUSD contract
    insuranceFund: {
      monitoredAddresses: [
      ],
      tokensToMonitor: [
      ],
      lpTokensToMonitor: [
        {
          lpTokenAddress: "",
          poolAddress: "",
          underlyingTokens: [
            "",
            "" 
          ],
          protocol: "curve"
        }
      ]
    },
    manualDataSources: {
      bridgeSupply: {
        dataUrl: "https://layerzeroscan.com/oft/crvUSD/Curve%20Finance",
        description: "Check Curve Finance for cross-chain crvUSD supply"
      },
      collateralizationRatio: {
        dataUrl: "https://curvemonitor.com/platform/crvusd",
        description: "crvUSD markets dashboard"
      }
    },
    category: "curve"
  },
  {
    name: "USDO",
    symbol: "USDO",
    coingeckoIds: ["openeden-open-dollar"], 
    contractAddresses: {
      usdo: "0x8238884ec9668ef77b90c6dff4d1a9f4f4823bfe", // USDO token
      cusdo: "0xad55aebc9b8c03fc43cd9f62260391c13c23e7c0" // cUSDO token (from Curve pool)
    },
    stakedCoingeckoIds: ["compounding-open-dollar"], // No staked version available
    stakedContractAddress: "0xad55aebc9b8c03fc43cd9f62260391c13c23e7c0",
    insuranceFund: {
      monitoredAddresses: [
      ],
      tokensToMonitor: [
      ],
      lpTokensToMonitor: [
        {
          lpTokenAddress: "", // sDAI/USDS Curve LP
          poolAddress: "",
          underlyingTokens: [
            "",
            "" 
          ],
          protocol: "curve"
        }
      ]
    },
    manualDataSources: {
      bridgeSupply: {
        dataUrl: "https://docs.chain.link/ccip/directory/mainnet/token/USDO",
        description: "Check OpenEden for cross-chain supply data"
      },
      collateralizationRatio: {
        dataUrl: "https://openeden.com/usdo/transparency",
        description: "OpenEden transparency page"
      }
    },
    category: "openeden"
  },
  {
    name: "fxUSD",
    symbol: "fxUSD",
    coingeckoIds: ["f-x-protocol-fxusd"], 
    contractAddresses: {
      fxusd: "0x085780639cc2cacd35e474e71f4d000e2405d8f6"
    },
    stakedCoingeckoIds: ["fx-usd-saving"], // No staked version available
    stakedContractAddress: "0x7743e50f534a7f9f1791dde7dcd89f7783eefc39",
    insuranceFund: {
      monitoredAddresses: [
      ],
      tokensToMonitor: [
      ],
      lpTokensToMonitor: [
        {
          lpTokenAddress: "", // sDAI/USDS Curve LP
          poolAddress: "",
          underlyingTokens: [
            "",
            "" 
          ],
          protocol: "curve"
        }
      ]
    },
    manualDataSources: {
      bridgeSupply: {
        dataUrl: "No bridged supply",
        description: "Check f(x) Protocol for cross-chain supply"
      },
      collateralizationRatio: {
        dataUrl: "https://fx.aladdin.club/v2/statistics/",
        description: "f(x) Protocol dashboard"
      }
    },
    category: "fx"
  },
  {
    name: "reUSD",
    symbol: "reUSD",
    coingeckoIds: ["resupply-usd"], 
    contractAddresses: {
      reusd: "0x57ab1e0003f623289cd798b1824be09a793e4bec"
    },
    stakedCoingeckoIds: [], // No staked version available
    stakedContractAddress: "0x557AB1e003951A73c12D16F0fEA8490E39C33C35",
    insuranceFund: {
      monitoredAddresses: [
        "0x00000000efe883b3304aFf71eaCf72Dbc3e1b577"
      ],
      tokensToMonitor: [
        "0x57ab1e0003f623289cd798b1824be09a793e4bec",
        "0x419905009e4656fdc02418c7df35b1e61ed5f726"
      ],
      lpTokensToMonitor: [
        {
          lpTokenAddress: "", 
          poolAddress: "",
          underlyingTokens: [
            "",
            "" 
          ],
          protocol: "curve"
        }
      ]
    },
    manualDataSources: {
      bridgeSupply: {
        dataUrl: "No bridged supply",
        description: "Check Reserve Protocol for cross-chain reUSD supply"
      },
      collateralizationRatio: {
        dataUrl: "https://hippo.army/",
        description: "Reserve Protocol dashboard for collateralization data"
      }
    },
    category: "reserve"
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
