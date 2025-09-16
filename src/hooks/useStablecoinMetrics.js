// ================= STABLECOIN METRICS HOOKS =================
// Hooks for fetching stablecoin-specific data from various sources

import { useQuery } from '@tanstack/react-query';
import { cacheClient } from '../services/cache-client.js';

// ================= SUPPLY METRICS =================

/**
 * Hook to fetch total supply for a stablecoin
 */
export function useStablecoinTotalSupply(contractAddress, options = {}) {
  return useQuery({
    queryKey: ['stablecoin-total-supply', contractAddress],
    queryFn: async () => {
      if (!contractAddress) return { data: 0, _unavailable: true };
      
      const response = await cacheClient.get(`/api/ethereum/token-total-supply/${contractAddress}`);
      return response.data;
    },
    enabled: !!contractAddress && (options.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    ...options
  });
}

/**
 * Hook to fetch mainnet supply for a stablecoin
 */
export function useStablecoinMainnetSupply(contractAddress, options = {}) {
  return useQuery({
    queryKey: ['stablecoin-mainnet-supply', contractAddress],
    queryFn: async () => {
      if (!contractAddress) return { data: 0, _unavailable: true };
      
      // For now, assume mainnet supply equals total supply
      // This can be refined to subtract cross-chain supplies
      const response = await cacheClient.get(`/api/ethereum/token-total-supply/${contractAddress}`);
      return response.data;
    },
    enabled: !!contractAddress && (options.enabled !== false),
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
    retry: 2,
    ...options
  });
}

/**
 * Hook to fetch bridge-secured supply
 */
export function useStablecoinBridgeSupply(stablecoinSymbol, options = {}) {
  return useQuery({
    queryKey: ['stablecoin-bridge-supply', stablecoinSymbol],
    queryFn: async () => {
      if (!stablecoinSymbol) return { data: 0, _unavailable: true };
      
      // This would integrate with bridge APIs like LayerZero, Wormhole, etc.
      // For now, return placeholder data
      return { data: 0, _unavailable: true, _placeholder: true };
    },
    enabled: !!stablecoinSymbol && (options.enabled !== false),
    staleTime: 10 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    retry: 2,
    ...options
  });
}

// ================= LENDING MARKET METRICS =================

/**
 * Hook to fetch Aave collateral usage for a stablecoin
 */
export function useAaveCollateralUsage(contractAddress, options = {}) {
  return useQuery({
    queryKey: ['aave-collateral', contractAddress],
    queryFn: async () => {
      if (!contractAddress) return { data: 0, _unavailable: true };
      
      try {
        const response = await cacheClient.get(`/api/aave/collateral/${contractAddress}`);
        return response.data;
      } catch (error) {
        console.warn('Aave data unavailable:', error);
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
 * Hook to fetch Morpho collateral usage for a stablecoin
 */
export function useMorphoCollateralUsage(contractAddress, options = {}) {
  return useQuery({
    queryKey: ['morpho-collateral', contractAddress],
    queryFn: async () => {
      if (!contractAddress) return { data: 0, _unavailable: true };
      
      try {
        const response = await cacheClient.get(`/api/morpho/collateral/${contractAddress}`);
        return response.data;
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
    queryKey: ['euler-collateral', contractAddress],
    queryFn: async () => {
      if (!contractAddress) return { data: 0, _unavailable: true };
      
      try {
        const response = await cacheClient.get(`/api/euler/collateral/${contractAddress}`);
        return response.data;
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
        const response = await cacheClient.get(`/api/fluid/collateral/${contractAddress}`);
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
 * Hook to fetch combined lending market usage
 */
export function useTotalLendingMarketUsage(contractAddress, options = {}) {
  const aaveData = useAaveCollateralUsage(contractAddress, options);
  const morphoData = useMorphoCollateralUsage(contractAddress, options);
  const eulerData = useEulerCollateralUsage(contractAddress, options);
  const fluidData = useFluidCollateralUsage(contractAddress, options);

  return useQuery({
    queryKey: ['total-lending-usage', contractAddress, aaveData.data, morphoData.data, eulerData.data, fluidData.data],
    queryFn: async () => {
      const total = (aaveData.data?.data || 0) + 
                   (morphoData.data?.data || 0) + 
                   (eulerData.data?.data || 0) + 
                   (fluidData.data?.data || 0);
      
      return { 
        data: total,
        breakdown: {
          aave: aaveData.data?.data || 0,
          morpho: morphoData.data?.data || 0,
          euler: eulerData.data?.data || 0,
          fluid: fluidData.data?.data || 0
        }
      };
    },
    enabled: !!contractAddress && (options.enabled !== false) &&
             aaveData.isSuccess && morphoData.isSuccess && eulerData.isSuccess && fluidData.isSuccess,
    staleTime: 15 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    ...options
  });
}

// ================= SAFETY BUFFER METRICS =================

/**
 * Hook to fetch insurance fund data for a stablecoin
 */
export function useStablecoinInsuranceFund(stablecoinSymbol, options = {}) {
  return useQuery({
    queryKey: ['stablecoin-insurance-fund', stablecoinSymbol],
    queryFn: async () => {
      if (!stablecoinSymbol) return { data: 0, _unavailable: true };
      
      try {
        const response = await cacheClient.get(`/api/stablecoin/insurance-fund/${stablecoinSymbol.toLowerCase()}`);
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
 */
export function useStablecoinCollateralizationRatio(stablecoinSymbol, options = {}) {
  return useQuery({
    queryKey: ['stablecoin-cr', stablecoinSymbol],
    queryFn: async () => {
      if (!stablecoinSymbol) return { data: 0, _unavailable: true };
      
      try {
        const response = await cacheClient.get(`/api/stablecoin/collateralization-ratio/${stablecoinSymbol.toLowerCase()}`);
        return response.data;
      } catch (error) {
        console.warn('Collateralization ratio data unavailable:', error);
        return { data: 0, _unavailable: true };
      }
    },
    enabled: !!stablecoinSymbol && (options.enabled !== false),
    staleTime: 15 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    retry: 1,
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
          const response = await cacheClient.get(`/api/ethereum/token-balance/${contractAddress}/${stakingContract}`);
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
 * Hook to fetch all metrics for a single stablecoin
 */
export function useStablecoinCompleteMetrics(stablecoin, options = {}) {
  const contractAddress = stablecoin.contractAddresses?.[Object.keys(stablecoin.contractAddresses)[0]];
  
  // Supply metrics
  const totalSupply = useStablecoinTotalSupply(contractAddress, options);
  const mainnetSupply = useStablecoinMainnetSupply(contractAddress, options);
  const bridgeSupply = useStablecoinBridgeSupply(stablecoin.symbol, options);
  
  // DEX liquidity (reuse existing hooks)
  const curveTVL = useCurveTVL(contractAddress, options);
  const balancerTVL = useBalancerTVL(contractAddress, options);
  const uniswapTVL = useUniswapTotalTVL(contractAddress, options);
  const sushiTVL = useSushiTotalTVL(contractAddress, options);
  
  // Lending markets
  const totalLendingUsage = useTotalLendingMarketUsage(contractAddress, options);
  
  // Safety metrics
  const insuranceFund = useStablecoinInsuranceFund(stablecoin.symbol, options);
  const collateralizationRatio = useStablecoinCollateralizationRatio(stablecoin.symbol, options);
  const stakedSupply = useStablecoinStakedSupply(contractAddress, [], options);

  return {
    // Supply metrics
    totalSupply,
    mainnetSupply,
    bridgeSupply,
    
    // Liquidity metrics
    curveTVL,
    balancerTVL,
    uniswapTVL,
    sushiTVL,
    
    // Lending markets
    totalLendingUsage,
    
    // Safety metrics
    insuranceFund,
    collateralizationRatio,
    stakedSupply,
    
    // Calculated metrics
    totalMainnetLiquidity: {
      data: (curveTVL.data?.data || 0) + (balancerTVL.data?.data || 0) + 
            (uniswapTVL.data?.data || 0) + (sushiTVL.data?.data || 0),
      isLoading: curveTVL.isLoading || balancerTVL.isLoading || uniswapTVL.isLoading || sushiTVL.isLoading
    },
    
    supplyOnMainnetPercent: {
      data: totalSupply.data?.data > 0 ? (mainnetSupply.data?.data || 0) / totalSupply.data.data : 0,
      isLoading: totalSupply.isLoading || mainnetSupply.isLoading
    }
  };
}

// Import existing hooks for reuse
import { 
  useCurveTVL,
  useBalancerTVL,
  useUniswapTotalTVL,
  useSushiTotalTVL
} from './index.js';
