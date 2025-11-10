import axios from 'axios';
import { RequestQueue, generateCacheKey } from './request-queue.js';

export class PendleFetcher {
  constructor() {
    this.baseUrl = 'https://api-v2.pendle.finance/core/v1';
    
    // Initialize request queue with optimized settings for Pendle API
    this.requestQueue = new RequestQueue({
      concurrency: 3, // Conservative for Pendle API
      requestsPerSecond: 5, // Moderate rate limiting
      retryAttempts: 2, // Fail faster
      baseDelay: 1000, // Base delay
      maxDelay: 20000, // Max delay
      circuitThreshold: 4, // Circuit breaker threshold
      circuitTimeout: 60000 // Circuit breaker timeout
    });
    
    console.log('PendleFetcher initialized with request queue');
  }

  /**
   * Fetch all Pendle markets for Ethereum mainnet
   * @returns {Promise<Array>} - Array of market objects
   */
  async fetchAllMarkets() {
    const requestKey = generateCacheKey('pendle', 'all-markets', { chainId: 1 });
    
    return this.requestQueue.enqueue(requestKey, async () => {
      const url = `${this.baseUrl}/markets/all?chainId=1`;
      console.log('Fetching all Pendle markets...');
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'OpenDashboard/1.0'
        }
      });

      const markets = response.data?.markets || [];
      console.log(`Successfully fetched ${markets.length} Pendle markets`);
      
      return {
        markets,
        total: markets.length,
        fetched_at: new Date().toISOString()
      };
    }).catch(error => {
      console.error('Error fetching Pendle markets:', error.message);
      return {
        markets: [],
        total: 0,
        error: error.message,
        _unavailable: true,
        fetched_at: new Date().toISOString()
      };
    });
  }

  /**
   * Filter markets by underlying asset and exclude expired markets
   * @param {Array} markets - Array of Pendle market objects
   * @param {Array} tokenAddresses - Array of token addresses to match
   * @returns {Array} - Filtered markets
   */
  filterMarketsByUnderlyingAsset(markets, tokenAddresses) {
    if (!markets || !Array.isArray(markets) || markets.length === 0) {
      return [];
    }

    const now = new Date();
    const addressSet = new Set(tokenAddresses.map(addr => addr.toLowerCase()));
    
    const filtered = markets.filter(market => {
      // Check if expired
      if (market.expiry) {
        const expiryDate = new Date(market.expiry);
        if (expiryDate < now) {
          return false; // Exclude expired markets
        }
      }
      
      // Extract address from "chainId-address" format
      const underlyingAsset = market.underlyingAsset || '';
      const assetAddress = underlyingAsset.includes('-') 
        ? underlyingAsset.split('-')[1]?.toLowerCase()
        : underlyingAsset.toLowerCase();
      
      return addressSet.has(assetAddress);
    });

    console.log(`Filtered ${filtered.length} active markets from ${markets.length} total (${tokenAddresses.length} tokens matched)`);
    return filtered;
  }

  /**
   * Extract PT token addresses from markets
   * @param {Array} markets - Array of Pendle market objects
   * @returns {Array} - Array of PT token addresses
   */
  extractPTAddresses(markets) {
    if (!markets || !Array.isArray(markets)) {
      return [];
    }

    const ptAddresses = markets
      .map(market => {
        const ptField = market.pt || '';
        // Strip "chainId-" prefix to get just the address
        const ptAddress = ptField.includes('-') 
          ? ptField.split('-')[1]
          : ptField;
        
        return ptAddress?.toLowerCase();
      })
      .filter(addr => addr && addr.startsWith('0x')); // Only valid addresses

    console.log(`Extracted ${ptAddresses.length} PT token addresses from ${markets.length} markets`);
    return ptAddresses;
  }

  /**
   * Get PT token addresses for a stablecoin (including staked versions)
   * @param {Array} tokenAddresses - Array of stablecoin contract addresses
   * @param {Array} allMarkets - All Pendle markets (from cache)
   * @returns {Object} - PT addresses with market details
   */
  getPTTokensForStablecoin(tokenAddresses, allMarkets) {
    try {
      const markets = allMarkets?.markets || [];
      
      // Filter markets for this stablecoin
      const relevantMarkets = this.filterMarketsByUnderlyingAsset(markets, tokenAddresses);
      
      // Extract PT addresses
      const ptAddresses = this.extractPTAddresses(relevantMarkets);
      
      // Create detailed mapping
      const ptDetails = relevantMarkets.map(market => {
        const ptField = market.pt || '';
        const ptAddress = ptField.includes('-') ? ptField.split('-')[1] : ptField;
        const underlyingAsset = market.underlyingAsset || '';
        const assetAddress = underlyingAsset.includes('-') 
          ? underlyingAsset.split('-')[1]
          : underlyingAsset;
        
        return {
          ptAddress: ptAddress?.toLowerCase(),
          marketAddress: market.address?.toLowerCase(),
          marketName: market.name,
          underlyingAsset: assetAddress?.toLowerCase(),
          expiry: market.expiry,
          totalTvl: market.details?.totalTvl || 0,
          totalPt: market.details?.totalPt || 0
        };
      });

      return {
        ptAddresses,
        ptDetails,
        marketCount: relevantMarkets.length,
        tokenAddresses: tokenAddresses.map(a => a.toLowerCase())
      };
    } catch (error) {
      console.error('Error getting PT tokens for stablecoin:', error.message);
      return {
        ptAddresses: [],
        ptDetails: [],
        marketCount: 0,
        error: error.message
      };
    }
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

