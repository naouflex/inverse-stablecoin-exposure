// ================= STABLECOIN METRICS HOOKS =================
// Hooks for fetching stablecoin-specific data from various sources

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import axios from 'axios';
import { useTokenTotalSupply, useTokenDecimals, useMultipleTokenBalancesWithUSD } from './useEthereum.js';
import { formatTokenAmount, getLPTokenValueUSD, fetchFDV } from '../services/cache-client.js';

// Create axios instance for API calls
const api = axios.create({
  baseURL: '/api',
  timeout: 60000, // Increased from 40s to 60s for stablecoin metrics with many parallel requests
});

// ================= SUPPLY METRICS =================

/**
 * Hook to fetch total supply for a stablecoin from CoinGecko (supports multiple tokens)
 */
export function useStablecoinTotalSupply(coingeckoIds, options = {}) {
  return useQuery({
    queryKey: ['stablecoin-total-supply-cg', coingeckoIds],
    queryFn: async () => {
      if (!coingeckoIds || coingeckoIds.length === 0) return { data: 0, _unavailable: true };
      
      try {
        let totalSupply = 0;
        const breakdown = {};
        
        // Fetch data for each CoinGecko ID and sum them
        for (const coingeckoId of coingeckoIds) {
          try {
            const response = await api.get(`/coingecko/market-data/${coingeckoId}`);
            const supply = response.data?.total_supply || 0;
            totalSupply += supply;
            breakdown[coingeckoId] = supply;
          } catch (error) {
            console.warn(`CoinGecko data unavailable for ${coingeckoId}:`, error);
            breakdown[coingeckoId] = 0;
          }
        }
        
        return { 
          data: totalSupply,
          breakdown,
          source: 'coingecko',
          lastUpdated: new Date().toISOString()
        };
      } catch (error) {
        console.warn(`CoinGecko total supply data unavailable:`, error);
        return { data: 0, _unavailable: true };
      }
    },
    enabled: !!coingeckoIds && coingeckoIds.length > 0 && (options.enabled !== false),
    staleTime: 10 * 60 * 1000, // Increased from 5 to 10 minutes - reduce requests
    cacheTime: 60 * 60 * 1000, // Increased from 30 to 60 minutes
    retry: 1, // Reduced from 2 to 1 - fail faster to avoid timeouts
    retryDelay: 1000, // Add 1s delay between retries
    ...options
  });
}

/**
 * Hook to fetch mainnet supply for a stablecoin (using CoinGecko circulating supply)
 */
export function useStablecoinMainnetSupply(coingeckoIds, options = {}) {
  return useQuery({
    queryKey: ['stablecoin-mainnet-supply-cg', coingeckoIds],
    queryFn: async () => {
      if (!coingeckoIds || coingeckoIds.length === 0) return { data: 0, _unavailable: true };
      
      try {
        let totalCirculatingSupply = 0;
        const breakdown = {};
        
        // Fetch circulating supply for each CoinGecko ID and sum them
        for (const coingeckoId of coingeckoIds) {
          try {
            const response = await api.get(`/coingecko/market-data/${coingeckoId}`);
            const supply = response.data?.circulating_supply || 0;
            totalCirculatingSupply += supply;
            breakdown[coingeckoId] = supply;
          } catch (error) {
            console.warn(`CoinGecko circulating supply unavailable for ${coingeckoId}:`, error);
            breakdown[coingeckoId] = 0;
          }
        }
        
        return { 
          data: totalCirculatingSupply,
          breakdown,
          source: 'coingecko',
          lastUpdated: new Date().toISOString()
        };
      } catch (error) {
        console.warn(`CoinGecko mainnet supply data unavailable:`, error);
        return { data: 0, _unavailable: true };
      }
    },
    enabled: !!coingeckoIds && coingeckoIds.length > 0 && (options.enabled !== false),
    staleTime: 10 * 60 * 1000, // Increased from 5 to 10 minutes
    cacheTime: 60 * 60 * 1000, // Increased from 30 to 60 minutes
    retry: 1, // Reduced from 2 to 1
    retryDelay: 1000,
    ...options
  });
}

/**
 * Hook to fetch bridge-secured supply
 * First tries manual data from cache, fallback to auto-fetch (placeholder for now)
 */
