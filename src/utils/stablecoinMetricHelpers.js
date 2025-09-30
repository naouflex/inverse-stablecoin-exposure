/**
 * Stablecoin Metric Helper Functions
 * 
 * Utilities to extract and organize metric values from stablecoin data
 * Similar to ProtocolRow pattern but adapted for column-based stablecoin structure
 */

// ================= FACTOR OF SAFETY CALCULATION HELPERS =================

/**
 * Calculate Insurance Fund component of Factor of Safety
 * Returns score based on insurance fund size relative to total supply
 */
function getInsuranceComponent(totalSupply, insuranceFund) {
  if (totalSupply === 0) return -0.05;
  
  const ratio = insuranceFund / totalSupply;
  
  if (ratio > 0.5) return 0.2;   // Insurance > 50% of supply
  if (ratio > 0.25) return 0.1;  // Insurance > 25% of supply
  if (ratio > 0.1) return 0.05;  // Insurance > 10% of supply
  return -0.05;                  // Insurance < 10% of supply
}

/**
 * Calculate Collateralization Ratio component of Factor of Safety
 * Returns score based on how over-collateralized the stablecoin is
 */
function getCRComponent(cr) {
  if (cr > 1.5) return 0.2;   // CR > 150%
  if (cr > 1.1) return 0.1;   // CR > 110%
  if (cr > 1.0) return 0.05;  // CR > 100%
  return -0.1;                // CR <= 100% (under-collateralized)
}

/**
 * Calculate Staked Supply component of Factor of Safety
 * Returns score based on what % of supply is staked (shows commitment)
 */
function getStakedComponent(totalSupply, stakedSupply) {
  if (totalSupply === 0) return 0;
  
  const ratio = stakedSupply / totalSupply;
  
  if (ratio > 0.5) return 0.05;  // Staked > 50% of supply
  return 0;
}

/**
 * Calculate Mainnet Supply component of Factor of Safety
 * Returns score based on what % of supply is on mainnet (less bridge risk)
 */
function getMainnetComponent(supplyOnMainnetPercent) {
  if (supplyOnMainnetPercent > 0.9) return 0.05;  // > 90% on mainnet
  return 0;
}

/**
 * Calculate overall Factor of Safety score
 * Composite risk score based on multiple safety metrics
 */
function calculateFactorOfSafety(totalSupply, insuranceFund, cr, stakedSupply, supplyOnMainnetPercent) {
  const baseScore = 0.5;
  const insuranceScore = getInsuranceComponent(totalSupply, insuranceFund);
  const crScore = getCRComponent(cr);
  const stakedScore = getStakedComponent(totalSupply, stakedSupply);
  const mainnetScore = getMainnetComponent(supplyOnMainnetPercent);
  
  return baseScore + insuranceScore + crScore + stakedScore + mainnetScore;
}

// ================= METRIC EXTRACTION FUNCTIONS =================

/**
 * Extract all metric values from stablecoin metrics in an organized structure
 * @param {object} metrics - The metrics object from useStablecoinCompleteMetrics
 * @param {object} stablecoin - The stablecoin configuration object
 * @returns {object} Organized metric values with loading states
 */
