// ================= STABLECOIN METRICS HOOKS =================
// Hooks for fetching stablecoin-specific data from various sources

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { useTokenTotalSupply, useTokenDecimals, useMultipleTokenBalancesWithUSD } from './useEthereum.js';
import { formatTokenAmount, getLPTokenValueUSD, fetchFDV } from '../services/cache-client.js';

// Create axios instance for API calls
const api = axios.create({
  baseURL: '/api',
  timeout: 90000, // Increased to 90s - stablecoin metrics need more time with conservative loading
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
    staleTime: 30 * 60 * 1000, // 30 minutes - prevent unnecessary refetches
    cacheTime: 2 * 60 * 60 * 1000, // 2 hours - keep data cached longer
    retry: 0, // No retries - if it fails, rely on stale data or next load
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false, // Don't refetch on network reconnect
    refetchOnMount: false, // Don't refetch on component mount if data exists
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
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 2 * 60 * 60 * 1000, // 2 hours
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
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
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 2 * 60 * 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
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
    staleTime: 30 * 60 * 1000,
    cacheTime: 2 * 60 * 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
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
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 2 * 60 * 60 * 1000, // 2 hours
    retry: 0, // No retries
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    ...options
  });
}

/**
 * Hook to fetch Morpho collateral usage using unified API
 */
export function useMorphoCollateralUsage(contractAddress, options = {}) {
  return useQuery({
    queryKey: ['morpho-unified-lending', contractAddress],
    queryFn: async () => {
      if (!contractAddress) return { data: 0, _unavailable: true };
      
      try {
        const response = await api.get(`/lending/morpho/${contractAddress}`);
        
        // Return collateral TVL (when token is used as collateral in Morpho markets)
        const totalTVL = response.data?.totalCollateralTVL || 0;
        
        return { 
          data: totalTVL,
          totalSupplyTVL: response.data?.totalSupplyTVL || 0,
          marketCount: response.data?.marketCount || 0,
          breakdown: {
            loanMarkets: response.data?.markets?.loanMarkets?.length || 0,
            collateralMarkets: response.data?.markets?.collateralMarkets?.length || 0
          },
          source: 'morpho_unified_api'
        };
      } catch (error) {
        console.warn('Morpho unified data unavailable:', error);
        return { data: 0, _unavailable: true };
      }
    },
    enabled: !!contractAddress && (options.enabled !== false),
    staleTime: 15 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    ...options
  });
}

/**
 * Hook to fetch Euler collateral usage for a stablecoin
 * Updated for Euler V2 subgraph - fetches vault creation data and calculates TVL
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
          vaultCount: response.data?.vaultCount || 0,
          source: 'euler_v2_subgraph'
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
 * Now supports multiple contract addresses (including staked tokens)
 */
export function useTotalLendingMarketUsage(contractAddresses, options = {}) {
  // Convert contractAddresses to array of addresses for querying
  const addressesToQuery = useMemo(() => {
    if (!contractAddresses) return [];
    if (typeof contractAddresses === 'string') return [contractAddresses];
    if (Array.isArray(contractAddresses)) return contractAddresses;
    if (typeof contractAddresses === 'object' && contractAddresses !== null) {
      const addresses = Object.values(contractAddresses).filter(addr => addr && typeof addr === 'string');
      console.log(`🔍 useTotalLendingMarketUsage - Addresses to query:`, {
        contractAddresses: contractAddresses,
        extractedAddresses: addresses,
        count: addresses.length
      });
      return addresses;
    }
    return [];
  }, [contractAddresses]);

  // Create queries for each address and each protocol
  const aaveQueries = addressesToQuery.map(address => 
    useAaveCollateralUsage(address, options)
  );
  const morphoQueries = addressesToQuery.map(address => 
    useMorphoCollateralUsage(address, options)
  );
  const eulerQueries = addressesToQuery.map((address, index) => {
    console.log(`🔍 Creating Euler query ${index + 1}/${addressesToQuery.length} for address: ${address}`);
    return useEulerCollateralUsage(address, options);
  });
  const fluidQueries = addressesToQuery.map(address => 
    useFluidCollateralUsage(address, options)
  );
  
  return useMemo(() => {
    // Aggregate results from all queries with safety checks
    const safeAaveQueries = Array.isArray(aaveQueries) ? aaveQueries : [];
    const safeMorphoQueries = Array.isArray(morphoQueries) ? morphoQueries : [];
    const safeEulerQueries = Array.isArray(eulerQueries) ? eulerQueries : [];
    const safeFluidQueries = Array.isArray(fluidQueries) ? fluidQueries : [];
    
    const aaveTVL = safeAaveQueries.reduce((sum, query) => sum + (query?.data?.data || 0), 0);
    const morphoTVL = safeMorphoQueries.reduce((sum, query) => sum + (query?.data?.data || 0), 0);
    const eulerTVL = safeEulerQueries.reduce((sum, query) => sum + (query?.data?.data || 0), 0);
    const fluidTVL = safeFluidQueries.reduce((sum, query) => sum + (query?.data?.data || 0), 0);
    const total = aaveTVL + morphoTVL + eulerTVL + fluidTVL;
    
    const allQueries = [...safeAaveQueries, ...safeMorphoQueries, ...safeEulerQueries, ...safeFluidQueries];
    const isLoading = allQueries.some(query => query?.isLoading);
    
    return {
      data: {
        totalLendingTVL: total,
        protocols: {
          aave_v3: { totalTVL: aaveTVL },
          morpho_combined: { totalTVL: morphoTVL },
          euler: { totalTVL: eulerTVL },
          fluid: { totalTVL: fluidTVL }
        }
      },
      isLoading,
      source: 'individual_protocol_endpoints_multi_address'
    };
  }, [aaveQueries, morphoQueries, eulerQueries, fluidQueries]);
}