export function useStablecoinBridgeSupply(stablecoinSymbol, options = {}) {
  return useQuery({
    queryKey: ['stablecoin-bridge-supply', stablecoinSymbol],
    queryFn: async () => {
      if (!stablecoinSymbol) return { data: 0, _unavailable: true };
      
      // Try to fetch manual data first
      try {
        const response = await api.get(`/manual-data/${stablecoinSymbol}/bridgeSupply`);
        if (response.data.success && response.data.data !== null) {
          return { 
            data: response.data.data,
            source: 'manual_entry',
            lastUpdated: response.data.metadata.lastUpdated,
            updatedBy: response.data.metadata.updatedBy
          };
        }
      } catch (error) {
        console.log('No manual bridge supply data, using placeholder');
      }
      
      // Fallback: This would integrate with bridge APIs like LayerZero, Wormhole, etc.
      // For now, return placeholder data
      return { data: 0, _unavailable: true, _placeholder: true };
    },
    enabled: !!stablecoinSymbol && (options.enabled !== false),
    staleTime: 2 * 60 * 1000, // 2 minutes - shorter for manual data
    cacheTime: 10 * 60 * 1000,
    retry: 2,
    ...options
  });
}

/**
 * Hook to fetch staked supply for a stablecoin from CoinGecko (supports multiple staked tokens)
 */
