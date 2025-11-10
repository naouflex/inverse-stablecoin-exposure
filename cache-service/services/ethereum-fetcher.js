import axios from 'axios';
import { RequestQueue, generateCacheKey } from './request-queue.js';

export class EthereumFetcher {
  constructor() {
    this.primaryRpcUrl = process.env.ETH_RPC_URL || 'https://eth.llamarpc.com';
    this.fallbackRpcUrl = process.env.ETH_RPC_URL_FALLBACK || 'https://rpc.ankr.com/eth';
    
    // Initialize request queue with optimized settings for Ethereum RPC
    this.requestQueue = new RequestQueue({
      concurrency: 6, // Ethereum RPC can handle more concurrent requests
      requestsPerSecond: 10, // Higher rate limit for RPC calls
      retryAttempts: 2, // Fail faster for RPC calls
      baseDelay: 500, // Shorter base delay for RPC
      maxDelay: 10000, // Shorter max delay
      circuitThreshold: 5, // More tolerant for RPC calls
      circuitTimeout: 30000 // Shorter timeout for RPC recovery
    });
    
    console.log('EthereumFetcher initialized with request queue');
  }

  async makeRpcCall(method, params = []) {
    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: method,
      params: params
    };

    const options = {
      method: 'post',
      headers: {
        'Content-Type': 'application/json'
      },
      data: payload
    };