export function extractStablecoinMetricValues(metrics, stablecoin) {
  if (!metrics) {
    return {
      metricValues: {},
      isLoading: true,
      hasError: false
    };
  }

  // Extract basic values first (needed for Factor of Safety calculation)
  const totalSupplyValue = metrics.totalSupply?.data?.data || 0;
  const insuranceFundValue = metrics.insuranceFund?.data?.data || 0;
  const crValue = metrics.collateralizationRatio?.data?.data || 0;
  const stakedSupplyValue = metrics.stakedSupply?.data?.data || 0;
  const supplyOnMainnetPercentValue = metrics.supplyOnMainnetPercent?.data || 0;

  return {
    // Supply Metrics
    totalSupply: {
      value: metrics.totalSupply?.data?.data || 0,
      isLoading: metrics.totalSupply?.isLoading || false,
      error: metrics.totalSupply?.error || null,
      breakdown: metrics.totalSupply?.breakdown || null
    },
    
    bridgeSupply: {
      value: metrics.bridgeSupply?.data?.data || 0,
      isLoading: metrics.bridgeSupply?.isLoading || false,
      error: metrics.bridgeSupply?.error || null,
      isPlaceholder: metrics.bridgeSupply?.data?._placeholder || false
    },
    
    mainnetSupply: {
      value: metrics.mainnetSupply?.data?.data || 0,
      isLoading: metrics.mainnetSupply?.isLoading || false,
      error: metrics.mainnetSupply?.error || null,
      breakdown: metrics.mainnetSupply?.breakdown || null
    },
    
    // Calculated: Excl. lending markets, other networks
    // Formula: Total Supply - Bridge Supply (other chains) - Total Lending Markets
    // Treat N/A values as 0 so subtraction always works
    exclLendingOtherNetworks: {
      value: Math.max(0, 
        (metrics.totalSupply?.data?.data || 0) - 
        (metrics.bridgeSupply?.data?.data || 0) - 
        (metrics.totalLendingUsage?.data?.totalLendingTVL || 0)
      ),
      isLoading: metrics.totalSupply?.isLoading || 
                 metrics.bridgeSupply?.isLoading || 
                 metrics.totalLendingUsage?.isLoading || 
                 false,
      error: null,
      isCalculated: true,
      formula: 'Total Supply - Bridge Supply - Total Lending Markets'
    },
    
    // Liquidity Metrics (DEX TVL)
    curveTVL: {
      value: metrics.curveTVL?.data?.data || 0,
      isLoading: metrics.curveTVL?.isLoading || false,
      error: metrics.curveTVL?.error || null
    },
    
    balancerTVL: {
      value: metrics.balancerTVL?.data?.data || 0,
      isLoading: metrics.balancerTVL?.isLoading || false,
      error: metrics.balancerTVL?.error || null
    },
    
    uniswapTVL: {
      value: metrics.uniswapTVL?.data?.data || 0,
      isLoading: metrics.uniswapTVL?.isLoading || false,
      error: metrics.uniswapTVL?.error || null
    },
    
    sushiTVL: {
      value: metrics.sushiTVL?.data?.data || 0,
      isLoading: metrics.sushiTVL?.isLoading || false,
      error: metrics.sushiTVL?.error || null
    },
    
    totalMainnetLiquidity: {
      value: metrics.totalMainnetLiquidity?.data || 0,
      isLoading: metrics.totalMainnetLiquidity?.isLoading || false,
      error: metrics.totalMainnetLiquidity?.error || null
    },
    
    // Lending Markets
    aaveCollateral: {
      value: metrics.totalLendingUsage?.data?.protocols?.aave_v3?.totalTVL || 0,
      isLoading: metrics.totalLendingUsage?.isLoading || false,
      error: metrics.totalLendingUsage?.error || null
    },
    
    morphoCollateral: {
      value: metrics.totalLendingUsage?.data?.protocols?.morpho_combined?.totalTVL || 0,
      isLoading: metrics.totalLendingUsage?.isLoading || false,
      error: metrics.totalLendingUsage?.error || null
    },
    
    eulerCollateral: {
      value: metrics.totalLendingUsage?.data?.protocols?.euler?.totalTVL || 0,
      isLoading: metrics.totalLendingUsage?.isLoading || false,
      error: metrics.totalLendingUsage?.error || null
    },
    
    totalLendingMarkets: {
      value: metrics.totalLendingUsage?.data?.totalLendingTVL || 0,
      isLoading: metrics.totalLendingUsage?.isLoading || false,
      error: metrics.totalLendingUsage?.error || null,
      protocols: metrics.totalLendingUsage?.data?.protocols || {}
    },
    
    // Safety Buffer Metrics
    insuranceFund: {
      value: metrics.insuranceFund?.data?.data || 0,
      isLoading: metrics.insuranceFund?.isLoading || false,
      error: metrics.insuranceFund?.error || null,
      isUnavailable: metrics.insuranceFund?.data?._unavailable || false,
      source: metrics.insuranceFund?.source || 'unknown',
      breakdown: metrics.insuranceFund?.breakdown || null
    },
    
    collateralizationRatio: {
      value: metrics.collateralizationRatio?.data?.data || 0,
      isLoading: metrics.collateralizationRatio?.isLoading || false,
      error: metrics.collateralizationRatio?.error || null,
      isUnavailable: metrics.collateralizationRatio?.data?._unavailable || false
    },
    
    stakedSupply: {
      value: metrics.stakedSupply?.data?.data || 0,
      isLoading: metrics.stakedSupply?.isLoading || false,
      error: metrics.stakedSupply?.error || null,
      isUnavailable: metrics.stakedSupply?.data?._unavailable || false,
      source: metrics.stakedSupply?.source || 'unknown',
      breakdown: metrics.stakedSupply?.breakdown || null
    },
    
    supplyOnMainnetPercent: {
      value: metrics.supplyOnMainnetPercent?.data || 0,
      isLoading: metrics.supplyOnMainnetPercent?.isLoading || false,
      error: metrics.supplyOnMainnetPercent?.error || null,
      isCalculated: true,
      formula: '1 - (Bridge Supply / Mainnet Supply)'
    },
    
    // Factor of Safety - Composite Risk Score
    // Based on: Insurance Fund, CR, Staked Supply, and Mainnet Supply %
    factorOfSafety: {
      value: calculateFactorOfSafety(
        totalSupplyValue,
        insuranceFundValue,
        crValue,
        stakedSupplyValue,
        supplyOnMainnetPercentValue
      ),
      isLoading: metrics.totalSupply?.isLoading || 
                 metrics.insuranceFund?.isLoading || 
                 metrics.collateralizationRatio?.isLoading || 
                 metrics.stakedSupply?.isLoading || 
                 metrics.supplyOnMainnetPercent?.isLoading || 
                 false,
      error: null,
      isCalculated: true,
      formula: 'Composite score based on Insurance, CR, Staked Supply, Mainnet %',
      components: {
        baseScore: 0.5,
        insuranceComponent: getInsuranceComponent(totalSupplyValue, insuranceFundValue),
        crComponent: getCRComponent(crValue),
        stakedComponent: getStakedComponent(totalSupplyValue, stakedSupplyValue),
        mainnetComponent: getMainnetComponent(supplyOnMainnetPercentValue)
      }
    },
    
    // Theoretical Supply Limit
    // Formula: Factor of Safety * min(Excl. Lending Markets, Total Mainnet Liquidity)
    // Shows the maximum safe supply based on safety score and liquidity constraints
    theoreticalSupplyLimit: (() => {
      const fosValue = calculateFactorOfSafety(
        totalSupplyValue,
        insuranceFundValue,
        crValue,
        stakedSupplyValue,
        supplyOnMainnetPercentValue
      );
      
      // Get excl lending value
      const exclLendingValue = Math.max(0, 
        totalSupplyValue - 
        (metrics.bridgeSupply?.data?.data || 0) - 
        (metrics.totalLendingUsage?.data?.totalLendingTVL || 0)
      );
      
      // Get total mainnet liquidity
      const totalMainnetLiquidityValue = metrics.totalMainnetLiquidity?.data || 0;
      
      // Calculate: FoS * min(exclLending, totalLiquidity)
      const limitingFactor = Math.min(exclLendingValue, totalMainnetLiquidityValue);
      const theoreticalLimit = fosValue * limitingFactor;
      
      return {
        value: theoreticalLimit,
        isLoading: metrics.totalSupply?.isLoading || 
                   metrics.bridgeSupply?.isLoading ||
                   metrics.totalLendingUsage?.isLoading ||
                   metrics.totalMainnetLiquidity?.isLoading ||
                   metrics.insuranceFund?.isLoading || 
                   metrics.collateralizationRatio?.isLoading || 
                   metrics.stakedSupply?.isLoading || 
                   metrics.supplyOnMainnetPercent?.isLoading || 
                   false,
        error: null,
        isCalculated: true,
        formula: 'Factor of Safety × min(Excl. Lending, Total Mainnet Liquidity)',
        components: {
          factorOfSafety: fosValue,
          exclLendingMarkets: exclLendingValue,
          totalMainnetLiquidity: totalMainnetLiquidityValue,
          limitingFactor: limitingFactor,
          limitedBy: exclLendingValue < totalMainnetLiquidityValue ? 'Excl. Lending Markets' : 'Total Mainnet Liquidity'
        }
      };
    })(),
    
    // Overall loading/error states
    isLoading: Object.values(metrics).some(m => m?.isLoading),
    hasError: Object.values(metrics).some(m => m?.error || m?.isError)
  };
}

