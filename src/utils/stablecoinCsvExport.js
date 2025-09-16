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
      // Mainnet Liquidity
      'Curve TVL',
      'Balancer TVL',
      'Uniswap TVL',
      'Sushiswap TVL',
      'Total Mainnet Liquidity',
      // Competitor Markets
      'Aave Collateral',
      'Morpho Collateral',
      'Euler Collateral',
      'Fluid Collateral',
      'Total Lending Markets',
      // Safety Buffer
      'Insurance Layer/Fund',
      'Collateralization Ratio',
      'Staked Supply',
      '% Supply on Mainnet',
      'Factor of Safety',
      // Metadata
      'Last Updated'
    ];

    // Build CSV rows
    const rows = stablecoins.map((stablecoin, index) => {
      const metrics = metricsData[index] || {};
      
      return [
        stablecoin.name,
        stablecoin.category.replace('_', ' '),
        // Supply Metrics
        formatStablecoinAmount(metrics.totalSupply?.data?.data || 0),
        formatStablecoinAmount(metrics.bridgeSupply?.data?.data || 0),
        formatStablecoinAmount(metrics.mainnetSupply?.data?.data || 0),
        'N/A', // Calculated field - placeholder
        // Mainnet Liquidity
        formatStablecoinAmount(metrics.curveTVL?.data?.data || 0),
        formatStablecoinAmount(metrics.balancerTVL?.data?.data || 0),
        formatStablecoinAmount(metrics.uniswapTVL?.data?.data || 0),
        formatStablecoinAmount(metrics.sushiTVL?.data?.data || 0),
        formatStablecoinAmount(metrics.totalMainnetLiquidity?.data || 0),
        // Competitor Markets
        formatStablecoinAmount(metrics.aaveCollateral?.data?.data || 0),
        formatStablecoinAmount(metrics.morphoCollateral?.data?.data || 0),
        formatStablecoinAmount(metrics.eulerCollateral?.data?.data || 0),
        formatStablecoinAmount(metrics.fluidCollateral?.data?.data || 0),
        formatStablecoinAmount(metrics.totalLendingUsage?.data?.data || 0),
        // Safety Buffer
        formatStablecoinAmount(metrics.insuranceFund?.data?.data || 0),
        formatRatio(metrics.collateralizationRatio?.data?.data || 0),
        formatStablecoinAmount(metrics.stakedSupply?.data?.data || 0),
        formatPercentage(metrics.supplyOnMainnetPercent?.data || 0),
        'N/A', // Factor of Safety - calculated field
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
      // Liquidity Breakdown
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
      // Lending Markets Breakdown
      'Aave Collateral (Raw)',
      'Aave Collateral (Formatted)',
      'Morpho Collateral (Raw)',
      'Morpho Collateral (Formatted)',
      'Euler Collateral (Raw)',
      'Euler Collateral (Formatted)',
      'Fluid Collateral (Raw)',
      'Fluid Collateral (Formatted)',
      'Total Lending Markets (Raw)',
      'Total Lending Markets (Formatted)',
      // Safety Metrics
      'Insurance Fund (Raw)',
      'Insurance Fund (Formatted)',
      'Collateralization Ratio',
      'Staked Supply (Raw)',
      'Staked Supply (Formatted)',
      'Supply on Mainnet %',
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
      
      return [
        stablecoin.name,
        stablecoin.symbol,
        stablecoin.category.replace('_', ' '),
        JSON.stringify(stablecoin.contractAddresses),
        stablecoin.coingeckoIds.join('; '),
        // Supply Metrics (Raw and Formatted)
        metrics.totalSupply?.data?.data || 0,
        formatStablecoinAmount(metrics.totalSupply?.data?.data || 0),
        metrics.bridgeSupply?.data?.data || 0,
        formatStablecoinAmount(metrics.bridgeSupply?.data?.data || 0),
        metrics.mainnetSupply?.data?.data || 0,
        formatStablecoinAmount(metrics.mainnetSupply?.data?.data || 0),
        // Liquidity Breakdown (Raw and Formatted)
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
        // Lending Markets (Raw and Formatted)
        metrics.aaveCollateral?.data?.data || 0,
        formatStablecoinAmount(metrics.aaveCollateral?.data?.data || 0),
        metrics.morphoCollateral?.data?.data || 0,
        formatStablecoinAmount(metrics.morphoCollateral?.data?.data || 0),
        metrics.eulerCollateral?.data?.data || 0,
        formatStablecoinAmount(metrics.eulerCollateral?.data?.data || 0),
        metrics.fluidCollateral?.data?.data || 0,
        formatStablecoinAmount(metrics.fluidCollateral?.data?.data || 0),
        metrics.totalLendingUsage?.data?.data || 0,
        formatStablecoinAmount(metrics.totalLendingUsage?.data?.data || 0),
        // Safety Metrics
        metrics.insuranceFund?.data?.data || 0,
        formatStablecoinAmount(metrics.insuranceFund?.data?.data || 0),
        formatRatio(metrics.collateralizationRatio?.data?.data || 0),
        metrics.stakedSupply?.data?.data || 0,
        formatStablecoinAmount(metrics.stakedSupply?.data?.data || 0),
        formatPercentage(metrics.supplyOnMainnetPercent?.data || 0),
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