    // Try primary RPC first
    try {
      const response = await axios.request({
        ...options,
        url: this.primaryRpcUrl,
        timeout: 8000
      });
      
      if (response.data.error) {
        throw new Error(`Primary RPC error: ${JSON.stringify(response.data.error)}`);
      }
      
      return response.data.result;
    } catch (error) {
      console.warn('Primary RPC failed, trying fallback:', error.message);
      
      // Try fallback RPC
      try {
        const response = await axios.request({
          ...options,
          url: this.fallbackRpcUrl,
          timeout: 8000
        });
        
        if (response.data.error) {
          throw new Error(`Fallback RPC error: ${JSON.stringify(response.data.error)}`);
        }
        
        return response.data.result;
      } catch (fallbackError) {
        console.error('Both RPC endpoints failed:', fallbackError.message);
        throw fallbackError;
      }
    }
  }

  // Public API methods (used by endpoints)
  async getTokenBalanceFormatted(tokenAddress, holderAddress) {
    const requestKey = generateCacheKey('ethereum', 'token-balance', { tokenAddress, holderAddress });
    
    return this.requestQueue.enqueue(requestKey, async () => {
      const balance = await this.getTokenBalance(tokenAddress, holderAddress);
      return {
        tokenAddress,
        holderAddress,
        balance: balance.balance,
        balanceHex: balance.balanceHex,
        fetched_at: new Date().toISOString()
      };
    }).catch(error => {
      console.error(`Error fetching token balance:`, error.message);
      return {
        tokenAddress,
        holderAddress,
        balance: null,
        error: error.message,
        _unavailable: true,
        fetched_at: new Date().toISOString()
      };
    });
  }

  async getTokenDecimalsFormatted(tokenAddress) {
    const requestKey = generateCacheKey('ethereum', 'token-decimals', { tokenAddress });
    
    return this.requestQueue.enqueue(requestKey, async () => {
      const decimals = await this.getTokenDecimals(tokenAddress);
      return {
        tokenAddress,
        decimals,
        fetched_at: new Date().toISOString()
      };
    }).catch(error => {
      return {
        tokenAddress,
        decimals: 18,
        error: error.message,
        fetched_at: new Date().toISOString()
      };
    });
  }

  async getTokenNameFormatted(tokenAddress) {
    const requestKey = generateCacheKey('ethereum', 'token-name', { tokenAddress });
    
    return this.requestQueue.enqueue(requestKey, async () => {
      const name = await this.getTokenName(tokenAddress);
      return {
        tokenAddress,
        name,
        fetched_at: new Date().toISOString()
      };
    }).catch(error => {
      return {
        tokenAddress,
        name: 'Unknown',
        error: error.message,
        fetched_at: new Date().toISOString()
      };
    });
  }

  async getTokenSymbolFormatted(tokenAddress) {
    const requestKey = generateCacheKey('ethereum', 'token-symbol', { tokenAddress });
    
    return this.requestQueue.enqueue(requestKey, async () => {
      const symbol = await this.getTokenSymbol(tokenAddress);
      return {
        tokenAddress,
        symbol,
        fetched_at: new Date().toISOString()
      };
    }).catch(error => {
      return {
        tokenAddress,
        symbol: 'UNKNOWN',
        error: error.message,
        fetched_at: new Date().toISOString()
      };
    });
  }

  async getTotalSupplyFormatted(tokenAddress) {
    const requestKey = generateCacheKey('ethereum', 'total-supply', { tokenAddress });
    
    return this.requestQueue.enqueue(requestKey, async () => {
      const totalSupply = await this.getTokenTotalSupply(tokenAddress);
      return {
        tokenAddress,
        totalSupply,
        fetched_at: new Date().toISOString()
      };
    }).catch(error => {
      return {
        tokenAddress,
        totalSupply: null,
        error: error.message,
        _unavailable: true,
        fetched_at: new Date().toISOString()
      };
    });
  }

  async fetchData(method, params = {}) {
    const requestKey = generateCacheKey('ethereum', method, params);
    
    return this.requestQueue.enqueue(requestKey, async () => {
      console.log(`Fetching Ethereum ${method} data`);
      
      switch (method) {
        case 'currentBlock':
          return await this.getCurrentBlock();
        
        case 'gasPrice':
          return await this.getGasPrice();
        
        case 'tokenBalance':
          return await this.getTokenBalance(params.tokenAddress, params.walletAddress);
        
        case 'tokenInfo':
          return await this.getTokenInfo(params.tokenAddress);
        
        case 'ethBalance':
          return await this.getEthBalance(params.address);
        
        default:
          throw new Error(`Unknown method: ${method}`);
      }
    }).catch(error => {
      console.error(`Error fetching Ethereum ${method} data:`, error.message);
      return {
        method,
        data: null,
        error: error.message,
        _unavailable: true,
        fetched_at: new Date().toISOString()
      };
    });
  }

  async getCurrentBlock() {
    const blockNumber = await this.makeRpcCall('eth_blockNumber');
    const blockNumberDecimal = parseInt(blockNumber, 16);
    
    return {
      method: 'currentBlock',
      blockNumber: blockNumberDecimal,
      blockNumberHex: blockNumber,
      fetched_at: new Date().toISOString()
    };
  }

  async getGasPrice() {
    const gasPrice = await this.makeRpcCall('eth_gasPrice');
    const gasPriceDecimal = parseInt(gasPrice, 16);
    const gasPriceGwei = gasPriceDecimal / 1e9;
    
    return {
      method: 'gasPrice',
      gasPrice: gasPriceDecimal,
      gasPriceGwei: gasPriceGwei,
      gasPriceHex: gasPrice,
      fetched_at: new Date().toISOString()
    };
  }

  async getEthBalance(address) {
    const balance = await this.makeRpcCall('eth_getBalance', [address, 'latest']);
    const balanceDecimal = parseInt(balance, 16);
    const balanceEth = balanceDecimal / 1e18;
    
    return {
      method: 'ethBalance',
      address: address,
      balance: balanceDecimal,
      balanceEth: balanceEth,
      balanceHex: balance,
      fetched_at: new Date().toISOString()
    };
  }

  async getTokenBalance(tokenAddress, walletAddress) {
    // ERC-20 balanceOf function signature: 0x70a08231
    const methodId = '0x70a08231';
    const paddedAddress = walletAddress.slice(2).padStart(64, '0');
    const data = methodId + paddedAddress;
    
    const result = await this.makeRpcCall('eth_call', [
      {
        to: tokenAddress,
        data: data
      },
      'latest'
    ]);
    
    const balance = parseInt(result, 16);
    
    return {
      method: 'tokenBalance',
      tokenAddress: tokenAddress,
      walletAddress: walletAddress,
      balance: balance,
      balanceHex: result,
      fetched_at: new Date().toISOString()
    };
  }

  async getTokenInfo(tokenAddress) {
    try {
      // Get token name, symbol, decimals, and total supply
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        this.getTokenName(tokenAddress),
        this.getTokenSymbol(tokenAddress),
        this.getTokenDecimals(tokenAddress),
        this.getTokenTotalSupply(tokenAddress)
      ]);

      return {
        method: 'tokenInfo',
        tokenAddress: tokenAddress,
        name: name,
        symbol: symbol,
        decimals: decimals,
        totalSupply: totalSupply,
        fetched_at: new Date().toISOString()
      };
    } catch (error) {
      return {
        method: 'tokenInfo',
        tokenAddress: tokenAddress,
        error: error.message,
        _unavailable: true,
        fetched_at: new Date().toISOString()
      };
    }
  }

  async getTokenName(tokenAddress) {
    // ERC-20 name() function signature: 0x06fdde03
    const data = '0x06fdde03';
    
    try {
      const result = await this.makeRpcCall('eth_call', [
        {
          to: tokenAddress,
          data: data
        },
        'latest'
      ]);
      
      return this.decodeString(result);
    } catch (error) {
      return 'Unknown';
    }
  }

  async getTokenSymbol(tokenAddress) {
    // ERC-20 symbol() function signature: 0x95d89b41
    const data = '0x95d89b41';
    
    try {
      const result = await this.makeRpcCall('eth_call', [
        {
          to: tokenAddress,
          data: data
        },
        'latest'
      ]);
      
      return this.decodeString(result);
    } catch (error) {
      return 'UNKNOWN';
    }
  }

  async getTokenDecimals(tokenAddress) {
    // ERC-20 decimals() function signature: 0x313ce567
    const data = '0x313ce567';
    
    try {
      const result = await this.makeRpcCall('eth_call', [
        {
          to: tokenAddress,
          data: data
        },
        'latest'
      ]);
      
      return parseInt(result, 16);
    } catch (error) {
      return 18; // Default decimals
    }
  }

  async getTokenTotalSupply(tokenAddress) {
    // ERC-20 totalSupply() function signature: 0x18160ddd
    const data = '0x18160ddd';
    
    try {
      const result = await this.makeRpcCall('eth_call', [
        {
          to: tokenAddress,
          data: data
        },
        'latest'
      ]);
      
      return parseInt(result, 16);
    } catch (error) {
      // Throw error instead of returning 0
      throw error;
    }
  }

  async getAllowance(tokenAddress, ownerAddress, spenderAddress) {
    // ERC-20 allowance(address,address) function signature: 0xdd62ed3e
    // First parameter (owner) - pad to 32 bytes
    const paddedOwner = ownerAddress.slice(2).padStart(64, '0');
    // Second parameter (spender) - pad to 32 bytes  
    const paddedSpender = spenderAddress.slice(2).padStart(64, '0');
    
    const data = '0xdd62ed3e' + paddedOwner + paddedSpender;
    
    try {
      const result = await this.makeRpcCall('eth_call', [
        {
          to: tokenAddress,
          data: data
        },
        'latest'
      ]);
      
      return parseInt(result, 16);
    } catch (error) {
      // Throw error instead of returning 0
      throw error;
    }
  }

  async getAllowanceFormatted(tokenAddress, ownerAddress, spenderAddress) {
    const requestKey = generateCacheKey('ethereum', 'allowance', { tokenAddress, ownerAddress, spenderAddress });
    
    return this.requestQueue.enqueue(requestKey, async () => {
      const [allowance, decimals] = await Promise.all([
        this.getAllowance(tokenAddress, ownerAddress, spenderAddress),
        this.getTokenDecimals(tokenAddress)
      ]);
      
      // Format allowance amount
      const allowanceFormatted = decimals > 0 ? (allowance / Math.pow(10, decimals)).toFixed(6) : allowance.toString();
      
      return {
        allowance: allowance.toString(),
        allowanceFormatted,
        decimals,
        tokenAddress,
        ownerAddress,
        spenderAddress,
        fetched_at: new Date().toISOString()
      };
    }).catch(error => {
      return {
        tokenAddress,
        ownerAddress,
        spenderAddress,
        allowance: null,
        error: error.message,
        _unavailable: true,
        fetched_at: new Date().toISOString()
      };
    });
  }

  decodeString(hexData) {
    if (!hexData || hexData === '0x') return '';
    
    // Remove 0x prefix
    const hex = hexData.slice(2);
    
    // Skip first 64 chars (offset) and next 64 chars (length), then get the string
    const offset = parseInt(hex.slice(0, 64), 16) * 2;
    const length = parseInt(hex.slice(offset, offset + 64), 16) * 2;
    const stringHex = hex.slice(offset + 64, offset + 64 + length);
    
    // Convert hex to string
    let result = '';
    for (let i = 0; i < stringHex.length; i += 2) {
      const charCode = parseInt(stringHex.slice(i, i + 2), 16);
      if (charCode !== 0) {
        result += String.fromCharCode(charCode);
      }
    }
    
    return result;
  }

  /**
   * Get eVault address from dToken contract (Euler V2)
   * @param {string} dTokenAddress - dToken contract address
   * @returns {Promise<string>} - eVault address
   */
  async getEVaultFromDToken(dTokenAddress) {
    // Euler dToken contracts have an eVault() function that returns the eVault address
    // Function signature for eVault(): 0x985426ec
    const data = '0x985426ec';
    
    try {
      const result = await this.makeRpcCall('eth_call', [
        {
          to: dTokenAddress,
          data: data
        },
        'latest'
      ]);
      
      // Result is a 32-byte hex string, extract the address (last 20 bytes)
      const eVaultAddress = '0x' + result.slice(-40);
      return eVaultAddress;
    } catch (error) {
      console.error(`Error getting eVault address from dToken ${dTokenAddress}:`, error.message);
      throw error;
    }
  }

  /**
   * Get total assets from eVault contract (Euler V2)
   * @param {string} eVaultAddress - eVault contract address
   * @returns {Promise<string>} - Total assets in wei
   */
  async getTotalAssetsFromEVault(eVaultAddress) {
    // Euler eVault contracts have a totalAssets() function that returns the total assets
    // Function signature for totalAssets(): 0x01e1d114
    const data = '0x01e1d114';
    
    try {
      const result = await this.makeRpcCall('eth_call', [
        {
          to: eVaultAddress,
          data: data
        },
        'latest'
      ]);
      
      return result; // Returns total assets in wei
    } catch (error) {
      console.error(`Error getting total assets from eVault ${eVaultAddress}:`, error.message);
      throw error;
    }
  }

  /**
   * Get total borrows from eVault contract (Euler V2)
   * @param {string} eVaultAddress - eVault contract address
   * @returns {Promise<string>} - Total borrows in wei
   */
  async getTotalBorrowsFromEVault(eVaultAddress) {
    // Euler eVault contracts have a totalBorrows() function
    // Function signature for totalBorrows(): 0x47bd3718
    const data = '0x47bd3718';
    
    try {
      const result = await this.makeRpcCall('eth_call', [
        {
          to: eVaultAddress,
          data: data
        },
        'latest'
      ]);
      
      return result; // Returns total borrows in wei
    } catch (error) {
      console.error(`Error getting total borrows from eVault ${eVaultAddress}:`, error.message);
      throw error;
    }
  }

  /**
   * Get complete Euler vault data using on-chain calls
   * @param {string} dTokenAddress - dToken contract address
   * @returns {Promise<object>} - Vault data with cash and borrows
   */
  async getEulerVaultData(dTokenAddress) {
    try {
      // Step 1: Get eVault address from dToken
      const eVaultAddress = await this.getEVaultFromDToken(dTokenAddress);
      
      // Step 2: Get total assets and borrows from eVault
      const [totalAssetsHex, borrowsHex] = await Promise.all([
        this.getTotalAssetsFromEVault(eVaultAddress),
        this.getTotalBorrowsFromEVault(eVaultAddress)
      ]);
      
      // Step 3: Convert to decimal values
      const totalAssets = parseInt(totalAssetsHex, 16);
      const totalBorrows = parseInt(borrowsHex, 16);
      
      // Step 4: Convert to USD (assuming 18 decimals for stablecoins)
      const decimals = 18;
      const totalAssetsUSD = totalAssets / Math.pow(10, decimals);
      const borrowsUSD = totalBorrows / Math.pow(10, decimals);
      // For lending protocols, TVL is typically the total assets (deposits)
      const tvlUSD = totalAssetsUSD;
      
      return {
        dTokenAddress,
        eVaultAddress,
        totalAssets: totalAssets.toString(),
        totalBorrows: totalBorrows.toString(),
        totalAssetsUSD,
        borrowsUSD,
        tvlUSD,
        hasActivity: tvlUSD > 0,
        fetched_at: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error getting Euler vault data for dToken ${dTokenAddress}:`, error.message);
      return {
        dTokenAddress,
        eVaultAddress: null,
        totalAssets: '0',
        totalBorrows: '0',
        totalAssetsUSD: 0,
        borrowsUSD: 0,
        tvlUSD: 0,
        hasActivity: false,
        error: error.message,
        fetched_at: new Date().toISOString()
      };
    }
  }

  /**
   * Get exchange rate from Curve pool using get_dy function
   * @param {string} poolAddress - Curve pool address
   * @param {number} i - Index of input token
   * @param {number} j - Index of output token  
   * @param {string} dx - Amount of input token (in wei/smallest unit)
   * @returns {Promise<object>} - Exchange rate information
   */
 

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
      const isHealthy = status.circuitState === 'CLOSED' && status.failureCount < 5;
      
      return {
        healthy: isHealthy,
        status: status,
        primaryRpc: this.primaryRpcUrl,
        fallbackRpc: this.fallbackRpcUrl,
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