// ================= MANUAL METRIC DEFAULTS =================
// Optional configuration file for default values of manually-entered metrics
// These defaults will be used when no manual entry has been made by an operator
// 
// To use this file:
// 1. Uncomment and fill in values for the stablecoins you want to provide defaults for
// 2. Run the server endpoint to load defaults: POST /api/manual-data/load-defaults (requires operator key)
// 3. Defaults will only be loaded if no manual entry already exists for that metric
//
// Values can be updated anytime by operators through the normal manual entry UI
// Those manual entries will always take precedence over these defaults

export const manualDefaults = {
  USDS_DAI: {
    bridgeSupply: 202768477,  // $202,768,477
    collateralizationRatio: 1.4740  // 147.40%
  },
  
  USDe: {
    bridgeSupply: 324696777,  // $324,696,777
    collateralizationRatio: 1.0057  // 100.57%
  },
  
  USR: {
    bridgeSupply: 9253865,  // $9,253,865
    collateralizationRatio: 1.5160  // 151.60%
  },
  
  deUSD: {
    bridgeSupply: 28450791,  // $28,450,791
    collateralizationRatio: 1.0069  // 100.69%
  },
  
  crvUSD: {
    bridgeSupply: 1296,  // $1,296
    collateralizationRatio: 2.0228  // 202.28%
  },
  
  USDO: {
    bridgeSupply: 1503626,  // $1,503,626
    collateralizationRatio: 1.0364  // 103.64%
  },
  
  fxUSD: {
    bridgeSupply: 0,  // $0
    collateralizationRatio: 1.8839  // 188.39%
  },
  
  reUSD: {
    bridgeSupply: 0,  // $0
    collateralizationRatio: 1.1067  // 110.67%
  }
};

// Helper function to validate default values
export function validateDefaults(defaults) {
  const errors = [];
  
  for (const [symbol, metrics] of Object.entries(defaults)) {
    if (metrics.bridgeSupply !== undefined) {
      if (typeof metrics.bridgeSupply !== 'number' || metrics.bridgeSupply < 0) {
        errors.push(`${symbol}.bridgeSupply must be a non-negative number`);
      }
    }
    
    if (metrics.collateralizationRatio !== undefined) {
      if (typeof metrics.collateralizationRatio !== 'number' || metrics.collateralizationRatio <= 0) {
        errors.push(`${symbol}.collateralizationRatio must be a positive number`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Helper function to check if a symbol has defaults configured
export function hasDefaults(symbol) {
  return symbol in manualDefaults && 
         (manualDefaults[symbol].bridgeSupply !== undefined || 
          manualDefaults[symbol].collateralizationRatio !== undefined);
}

// Helper function to get defaults for a specific symbol
export function getDefaultsForSymbol(symbol) {
  return manualDefaults[symbol] || {};
}

// Helper function to get all symbols with configured defaults
export function getSymbolsWithDefaults() {
  return Object.keys(manualDefaults);
}

