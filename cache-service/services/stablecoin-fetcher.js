// ================= STABLECOIN FETCHER =================
// Service for fetching stablecoin-specific metrics

import { RequestQueue, generateCacheKey } from './request-queue.js';

// Simple safe fetch implementation for stablecoin data
async function safeExternalFetch(cacheKey, fetchFunction, requestQueue, timeoutMs = 30000) {
  try {
    const requestKey = generateCacheKey('stablecoin', cacheKey);
    
    const result = await requestQueue.enqueue(requestKey, async () => {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      );
      
      return await Promise.race([fetchFunction(), timeoutPromise]);
    });
    
    return result;
  } catch (error) {
    // Return safe default on error
    return { data: 0, _unavailable: true };
  }
}

export class StablecoinFetcher {
  constructor(logger, redisClient) {
    this.logger = logger;
    this.redisClient = redisClient;
    
    // Initialize request queue for stablecoin-specific API calls
    // Optimized for stablecoin dashboard that makes many parallel requests
    this.requestQueue = new RequestQueue({
      concurrency: 6, // Increased from 2 - handle multiple stablecoins efficiently
      requestsPerSecond: 8, // Increased from 1 - much less restrictive
      retryAttempts: 2, // Reduced from 3 - fail faster to avoid timeouts
      baseDelay: 1500, // Reduced from 3000ms
      maxDelay: 20000, // Reduced from 45000ms - fail faster
      circuitThreshold: 5, // Increased from 3 - more tolerant
      circuitTimeout: 60000 // Reduced from 90000ms
    });
    
    this.circuitBreaker = {
      failures: 0,
      lastFailTime: 0,
      threshold: 3,
      timeout: 60000 // 1 minute
    };
  }

  // ================= LENDING MARKET DATA =================

  async getAaveCollateralUsage(tokenAddress) {
    const cacheKey = `aave-collateral-${tokenAddress}`;
    
    return safeExternalFetch(
      cacheKey,
      async () => {
        // Placeholder for Aave API integration
        // In production, this would query Aave's subgraph or API
        this.logger.info(`Fetching Aave collateral usage for ${tokenAddress}`);
        
        // Mock data - replace with actual Aave API call
        const mockData = {
          collateralAmount: 0,
          utilizationRate: 0,
          borrowRate: 0,
          supplyRate: 0,
          lastUpdated: new Date().toISOString()
        };
        
        return { data: mockData };
      },
      this.requestQueue,
      30000 // 8 second timeout
    );
  }

  async getMorphoCollateralUsage(tokenAddress) {
    const cacheKey = `morpho-collateral-${tokenAddress}`;
    
    return safeExternalFetch(
      cacheKey,
      async () => {
        // Placeholder for Morpho API integration
        this.logger.info(`Fetching Morpho collateral usage for ${tokenAddress}`);
        
        // Mock data - replace with actual Morpho API call
        const mockData = {
          collateralAmount: 0,
          utilizationRate: 0,
          borrowRate: 0,
          supplyRate: 0,
          lastUpdated: new Date().toISOString()
        };
        
        return { data: mockData };
      },
      this.requestQueue,
      30000
    );
  }

  async getEulerCollateralUsage(tokenAddress) {
    const cacheKey = `euler-collateral-${tokenAddress}`;
    
    return safeExternalFetch(
      cacheKey,
      async () => {
        // Placeholder for Euler API integration
        this.logger.info(`Fetching Euler collateral usage for ${tokenAddress}`);
        
        // Mock data - replace with actual Euler API call
        const mockData = {
          collateralAmount: 0,
          utilizationRate: 0,
          borrowRate: 0,
          supplyRate: 0,
          lastUpdated: new Date().toISOString()
        };
        
        return { data: mockData };
      },
      this.requestQueue,
      30000
    );
  }

  async getFluidCollateralUsage(tokenAddress) {
    const cacheKey = `fluid-collateral-${tokenAddress}`;
    
    return safeExternalFetch(
      cacheKey,
      async () => {
        // Placeholder for Fluid API integration
        this.logger.info(`Fetching Fluid collateral usage for ${tokenAddress}`);
        
        // Mock data - replace with actual Fluid API call
        const mockData = {
          collateralAmount: 0,
          utilizationRate: 0,
          borrowRate: 0,
          supplyRate: 0,
          lastUpdated: new Date().toISOString()
        };
        
        return { data: mockData };
      },
      this.requestQueue,
      30000
    );
  }

  // ================= BRIDGE DATA =================

