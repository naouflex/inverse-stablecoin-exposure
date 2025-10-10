import axios from 'axios';
import { RequestQueue, generateCacheKey } from './request-queue.js';

export class MorphoFetcher {
  constructor() {
    this.apiUrl = 'https://api.morpho.org/graphql';
    
    // Initialize request queue for Morpho API calls
    this.requestQueue = new RequestQueue({
      concurrency: 4, // Morpho API can handle moderate concurrency
      requestsPerSecond: 5, // Conservative rate limiting
      retryAttempts: 3,
      baseDelay: 1000,
      maxDelay: 15000,
      circuitThreshold: 5,
      circuitTimeout: 60000
    });
    
    console.log('MorphoFetcher initialized with unified API');
  }

  /**
   * Get markets where a token is used as collateral and aggregate TVL data
   * Uses two-step approach: 1) Find markets, 2) Get aggregated TVL data
   * @param {string} tokenAddress - The token contract address
   * @returns {Promise<Object>} - Market data from Morpho API
   */
  async getTokenMarkets(tokenAddress) {
    try {
      // Step 1: Find all markets where token is used as collateral
      const identifyMarketsQuery = `
        query IdentifyCollateralMarkets($tokenAddress: String!) {
          collateralMarkets: markets(
            first: 1000
            where: { 
              collateralAssetAddress_in: [$tokenAddress],
              chainId_in: [1]
            }
          ) {
            pageInfo {
              count
              countTotal
            }
            items {
              uniqueKey
              lltv
              collateralAsset {
                address
                symbol
                decimals
              }
              loanAsset {
                address
                symbol
                decimals
              }
            }
          }
          loanMarkets: markets(
            first: 1000
            where: { 
              loanAssetAddress_in: [$tokenAddress],
              chainId_in: [1]
            }
          ) {
            pageInfo {
              count
              countTotal
            }
            items {
              uniqueKey
              lltv
              collateralAsset {
                address
                symbol
                decimals
              }
              loanAsset {
                address
                symbol
                decimals
              }
            }
          }
        }
      `;

      const requestKey = generateCacheKey('morpho', 'token-markets-comprehensive', { tokenAddress });
      
      const result = await this.requestQueue.enqueue(requestKey, async () => {
        console.log(`Fetching comprehensive Morpho markets for token: ${tokenAddress}`);
        
        const response = await axios.post(this.apiUrl, {
          query: identifyMarketsQuery,
          variables: {
            tokenAddress: tokenAddress.toLowerCase()
          }
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });

        if (response.data.errors) {
          console.error('Morpho GraphQL errors:', response.data.errors);
          throw new Error(`Morpho API errors: ${JSON.stringify(response.data.errors)}`);
        }

        return response.data.data;
      });

      const collateralMarkets = result.collateralMarkets?.items || [];
      const loanMarkets = result.loanMarkets?.items || [];
      
      console.log(`Identified markets for ${tokenAddress}: ${collateralMarkets.length} collateral, ${loanMarkets.length} loan markets`);

      // Step 2: Get aggregated TVL data for identified markets
      if (collateralMarkets.length === 0 && loanMarkets.length === 0) {
        console.log(`No markets found for ${tokenAddress}`);
        return {
          protocol: 'morpho_unified',
          tokenAddress,
          markets: { loanMarkets: [], collateralMarkets: [] },
          totalTVL: 0,
          totalSupplyTVL: 0,
          totalCollateralTVL: 0,
          marketCount: 0,
          fetched_at: new Date().toISOString()
        };
      }

      // Get detailed TVL data for the identified markets
      const uniqueKeys = [
        ...collateralMarkets.map(m => m.uniqueKey),
        ...loanMarkets.map(m => m.uniqueKey)
      ];
      
      const tvlDataQuery = `
        query GetMarketsTVLData($uniqueKeys: [String!]!) {
          marketsByKeys: markets(
            first: 1000
            where: { 
              uniqueKey_in: $uniqueKeys,
              chainId_in: [1]
            }
          ) {
            items {
              uniqueKey
              collateralAsset {
                address
                symbol
              }
              loanAsset {
                address
                symbol
              }
              state {
                collateralAssets
                collateralAssetsUsd
                borrowAssets
                borrowAssetsUsd
                supplyAssets
                supplyAssetsUsd
                liquidityAssets
                liquidityAssetsUsd
                utilization
              }
            }
          }
        }
      `;

      const tvlResult = await this.requestQueue.enqueue(
        `${requestKey}-tvl`, 
        async () => {
          console.log(`Fetching TVL data for ${uniqueKeys.length} markets`);
          
          const response = await axios.post(this.apiUrl, {
            query: tvlDataQuery,
            variables: {
              uniqueKeys: uniqueKeys
            }
          }, {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });

          if (response.data.errors) {
            console.error('Morpho TVL GraphQL errors:', response.data.errors);
            throw new Error(`Morpho TVL API errors: ${JSON.stringify(response.data.errors)}`);
          }

          return response.data.data;
        }
      );

      const marketsWithTVL = tvlResult.marketsByKeys?.items || [];
      
      // Aggregate TVL data based on how the token is used
      let totalCollateralTVL = 0;
      let totalSupplyTVL = 0;
      
      const collateralMarketKeys = new Set(collateralMarkets.map(m => m.uniqueKey));
      const loanMarketKeys = new Set(loanMarkets.map(m => m.uniqueKey));
      
      marketsWithTVL.forEach(market => {
        const state = market.state;
        
        // If token is used as collateral in this market
        if (collateralMarketKeys.has(market.uniqueKey)) {
          totalCollateralTVL += Number(state.collateralAssetsUsd) || 0;
        }
        
        // If token is used as loan asset in this market
        if (loanMarketKeys.has(market.uniqueKey)) {
          totalSupplyTVL += Number(state.supplyAssetsUsd) || 0;
        }
      });

      console.log(`Comprehensive Morpho data for ${tokenAddress}:`, {
        collateralMarketsFound: collateralMarkets.length,
        loanMarketsFound: loanMarkets.length,
        marketsWithTVLData: marketsWithTVL.length,
        totalCollateralTVL,
        totalSupplyTVL
      });

      return {
        protocol: 'morpho_unified',
        tokenAddress,
        markets: {
          loanMarkets: loanMarkets,
          collateralMarkets: collateralMarkets,
          marketsWithTVL: marketsWithTVL
        },
        // For lending competitor analysis, we care about collateral usage
        totalTVL: totalCollateralTVL,
        totalSupplyTVL,
        totalCollateralTVL,
        marketCount: collateralMarkets.length + loanMarkets.length,
        fetched_at: new Date().toISOString()
      };

    } catch (error) {
      console.error(`Error fetching comprehensive Morpho markets for ${tokenAddress}:`, error.message);
      
      // Return safe default
      return {
        protocol: 'morpho_unified',
        tokenAddress,
        markets: { loanMarkets: [], collateralMarkets: [], marketsWithTVL: [] },
        totalTVL: 0,
        totalSupplyTVL: 0,
        totalCollateralTVL: 0,
        marketCount: 0,
        error: error.message,
        fetched_at: new Date().toISOString()
      };
    }
  }