/**
 * Extract sortable values from all stablecoins
 * Used for sorting columns in the dashboard
 * @param {array} stablecoins - Array of stablecoin configs
 * @param {array} allStablecoinMetrics - Array of metrics from useStablecoinCompleteMetrics
 * @returns {array} Array of stablecoins with sortValues
 */
export function extractSortableValues(stablecoins, allStablecoinMetrics) {
  return stablecoins.map((stablecoin, index) => {
    const metrics = allStablecoinMetrics[index];
    const extracted = extractStablecoinMetricValues(metrics, stablecoin);
    
    return {
      ...stablecoin,
      originalIndex: index,
      sortValues: {
        // Supply metrics
        totalSupply: extracted.totalSupply.value,
        bridgeSupply: extracted.bridgeSupply.value,
        mainnetSupply: extracted.mainnetSupply.value,
        exclLendingOtherNetworks: extracted.exclLendingOtherNetworks.value,
        
        // Liquidity metrics
        curveTVL: extracted.curveTVL.value,
        balancerTVL: extracted.balancerTVL.value,
        uniswapTVL: extracted.uniswapTVL.value,
        sushiTVL: extracted.sushiTVL.value,
        totalMainnetLiquidity: extracted.totalMainnetLiquidity.value,
        
        // Lending metrics
        aaveCollateral: extracted.aaveCollateral.value,
        morphoCollateral: extracted.morphoCollateral.value,
        eulerCollateral: extracted.eulerCollateral.value,
        totalLendingMarkets: extracted.totalLendingMarkets.value,
        
        // Safety metrics
        insuranceFund: extracted.insuranceFund.value,
        collateralizationRatio: extracted.collateralizationRatio.value,
        stakedSupply: extracted.stakedSupply.value,
        supplyOnMainnetPercent: extracted.supplyOnMainnetPercent.value,
        factorOfSafety: extracted.factorOfSafety.value,
        theoreticalSupplyLimit: extracted.theoreticalSupplyLimit.value,
        
        // Meta
        name: stablecoin.name,
        symbol: stablecoin.symbol,
        category: stablecoin.category
      }
    };
  });
}