  async getBridgeSecuredSupply(stablecoinSymbol) {
    const cacheKey = `bridge-supply-${stablecoinSymbol}`;
    
    return safeExternalFetch(
      cacheKey,
      async () => {
        // Placeholder for bridge API integration
        // This would integrate with LayerZero, Wormhole, etc.
        this.logger.info(`Fetching bridge secured supply for ${stablecoinSymbol}`);
        
        // Mock data - replace with actual bridge API calls
        const mockData = {
          totalBridgedSupply: 0,
          bridgeBreakdown: {
            layerzero: 0,
            wormhole: 0,
            multichain: 0,
            other: 0
          },
          lastUpdated: new Date().toISOString()
        };
        
        return { data: mockData };
      },
      this.requestQueue,
      30000
    );
  }

  // ================= SAFETY METRICS =================

  async getInsuranceFund(stablecoinSymbol) {
    const cacheKey = `insurance-fund-${stablecoinSymbol}`;
    
    return safeExternalFetch(
      cacheKey,
      async () => {
        // Placeholder for protocol-specific insurance fund data
        this.logger.info(`Fetching insurance fund data for ${stablecoinSymbol}`);
        
        // Mock data - replace with actual protocol API calls
        const mockData = {
          fundSize: 0,
          fundCurrency: 'USD',
          coverage: 0,
          lastUpdated: new Date().toISOString()
        };
        
        return { data: mockData };
      },
      this.requestQueue,
      30000
    );
  }

  async getCollateralizationRatio(stablecoinSymbol) {
    const cacheKey = `collateralization-ratio-${stablecoinSymbol}`;
    
    return safeExternalFetch(
      cacheKey,
      async () => {
        // Placeholder for protocol-specific CR data
        this.logger.info(`Fetching collateralization ratio for ${stablecoinSymbol}`);
        
        // Mock data - replace with actual protocol API calls
        const mockData = {
          currentRatio: 0,
          targetRatio: 0,
          minimumRatio: 0,
          lastUpdated: new Date().toISOString()
        };
        
        return { data: mockData };
      },
      this.requestQueue,
      30000
    );
  }

  // ================= STAKING DATA =================

  async getStakingData(tokenAddress, stakingContracts) {
    const cacheKey = `staking-data-${tokenAddress}`;
    
    return safeExternalFetch(
      cacheKey,
      async () => {
        // Placeholder for staking contract data
        this.logger.info(`Fetching staking data for ${tokenAddress}`);
        
        // Mock data - replace with actual staking contract calls
        const mockData = {
          totalStaked: 0,
          stakingContracts: stakingContracts.map(contract => ({
            address: contract,
            stakedAmount: 0,
            apy: 0
          })),
          lastUpdated: new Date().toISOString()
        };
        
        return { data: mockData };
      },
      this.requestQueue,
      30000
    );
  }

  // ================= UTILITY METHODS =================

  async refreshStablecoinData(stablecoinConfig) {
    const results = {};
    
    try {
      // Get primary contract address
      const contractAddress = stablecoinConfig.contractAddresses[Object.keys(stablecoinConfig.contractAddresses)[0]];
      
      // Fetch lending market data
      results.aave = await this.getAaveCollateralUsage(contractAddress);
      results.morpho = await this.getMorphoCollateralUsage(contractAddress);
      results.euler = await this.getEulerCollateralUsage(contractAddress);
      results.fluid = await this.getFluidCollateralUsage(contractAddress);
      
      // Fetch bridge data
      results.bridge = await this.getBridgeSecuredSupply(stablecoinConfig.symbol);
      
      // Fetch safety metrics
      results.insurance = await this.getInsuranceFund(stablecoinConfig.symbol);
      results.collateralization = await this.getCollateralizationRatio(stablecoinConfig.symbol);
      
      // Fetch staking data if applicable
      results.staking = await this.getStakingData(contractAddress, []);
      
      this.logger.info(`Successfully refreshed stablecoin data for ${stablecoinConfig.symbol}`);
      
    } catch (error) {
      this.logger.error(`Error refreshing stablecoin data for ${stablecoinConfig.symbol}:`, error);
    }
    
    return results;
  }

  /**
   * Get current request queue status for monitoring
   */
  getQueueStatus() {
    return this.requestQueue.getStatus();
  }

  /**
   * Clear the request queue (for cleanup)
   */
  clearQueue() {
    this.requestQueue.clear();
  }

  /**
   * Health check method
   */
  async healthCheck() {
    try {
      const status = this.getQueueStatus();
      const isHealthy = status.circuitState === 'CLOSED' && status.failureCount < 3;
      
      return {
        healthy: isHealthy,
        status: status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}