  /**
   * Get detailed market information for a specific market
   * @param {string} uniqueKey - Morpho market unique key
   * @returns {Promise<Object>} - Detailed market data
   */
  async getMarketDetails(uniqueKey) {
    try {
      const query = `
        query GetMarketDetails($uniqueKey: String!) {
          marketByUniqueKey(uniqueKey: $uniqueKey, chainId: 1) {
            uniqueKey
            loanAsset {
              address
              symbol
              decimals
            }
            collateralAsset {
              address
              symbol
              decimals
            }
            lltv
            state {
              supplyAssets
              supplyAssetsUsd
              borrowAssets
              borrowAssetsUsd
              collateralAssets
              collateralAssetsUsd
              utilization
              supplyApy
              borrowApy
            }
          }
        }
      `;

      const requestKey = generateCacheKey('morpho', 'market-details', { uniqueKey });
      
      const result = await this.requestQueue.enqueue(requestKey, async () => {
        const response = await axios.post(this.apiUrl, {
          query,
          variables: { uniqueKey }
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });

        if (response.data.errors) {
          throw new Error(`Morpho API errors: ${JSON.stringify(response.data.errors)}`);
        }

        return response.data.data.marketByUniqueKey;
      });

      return result;

    } catch (error) {
      console.error(`Error fetching Morpho market details for ${uniqueKey}:`, error.message);
      return null;
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
}
