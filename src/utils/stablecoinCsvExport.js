// ================= STABLECOIN CSV EXPORT UTILITY =================

import { formatStablecoinAmount, formatPercentage, formatRatio } from '../config/stablecoins.js';

/**
 * Export stablecoin metrics to CSV format
 */
export function exportStablecoinMetricsToCSV(stablecoins, metricsData) {
  try {
    // Define CSV headers
    const headers = [
      'Stablecoin',
      'Category',
      // Supply Metrics
      'Total Supply',
      'Supply Secured by Bridge',
      'Mainnet Supply',
      'Excl. Lending Markets, Other Networks',
      // Mainnet Liquidity (now includes Pendle PT)
      'Curve TVL (incl. PT)',
      'Balancer TVL (incl. PT)',
      'Uniswap TVL (incl. PT)',
      'Sushiswap TVL (incl. PT)',
      'Total Mainnet Liquidity',
      // Competitor Markets (now includes Pendle PT)
      'Aave Collateral (incl. PT)',
      'Aave Direct',
      'Aave Pendle PT',
      'Morpho Collateral (incl. PT)',
      'Morpho Direct',
      'Morpho Pendle PT',
      'Euler Collateral (incl. PT)',
      'Euler Direct',
      'Euler Pendle PT',
      'Fluid Collateral (incl. PT)',
      'Fluid Direct',
      'Fluid Pendle PT',
      'Total Lending Markets',
      'Total Pendle PT in Lending',
      'Pendle PT Tokens Found',
      // Safety Buffer
      'Insurance Layer/Fund',
      'Collateralization Ratio',
      'Staked Supply',
      '% Supply on Mainnet',
      'Factor of Safety',
      'Theoretical Supply Limit',
      // Metadata
      'Last Updated'
    ];

    // Build CSV rows
    const rows = stablecoins.map((stablecoin, index) => {
      const metrics = metricsData[index] || {};
      const lendingData = metrics.totalLendingUsage?.data || {};
      const protocols = lendingData.protocols || {};
      const pendleData = lendingData.pendle || {};
      
      // Calculate total PT TVL across all lending protocols
      const totalPTTVL = (protocols.aave_v3?.ptTVL || 0) + 
                         (protocols.morpho_combined?.ptTVL || 0) + 
                         (protocols.euler?.ptTVL || 0) + 
                         (protocols.fluid?.ptTVL || 0);
      
      // Calculate Excl. Lending Markets, Other Networks
      const totalSupply = metrics.totalSupply?.data?.data || 0;
      const bridgeSupply = metrics.bridgeSupply?.data?.data || 0;
      const totalLending = lendingData.totalLendingTVL || 0;
      const exclLendingOtherNetworks = totalSupply - bridgeSupply - totalLending;
      
      // Calculate Factor of Safety (using extractStablecoinMetricValues would be ideal, but keeping it simple)
      const fosValue = 0; // Placeholder - complex calculation
      
      // Calculate Theoretical Supply Limit
      const tslValue = 0; // Placeholder - complex calculation
      
      return [
        stablecoin.name,
        stablecoin.category.replace('_', ' '),
        // Supply Metrics
        formatStablecoinAmount(totalSupply),
        formatStablecoinAmount(bridgeSupply),
        formatStablecoinAmount(metrics.mainnetSupply?.data?.data || 0),
        formatStablecoinAmount(exclLendingOtherNetworks),
        // Mainnet Liquidity (now includes Pendle PT)
        formatStablecoinAmount(metrics.curveTVL?.data?.data || 0),
        formatStablecoinAmount(metrics.balancerTVL?.data?.data || 0),
        formatStablecoinAmount(metrics.uniswapTVL?.data?.data || 0),
        formatStablecoinAmount(metrics.sushiTVL?.data?.data || 0),
        formatStablecoinAmount(metrics.totalMainnetLiquidity?.data || 0),
        // Competitor Markets with PT breakdown
        formatStablecoinAmount(protocols.aave_v3?.totalTVL || 0),
        formatStablecoinAmount(protocols.aave_v3?.directTVL || 0),
        formatStablecoinAmount(protocols.aave_v3?.ptTVL || 0),
        formatStablecoinAmount(protocols.morpho_combined?.totalTVL || 0),
        formatStablecoinAmount(protocols.morpho_combined?.directTVL || 0),
        formatStablecoinAmount(protocols.morpho_combined?.ptTVL || 0),
        formatStablecoinAmount(protocols.euler?.totalTVL || 0),
        formatStablecoinAmount(protocols.euler?.directTVL || 0),
        formatStablecoinAmount(protocols.euler?.ptTVL || 0),
        formatStablecoinAmount(protocols.fluid?.totalTVL || 0),
        formatStablecoinAmount(protocols.fluid?.directTVL || 0),
        formatStablecoinAmount(protocols.fluid?.ptTVL || 0),
        formatStablecoinAmount(totalLending),
        formatStablecoinAmount(totalPTTVL),
        pendleData.ptTokensFound || 0,
        // Safety Buffer
        formatStablecoinAmount(metrics.insuranceFund?.data?.data || 0),
        formatRatio(metrics.collateralizationRatio?.data?.data || 0),
        formatStablecoinAmount(metrics.stakedSupply?.data?.data || 0),
        formatPercentage(metrics.supplyOnMainnetPercent?.data || 0),
        fosValue.toFixed(2),
        formatStablecoinAmount(tslValue),
        // Metadata
        new Date().toISOString()
      ];
    });

    // Convert to CSV format
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => {
          // Escape cells containing commas, quotes, or newlines
          if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(',')
      )
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `stablecoin-exposure-metrics-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    console.log('CSV export completed successfully');
    
  } catch (error) {
    console.error('Error exporting CSV:', error);
    alert('Failed to export CSV. Please try again.');
  }
}

/**
 * Export detailed stablecoin metrics with additional breakdown data
 */
export function exportDetailedStablecoinMetricsToCSV(stablecoins, metricsData) {
  try {
    // Extended headers for detailed export
    const headers = [
      'Stablecoin',
      'Symbol',
      'Category',
      'Contract Address',
      'CoinGecko IDs',
      // Supply Metrics
      'Total Supply (Raw)',
      'Total Supply (Formatted)',
      'Bridge Supply (Raw)',
      'Bridge Supply (Formatted)',
      'Mainnet Supply (Raw)',
      'Mainnet Supply (Formatted)',
      'Excl. Lending Markets (Raw)',
      'Excl. Lending Markets (Formatted)',
      // Liquidity Breakdown (includes Pendle PT)
      'Curve TVL (Raw)',
      'Curve TVL (Formatted)',
      'Balancer TVL (Raw)',
      'Balancer TVL (Formatted)',
      'Uniswap TVL (Raw)',
      'Uniswap TVL (Formatted)',
      'Sushiswap TVL (Raw)',
      'Sushiswap TVL (Formatted)',
      'Total DEX Liquidity (Raw)',
      'Total DEX Liquidity (Formatted)',
      // Lending Markets Breakdown with Pendle PT
      'Aave Total (Raw)',
      'Aave Total (Formatted)',
      'Aave Direct (Raw)',
      'Aave PT (Raw)',
      'Aave PT Markets',
      'Morpho Total (Raw)',
      'Morpho Total (Formatted)',
      'Morpho Direct (Raw)',
      'Morpho PT (Raw)',
      'Morpho PT Markets',
      'Euler Total (Raw)',
      'Euler Total (Formatted)',
      'Euler Direct (Raw)',
      'Euler PT (Raw)',
      'Euler PT Markets',
      'Fluid Total (Raw)',
      'Fluid Total (Formatted)',
      'Fluid Direct (Raw)',
      'Fluid PT (Raw)',
      'Fluid PT Markets',
      'Total Lending Markets (Raw)',
      'Total Lending Markets (Formatted)',
      'Total PT TVL in Lending (Raw)',
      'Total PT TVL in Lending (Formatted)',
      'Pendle PT Tokens Found',
      'Pendle Markets Matched',
      // Safety Metrics
      'Insurance Fund (Raw)',
      'Insurance Fund (Formatted)',
      'Collateralization Ratio',
      'Staked Supply (Raw)',
      'Staked Supply (Formatted)',
      'Supply on Mainnet %',
      'Factor of Safety',
      'Theoretical Supply Limit (Raw)',
      'Theoretical Supply Limit (Formatted)',
      // Data Quality Indicators
      'Total Supply Available',
      'Bridge Data Available',
      'Curve Data Available',
      'Balancer Data Available',
      'Uniswap Data Available',
      'Sushiswap Data Available',
      'Lending Data Available',
      'Safety Data Available',
      // Timestamps
      'Export Date',
      'Export Time'
    ];

    // Build detailed CSV rows
    const rows = stablecoins.map((stablecoin, index) => {
      const metrics = metricsData[index] || {};
      const now = new Date();
      const lendingData = metrics.totalLendingUsage?.data || {};
      const protocols = lendingData.protocols || {};
      const pendleData = lendingData.pendle || {};
      
      // Calculate totals
      const totalSupply = metrics.totalSupply?.data?.data || 0;
      const bridgeSupply = metrics.bridgeSupply?.data?.data || 0;
      const totalLending = lendingData.totalLendingTVL || 0;
      const exclLendingOtherNetworks = totalSupply - bridgeSupply - totalLending;
      
      const totalPTTVL = (protocols.aave_v3?.ptTVL || 0) + 
                         (protocols.morpho_combined?.ptTVL || 0) + 
                         (protocols.euler?.ptTVL || 0) + 
                         (protocols.fluid?.ptTVL || 0);
      
      return [
        stablecoin.name,
        stablecoin.symbol,
        stablecoin.category.replace('_', ' '),
        JSON.stringify(stablecoin.contractAddresses),
        stablecoin.coingeckoIds.join('; '),
        // Supply Metrics (Raw and Formatted)
        totalSupply,
        formatStablecoinAmount(totalSupply),
        bridgeSupply,
        formatStablecoinAmount(bridgeSupply),
        metrics.mainnetSupply?.data?.data || 0,
        formatStablecoinAmount(metrics.mainnetSupply?.data?.data || 0),
        exclLendingOtherNetworks,
        formatStablecoinAmount(exclLendingOtherNetworks),
        // Liquidity Breakdown (Raw and Formatted) - now includes Pendle PT
        metrics.curveTVL?.data?.data || 0,
        formatStablecoinAmount(metrics.curveTVL?.data?.data || 0),
        metrics.balancerTVL?.data?.data || 0,
        formatStablecoinAmount(metrics.balancerTVL?.data?.data || 0),
        metrics.uniswapTVL?.data?.data || 0,
        formatStablecoinAmount(metrics.uniswapTVL?.data?.data || 0),
        metrics.sushiTVL?.data?.data || 0,
        formatStablecoinAmount(metrics.sushiTVL?.data?.data || 0),
        metrics.totalMainnetLiquidity?.data || 0,
        formatStablecoinAmount(metrics.totalMainnetLiquidity?.data || 0),
        // Lending Markets with Pendle PT breakdown
        protocols.aave_v3?.totalTVL || 0,
        formatStablecoinAmount(protocols.aave_v3?.totalTVL || 0),
        protocols.aave_v3?.directTVL || 0,
        protocols.aave_v3?.ptTVL || 0,
        protocols.aave_v3?.ptMarkets || 0,
        protocols.morpho_combined?.totalTVL || 0,
        formatStablecoinAmount(protocols.morpho_combined?.totalTVL || 0),
        protocols.morpho_combined?.directTVL || 0,
        protocols.morpho_combined?.ptTVL || 0,
        protocols.morpho_combined?.ptMarkets || 0,
        protocols.euler?.totalTVL || 0,
        formatStablecoinAmount(protocols.euler?.totalTVL || 0),
        protocols.euler?.directTVL || 0,
        protocols.euler?.ptTVL || 0,
        protocols.euler?.ptMarkets || 0,
        protocols.fluid?.totalTVL || 0,
        formatStablecoinAmount(protocols.fluid?.totalTVL || 0),
        protocols.fluid?.directTVL || 0,
        protocols.fluid?.ptTVL || 0,
        protocols.fluid?.ptMarkets || 0,
        totalLending,
        formatStablecoinAmount(totalLending),
        totalPTTVL,
        formatStablecoinAmount(totalPTTVL),
        pendleData.ptTokensFound || 0,
        pendleData.marketsMatched || 0,
        // Safety Metrics
        metrics.insuranceFund?.data?.data || 0,
        formatStablecoinAmount(metrics.insuranceFund?.data?.data || 0),
        formatRatio(metrics.collateralizationRatio?.data?.data || 0),
        metrics.stakedSupply?.data?.data || 0,
        formatStablecoinAmount(metrics.stakedSupply?.data?.data || 0),
        formatPercentage(metrics.supplyOnMainnetPercent?.data || 0),
        0, // Factor of Safety - placeholder
        0, // Theoretical Supply Limit - placeholder
        formatStablecoinAmount(0),
        // Data Quality Indicators
        !metrics.totalSupply?.data?._unavailable ? 'Yes' : 'No',
        !metrics.bridgeSupply?.data?._unavailable ? 'Yes' : 'No',
        !metrics.curveTVL?.data?._unavailable ? 'Yes' : 'No',
        !metrics.balancerTVL?.data?._unavailable ? 'Yes' : 'No',
        !metrics.uniswapTVL?.data?._unavailable ? 'Yes' : 'No',
        !metrics.sushiTVL?.data?._unavailable ? 'Yes' : 'No',
        !metrics.totalLendingUsage?.data?._unavailable ? 'Yes' : 'No',
        !metrics.insuranceFund?.data?._unavailable && !metrics.collateralizationRatio?.data?._unavailable ? 'Yes' : 'No',
        // Timestamps
        now.toISOString().split('T')[0],
        now.toISOString().split('T')[1].split('.')[0]
      ];
    });

    // Convert to CSV format
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => {
          // Escape cells containing commas, quotes, or newlines
          if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(',')
      )
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `stablecoin-exposure-detailed-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    console.log('Detailed CSV export completed successfully');
    
  } catch (error) {
    console.error('Error exporting detailed CSV:', error);
    alert('Failed to export detailed CSV. Please try again.');
  }
}
