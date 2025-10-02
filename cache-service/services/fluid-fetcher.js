import axios from 'axios';

export class FluidFetcher {
  constructor() {
    this.baseUrl = 'https://api.fluid.instadapp.io/v2';
    console.log('FluidFetcher initialized');
  }

  /**
   * Fetch data based on queryType and params
   * @param {string} queryType - Type of query (token_borrow, all_vaults)
   * @param {object} params - Parameters including tokenAddress
   * @returns {Promise<object>} - Formatted response data
   */
  async fetchData(queryType, params = {}) {
    try {
      console.log(`Fetching Fluid ${queryType} data`);
      
      let result;
      switch (queryType) {
        case 'token_borrow':
          result = await this.fetchTokenBorrowLiquidity(params.tokenAddress);
          break;
        case 'all_vaults':
          result = await this.fetchAllVaults();
          break;
        default:
          throw new Error(`Unknown query type: ${queryType}`);
      }

      return {
        protocol: 'fluid',
        queryType,
        data: result,
        fetched_at: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error fetching Fluid ${queryType} data:`, error.message);
      throw error;
    }
  }

  /**
   * Get Fluid collateral value for a specific stablecoin token
   * Returns the USD value of the stablecoin when used as collateral (supplyToken) in vaults
   * @param {string} tokenAddress - The stablecoin token contract address  
   * @returns {Promise<number>} - Total USD value of this stablecoin used as collateral
   */
  async fetchTokenBorrowLiquidity(tokenAddress) {
    try {
      const url = `${this.baseUrl}/borrowing/1/vaults`;
      const response = await axios.get(url, { timeout: 8000 });
      
      let totalCollateralUSD = 0;
      
      if (response.data && Array.isArray(response.data)) {
        for (const vault of response.data) {
          // Check if this vault has our stablecoin as the supply token (collateral)
          const supplyToken = vault.supplyToken?.token0;
          
          if (supplyToken && supplyToken.address.toLowerCase() === tokenAddress.toLowerCase()) {
            // Get the USD value of the stablecoin deposited as collateral
            const totalSupplyLiquidity = Number(vault.totalSupplyLiquidity || 0);
            const price = Number(supplyToken.price || 0);
            const decimals = Number(supplyToken.decimals || 18);
            
            if (totalSupplyLiquidity > 0 && price > 0) {
              // Calculate USD value of the stablecoin collateral
              const collateralUSD = (totalSupplyLiquidity / Math.pow(10, decimals)) * price;
              totalCollateralUSD += collateralUSD;
              
              console.log(`Fluid Vault ${vault.id} (${vault.address}): ${supplyToken.symbol} used as collateral = $${collateralUSD.toFixed(2)}`);
            }
          }
        }
      }
      
      console.log(`Total Fluid collateral value for ${tokenAddress}: $${totalCollateralUSD.toFixed(2)}`);
      return totalCollateralUSD;
    } catch (error) {
      console.error(`Error fetching Fluid collateral for ${tokenAddress}:`, error.message);
      return 0;
    }
  }

  /**
   * Fetch all Fluid vaults data (useful for caching and efficiency)
   * @returns {Promise<object>} - All vaults data from Fluid API
   */
  async fetchAllVaults() {
    try {
      const url = `${this.baseUrl}/borrowing/1/vaults`;
      const response = await axios.get(url, { timeout: 8000 });
      
      if (response.data && Array.isArray(response.data)) {
        return response.data;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching all Fluid vaults:', error.message);
      return null;
    }
  }

  /**
   * Get detailed information about a specific vault
   * @param {string} vaultId - The vault ID
   * @returns {Promise<object>} - Vault details
   */
  async fetchVaultDetails(vaultId) {
    try {
      const allVaults = await this.fetchAllVaults();
      
      if (allVaults && Array.isArray(allVaults)) {
        const vault = allVaults.find(v => v.id === vaultId || v.address.toLowerCase() === vaultId.toLowerCase());
        return vault || null;
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching Fluid vault details for ${vaultId}:`, error.message);
      return null;
    }
  }

  /**
   * Get total supply liquidity for a specific token (when used as supply token)
   * @param {string} tokenAddress - The token contract address
   * @returns {Promise<number>} - Total supply liquidity in USD
   */
  async fetchTokenSupplyLiquidity(tokenAddress) {
    try {
      const url = `${this.baseUrl}/borrowing/1/vaults`;
      const response = await axios.get(url, { timeout: 8000 });
      
      let totalSupplyUSD = 0;
      
      if (response.data && Array.isArray(response.data)) {
        for (const vault of response.data) {
          // Check if this vault has our token as the supply token
          const supplyToken = vault.supplyToken?.token0;
          
          if (supplyToken && supplyToken.address.toLowerCase() === tokenAddress.toLowerCase()) {
            // Calculate USD value from totalSupplyLiquidity
            const totalSupplyLiquidity = Number(vault.totalSupplyLiquidity || 0);
            const price = Number(supplyToken.price || 0);
            const decimals = Number(supplyToken.decimals || 18);
            
            if (totalSupplyLiquidity > 0 && price > 0) {
              // Convert from raw units to human-readable and multiply by price
              const supplyUSD = (totalSupplyLiquidity / Math.pow(10, decimals)) * price;
              totalSupplyUSD += supplyUSD;
              
              console.log(`Fluid Vault ${vault.id} (${vault.address}): ${supplyToken.symbol} supply = $${supplyUSD.toFixed(2)}`);
            }
          }
        }
      }
      
      console.log(`Total Fluid supply liquidity for ${tokenAddress}: $${totalSupplyUSD.toFixed(2)}`);
      return totalSupplyUSD;
    } catch (error) {
      console.error(`Error fetching Fluid supply liquidity for ${tokenAddress}:`, error.message);
      return 0;
    }
  }
}

