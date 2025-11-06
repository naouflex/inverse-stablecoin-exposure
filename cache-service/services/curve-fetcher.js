import axios from 'axios';
import { RequestQueue, generateCacheKey } from './request-queue.js';

export class CurveFetcher {
  constructor() {
    this.baseUrl = 'https://api.curve.finance/v1';
    
    // Initialize request queue with optimized settings for Curve API
    this.requestQueue = new RequestQueue({
      concurrency: 3, // Curve API is more conservative
      requestsPerSecond: 4, // Conservative rate limiting
      retryAttempts: 2, // Fail faster
      baseDelay: 1500, // Slightly longer base delay
      maxDelay: 20000, // Max delay
      circuitThreshold: 4, // Circuit breaker threshold
      circuitTimeout: 60000 // Circuit breaker timeout
    });
    
    console.log('CurveFetcher initialized with request queue');
  }

  /**
   * Fetch data based on queryType and params
   * @param {string} queryType - Type of query (token_tvl, token_volume, all_pools)
   * @param {object} params - Parameters including tokenAddress
   * @returns {Promise<object>} - Formatted response data
   */
  async fetchData(queryType, params = {}) {
    const requestKey = generateCacheKey('curve', queryType, params);
    
    return this.requestQueue.enqueue(requestKey, async () => {
      console.log(`Fetching Curve ${queryType} data`);
      
      let result;
      switch (queryType) {
        case 'token_tvl':
          result = await this.fetchTokenTVL(params.tokenAddress);
          break;
        case 'token_volume':
          result = await this.fetchTokenVolume(params.tokenAddress);
          break;
        case 'all_pools':
          result = await this.fetchAllPools();
          break;
        default:
          throw new Error(`Unknown query type: ${queryType}`);
      }

      const response = {
        protocol: 'curve',
        queryType,
        data: result,
        fetched_at: new Date().toISOString()
      };

      console.log(`Successfully fetched Curve ${queryType} data`);
      return response;
    }).catch(error => {
      console.error(`Error fetching Curve ${queryType} data:`, error.message);
      // Return error object with null data and _unavailable flag
      return {
        protocol: 'curve',
        queryType,
        data: null,
        error: error.message,
        _unavailable: true,
        fetched_at: new Date().toISOString()
      };
    });
  }

  /**
   * Get Curve TVL for a specific token by finding all pools containing that token
   * @param {string} tokenAddress - The token contract address  
   * @returns {Promise<number>} - Total Value Locked in USD across all pools containing the token
   */
  async fetchTokenTVL(tokenAddress) {
    const requestKey = generateCacheKey('curve', 'token-tvl-internal', { tokenAddress });
    
    return this.requestQueue.enqueue(requestKey, async () => {
      const url = `${this.baseUrl}/getPools/all/ethereum`;
      console.log(`Fetching Curve pools data for TVL calculation: ${tokenAddress}`);
      
      const response = await axios.get(url, { timeout: 8000 });
      
      let totalTVL = 0;
      
      if (response.data.success && response.data.data && response.data.data.poolData) {
        for (const pool of response.data.data.poolData) {
          // Check if this pool contains our token
          let hasToken = false;
          if (pool.coinsAddresses) {
            for (const coinAddress of pool.coinsAddresses) {
              if (coinAddress.toLowerCase() === tokenAddress.toLowerCase()) {
                hasToken = true;
                break;
              }
            }
          }
          
          if (hasToken && pool.coins) {
            // Calculate only the specific token's TVL in this pool, not the entire pool TVL
            for (const coin of pool.coins) {
              if (coin.address && coin.address.toLowerCase() === tokenAddress.toLowerCase()) {
                if (coin.poolBalance && coin.usdPrice) {
                  const balance = Number(coin.poolBalance);
                  const price = Number(coin.usdPrice);
                  const decimals = Number(coin.decimals || 18);
                  const coinValue = (balance * price) / Math.pow(10, decimals);
                  totalTVL += coinValue;
                  console.log(`Curve Pool: ${pool.name}, ${coin.symbol} TVL: ${coinValue}`);
                }
                break; // Found our token, no need to check other coins in this pool
              }
            }
          }
        }
      }
      
      console.log(`Total Curve TVL for ${tokenAddress}: $${totalTVL.toFixed(2)}`);
      return totalTVL;
    }).catch(error => {
      console.error(`Error fetching Curve TVL for ${tokenAddress}:`, error.message);
      throw error; // Let fetchData handle the error formatting
    });
  }

