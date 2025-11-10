import { useQuery } from '@tanstack/react-query';
import {
  fetchCurveFilteredTVL,
  fetchUniswapFilteredTotalTVL,
  fetchSushiFilteredTotalTVL,
  fetchBalancerFilteredTVL,
  fetchBalancerV2FilteredTVL,
  fetchBalancerV3FilteredTVL
} from '../services/cache-client.js';

// ================= FILTERED TVL HOOKS =================
// These hooks fetch TVL data excluding same-protocol stablecoin pairs
// For example, DAI-USDC is included but DAI-USDS is excluded

/**
 * Hook to get filtered Curve TVL for a specific token (excludes same-protocol pairs, includes Pendle PT)
 * @param {string} tokenAddress - The token contract address
 * @param {Array} additionalAddresses - Additional addresses (e.g., staked versions)
 * @param {object} options - Query options
 * @returns {object} Query result with filtered TVL data
 */
export function useCurveFilteredTVL(tokenAddress, additionalAddresses = [], options = {}) {
  return useQuery({
    queryKey: ['curve', 'filtered-tvl-pt', tokenAddress?.toLowerCase(), additionalAddresses.sort().join(',')],
    queryFn: () => fetchCurveFilteredTVL(tokenAddress, additionalAddresses),
    enabled: !!tokenAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    ...options
  });
}

/**
 * Hook to get filtered Uniswap total TVL for a specific token (excludes same-protocol pairs, includes Pendle PT)
 * @param {string} tokenAddress - The token contract address
 * @param {Array} additionalAddresses - Additional addresses (e.g., staked versions)
 * @param {object} options - Query options
 * @returns {object} Query result with filtered TVL data
 */
export function useUniswapFilteredTotalTVL(tokenAddress, additionalAddresses = [], options = {}) {
  return useQuery({
    queryKey: ['uniswap', 'filtered-total-tvl-pt', tokenAddress?.toLowerCase(), additionalAddresses.sort().join(',')],
    queryFn: () => fetchUniswapFilteredTotalTVL(tokenAddress, additionalAddresses),
    enabled: !!tokenAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    ...options
  });
}

/**
 * Hook to get filtered SushiSwap total TVL for a specific token (excludes same-protocol pairs, includes Pendle PT)
 * @param {string} tokenAddress - The token contract address
 * @param {Array} additionalAddresses - Additional addresses (e.g., staked versions)
 * @param {object} options - Query options
 * @returns {object} Query result with filtered TVL data
 */
export function useSushiFilteredTotalTVL(tokenAddress, additionalAddresses = [], options = {}) {
  return useQuery({
    queryKey: ['sushiswap', 'filtered-total-tvl-pt', tokenAddress?.toLowerCase(), additionalAddresses.sort().join(',')],
    queryFn: () => fetchSushiFilteredTotalTVL(tokenAddress, additionalAddresses),
    enabled: !!tokenAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    ...options
  });
}

/**
 * Hook to get filtered Balancer TVL for a specific token (excludes same-protocol pairs, includes Pendle PT)
 * @param {string} tokenAddress - The token contract address
 * @param {Array} additionalAddresses - Additional addresses (e.g., staked versions)
 * @param {object} options - Query options
 * @returns {object} Query result with filtered TVL data
 */
export function useBalancerFilteredTVL(tokenAddress, additionalAddresses = [], options = {}) {
  return useQuery({
    queryKey: ['balancer', 'filtered-tvl-pt', tokenAddress?.toLowerCase(), additionalAddresses.sort().join(',')],
    queryFn: () => fetchBalancerFilteredTVL(tokenAddress, additionalAddresses),
    enabled: !!tokenAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    ...options
  });
}