/**
 * Get a specific metric value from the extracted values
 * @param {object} extractedValues - Result from extractStablecoinMetricValues
 * @param {string} metricKey - The metric key to retrieve
 * @returns {object} The metric value object
 */
export function getMetricValue(extractedValues, metricKey) {
  return extractedValues[metricKey] || {
    value: 0,
    isLoading: false,
    error: null,
    isUnavailable: true
  };
}

/**
 * Check if a stablecoin has any errors in its metrics
 * @param {object} metrics - The metrics object from useStablecoinCompleteMetrics
 * @returns {array} Array of error objects with metric names
 */
export function getStablecoinErrors(metrics) {
  if (!metrics) return [];
  
  const errors = [];
  
  Object.entries(metrics).forEach(([metricKey, metricData]) => {
    if (metricData?.error || metricData?.isError) {
      errors.push({
        metric: metricKey,
        error: metricData.error,
        message: metricData.error?.message || 'Unknown error'
      });
    }
  });
  
  return errors;
}

/**
 * Calculate aggregate statistics across all stablecoins
 * @param {array} allStablecoinMetrics - Array of metrics from useStablecoinCompleteMetrics
 * @returns {object} Aggregate statistics
 */
export function calculateAggregateStats(allStablecoinMetrics) {
  const extracted = allStablecoinMetrics.map(m => extractStablecoinMetricValues(m));
  
  const sum = (values) => values.reduce((total, v) => total + (v || 0), 0);
  
  return {
    totalSupplyAcrossAll: sum(extracted.map(e => e.totalSupply.value)),
    totalLiquidityAcrossAll: sum(extracted.map(e => e.totalMainnetLiquidity.value)),
    totalLendingAcrossAll: sum(extracted.map(e => e.totalLendingMarkets.value)),
    totalInsuranceFundAcrossAll: sum(extracted.map(e => e.insuranceFund.value)),
    
    // Loading states
    anyLoading: extracted.some(e => e.isLoading),
    allLoaded: extracted.every(e => !e.isLoading),
    
    // Error states
    stablecoinsWithErrors: extracted.filter(e => e.hasError).length,
    totalStablecoins: extracted.length
  };
}
