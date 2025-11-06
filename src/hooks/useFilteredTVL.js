import { useQuery } from '@tanstack/react-query';
import {
  fetchCurveFilteredTVL,
  fetchUniswapFilteredTotalTVL,
  fetchSushiFilteredTotalTVL,
  fetchBalancerFilteredTVL
} from '../services/cache-client.js';

// ================= FILTERED TVL HOOKS =================
// These hooks fetch TVL data excluding same-protocol stablecoin pairs
// For example, DAI-USDC is included but DAI-USDS is excluded

/**
 * Hook to get filtered Curve TVL for a specific token (excludes same-protocol pairs)
 * @param {string} tokenAddress - The token contract address
 * @param {object} options - Query options
 * @returns {object} Query result with filtered TVL data
 */
export function useCurveFilteredTVL(tokenAddress, options = {}) {
  return useQuery({
    queryKey: ['curve', 'filtered-tvl', tokenAddress?.toLowerCase()],
    queryFn: () => fetchCurveFilteredTVL(tokenAddress),
    enabled: !!tokenAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    ...options
  });
}

/**
 * Hook to get filtered Uniswap total TVL for a specific token (excludes same-protocol pairs)
 * @param {string} tokenAddress - The token contract address
 * @param {object} options - Query options
 * @returns {object} Query result with filtered TVL data
 */
export function useUniswapFilteredTotalTVL(tokenAddress, options = {}) {
  return useQuery({
    queryKey: ['uniswap', 'filtered-total-tvl', tokenAddress?.toLowerCase()],
    queryFn: () => fetchUniswapFilteredTotalTVL(tokenAddress),
    enabled: !!tokenAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    ...options
  });
}

/**
 * Hook to get filtered SushiSwap total TVL for a specific token (excludes same-protocol pairs)
 * @param {string} tokenAddress - The token contract address
 * @param {object} options - Query options
 * @returns {object} Query result with filtered TVL data
 */
export function useSushiFilteredTotalTVL(tokenAddress, options = {}) {
  return useQuery({
    queryKey: ['sushiswap', 'filtered-total-tvl', tokenAddress?.toLowerCase()],
    queryFn: () => fetchSushiFilteredTotalTVL(tokenAddress),
    enabled: !!tokenAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    ...options
  });
}

/**
 * Hook to get filtered Balancer TVL for a specific token (excludes same-protocol pairs)
 * @param {string} tokenAddress - The token contract address
 * @param {object} options - Query options
 * @returns {object} Query result with filtered TVL data
 */
export function useBalancerFilteredTVL(tokenAddress, options = {}) {
  return useQuery({
    queryKey: ['balancer', 'filtered-tvl', tokenAddress?.toLowerCase()],
    queryFn: () => fetchBalancerFilteredTVL(tokenAddress),
    enabled: !!tokenAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    ...options
  });
}
