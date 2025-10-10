import { useQuery } from '@tanstack/react-query';
import {
  fetchFluidTokenBorrowLiquidity,
  fetchFluidCollateral
} from '../services/cache-client.js';

// ================= FLUID HOOKS =================
// NOTE: All hooks return COLLATERAL data (when token is used as supplyToken in Fluid vaults)

/**
 * Hook to get Fluid collateral for a specific token (direct API call)
 * Gets the total USD value of a token when used as collateral (supplyToken) in Fluid vaults
 * @param {string} tokenAddress - The token contract address
 * @param {object} options - Query options
 * @returns {object} Query result with collateral data
 */
export function useFluidBorrowLiquidity(tokenAddress, options = {}) {
  return useQuery({
    queryKey: ['fluid', 'collateral', tokenAddress?.toLowerCase()],
    queryFn: () => fetchFluidTokenBorrowLiquidity(tokenAddress),
    enabled: !!tokenAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    ...options
  });
}

/**
 * Hook to get Fluid collateral usage for a specific token (direct API call)
 * Alias for useFluidBorrowLiquidity - both return collateral data
 * @param {string} tokenAddress - The token contract address
 * @param {object} options - Query options
 * @returns {object} Query result with collateral data
 */
export function useFluidCollateral(tokenAddress, options = {}) {
  return useQuery({
    queryKey: ['fluid', 'collateral', tokenAddress?.toLowerCase()],
    queryFn: () => fetchFluidCollateral(tokenAddress),
    enabled: !!tokenAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    ...options
  });
}

/**
 * Hook to get Fluid data for a token
 * @param {string} tokenAddress - The token contract address
 * @returns {object} Fluid collateral data
 */
export function useFluidTokenData(tokenAddress) {
  const collateralQuery = useFluidCollateral(tokenAddress);
  
  return {
    collateral: {
      data: collateralQuery.data || 0,
      isLoading: collateralQuery.isLoading,
      error: collateralQuery.error,
      isError: collateralQuery.isError
    },
    isLoading: collateralQuery.isLoading,
    hasError: collateralQuery.isError
  };
}