export function useStablecoinStakedSupplyFromCoinGecko(stakedCoingeckoIds, options = {}) {
  return useQuery({
    queryKey: ['stablecoin-staked-supply-cg', stakedCoingeckoIds],
    queryFn: async () => {
      if (!stakedCoingeckoIds || stakedCoingeckoIds.length === 0) return { data: 0, _unavailable: true };
      
      try {
        let totalStakedSupply = 0;
        const breakdown = {};
        
        // Fetch data for each staked CoinGecko ID and sum their total supplies
        for (const coingeckoId of stakedCoingeckoIds) {
          try {
            const response = await api.get(`/coingecko/market-data/${coingeckoId}`);
            const supply = response.data?.total_supply || 0;
            totalStakedSupply += supply;
            breakdown[coingeckoId] = supply;
          } catch (error) {
            console.warn(`CoinGecko staked supply data unavailable for ${coingeckoId}:`, error);
            breakdown[coingeckoId] = 0;
          }
        }
        
        return { 
          data: totalStakedSupply,
          breakdown,
          source: 'coingecko',
          lastUpdated: new Date().toISOString()
        };
      } catch (error) {
        console.warn(`CoinGecko staked supply data unavailable:`, error);
        return { data: 0, _unavailable: true };
      }
    },
    enabled: !!stakedCoingeckoIds && stakedCoingeckoIds.length > 0 && (options.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    ...options
  });
}

// ================= LENDING MARKET METRICS =================

/**
 * Hook to fetch Aave V3 collateral usage for a stablecoin
 */
export function useAaveCollateralUsage(contractAddress, options = {}) {
  return useQuery({
    queryKey: ['aave-v3-lending', contractAddress],
    queryFn: async () => {
      if (!contractAddress) return { data: 0, _unavailable: true };
      
      try {
        const response = await api.get(`/lending/aave-v3/${contractAddress}`);
        return { 
          data: response.data?.totalTVL || 0,
          totalBorrows: response.data?.totalBorrows || 0,
          markets: response.data?.markets || [],
          source: 'aave_v3_subgraph'
        };
      } catch (error) {
        console.warn('Aave V3 data unavailable:', error);
        return { data: 0, _unavailable: true };
      }
    },
    enabled: !!contractAddress && (options.enabled !== false),
    staleTime: 15 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    retry: 1,
    retryDelay: 1000,
    ...options
  });
}

/**
 * Hook to fetch combined Morpho collateral usage for a stablecoin
 */
export function useMorphoCollateralUsage(contractAddress, options = {}) {
  return useQuery({
    queryKey: ['morpho-combined-lending', contractAddress],
    queryFn: async () => {
      if (!contractAddress) return { data: 0, _unavailable: true };
      
      try {
        // Fetch data from all Morpho subgraphs
        const [compoundData, aaveV2Data, aaveV3Data] = await Promise.all([
          api.get(`/lending/morpho-compound/${contractAddress}`),
          api.get(`/lending/morpho-aave-v2/${contractAddress}`),
          api.get(`/lending/morpho-aave-v3/${contractAddress}`)
        ]);
        
        const totalTVL = (compoundData.data?.totalTVL || 0) + 
                        (aaveV2Data.data?.totalTVL || 0) + 
                        (aaveV3Data.data?.totalTVL || 0);
        
        return { 
          data: totalTVL,
          breakdown: {
            compound: compoundData.data?.totalTVL || 0,
            aave_v2: aaveV2Data.data?.totalTVL || 0,
            aave_v3: aaveV3Data.data?.totalTVL || 0
          },
          source: 'morpho_subgraphs'
        };
      } catch (error) {
        console.warn('Morpho data unavailable:', error);
        return { data: 0, _unavailable: true };
      }
    },
    enabled: !!contractAddress && (options.enabled !== false),
    staleTime: 15 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    retry: 1,
    ...options
  });
}

/**
 * Hook to fetch Euler collateral usage for a stablecoin
 */
export function useEulerCollateralUsage(contractAddress, options = {}) {
  return useQuery({
    queryKey: ['euler-lending', contractAddress],
    queryFn: async () => {
      if (!contractAddress) return { data: 0, _unavailable: true };
      
      try {
        const response = await api.get(`/lending/euler/${contractAddress}`);
        return { 
          data: response.data?.totalTVL || 0,
          totalSupply: response.data?.totalSupply || 0,
          totalBorrows: response.data?.totalBorrows || 0,
          markets: response.data?.markets || [],
          source: 'euler_subgraph'
        };
      } catch (error) {
        console.warn('Euler data unavailable:', error);
        return { data: 0, _unavailable: true };
      }
    },
    enabled: !!contractAddress && (options.enabled !== false),
    staleTime: 15 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    retry: 1,
    ...options
  });
}

/**
 * Hook to fetch Fluid collateral usage for a stablecoin
 */
export function useFluidCollateralUsage(contractAddress, options = {}) {
  return useQuery({
    queryKey: ['fluid-collateral', contractAddress],
    queryFn: async () => {
      if (!contractAddress) return { data: 0, _unavailable: true };
      
      try {
        const response = await api.get(`/fluid/collateral/${contractAddress}`);
        return response.data;
      } catch (error) {
        console.warn('Fluid data unavailable:', error);
        return { data: 0, _unavailable: true };
      }
    },
    enabled: !!contractAddress && (options.enabled !== false),
    staleTime: 15 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    retry: 1,
    ...options
  });
}

/**
 * Hook to fetch combined lending market usage using individual protocol endpoints
 */
export function useTotalLendingMarketUsage(contractAddress, options = {}) {
  // Fetch each protocol individually to avoid the combined endpoint issues
  const aaveData = useAaveCollateralUsage(contractAddress, options);
  const morphoData = useMorphoCollateralUsage(contractAddress, options);
  const eulerData = useEulerCollateralUsage(contractAddress, options);
  
  return useMemo(() => {
    const aaveTVL = aaveData.data?.data || 0;
    const morphoTVL = morphoData.data?.data || 0;
    const eulerTVL = eulerData.data?.data || 0;
    const total = aaveTVL + morphoTVL + eulerTVL;
    
    const isLoading = aaveData.isLoading || morphoData.isLoading || eulerData.isLoading;
    
    return {
      data: {
        totalLendingTVL: total,
        protocols: {
          aave_v3: { totalTVL: aaveTVL },
          morpho_combined: { totalTVL: morphoTVL },
          euler: { totalTVL: eulerTVL }
        }
      },
      isLoading,
      source: 'individual_protocol_endpoints'
    };
  }, [aaveData, morphoData, eulerData]);
}

// ================= SAFETY BUFFER METRICS =================

/**
 * Hook to fetch insurance fund data by monitoring token balances at specific addresses
 */
export function useStablecoinInsuranceFundFromBalances(insuranceFundConfig, options = {}) {
  // Create queries for regular tokens
  const regularTokenQueries = useMemo(() => {
    if (!insuranceFundConfig?.monitoredAddresses || !insuranceFundConfig?.tokensToMonitor) {
      return [];
    }
    
    return insuranceFundConfig.monitoredAddresses.map(address => 
      useMultipleTokenBalancesWithUSD(insuranceFundConfig.tokensToMonitor, address, options)
    );
  }, [insuranceFundConfig?.monitoredAddresses, insuranceFundConfig?.tokensToMonitor, options]);

  // Create queries for LP tokens
  const lpTokenQueries = useMemo(() => {
    if (!insuranceFundConfig?.monitoredAddresses || !insuranceFundConfig?.lpTokensToMonitor) {
      return [];
    }

    const queries = [];
    
    insuranceFundConfig.monitoredAddresses.forEach(address => {
      insuranceFundConfig.lpTokensToMonitor.forEach(lpConfig => {
        const queryKey = ['lp-token-value', lpConfig.lpTokenAddress, address, lpConfig.poolAddress];
        
        const lpQuery = useQuery({
          queryKey,
          queryFn: async () => {
            return await getLPTokenValueUSD(
              lpConfig.lpTokenAddress,
              address,
              lpConfig.poolAddress,
              lpConfig.underlyingTokens,
              lpConfig.protocol
            );
          },
          enabled: !!(lpConfig.lpTokenAddress && address && lpConfig.poolAddress),
          staleTime: 2 * 60 * 1000, // 2 minutes
          cacheTime: 5 * 60 * 1000, // 5 minutes
          retry: 2,
          ...options
        });

        queries.push({
          query: lpQuery,
          address,
          lpConfig
        });
      });
    });

    return queries;
  }, [insuranceFundConfig?.monitoredAddresses, insuranceFundConfig?.lpTokensToMonitor, options]);

  // Aggregate the results
  const aggregatedData = useMemo(() => {
    const hasRegularTokens = regularTokenQueries.length > 0;
    const hasLPTokens = lpTokenQueries.length > 0;

    if (!hasRegularTokens && !hasLPTokens) {
      return {
        data: 0,
        _unavailable: true,
        isLoading: false
      };
    }

    const regularTokensLoading = regularTokenQueries.some(query => query.isLoading);
    const lpTokensLoading = lpTokenQueries.some(item => item.query.isLoading);
    const isLoading = regularTokensLoading || lpTokensLoading;
    
    if (isLoading) {
      return {
        data: 0,
        isLoading: true
      };
    }

    let totalUSDValue = 0;
    const breakdown = {};

    // Process regular token balances
    regularTokenQueries.forEach((query, addressIndex) => {
      const address = insuranceFundConfig.monitoredAddresses[addressIndex];
      if (!breakdown[address]) breakdown[address] = { tokens: {}, lpTokens: {} };
      
      if (query.data) {
        Object.entries(query.data).forEach(([tokenAddress, tokenData]) => {
          const usdValue = tokenData.balanceUSD || 0;
          totalUSDValue += usdValue;
          breakdown[address].tokens[tokenAddress] = {
            balance: tokenData.balance || 0,
            balanceUSD: usdValue,
            price: tokenData.price || 0,
            type: 'token'
          };
        });
      }
    });

    // Process LP token balances
    lpTokenQueries.forEach(({ query, address, lpConfig }) => {
      if (!breakdown[address]) breakdown[address] = { tokens: {}, lpTokens: {} };
      
      if (query.data && query.data.lpBalanceUSD > 0) {
        totalUSDValue += query.data.lpBalanceUSD;
        breakdown[address].lpTokens[lpConfig.lpTokenAddress] = {
          ...query.data,
          type: 'lp_token',
          protocol: lpConfig.protocol,
          poolAddress: lpConfig.poolAddress,
          underlyingTokens: lpConfig.underlyingTokens
        };
      }
    });

    return {
      data: totalUSDValue,
      isLoading: false,
      breakdown,
      source: 'blockchain_balances_with_lp'
    };
  }, [regularTokenQueries, lpTokenQueries, insuranceFundConfig]);

  return aggregatedData;
}

/**
 * Hook to fetch insurance fund data for a stablecoin (legacy API approach)
 */
export function useStablecoinInsuranceFund(stablecoinSymbol, options = {}) {
  return useQuery({
    queryKey: ['stablecoin-insurance-fund', stablecoinSymbol],
    queryFn: async () => {
      if (!stablecoinSymbol) return { data: 0, _unavailable: true };
      
      try {
        const response = await api.get(`/stablecoin/insurance-fund/${stablecoinSymbol.toLowerCase()}`);
        return response.data;
      } catch (error) {
        console.warn('Insurance fund data unavailable:', error);
        return { data: 0, _unavailable: true };
      }
    },
    enabled: !!stablecoinSymbol && (options.enabled !== false),
    staleTime: 30 * 60 * 1000,
    cacheTime: 2 * 60 * 60 * 1000,
    retry: 1,
    ...options
  });
}

/**
 * Hook to fetch collateralization ratio for a stablecoin
 * First tries manual data from cache, fallback to auto-fetch
 */
export function useStablecoinCollateralizationRatio(stablecoinSymbol, options = {}) {
  return useQuery({
    queryKey: ['stablecoin-cr', stablecoinSymbol],
    queryFn: async () => {
      if (!stablecoinSymbol) return { data: 0, _unavailable: true };
      
      // Try to fetch manual data first
      try {
        const response = await api.get(`/manual-data/${stablecoinSymbol}/collateralizationRatio`);
        if (response.data.success && response.data.data !== null) {
          return { 
            data: response.data.data,
            source: 'manual_entry',
            lastUpdated: response.data.metadata.lastUpdated,
            updatedBy: response.data.metadata.updatedBy
          };
        }
      } catch (error) {
        console.log('No manual CR data, trying auto-fetch');
      }
      
      // Fallback to auto-fetch endpoint
      try {
        const response = await api.get(`/stablecoin/collateralization-ratio/${stablecoinSymbol.toLowerCase()}`);
        return response.data;
      } catch (error) {
        console.warn('Collateralization ratio data unavailable:', error);
        return { data: 0, _unavailable: true };
      }
    },
    enabled: !!stablecoinSymbol && (options.enabled !== false),
    staleTime: 2 * 60 * 1000, // 2 minutes - shorter for manual data
    cacheTime: 10 * 60 * 1000,
    retry: 1,
    ...options
  });
}

/**
 * Hook to fetch FDV from CoinGecko for a specific token (used for Resolv RLP)
 */
export function useStablecoinFDVFromCoinGecko(coingeckoId, options = {}) {
  return useQuery({
    queryKey: ['stablecoin-fdv-cg', coingeckoId],
    queryFn: async () => {
      if (!coingeckoId) return { data: 0, _unavailable: true };
      
      try {
        console.log(`Fetching FDV for ${coingeckoId}...`);
        const fdvData = await fetchFDV(coingeckoId);
        console.log(`FDV data received for ${coingeckoId}:`, fdvData);
        
        const result = {
          data: fdvData.fdv || 0,
          source: 'coingecko',
          lastUpdated: fdvData.fetched_at || new Date().toISOString()
        };
        
        console.log(`Processed FDV result for ${coingeckoId}:`, result);
        return result;
      } catch (error) {
        console.warn(`CoinGecko FDV data unavailable for ${coingeckoId}:`, error);
        return { data: 0, _unavailable: true };
      }
    },
    enabled: !!coingeckoId && (options.enabled !== false),
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    ...options
  });
}

/**
 * Hook to fetch staked supply for a stablecoin
 */
export function useStablecoinStakedSupply(contractAddress, stakingContracts = [], options = {}) {
  return useQuery({
    queryKey: ['stablecoin-staked-supply', contractAddress, stakingContracts],
    queryFn: async () => {
      if (!contractAddress || !stakingContracts.length) return { data: 0, _unavailable: true };
      
      try {
        let totalStaked = 0;
        const breakdown = {};
        
        for (const stakingContract of stakingContracts) {
          const response = await api.get(`/ethereum/token-balance/${contractAddress}/${stakingContract}`);
          const balance = response.data?.data || 0;
          totalStaked += balance;
          breakdown[stakingContract] = balance;
        }
        
        return { 
          data: totalStaked,
          breakdown
        };
      } catch (error) {
        console.warn('Staked supply data unavailable:', error);
        return { data: 0, _unavailable: true };
      }
    },
    enabled: !!contractAddress && stakingContracts.length > 0 && (options.enabled !== false),
    staleTime: 15 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    retry: 1,
    ...options
  });
}

// ================= COMBINED METRICS HOOK =================

/**
 * Hook to fetch all metrics for a single stablecoin using existing well-tested hooks
 */
export function useStablecoinCompleteMetrics(stablecoin, options = {}) {
  const contractAddress = stablecoin.contractAddresses?.[Object.keys(stablecoin.contractAddresses)[0]];
  const coingeckoIds = stablecoin.coingeckoIds;
  const contractAddresses = stablecoin.contractAddresses;
  
  // Use existing CoinGecko hooks for supply data
  const coinGeckoDataQueries = coingeckoIds.map(coinId => 
    useCoinGeckoMarketData(coinId, options)
  );
  
  // Calculate combined supply metrics
  const totalSupply = useMemo(() => {
    const total = coinGeckoDataQueries.reduce((sum, query) => {
      return sum + (query.data?.total_supply || 0);
    }, 0);
    
    const isLoading = coinGeckoDataQueries.some(query => query.isLoading);
    
    return {
      data: { data: total },
      isLoading,
      breakdown: coinGeckoDataQueries.reduce((acc, query, index) => {
        acc[coingeckoIds[index]] = query.data?.total_supply || 0;
        return acc;
      }, {})
    };
  }, [coinGeckoDataQueries, coingeckoIds]);
  
  const mainnetSupply = useMemo(() => {
    const total = coinGeckoDataQueries.reduce((sum, query) => {
      return sum + (query.data?.circulating_supply || 0);
    }, 0);
    
    const isLoading = coinGeckoDataQueries.some(query => query.isLoading);
    
    return {
      data: { data: total },
      isLoading,
      breakdown: coinGeckoDataQueries.reduce((acc, query, index) => {
        acc[coingeckoIds[index]] = query.data?.circulating_supply || 0;
        return acc;
      }, {})
    };
  }, [coinGeckoDataQueries, coingeckoIds]);
  
  const bridgeSupply = useStablecoinBridgeSupply(stablecoin.symbol, options);
  
  // DEX liquidity - use existing hooks for primary contract, then add others if needed
  const primaryContractAddress = contractAddress; // First contract address
  
  // Use existing hooks exactly like the original dashboard
  const curveTVL = useCurveTVL(primaryContractAddress, options);
  const balancerTVL = useBalancerTVL(primaryContractAddress, options);  
  const uniswapTVL = useUniswapTotalTVL(primaryContractAddress, options);
  const sushiTVL = useSushiTotalTVL(primaryContractAddress, options);
  
  // For multi-token stablecoins (like USDS+DAI), add additional contract addresses
  const additionalContracts = Object.entries(contractAddresses).filter(([key, addr]) => addr !== primaryContractAddress);
  
  const additionalCurveTVL = additionalContracts.map(([tokenKey, contractAddress]) => 
    useCurveTVL(contractAddress, {
      ...options,
      enabled: contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000" && (options.enabled !== false)
    })
  );
  
  const additionalBalancerTVL = additionalContracts.map(([tokenKey, contractAddress]) => 
    useBalancerTVL(contractAddress, {
      ...options,
      enabled: contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000" && (options.enabled !== false)
    })
  );
  
  const additionalUniswapTVL = additionalContracts.map(([tokenKey, contractAddress]) => 
    useUniswapTotalTVL(contractAddress, {
      ...options,
      enabled: contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000" && (options.enabled !== false)
    })
  );
  
  const additionalSushiTVL = additionalContracts.map(([tokenKey, contractAddress]) => 
    useSushiTotalTVL(contractAddress, {
      ...options,
      enabled: contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000" && (options.enabled !== false)
    })
  );
  
  // Lending markets - combine data from all contract addresses
  const lendingQueries = Object.entries(contractAddresses).map(([tokenKey, contractAddress]) => ({
    tokenKey,
    contractAddress,
    query: useTotalLendingMarketUsage(contractAddress, {
      ...options,
      enabled: contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000" && (options.enabled !== false)
    })
  }));
  
  const totalLendingUsage = useMemo(() => {
    const total = lendingQueries.reduce((sum, { query }) => {
      return sum + (query.data?.totalLendingTVL || 0);
    }, 0);
    
    const isLoading = lendingQueries.some(({ query }) => query.isLoading);
    
    // Combine protocol breakdown data from all queries
    const combinedProtocols = lendingQueries.reduce((acc, { tokenKey, query }) => {
      if (query.data?.protocols) {
        Object.entries(query.data.protocols).forEach(([protocol, data]) => {
          if (!acc[protocol]) acc[protocol] = { totalTVL: 0 };
          acc[protocol].totalTVL += data.totalTVL || 0;
        });
      }
      return acc;
    }, {});
    
    return {
      data: {
        totalLendingTVL: total,
        protocols: combinedProtocols
      },
      isLoading
    };
  }, [lendingQueries]);
  
  // Safety metrics
  const insuranceFundFromBalances = useStablecoinInsuranceFundFromBalances(stablecoin.insuranceFund, options);
  const insuranceFundFromAPI = useStablecoinInsuranceFund(stablecoin.symbol, options);
  
  // For Resolv, fetch FDV from CoinGecko
  const insuranceFundFromFDV = useStablecoinFDVFromCoinGecko(
    stablecoin.insuranceFund?.type === 'fdv' ? stablecoin.insuranceFund.rlpCoingeckoId : null,
    options
  );
  
  // Choose the appropriate insurance fund data source based on configuration
  const insuranceFund = useMemo(() => {
    console.log(`Insurance fund logic for ${stablecoin.symbol}:`, {
      type: stablecoin.insuranceFund?.type,
      rlpCoingeckoId: stablecoin.insuranceFund?.rlpCoingeckoId,
      fdvData: insuranceFundFromFDV.data,
      fdvLoading: insuranceFundFromFDV.isLoading
    });
    
    // Special case for Resolv: use FDV data
    if (stablecoin.insuranceFund?.type === 'fdv' && stablecoin.insuranceFund.rlpCoingeckoId) {
      const result = {
        data: { data: insuranceFundFromFDV.data?.data || 0 },
        isLoading: insuranceFundFromFDV.isLoading,
        source: 'coingecko_fdv',
        rlpTokenAddress: stablecoin.insuranceFund.rlpTokenAddress,
        rlpCoingeckoId: stablecoin.insuranceFund.rlpCoingeckoId
      };
      console.log(`Resolv insurance fund result:`, result);
      return result;
    }
    
    // Standard case: use balance-based data if available
    if (stablecoin.insuranceFund?.monitoredAddresses?.length > 0) {
      return {
        data: { data: insuranceFundFromBalances.data || 0 },
        isLoading: insuranceFundFromBalances.isLoading,
        breakdown: insuranceFundFromBalances.breakdown,
        source: 'blockchain_balances'
      };
    }
    
    // Fallback to API data
    return insuranceFundFromAPI;
  }, [stablecoin.insuranceFund, insuranceFundFromBalances, insuranceFundFromAPI, insuranceFundFromFDV]);
  
  const collateralizationRatio = useStablecoinCollateralizationRatio(stablecoin.symbol, options);
  
  // Use different approaches for staked supply based on the stablecoin
  const stakedSupplyFromCoinGecko = useStablecoinStakedSupplyFromCoinGecko(stablecoin.stakedCoingeckoIds, options);
  const stakedSupplyFromContract = useStablecoinStakedSupply(contractAddress, [], options);
  
  // For reUSD, use blockchain total supply directly from the staked contract
  const stakedSupplyFromBlockchain = useTokenTotalSupply(
    stablecoin.symbol === 'reUSD' ? stablecoin.stakedContractAddress : null,
    options
  );
  
  // Fetch decimals for reUSD staked contract to properly format the amount
  const stakedContractDecimals = useTokenDecimals(
    stablecoin.symbol === 'reUSD' ? stablecoin.stakedContractAddress : null,
    options
  );
  
  // Choose the appropriate data source based on the stablecoin
  const stakedSupply = useMemo(() => {
    // Special case for reUSD - use blockchain total supply with proper decimal formatting
    if (stablecoin.symbol === 'reUSD' && stablecoin.stakedContractAddress) {
      const rawAmount = stakedSupplyFromBlockchain.data || 0;
      const decimals = stakedContractDecimals.data || 18;
      const formattedAmount = rawAmount > 0 ? formatTokenAmount(rawAmount, decimals) : 0;
      
      return {
        data: { data: formattedAmount },
        isLoading: stakedSupplyFromBlockchain.isLoading || stakedContractDecimals.isLoading,
        source: 'blockchain',
        decimals: decimals
      };
    }
    
    // For other stablecoins with CoinGecko IDs, use CoinGecko data
    if (stablecoin.stakedCoingeckoIds && stablecoin.stakedCoingeckoIds.length > 0) {
      return {
        data: { data: stakedSupplyFromCoinGecko.data?.data || 0 },
        isLoading: stakedSupplyFromCoinGecko.isLoading,
        breakdown: stakedSupplyFromCoinGecko.data?.breakdown,
        source: 'coingecko'
      };
    }
    
    // Fallback to contract-based approach
    return stakedSupplyFromContract;
  }, [stablecoin.symbol, stablecoin.stakedCoingeckoIds, stablecoin.stakedContractAddress, 
      stakedSupplyFromCoinGecko, stakedSupplyFromContract, stakedSupplyFromBlockchain, stakedContractDecimals]);

  // Calculate combined TVL values (primary + additional contracts)
  const combinedCurveTVL = useMemo(() => {
    const primary = curveTVL.data || 0;
    const additional = additionalCurveTVL.reduce((sum, query) => sum + (query.data || 0), 0);
    return {
      data: { data: primary + additional },
      isLoading: curveTVL.isLoading || additionalCurveTVL.some(q => q.isLoading)
    };
  }, [curveTVL, additionalCurveTVL]);

  const combinedBalancerTVL = useMemo(() => {
    const primary = balancerTVL.data || 0;
    const additional = additionalBalancerTVL.reduce((sum, query) => sum + (query.data || 0), 0);
    return {
      data: { data: primary + additional },
      isLoading: balancerTVL.isLoading || additionalBalancerTVL.some(q => q.isLoading)
    };
  }, [balancerTVL, additionalBalancerTVL]);

  const combinedUniswapTVL = useMemo(() => {
    const primary = uniswapTVL.data || 0;
    const additional = additionalUniswapTVL.reduce((sum, query) => sum + (query.data || 0), 0);
    return {
      data: { data: primary + additional },
      isLoading: uniswapTVL.isLoading || additionalUniswapTVL.some(q => q.isLoading)
    };
  }, [uniswapTVL, additionalUniswapTVL]);

  const combinedSushiTVL = useMemo(() => {
    const primary = sushiTVL.data || 0;
    const additional = additionalSushiTVL.reduce((sum, query) => sum + (query.data || 0), 0);
    return {
      data: { data: primary + additional },
      isLoading: sushiTVL.isLoading || additionalSushiTVL.some(q => q.isLoading)
    };
  }, [sushiTVL, additionalSushiTVL]);

  return {
    // Supply metrics
    totalSupply,
    mainnetSupply,
    bridgeSupply,
    
    // Liquidity metrics (combined primary + additional contracts)
    curveTVL: combinedCurveTVL,
    balancerTVL: combinedBalancerTVL,
    uniswapTVL: combinedUniswapTVL,
    sushiTVL: combinedSushiTVL,
    
    // Lending markets
    totalLendingUsage,
    
    // Safety metrics
    insuranceFund,
    collateralizationRatio,
    stakedSupply,
    
    // Calculated metrics
    totalMainnetLiquidity: {
      data: (combinedCurveTVL.data?.data || 0) + (combinedBalancerTVL.data?.data || 0) + 
            (combinedUniswapTVL.data?.data || 0) + (combinedSushiTVL.data?.data || 0),
      isLoading: combinedCurveTVL.isLoading || combinedBalancerTVL.isLoading || 
                 combinedUniswapTVL.isLoading || combinedSushiTVL.isLoading
    },
    
    supplyOnMainnetPercent: {
      // Formula: 1 - (Bridge Supply / Mainnet Supply)
      // Shows what % of mainnet supply is actually ON mainnet (not bridged to other chains)
      data: mainnetSupply.data?.data > 0 
        ? 1 - ((bridgeSupply.data?.data || 0) / mainnetSupply.data.data)
        : 0,
      isLoading: mainnetSupply.isLoading || bridgeSupply.isLoading
    }
  };
}

// Import existing hooks for reuse
import { 
  useCurveTVL,
  useBalancerTVL,
  useUniswapTotalTVL,
  useSushiTotalTVL,
  useCoinGeckoMarketData
} from './index.js';