// ================= SAFETY BUFFER METRICS =================

/**
 * Hook to fetch insurance fund data by monitoring token balances at specific addresses
 * FIXED: Hooks can't be called inside useMemo - moved to top level
 */
export function useStablecoinInsuranceFundFromBalances(insuranceFundConfig, options = {}) {
  // Check if we have valid config
  const hasConfig = !!(insuranceFundConfig?.monitoredAddresses?.length > 0);
  const hasTokens = !!(insuranceFundConfig?.tokensToMonitor?.length > 0);
  const hasLPTokens = !!(insuranceFundConfig?.lpTokensToMonitor?.length > 0);
  
  // Query regular token balances (only call hooks at top level)
  // NOTE: We conditionally enable based on config, but always call the hooks
  const regularTokenQueries = (insuranceFundConfig?.monitoredAddresses || []).map((address, index) => 
    useMultipleTokenBalancesWithUSD(
      insuranceFundConfig?.tokensToMonitor || [], 
      address, 
      { 
        ...options, 
        enabled: hasConfig && hasTokens && (options.enabled !== false)
      }
    )
  );

  // Create LP token queries - must call at top level, can't be in useMemo
  // Generate a stable list of LP queries
  const lpTokenQueryConfigs = useMemo(() => {
    if (!hasConfig || !hasLPTokens) return [];
    
    const configs = [];
    insuranceFundConfig.monitoredAddresses.forEach(address => {
      (insuranceFundConfig.lpTokensToMonitor || []).forEach(lpConfig => {
        // Only add valid configs
        if (lpConfig.lpTokenAddress && lpConfig.poolAddress) {
          configs.push({
            lpTokenAddress: lpConfig.lpTokenAddress,
            poolAddress: lpConfig.poolAddress,
            underlyingTokens: lpConfig.underlyingTokens,
            protocol: lpConfig.protocol,
            address
          });
        }
      });
    });
    return configs;
  }, [insuranceFundConfig, hasConfig, hasLPTokens]);
  
  // Call hooks for each LP config at top level
  const lpTokenQueries = lpTokenQueryConfigs.map(config => {
    const queryKey = ['lp-token-value', config.lpTokenAddress, config.address, config.poolAddress];
    
    const lpQuery = useQuery({
      queryKey,
      queryFn: async () => {
        return await getLPTokenValueUSD(
          config.lpTokenAddress,
          config.address,
          config.poolAddress,
          config.underlyingTokens,
          config.protocol
        );
      },
      enabled: hasConfig && hasLPTokens && (options.enabled !== false),
      staleTime: 30 * 60 * 1000,
      cacheTime: 2 * 60 * 60 * 1000,
      retry: 0,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false
    });

    return {
      query: lpQuery,
      address: config.address,
      lpConfig: config
    };
  });

  // Aggregate the results
  const aggregatedData = useMemo(() => {
    const hasRegularTokens = regularTokenQueries.length > 0 && hasTokens;
    const hasLPTokensData = lpTokenQueries.length > 0 && hasLPTokens;

    // If no queries, return unavailable
    if (!hasRegularTokens && !hasLPTokensData) {
      //console.log('Insurance fund: No queries configured');
      return {
        data: 0,
        _unavailable: true,
        isLoading: false
      };
    }

    // Check loading status
    const regularTokensLoading = hasRegularTokens && regularTokenQueries.some(query => query.isLoading);
    const lpTokensLoading = hasLPTokensData && lpTokenQueries.some(item => item.query.isLoading);
    const isLoading = regularTokensLoading || lpTokensLoading;
    
    if (isLoading) {
      console.log('Insurance fund: Loading...', { regularTokensLoading, lpTokensLoading });
      return {
        data: 0,
        isLoading: true
      };
    }

    let totalUSDValue = 0;
    const breakdown = {};

    // Process regular token balances
    if (hasRegularTokens) {
      regularTokenQueries.forEach((query, addressIndex) => {
        const address = insuranceFundConfig.monitoredAddresses?.[addressIndex];
        if (!address) return;
        
        if (!breakdown[address]) breakdown[address] = { tokens: {}, lpTokens: {} };
        
        if (query.data && !query.error) {
          Object.entries(query.data).forEach(([tokenAddress, tokenData]) => {
            const usdValue = tokenData?.balanceUSD || 0;
            if (usdValue > 0) {
              totalUSDValue += usdValue;
              breakdown[address].tokens[tokenAddress] = {
                balance: tokenData.balance || 0,
                balanceUSD: usdValue,
                price: tokenData.price || 0,
                type: 'token'
              };
              //console.log(`Insurance fund token: ${tokenAddress} = $${usdValue.toFixed(2)}`);
            }
          });
        } else if (query.error) {
          console.warn(`Insurance fund token query error for ${address}:`, query.error);
        }
      });
    }

    // Process LP token balances
    if (hasLPTokensData) {
      lpTokenQueries.forEach(({ query, address, lpConfig }) => {
        if (!breakdown[address]) breakdown[address] = { tokens: {}, lpTokens: {} };
        
        if (query.data && !query.error && query.data.lpBalanceUSD > 0) {
          totalUSDValue += query.data.lpBalanceUSD;
          breakdown[address].lpTokens[lpConfig.lpTokenAddress] = {
            ...query.data,
            type: 'lp_token',
            protocol: lpConfig.protocol,
            poolAddress: lpConfig.poolAddress,
            underlyingTokens: lpConfig.underlyingTokens
          };
          //console.log(`Insurance fund LP: ${lpConfig.lpTokenAddress} = $${query.data.lpBalanceUSD.toFixed(2)}`);
        } else if (query.error) {
          console.warn(`Insurance fund LP query error:`, query.error);
        }
      });
    }

    //console.log(`Insurance fund total: $${totalUSDValue.toFixed(2)}`);
    
    return {
      data: totalUSDValue,
      isLoading: false,
      breakdown,
      source: 'blockchain_balances_with_lp',
      queriesExecuted: {
        regularTokens: hasRegularTokens ? regularTokenQueries.length : 0,
        lpTokens: hasLPTokensData ? lpTokenQueries.length : 0
      }
    };
  }, [regularTokenQueries, lpTokenQueries, insuranceFundConfig, hasTokens, hasLPTokens]);

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
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
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
    staleTime: 30 * 60 * 1000,
    cacheTime: 2 * 60 * 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
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
    staleTime: 30 * 60 * 1000,
    cacheTime: 2 * 60 * 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
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
    staleTime: 30 * 60 * 1000,
    cacheTime: 2 * 60 * 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    ...options
  });
}