  /**
   * Get Curve 24h volume for a specific token across all pools containing that token
   * @param {string} tokenAddress - The token contract address
   * @returns {Promise<number>} - 24h volume in USD
   */
  async fetchTokenVolume(tokenAddress) {
    const requestKey = generateCacheKey('curve', 'token-volume-internal', { tokenAddress });
    
    return this.requestQueue.enqueue(requestKey, async () => {
      console.log(`Fetching Curve volume data for: ${tokenAddress}`);
      
      // First get all pools to find which ones contain our token
      const poolUrl = `${this.baseUrl}/getPools/all/ethereum`;
      const poolResponse = await axios.get(poolUrl, { timeout: 8000 });
      
      const relevantPoolAddresses = [];
      if (poolResponse.data.success && poolResponse.data.data && poolResponse.data.data.poolData) {
        for (const poolInfo of poolResponse.data.data.poolData) {
          if (poolInfo.coinsAddresses) {
            for (const coinAddress of poolInfo.coinsAddresses) {
              if (coinAddress.toLowerCase() === tokenAddress.toLowerCase()) {
                relevantPoolAddresses.push(poolInfo.address.toLowerCase());
                break;
              }
            }
          }
        }
      }
      
      // Now get volumes for these specific pools
      const volumeUrl = `${this.baseUrl}/getVolumes/ethereum`;
      const volumeResponse = await axios.get(volumeUrl, { timeout: 8000 });
      
      let totalVolume = 0;
      if (volumeResponse.data.success && volumeResponse.data.data && volumeResponse.data.data.pools) {
        for (const pool of volumeResponse.data.data.pools) {
          if (relevantPoolAddresses.includes(pool.address.toLowerCase())) {
            totalVolume += Number(pool.volumeUSD || 0);
            console.log(`Curve Pool address: ${pool.address}, Volume: ${pool.volumeUSD}`);
          }
        }
      }
      
      console.log(`Total Curve volume for ${tokenAddress}: $${totalVolume.toFixed(2)}`);
      return totalVolume;
    }).catch(error => {
      console.error(`Error fetching Curve volume for ${tokenAddress}:`, error.message);
      throw error; // Let fetchData handle the error formatting
    });
  }

  /**
   * Fetch all Curve pools data (useful for caching and efficiency)
   * @returns {Promise<object>} - All pools data from Curve API
   */
  async fetchAllPools() {
    const requestKey = generateCacheKey('curve', 'all-pools-internal', {});
    
    return this.requestQueue.enqueue(requestKey, async () => {
      console.log('Fetching all Curve pools data');
      
      const url = `${this.baseUrl}/getPools/all/ethereum`;
      const response = await axios.get(url, { timeout: 8000 });
      
      if (response.data.success && response.data.data) {
        console.log(`Successfully fetched ${response.data.data.poolData?.length || 0} Curve pools`);
        return response.data.data;
      }
      
      throw new Error('Invalid response structure from Curve API');
    }).catch(error => {
      console.error('Error fetching all Curve pools:', error.message);
      throw error; // Let fetchData handle the error formatting
    });
  }

  /**
   * Fetch all Curve volumes data (useful for caching and efficiency)
   * @returns {Promise<object>} - All volumes data from Curve API
   */
  async fetchAllVolumes() {
    const requestKey = generateCacheKey('curve', 'all-volumes-internal', {});
    
    return this.requestQueue.enqueue(requestKey, async () => {
      console.log('Fetching all Curve volumes data');
      
      const url = `${this.baseUrl}/getVolumes/ethereum`;
      const response = await axios.get(url, { timeout: 8000 });
      
      if (response.data.success && response.data.data) {
        console.log(`Successfully fetched ${response.data.data.pools?.length || 0} Curve pool volumes`);
        return response.data.data;
      }
      
      throw new Error('Invalid response structure from Curve API');
    }).catch(error => {
      console.error('Error fetching all Curve volumes:', error.message);
      throw error;
    });
  }

  /**
   * Get total TVL for a specific Curve pool
   * @param {string} poolAddress - The pool contract address
   * @returns {Promise<number>} - Total pool TVL in USD
   */
  async fetchPoolTVL(poolAddress) {
    try {
      const url = `${this.baseUrl}/getPools/all/ethereum`;
      const response = await axios.get(url, { timeout: 8000 });
      
      if (response.data.success && response.data.data && response.data.data.poolData) {
        for (const pool of response.data.data.poolData) {
          if (pool.address && pool.address.toLowerCase() === poolAddress.toLowerCase()) {
            // Calculate total pool TVL from all coins
            let poolTVL = 0;
            if (pool.coins) {
              for (const coin of pool.coins) {
                if (coin.poolBalance && coin.usdPrice) {
                  const balance = Number(coin.poolBalance);
                  const price = Number(coin.usdPrice);
                  const decimals = Number(coin.decimals || 18);
                  const coinValue = (balance * price) / Math.pow(10, decimals);
                  poolTVL += coinValue;
                }
              }
            }
            return poolTVL;
          }
        }
      }
      
      return 0;
    } catch (error) {
      console.error(`Error fetching Curve pool TVL for ${poolAddress}:`, error.message);
      return 0;
    }
  }