// ================= COMBINED METRICS HOOK =================

/**
 * Hook to fetch all metrics for a single stablecoin using existing well-tested hooks
 * Uses staggered loading to prevent overwhelming the request queue
 */
export function useStablecoinCompleteMetrics(stablecoin, options = {}) {
  const contractAddress = stablecoin.contractAddresses?.[Object.keys(stablecoin.contractAddresses)[0]];
  const coingeckoIds = stablecoin.coingeckoIds;
  const contractAddresses = stablecoin.contractAddresses;
  
  // Rate limiting is handled by the cache service, so we can enable all metrics immediately
  const enableDEX = options.enabled !== false;
  const enableLending = options.enabled !== false;
  const enableSafety = options.enabled !== false;
  
  // Use existing CoinGecko hooks for supply data (Group 1 - immediate)
  const coinGeckoDataQueries = coingeckoIds.map(coinId => 
    useCoinGeckoMarketData(coinId, options)
  );
  
  // Calculate combined supply metrics
  const totalSupply = useMemo(() => {
    const total = coinGeckoDataQueries.reduce((sum, query) => {
      return sum + (query.data?.total_supply || 0);
    }, 0);
    
    const isLoading = coinGeckoDataQueries.some(query => query.isLoading);
    
    const breakdown = coinGeckoDataQueries.reduce((acc, query, index) => {
      acc[coingeckoIds[index]] = query.data?.total_supply || 0;
      return acc;
    }, {});
    
    // Debug logging for total supply
    if (!isLoading && total > 0) {
      const breakdownStr = Object.entries(breakdown)
        .filter(([_, value]) => value > 0)
        .map(([id, value]) => `${id}: $${value.toLocaleString()}`)
        .join(', ');
      console.log(`[${stablecoin.symbol}] Total Supply: $${total.toLocaleString()}${breakdownStr ? ` (${breakdownStr})` : ''}`);
    }
    
    return {
      data: { data: total },
      isLoading,
      breakdown
    };
  }, [coinGeckoDataQueries, coingeckoIds, stablecoin.symbol]);
  
  const mainnetSupply = useMemo(() => {
    const total = coinGeckoDataQueries.reduce((sum, query) => {
      return sum + (query.data?.circulating_supply || 0);
    }, 0);
    
    const isLoading = coinGeckoDataQueries.some(query => query.isLoading);
    
    const breakdown = coinGeckoDataQueries.reduce((acc, query, index) => {
      acc[coingeckoIds[index]] = query.data?.circulating_supply || 0;
      return acc;
    }, {});
    
    // Debug logging for mainnet supply
    if (!isLoading && total > 0) {
      const breakdownStr = Object.entries(breakdown)
        .filter(([_, value]) => value > 0)
        .map(([id, value]) => `${id}: $${value.toLocaleString()}`)
        .join(', ');
      console.log(`[${stablecoin.symbol}] Mainnet Supply: $${total.toLocaleString()}${breakdownStr ? ` (${breakdownStr})` : ''}`);
    }
    
    return {
      data: { data: total },
      isLoading,
      breakdown
    };
  }, [coinGeckoDataQueries, coingeckoIds, stablecoin.symbol]);
  
  const bridgeSupply = useStablecoinBridgeSupply(stablecoin.symbol, options);
  
  // Add logging for bridge supply
  useEffect(() => {
    if (!bridgeSupply.isLoading && bridgeSupply.data?.data !== undefined) {
      const amount = bridgeSupply.data.data;
      if (amount > 0) {
        console.log(`[${stablecoin.symbol}] Bridge Supply: $${amount.toLocaleString()} (${bridgeSupply.data.source || 'unknown'})`);
      } else if (bridgeSupply.data._unavailable) {
        console.log(`[${stablecoin.symbol}] Bridge Supply: Data unavailable`);
      }
    }
  }, [bridgeSupply.isLoading, bridgeSupply.data, stablecoin.symbol]);
  
  // DEX liquidity - Group 2 (staggered loading)
  const primaryContractAddress = contractAddress; // First contract address
  
  // Use filtered TVL hooks to exclude same-protocol stablecoin pairs (e.g., DAI-USDS, USDe-sUSDe)
  const curveTVL = useCurveFilteredTVL(primaryContractAddress, { ...options, enabled: enableDEX && (options.enabled !== false) });
  const balancerTVL = useBalancerFilteredTVL(primaryContractAddress, { ...options, enabled: enableDEX && (options.enabled !== false) });  
  const uniswapTVL = useUniswapFilteredTotalTVL(primaryContractAddress, { ...options, enabled: enableDEX && (options.enabled !== false) });
  const sushiTVL = useSushiFilteredTotalTVL(primaryContractAddress, { ...options, enabled: enableDEX && (options.enabled !== false) });
  
  // For multi-token stablecoins (like USDS+DAI), add additional contract addresses
  const additionalContracts = Object.entries(contractAddresses).filter(([key, addr]) => addr !== primaryContractAddress);
  
  const additionalCurveTVL = additionalContracts.map(([tokenKey, contractAddress]) => 
    useCurveFilteredTVL(contractAddress, {
      ...options,
      enabled: enableDEX && contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000" && (options.enabled !== false)
    })
  );
  
  const additionalBalancerTVL = additionalContracts.map(([tokenKey, contractAddress]) => 
    useBalancerFilteredTVL(contractAddress, {
      ...options,
      enabled: enableDEX && contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000" && (options.enabled !== false)
    })
  );
  
  const additionalUniswapTVL = additionalContracts.map(([tokenKey, contractAddress]) => 
    useUniswapFilteredTotalTVL(contractAddress, {
      ...options,
      enabled: enableDEX && contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000" && (options.enabled !== false)
    })
  );
  
  const additionalSushiTVL = additionalContracts.map(([tokenKey, contractAddress]) => 
    useSushiFilteredTotalTVL(contractAddress, {
      ...options,
      enabled: enableDEX && contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000" && (options.enabled !== false)
    })
  );
  
  // Lending markets - Group 3 (staggered loading)
  // Create base addresses (always available)
  const baseContractAddresses = useMemo(() => ({
    ...contractAddresses,
    ...(stablecoin.stakedContractAddresses || {})
  }), [contractAddresses, stablecoin.stakedContractAddresses]);
  
  
  // Combine all addresses for the final query
  const allContractAddresses = useMemo(() => ({
    ...baseContractAddresses
  }), [baseContractAddresses]);
  
  // Debug logging to see what contracts are being queried
  useEffect(() => {
    if (enableLending) {
      const regularCount = Object.keys(contractAddresses).length;
      const stakedCount = Object.keys(stablecoin.stakedContractAddresses || {}).length;
      const totalAddresses = Object.keys(allContractAddresses || {}).length;
      
      console.log(`[${stablecoin.symbol}] Lending contracts being queried:`, {
        regular: regularCount,
        staked: stakedCount,
        total: totalAddresses,
        addresses: allContractAddresses
      });
      
    }
  }, [enableLending, allContractAddresses, stablecoin.symbol, contractAddresses, stablecoin.stakedContractAddresses]);
  
  // Start lending queries immediately with available addresses
  const totalLendingQuery = useTotalLendingMarketUsage(allContractAddresses, {
    ...options,
    enabled: enableLending && Object.keys(allContractAddresses).length > 0 && (options.enabled !== false)
  });
  
  const totalLendingUsage = useMemo(() => {
    // Ensure we have valid data structure even if query fails
    const queryData = totalLendingQuery.data || {};
    const total = queryData.totalLendingTVL || 0;
    const isLoading = totalLendingQuery.isLoading;
    const protocols = queryData.protocols || {
      aave_v3: { totalTVL: 0 },
      morpho_combined: { totalTVL: 0 },
      euler: { totalTVL: 0 },
      fluid: { totalTVL: 0 }
    };
    
    // Debug logging for lending usage
    if (!isLoading && Object.keys(allContractAddresses).length > 0) {
      const regularCount = Object.keys(contractAddresses).length;
      const stakedCount = Object.keys(stablecoin.stakedContractAddresses || {}).length;
      
      console.log(`[${stablecoin.symbol}] Lending query results (combined):`, {
        totalTVL: total,
        addressCounts: { regular: regularCount, staked: stakedCount },
        protocols: Object.entries(protocols).map(([name, data]) => `${name}: $${(data?.totalTVL || 0).toLocaleString()}`).join(', '),
        queryError: totalLendingQuery.error ? totalLendingQuery.error.message : null
      });
    }
    
    // Additional safety check for data structure
    const safeProtocols = {
      aave_v3: { totalTVL: protocols?.aave_v3?.totalTVL || 0 },
      morpho_combined: { totalTVL: protocols?.morpho_combined?.totalTVL || 0 },
      euler: { totalTVL: protocols?.euler?.totalTVL || 0 },
      fluid: { totalTVL: protocols?.fluid?.totalTVL || 0 }
    };
    
    return {
      data: {
        totalLendingTVL: total,
        protocols: safeProtocols
      },
      isLoading,
      error: totalLendingQuery.error
    };
  }, [totalLendingQuery, allContractAddresses, stablecoin.symbol, contractAddresses, stablecoin.stakedContractAddresses]);
  
  // Safety metrics - Group 4 (staggered loading)
  const insuranceFundFromBalances = useStablecoinInsuranceFundFromBalances(
    stablecoin.insuranceFund, 
    { ...options, enabled: enableSafety && (options.enabled !== false) }
  );
  const insuranceFundFromAPI = useStablecoinInsuranceFund(
    stablecoin.symbol, 
    { ...options, enabled: enableSafety && (options.enabled !== false) }
  );
  
  // For Resolv, fetch FDV from CoinGecko
  const insuranceFundFromFDV = useStablecoinFDVFromCoinGecko(
    stablecoin.insuranceFund?.type === 'fdv' ? stablecoin.insuranceFund.rlpCoingeckoId : null,
    { ...options, enabled: enableSafety && (options.enabled !== false) }
  );
  
  // Choose the appropriate insurance fund data source based on configuration
  const insuranceFund = useMemo(() => {
    let result;
    
    // Special case for Resolv: use FDV data
    if (stablecoin.insuranceFund?.type === 'fdv' && stablecoin.insuranceFund.rlpCoingeckoId) {
      result = {
        data: { data: insuranceFundFromFDV.data?.data || 0 },
        isLoading: insuranceFundFromFDV.isLoading,
        source: 'coingecko_fdv',
        rlpTokenAddress: stablecoin.insuranceFund.rlpTokenAddress,
        rlpCoingeckoId: stablecoin.insuranceFund.rlpCoingeckoId
      };
    }
    // Standard case: use balance-based data if available
    else if (stablecoin.insuranceFund?.monitoredAddresses?.length > 0) {
      result = {
        data: { data: insuranceFundFromBalances.data || 0 },
        isLoading: insuranceFundFromBalances.isLoading,
        breakdown: insuranceFundFromBalances.breakdown,
        source: 'blockchain_balances'
      };
    }
    // Fallback to API data
    else {
      result = insuranceFundFromAPI;
    }
    
    // Debug logging for insurance fund
    if (!result.isLoading && result.data?.data !== undefined) {
      const amount = result.data.data;
      if (amount > 0) {
        console.log(`[${stablecoin.symbol}] Insurance Fund: $${amount.toLocaleString()} (${result.source || 'unknown'})`);
      } else if (result.data._unavailable) {
        console.log(`[${stablecoin.symbol}] Insurance Fund: Data unavailable`);
      }
    }
    
    return result;
  }, [stablecoin.insuranceFund, insuranceFundFromBalances, insuranceFundFromAPI, insuranceFundFromFDV, stablecoin.symbol]);
  
  const collateralizationRatio = useStablecoinCollateralizationRatio(
    stablecoin.symbol, 
    { ...options, enabled: enableSafety && (options.enabled !== false) }
  );
  
  // Add logging for collateralization ratio
  useEffect(() => {
    if (!collateralizationRatio.isLoading && collateralizationRatio.data?.data !== undefined) {
      const ratio = collateralizationRatio.data.data;
      if (ratio > 0) {
        console.log(`[${stablecoin.symbol}] Collateralization Ratio: ${(ratio * 100).toFixed(1)}% (${collateralizationRatio.data.source || 'unknown'})`);
      } else if (collateralizationRatio.data._unavailable) {
        console.log(`[${stablecoin.symbol}] Collateralization Ratio: Data unavailable`);
      }
    }
  }, [collateralizationRatio.isLoading, collateralizationRatio.data, stablecoin.symbol]);
  
  // Use different approaches for staked supply based on the stablecoin
  const stakedSupplyFromCoinGecko = useStablecoinStakedSupplyFromCoinGecko(
    stablecoin.stakedCoingeckoIds, 
    { ...options, enabled: enableSafety && (options.enabled !== false) }
  );
  const stakedSupplyFromContract = useStablecoinStakedSupply(
    contractAddress, 
    [], 
    { ...options, enabled: enableSafety && (options.enabled !== false) }
  );
  
  // For reUSD, use blockchain total supply directly from the first staked contract
  const firstStakedContract = stablecoin.stakedContractAddresses 
    ? Object.values(stablecoin.stakedContractAddresses)[0] 
    : null;
    
  const stakedSupplyFromBlockchain = useTokenTotalSupply(
    stablecoin.symbol === 'reUSD' ? firstStakedContract : null,
    { ...options, enabled: enableSafety && (options.enabled !== false) }
  );
  
  // Fetch decimals for reUSD staked contract to properly format the amount
  const stakedContractDecimals = useTokenDecimals(
    stablecoin.symbol === 'reUSD' ? firstStakedContract : null,
    { ...options, enabled: enableSafety && (options.enabled !== false) }
  );
  
  // Choose the appropriate data source based on the stablecoin
  const stakedSupply = useMemo(() => {
    let result;
    
    // Special case for reUSD - use blockchain total supply with proper decimal formatting
    if (stablecoin.symbol === 'reUSD' && firstStakedContract) {
      const rawAmount = stakedSupplyFromBlockchain.data || 0;
      const decimals = stakedContractDecimals.data || 18;
      const formattedAmount = rawAmount > 0 ? formatTokenAmount(rawAmount, decimals) : 0;
      
      result = {
        data: { data: formattedAmount },
        isLoading: stakedSupplyFromBlockchain.isLoading || stakedContractDecimals.isLoading,
        source: 'blockchain',
        decimals: decimals
      };
    }
    // For other stablecoins with CoinGecko IDs, use CoinGecko data
    else if (stablecoin.stakedCoingeckoIds && stablecoin.stakedCoingeckoIds.length > 0) {
      result = {
        data: { data: stakedSupplyFromCoinGecko.data?.data || 0 },
        isLoading: stakedSupplyFromCoinGecko.isLoading,
        breakdown: stakedSupplyFromCoinGecko.data?.breakdown,
        source: 'coingecko'
      };
    }
    // Fallback to contract-based approach
    else {
      result = stakedSupplyFromContract;
    }
    
    // Debug logging for staked supply
    if (!result.isLoading && result.data?.data !== undefined) {
      const amount = result.data.data;
      if (amount > 0) {
        const breakdownStr = result.breakdown 
          ? Object.entries(result.breakdown)
              .filter(([_, value]) => value > 0)
              .map(([id, value]) => `${id}: $${value.toLocaleString()}`)
              .join(', ')
          : '';
        console.log(`[${stablecoin.symbol}] Staked Supply: $${amount.toLocaleString()} (${result.source || 'unknown'})${breakdownStr ? ` - ${breakdownStr}` : ''}`);
      } else if (result.data._unavailable) {
        console.log(`[${stablecoin.symbol}] Staked Supply: Data unavailable`);
      }
    }
    
    return result;
  }, [stablecoin.symbol, stablecoin.stakedCoingeckoIds, firstStakedContract, 
      stakedSupplyFromCoinGecko, stakedSupplyFromContract, stakedSupplyFromBlockchain, stakedContractDecimals]);

  // Calculate combined TVL values (primary + additional contracts)
  const combinedCurveTVL = useMemo(() => {
    const primary = curveTVL.data || 0;
    const additional = additionalCurveTVL.reduce((sum, query) => sum + (query.data || 0), 0);
    const total = primary + additional;
    const isLoading = curveTVL.isLoading || additionalCurveTVL.some(q => q.isLoading);
    
    // Debug logging for Curve TVL
    if (!isLoading && (primary > 0 || additional > 0)) {
      console.log(`[${stablecoin.symbol}] Curve TVL - Primary: $${primary.toLocaleString()}, Additional: $${additional.toLocaleString()}, Total: $${total.toLocaleString()}`);
    }
    
    return {
      data: { data: total },
      isLoading
    };
  }, [curveTVL, additionalCurveTVL, stablecoin.symbol]);

  const combinedBalancerTVL = useMemo(() => {
    const primary = balancerTVL.data || 0;
    const additional = additionalBalancerTVL.reduce((sum, query) => sum + (query.data || 0), 0);
    const total = primary + additional;
    const isLoading = balancerTVL.isLoading || additionalBalancerTVL.some(q => q.isLoading);
    
    // Debug logging for Balancer TVL
    if (!isLoading && (primary > 0 || additional > 0)) {
      console.log(`[${stablecoin.symbol}] Balancer TVL - Primary: $${primary.toLocaleString()}, Additional: $${additional.toLocaleString()}, Total: $${total.toLocaleString()}`);
    }
    
    return {
      data: { data: total },
      isLoading
    };
  }, [balancerTVL, additionalBalancerTVL, stablecoin.symbol]);

  const combinedUniswapTVL = useMemo(() => {
    const primary = uniswapTVL.data || 0;
    const additional = additionalUniswapTVL.reduce((sum, query) => sum + (query.data || 0), 0);
    const total = primary + additional;
    const isLoading = uniswapTVL.isLoading || additionalUniswapTVL.some(q => q.isLoading);
    
    // Debug logging for Uniswap TVL
    if (!isLoading && (primary > 0 || additional > 0)) {
      console.log(`[${stablecoin.symbol}] Uniswap TVL - Primary: $${primary.toLocaleString()}, Additional: $${additional.toLocaleString()}, Total: $${total.toLocaleString()}`);
    }
    
    return {
      data: { data: total },
      isLoading
    };
  }, [uniswapTVL, additionalUniswapTVL, stablecoin.symbol]);

  const combinedSushiTVL = useMemo(() => {
    const primary = sushiTVL.data || 0;
    const additional = additionalSushiTVL.reduce((sum, query) => sum + (query.data || 0), 0);
    const total = primary + additional;
    const isLoading = sushiTVL.isLoading || additionalSushiTVL.some(q => q.isLoading);
    
    // Debug logging for Sushi TVL
    if (!isLoading && (primary > 0 || additional > 0)) {
      console.log(`[${stablecoin.symbol}] Sushi TVL - Primary: $${primary.toLocaleString()}, Additional: $${additional.toLocaleString()}, Total: $${total.toLocaleString()}`);
    }
    
    return {
      data: { data: total },
      isLoading
    };
  }, [sushiTVL, additionalSushiTVL, stablecoin.symbol]);

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
    totalMainnetLiquidity: useMemo(() => {
      const curveTotal = combinedCurveTVL.data?.data || 0;
      const balancerTotal = combinedBalancerTVL.data?.data || 0;
      const uniswapTotal = combinedUniswapTVL.data?.data || 0;
      const sushiTotal = combinedSushiTVL.data?.data || 0;
      const total = curveTotal + balancerTotal + uniswapTotal + sushiTotal;
      
      const isLoading = combinedCurveTVL.isLoading || combinedBalancerTVL.isLoading || 
                       combinedUniswapTVL.isLoading || combinedSushiTVL.isLoading;
      
      // Debug logging for total mainnet liquidity
      if (!isLoading && total > 0) {
        console.log(`[${stablecoin.symbol}] Total Mainnet Liquidity: $${total.toLocaleString()} (Curve: $${curveTotal.toLocaleString()}, Balancer: $${balancerTotal.toLocaleString()}, Uniswap: $${uniswapTotal.toLocaleString()}, Sushi: $${sushiTotal.toLocaleString()})`);
      }
      
      return {
        data: total,
        isLoading,
        breakdown: {
          curve: curveTotal,
          balancer: balancerTotal,
          uniswap: uniswapTotal,
          sushi: sushiTotal
        }
      };
    }, [combinedCurveTVL, combinedBalancerTVL, combinedUniswapTVL, combinedSushiTVL, stablecoin.symbol]),
    
    supplyOnMainnetPercent: useMemo(() => {
      // Formula: 1 - (Bridge Supply / Mainnet Supply)
      // Shows what % of mainnet supply is actually ON mainnet (not bridged to other chains)
      const mainnetAmount = mainnetSupply.data?.data || 0;
      const bridgeAmount = bridgeSupply.data?.data || 0;
      const percentage = mainnetAmount > 0 ? 1 - (bridgeAmount / mainnetAmount) : 0;
      const isLoading = mainnetSupply.isLoading || bridgeSupply.isLoading;
      
      // Debug logging for supply on mainnet percentage
      if (!isLoading && mainnetAmount > 0) {
        console.log(`[${stablecoin.symbol}] Supply Metrics Summary - Total: $${totalSupply.data?.data?.toLocaleString() || 0}, Mainnet: $${mainnetAmount.toLocaleString()}, Bridge: $${bridgeAmount.toLocaleString()}, On-Mainnet: ${(percentage * 100).toFixed(1)}%`);
      }
      
      return {
        data: percentage,
        isLoading,
        breakdown: {
          totalSupply: totalSupply.data?.data || 0,
          mainnetSupply: mainnetAmount,
          bridgeSupply: bridgeAmount
        }
      };
    }, [mainnetSupply, bridgeSupply, totalSupply, stablecoin.symbol])
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

// Import filtered TVL hooks for mainnet liquidity calculations
import {
  useCurveFilteredTVL,
  useUniswapFilteredTotalTVL,
  useSushiFilteredTotalTVL,
  useBalancerFilteredTVL
} from './useFilteredTVL.js';