  /**
   * Get Curve TVL for a specific token excluding same-protocol stablecoin pairs
   * @param {string} tokenAddress - The token contract address  
   * @returns {Promise<number>} - Filtered TVL in USD
   */
  async fetchFilteredTokenTVL(tokenAddress) {
    try {
      const url = `${this.baseUrl}/getPools/all/ethereum`;
      const response = await axios.get(url, { timeout: 8000 });
      
      let totalTVL = 0;
      
      if (response.data.success && response.data.data && response.data.data.poolData) {
        for (const pool of response.data.data.poolData) {
          // Check if this pool contains our token
          let hasToken = false;
          let otherTokens = [];
          
          if (pool.coinsAddresses && pool.coins) {
            for (let i = 0; i < pool.coinsAddresses.length; i++) {
              const coinAddress = pool.coinsAddresses[i];
              if (coinAddress.toLowerCase() === tokenAddress.toLowerCase()) {
                hasToken = true;
              } else {
                otherTokens.push(coinAddress);
              }
            }
          }
          
          if (hasToken) {
            // Check if any other token in the pool is from the same protocol
            let shouldExclude = false;
            for (const otherToken of otherTokens) {
              if (this.areTokensFromSameProtocol(tokenAddress, otherToken)) {
                shouldExclude = true;
                console.log(`Excluding Curve pool ${pool.name} - contains same-protocol tokens`);
                break;
              }
            }
            
            if (!shouldExclude && pool.coins) {
              // Calculate only the specific token's TVL in this pool
              for (const coin of pool.coins) {
                if (coin.address && coin.address.toLowerCase() === tokenAddress.toLowerCase()) {
                  if (coin.poolBalance && coin.usdPrice) {
                    const balance = Number(coin.poolBalance);
                    const price = Number(coin.usdPrice);
                    const decimals = Number(coin.decimals || 18);
                    const coinValue = (balance * price) / Math.pow(10, decimals);
                    totalTVL += coinValue;
                    console.log(`Curve Pool: ${pool.name}, ${coin.symbol} TVL: ${coinValue} (filtered)`);
                  }
                  break;
                }
              }
            }
          }
        }
      }
      
      console.log(`Total filtered Curve TVL for ${tokenAddress}: $${totalTVL.toFixed(2)}`);
      return totalTVL;
    } catch (error) {
      console.error(`Error fetching filtered Curve TVL for ${tokenAddress}:`, error.message);
      return 0;
    }
  }

  /**
   * Check if two tokens are from the same stablecoin protocol
   * @param {string} token1Address - First token address
   * @param {string} token2Address - Second token address
   * @returns {boolean} - True if tokens are from same protocol
   */
  areTokensFromSameProtocol(token1Address, token2Address) {
    if (!token1Address || !token2Address) return false;
    
    const addr1 = token1Address.toLowerCase();
    const addr2 = token2Address.toLowerCase();
    
    // Stablecoin relationship mapping
    const stablecoinRelationships = {
      sky: [
        "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
        "0xdc035d45d973e3ec169d2276ddab16f1e407384f", // USDS
        "0xa3931d71877c0e7a3148cb7eb4463524fec27fbd", // sUSDS
        "0x83f20f44975d03b1b09e64809b757c47f942beea"  // sDAI
      ],
      ethena: [
        "0x4c9edd5852cd905f086c759e8383e09bff1e68b3", // USDe
        "0x9d39a5de30e57443bff2a8307a4256c8797a3497"  // sUSDe
      ],
      resolv: [
        "0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110", // USR
        "0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055"  // wstUSR
      ],
      elixir: [
        "0x15700b564ca08d9439c58ca5053166e8317aa138", // deUSD
        "0x5c5b196abe0d54485975d1ec29617d42d9198326"  // sdeUSD
      ],
      curve: [
        "0xf939e0a03fb07f59a73314e73794be0e57ac1b4e", // crvUSD
        "0x0655977feb2f289a4ab78af67bab0d17aab84367"  // scrvUSD
      ],
      openeden: [
        "0x8238884ec9668ef77b90c6dff4d1a9f4f4823bfe", // USDO
        "0xad55aebc9b8c03fc43cd9f62260391c13c23e7c0"  // cUSDO
      ],
      fx: [
        "0x085780639cc2cacd35e474e71f4d000e2405d8f6", // fxUSD
        "0x7743e50f534a7f9f1791dde7dcd89f7783eefc39"  // xfxUSD/fxSave
      ],
      reserve: [
        "0x57ab1e0003f623289cd798b1824be09a793e4bec", // reUSD
        "0x557AB1e003951A73c12D16F0fEA8490E39C33C35"  // RSR staking
      ]
    };
    
    // Check each protocol's token list
    for (const protocolTokens of Object.values(stablecoinRelationships)) {
      const lowerTokens = protocolTokens.map(addr => addr.toLowerCase());
      
      if (lowerTokens.includes(addr1) && lowerTokens.includes(addr2)) {
        return true;
      }
    }
    
    return false;
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