import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cron from 'node-cron';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from the parent directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

import { createLogger, format, transports } from 'winston';

// Import data fetchers
import { CoinGeckoFetcher } from './services/coingecko-fetcher.js';
import { DefiLlamaFetcher } from './services/defillama-fetcher.js';
import { TheGraphFetcher } from './services/thegraph-fetcher.js';
import { EthereumFetcher } from './services/ethereum-fetcher.js';
import { CurveFetcher } from './services/curve-fetcher.js';
import { FluidFetcher } from './services/fluid-fetcher.js';
import { StablecoinFetcher } from './services/stablecoin-fetcher.js';
import { MorphoFetcher } from './services/morpho-fetcher.js';
import { PendleFetcher } from './services/pendle-fetcher.js';
import { DataValidator } from './services/data-validator.js';
// Using unified MorphoFetcher for all Morpho markets

// Initialize logger
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.File({ filename: './data/error.log', level: 'error' }),
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());

// Add request monitoring middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  logger.info(`Incoming request: ${req.method} ${req.url}`, {
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Monitor response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    
    logger[logLevel](`Request completed: ${req.method} ${req.url}`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || 0
    });
    
    // Log slow requests
    if (duration > 5000) {
      logger.warn(`Slow request detected: ${req.method} ${req.url} took ${duration}ms`);
    }
  });

  next();
});

// Add request timeout middleware to prevent 504 errors
app.use((req, res, next) => {
  // Set timeout to 25 seconds (less than typical gateway timeout of 30s)
  req.setTimeout(25000, () => {
    logger.warn(`Request timeout for ${req.method} ${req.url}`);
    if (!res.headersSent) {
      res.status(408).json({ 
        error: 'Request timeout',
        message: 'The request took too long to process. Please try again.'
      });
    }
  });
  
  res.setTimeout(25000, () => {
    logger.warn(`Response timeout for ${req.method} ${req.url}`);
    if (!res.headersSent) {
      res.status(408).json({ 
        error: 'Response timeout',
        message: 'The response took too long to send. Please try again.'
      });
    }
  });
  
  next();
});

app.use(express.json());

// Initialize Redis connection
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
logger.info(`Attempting to connect to Redis at: ${redisUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

const redis = createClient({
  url: redisUrl
});

redis.on('error', (err) => logger.error('Redis Client Error', err));
redis.on('connect', () => logger.info('Connected to Redis'));
redis.on('ready', () => logger.info('Redis client ready'));

// Using Redis as the primary cache - no SQLite needed for this demo

// Initialize data fetchers
const coinGeckoFetcher = new CoinGeckoFetcher();
const defiLlamaFetcher = new DefiLlamaFetcher();
const theGraphFetcher = new TheGraphFetcher();
const ethereumFetcher = new EthereumFetcher();
const curveFetcher = new CurveFetcher();
const fluidFetcher = new FluidFetcher();
const morphoFetcher = new MorphoFetcher();
const pendleFetcher = new PendleFetcher();
// Will use theGraphFetcher for lending protocols
let stablecoinFetcher; // Will be initialized after Redis connection

// Cache utilities - Redis only for simplicity
class CacheManager {
  constructor(redisClient) {
    this.redis = redisClient;
    this.validator = new DataValidator();
  }

  async get(key) {
    try {
      const redisData = await this.redis.get(key);
      if (redisData) {
        logger.info(`Cache hit: ${key}`);
        return JSON.parse(redisData);
      } else {
        logger.info(`Cache miss: ${key}`);
        return null;
      }
    } catch (error) {
      logger.error(`Cache get error for ${key}:`, error);
      return null;
    }
  }

  async set(key, data, ttlSeconds = 3600) {
    const serialized = JSON.stringify(data);

    try {
      await this.redis.setEx(key, ttlSeconds, serialized);
      
      // Also store as stale data with longer TTL for fallback
      const staleKey = `${key}:stale`;
      const staleData = { ...data, _cached_at: new Date().toISOString() };
      await this.redis.setEx(staleKey, ttlSeconds * 4, JSON.stringify(staleData)); // 4x longer TTL
      
      logger.info(`Cache set: ${key} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      logger.error(`Cache set error for ${key}:`, error);
    }
  }

  /**
   * Smart caching with validation and different TTLs based on data type
   */
  async setWithSmartTTL(key, data, dataType = 'default') {
    const ttlConfig = {
      'protocol-info': 86400, // 24 hours - protocol info changes infrequently
      'token-price': 300, // 5 minutes - prices change frequently
      'protocol-tvl': 1800, // 30 minutes - TVL changes moderately
      'all-protocols': 43200, // 12 hours - protocol list changes infrequently
      'market-data': 1800, // 30 minutes - market data changes moderately
      'volume-data': 3600, // 1 hour - volume data changes hourly
      'default': 3600 // 1 hour default
    };

    const ttl = ttlConfig[dataType] || ttlConfig.default;
    
    // ENHANCED: Validate data before caching
    const previousData = await this.get(key);
    const validation = this.validator.validate(data, previousData, dataType);
    
    if (!validation.isValid) {
      logger.warn(`Data validation failed for ${key}: ${validation.reason}`);
      
      // If validation suggests using stale data, try that
      if (validation.useStale) {
        const staleKey = `${key}:stale`;
        const staleData = await this.get(staleKey);
        
        if (staleData) {
          logger.info(`Using stale data for ${key} due to validation failure`);
          // Extend the TTL on the stale data since we're relying on it
          await this.redis.expire(staleKey, ttl * 2);
          
          // Try to merge good stale values with new data
          const mergedData = this.validator.mergeWithStaleData(data, staleData);
          logger.info(`Merged new data with stale data for ${key}`);
          await this.set(key, mergedData, ttl);
          return; // Don't cache the invalid data alone
        } else {
          logger.warn(`No stale data available for ${key}, data validation failed but caching anyway`);
        }
      }
    }
    
    await this.set(key, data, ttl);
    logger.info(`Smart cache set: ${key} (type: ${dataType}, TTL: ${ttl}s, valid: ${validation.isValid})`);
  }

  async cleanup() {
    // Redis handles expiration automatically
    logger.info(`Cache cleanup not needed - Redis handles TTL automatically`);
    return 0;
  }
}

let cacheManager;
let lastRefreshTimestamp = null;

// Simple Circuit Breaker to prevent cascade failures
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.threshold = threshold; // Number of failures before opening circuit
    this.timeout = timeout; // Time to wait before trying again
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.timeout) {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      } else {
        this.state = 'HALF_OPEN';
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      logger.warn(`Circuit breaker opened after ${this.failureCount} failures`);
    }
  }
}

// Create circuit breakers for external services
const coinGeckoCircuitBreaker = new CircuitBreaker(3, 15000); // Reduced timeout to prevent 504 errors
const defiLlamaCircuitBreaker = new CircuitBreaker(3, 15000); // Reduced timeout to prevent 504 errors
const theGraphCircuitBreaker = new CircuitBreaker(3, 15000); // Reduced timeout for GraphQL queries
const ethereumCircuitBreaker = new CircuitBreaker(3, 15000); // Reduced timeout for RPC calls

// Universal helper to safely fetch data with circuit breaker and stale fallback
async function safeExternalFetch(cacheKey, fetchFunction, circuitBreaker = theGraphCircuitBreaker, timeoutMs = 8000, dataType = 'default') {
  let data = await cacheManager.get(cacheKey);
  if (data) return data;

  try {
    data = await circuitBreaker.call(async () => {
      const fetchPromise = fetchFunction();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('External API timeout')), timeoutMs)
      );
      return Promise.race([fetchPromise, timeoutPromise]);
    });
    await cacheManager.setWithSmartTTL(cacheKey, data, dataType);
    return data;
  } catch (fetchError) {
    // Log timeout-related errors for monitoring
    if (fetchError.message.includes('timeout') || fetchError.code === 'ECONNABORTED') {
      logger.warn(`Timeout detected for ${cacheKey}: ${fetchError.message}`);
    }
    // Return stale data or default
    const staleKey = `${cacheKey}:stale`;
    const staleData = await cacheManager.get(staleKey);
    if (staleData) {
      logger.info(`Returning stale data for ${cacheKey}`);
      return { ...staleData, _stale: true };
    }
    // No stale data, return safe default
    return { data: 0, _unavailable: true, _error: fetchError.message };
  }
}

// API Routes
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      redis: 'unknown',
      coinGecko: coinGeckoCircuitBreaker.state,
      defiLlama: defiLlamaCircuitBreaker.state,
      theGraph: theGraphCircuitBreaker.state,
      ethereum: ethereumCircuitBreaker.state
    },
    coinGeckoQueue: coinGeckoFetcher.getQueueStatus(),
    defiLlamaQueue: defiLlamaFetcher.getQueueStatus(),
    theGraphQueue: theGraphFetcher.getQueueStatus(),
    curveQueue: curveFetcher.getQueueStatus(),
    ethereumQueue: ethereumFetcher.getQueueStatus(),
    fluidQueue: fluidFetcher.getQueueStatus(),
    morphoQueue: morphoFetcher.getQueueStatus(),
    pendleQueue: pendleFetcher.getQueueStatus(),
    stablecoinQueue: stablecoinFetcher ? stablecoinFetcher.getQueueStatus() : null
  };

  try {
    // Check Redis connection
    await redis.ping();
    health.services.redis = 'healthy';
  } catch (error) {
    health.services.redis = 'unhealthy';
    health.status = 'degraded';
    logger.error('Redis health check failed:', error);
  }

  // Check if any circuit breakers are open
  const openCircuits = Object.values(health.services).filter(status => status === 'OPEN').length;
  if (openCircuits > 0) {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Admin endpoint to get Redis info
app.get('/api/admin/redis-info', async (req, res) => {
  try {
    const info = await redis.info();
    const dbSize = await redis.dbSize();
    res.json({
      success: true,
      redis_url: redisUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), // Hide credentials
      db_size: dbSize,
      info: info,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting Redis info:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get Redis info',
      message: error.message 
    });
  }
});

// Admin endpoint to flush Redis cache
app.post('/api/admin/flush-cache', async (req, res) => {
  try {
    await redis.flushAll();
    logger.info('Redis cache flushed successfully');
    res.json({ 
      success: true, 
      message: 'Redis cache flushed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error flushing Redis cache:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to flush cache',
      message: error.message 
    });
  }
});

// Admin endpoint to flush cache via GET (easier to use in browser)
app.get('/api/admin/flush-cache', async (req, res) => {
  try {
    await redis.flushAll();
    logger.info('Redis cache flushed successfully via GET');
    res.json({ 
      success: true, 
      message: 'Redis cache flushed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error flushing Redis cache:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to flush cache',
      message: error.message 
    });
  }
});

// Enhanced cache cleaning endpoint with granular control
app.post('/api/admin/clean-cache', async (req, res) => {
  try {
    const { pattern, type, confirm } = req.body;
    
    // Safety check - require confirmation for destructive operations
    if (!confirm) {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required',
        message: 'Set "confirm": true in request body to proceed with cache cleaning'
      });
    }
    
    let deletedCount = 0;
    let keysToDelete = [];
    
    if (type === 'all') {
      // Flush all cache
      await redis.flushAll();
      logger.info('All Redis cache flushed via clean-cache endpoint');
      
      res.json({
        success: true,
        message: 'All cache cleared successfully',
        action: 'flush_all',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    if (pattern) {
      // Delete keys matching pattern
      keysToDelete = await redis.keys(pattern);
      
      if (keysToDelete.length > 0) {
        deletedCount = await redis.del(...keysToDelete);
        logger.info(`Deleted ${deletedCount} cache keys matching pattern: ${pattern}`);
      }
      
      res.json({
        success: true,
        message: `Cache cleaning completed`,
        action: 'pattern_delete',
        pattern: pattern,
        keysFound: keysToDelete.length,
        keysDeleted: deletedCount,
        deletedKeys: keysToDelete.slice(0, 10), // Show first 10 keys for reference
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    if (type) {
      // Predefined cache type cleaning
      const typePatterns = {
        'coingecko': 'coingecko:*',
        'defillama': 'defillama:*',
        'uniswap': 'uniswap:*',
        'curve': 'curve:*',
        'balancer': 'balancer:*',
        'sushiswap': 'sushiswap:*',
        'fraxswap': 'fraxswap:*',
        'fluid': 'fluid:*',
        'ethereum': 'ethereum:*',
        'aave': 'aave:*',
        'morpho': 'morpho:*',
        'euler': 'euler:*',
        'pendle': 'pendle:*',
        'lending': '*lending*',
        'stale': '*:stale',
        'manual': 'manual:*',
        'graph': 'graph:*'
      };
      
      const cleanPattern = typePatterns[type.toLowerCase()];
      if (!cleanPattern) {
        return res.status(400).json({
          success: false,
          error: 'Invalid cache type',
          availableTypes: Object.keys(typePatterns),
          message: 'Use one of the available types or provide a custom pattern'
        });
      }
      
      keysToDelete = await redis.keys(cleanPattern);
      
      if (keysToDelete.length > 0) {
        deletedCount = await redis.del(...keysToDelete);
        logger.info(`Deleted ${deletedCount} ${type} cache keys`);
      }
      
      res.json({
        success: true,
        message: `${type} cache cleared successfully`,
        action: 'type_delete',
        type: type,
        pattern: cleanPattern,
        keysFound: keysToDelete.length,
        keysDeleted: deletedCount,
        deletedKeys: keysToDelete.slice(0, 10), // Show first 10 keys for reference
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // No valid cleaning option provided
    res.status(400).json({
      success: false,
      error: 'Invalid request',
      message: 'Provide either "type" (all, coingecko, defillama, etc.) or "pattern" for cache cleaning',
      examples: {
        flushAll: { type: 'all', confirm: true },
        cleanCoinGecko: { type: 'coingecko', confirm: true },
        cleanPattern: { pattern: 'coingecko:market-data:*', confirm: true }
      }
    });
    
  } catch (error) {
    logger.error('Error cleaning cache:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clean cache',
      message: error.message 
    });
  }
});

// Cache statistics endpoint
app.get('/api/admin/cache-stats', async (req, res) => {
  try {
    const info = await redis.info('memory');
    const dbSize = await redis.dbSize();
    
    // Get sample of cache keys by type
    const keyTypes = {};
    const sampleKeys = await redis.keys('*');
    
    // Analyze key patterns
    for (const key of sampleKeys.slice(0, 1000)) { // Limit to first 1000 keys for performance
      const prefix = key.split(':')[0];
      keyTypes[prefix] = (keyTypes[prefix] || 0) + 1;
    }
    
    res.json({
      success: true,
      stats: {
        totalKeys: dbSize,
        memoryInfo: info,
        keysByType: keyTypes,
        sampleSize: Math.min(sampleKeys.length, 1000),
        totalKeysScanned: sampleKeys.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get cache statistics',
      message: error.message 
    });
  }
});

// Cache metadata endpoint - provides last refresh time
app.get('/api/cache/last-refresh', async (req, res) => {
  try {
    res.json({
      success: true,
      lastRefresh: lastRefreshTimestamp,
      nextRefresh: lastRefreshTimestamp ? 
        new Date(new Date(lastRefreshTimestamp).getTime() + 60 * 60 * 1000).toISOString() : 
        null,
      refreshInterval: '1 hour',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting cache metadata:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get cache metadata',
      message: error.message 
    });
  }
});

// ================= COINGECKO ENDPOINTS =================
// Mirror src/services/coingecko.js functions

// fetchCoinGeckoMarketData -> /api/coingecko/market-data/:coinId
app.get('/api/coingecko/market-data/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    const cacheKey = `coingecko:market-data:${coinId}`;
    
    logger.info(`API Request: GET /api/coingecko/market-data/${coinId}`);
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      logger.info(`Cache miss for ${coinId}, fetching fresh data...`);
      
      // Use circuit breaker pattern for external API calls
      try {
        data = await coinGeckoCircuitBreaker.call(async () => {
          const fetchPromise = coinGeckoFetcher.fetchCoinData(coinId);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('External API timeout')), 8000)
          );
          return Promise.race([fetchPromise, timeoutPromise]);
        });
        
        // Use shorter TTL for OPEN Index to ensure frequent updates
        const dataType = coinId === 'open-stablecoin-index' ? 'market-data' : 'default';
        await cacheManager.setWithSmartTTL(cacheKey, data, dataType);
        
        logger.info(`Fresh data fetched for ${coinId}:`, { price: data?.current_price, market_cap: data?.market_cap });
      } catch (fetchError) {
        logger.error(`Failed to fetch fresh data for ${coinId}:`, fetchError.message);
        
        // Try to return stale cache data if available
        const staleKey = `${cacheKey}:stale`;
        const staleData = await cacheManager.get(staleKey);
        
        if (staleData) {
          logger.info(`Returning stale data for ${coinId} due to fetch failure`);
          res.json({ ...staleData, _stale: true, _cached_at: staleData._cached_at });
          return;
        }
        
        // No stale data available, return error
        res.status(503).json({ 
          error: 'Service temporarily unavailable',
          message: 'Unable to fetch fresh data and no cached data available. Please try again in a few moments.',
          retry_after: coinGeckoCircuitBreaker.state === 'OPEN' ? 30 : 10
        });
        return;
      }
    } else {
      logger.info(`Cache hit for ${coinId}:`, { price: data?.current_price, market_cap: data?.market_cap });
    }
    
    res.json(data);
  } catch (error) {
    logger.error('CoinGecko market data error:', error);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// Legacy endpoint for direct coin data access
app.get('/api/coingecko/coin/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    const cacheKey = `coingecko:coin:${coinId}`;
    
    const data = await safeExternalFetch(
      cacheKey,
      () => coinGeckoFetcher.fetchCoinData(coinId),
      coinGeckoCircuitBreaker,
      10000
    );
    
    res.json(data);
  } catch (error) {
    logger.error('CoinGecko API error:', error);
    res.status(500).json({ error: 'Failed to fetch coin data' });
  }
});

// fetchCoinGecko30dVolume -> /api/coingecko/30d-volume/:coinId
app.get('/api/coingecko/30d-volume/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    const cacheKey = `coingecko:30d-volume:${coinId}`;
    
    const data = await safeExternalFetch(
      cacheKey,
      () => coinGeckoFetcher.fetch30dVolume(coinId),
      coinGeckoCircuitBreaker
    );
    
    res.json(data);
  } catch (error) {
    logger.error('CoinGecko 30d volume error:', error);
    res.status(500).json({ error: 'Failed to fetch volume data' });
  }
});

// fetchCoinGecko24hVolume -> /api/coingecko/24h-volume/:coinId
app.get('/api/coingecko/24h-volume/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    const cacheKey = `coingecko:24h-volume:${coinId}`;
    
    const data = await safeExternalFetch(
      cacheKey,
      () => coinGeckoFetcher.fetch24hVolume(coinId),
      coinGeckoCircuitBreaker
    );
    
    res.json(data);
  } catch (error) {
    logger.error('CoinGecko 24h volume error:', error);
    res.status(500).json({ error: 'Failed to fetch volume data' });
  }
});

// Add separate market cap endpoint -> /api/coingecko/market-cap/:coinId  
app.get('/api/coingecko/market-cap/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    const cacheKey = `coingecko:market-cap:${coinId}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await coinGeckoFetcher.fetchMarketCap(coinId);
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('CoinGecko market cap error:', error);
    res.status(500).json({ error: 'Failed to fetch market cap data' });
  }
});

// Add separate FDV endpoint -> /api/coingecko/fdv/:coinId
app.get('/api/coingecko/fdv/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    const cacheKey = `coingecko:fdv:${coinId}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await coinGeckoFetcher.fetchFDV(coinId);
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('CoinGecko FDV error:', error);
    res.status(500).json({ error: 'Failed to fetch FDV data' });
  }
});

// fetchTopExchanges24h -> /api/coingecko/top-exchanges/:coinId
app.get('/api/coingecko/top-exchanges/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    const cacheKey = `coingecko:top-exchanges:${coinId}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await coinGeckoFetcher.fetchTopExchanges(coinId);
      await cacheManager.set(cacheKey, data, 1800); // 30 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('CoinGecko top exchanges error:', error);
    res.status(500).json({ error: 'Failed to fetch top exchanges data' });
  }
});

// fetchAllMetricsRaw -> /api/coingecko/all-metrics/:coinId
app.get('/api/coingecko/all-metrics/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    const cacheKey = `coingecko:all-metrics:${coinId}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await coinGeckoFetcher.fetchAllMetrics(coinId);
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('CoinGecko all metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch all metrics data' });
  }
});

// Market chart and tickers (existing endpoints)
app.get('/api/coingecko/coins/:coinId/market_chart/range', async (req, res) => {
  try {
    const { coinId } = req.params;
    const cacheKey = `coingecko:chart:${coinId}:${JSON.stringify(req.query)}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await coinGeckoFetcher.fetchMarketChart(coinId, req.query);
      await cacheManager.set(cacheKey, data, 1800); // 30 minutes for chart data
    }
    
    res.json(data);
  } catch (error) {
    logger.error('CoinGecko market chart error:', error);
    res.status(500).json({ error: 'Failed to fetch market chart data' });
  }
});

app.get('/api/coingecko/coins/:coinId/tickers', async (req, res) => {
  try {
    const { coinId } = req.params;
    const cacheKey = `coingecko:tickers:${coinId}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await coinGeckoFetcher.fetchTickers(coinId, req.query);
      await cacheManager.set(cacheKey, data, 1800); // 30 minutes for tickers
    }
    
    res.json(data);
  } catch (error) {
    logger.error('CoinGecko tickers error:', error);
    res.status(500).json({ error: 'Failed to fetch tickers data' });
  }
});

// ================= DEFILLAMA ENDPOINTS =================
// Mirror src/services/defillama.js functions

// fetchDefiLlamaTVLDirect -> /api/defillama/tvl/:protocolSlug
app.get('/api/defillama/tvl/:protocolSlug', async (req, res) => {
  try {
    const { protocolSlug } = req.params;
    const cacheKey = `defillama:tvl:${protocolSlug}`;
    
    const data = await safeExternalFetch(
      cacheKey,
      () => defiLlamaFetcher.fetchProtocolTVL(protocolSlug),
      defiLlamaCircuitBreaker,
      12000, // Longer timeout for DefiLlama
      'protocol-tvl' // Smart caching type
    );
    
    res.json(data);
  } catch (error) {
    logger.error('DeFiLlama TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch TVL data' });
  }
});

// Legacy endpoint
app.get('/api/defillama/protocol/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const cacheKey = `defillama:protocol:${slug}`;
    
    const data = await safeExternalFetch(
      cacheKey,
      () => defiLlamaFetcher.fetchProtocolTVL(slug),
      defiLlamaCircuitBreaker,
      12000,
      'protocol-tvl'
    );
    
    res.json(data);
  } catch (error) {
    logger.error('DeFiLlama API error:', error);
    res.status(500).json({ error: 'Failed to fetch protocol data' });
  }
});

// getTokenPrice -> /api/defillama/token-price/:tokenAddress
app.get('/api/defillama/token-price/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const chain = req.query.chain || 'ethereum';
    const cacheKey = `defillama:token-price:${chain}:${tokenAddress}`;
    
    const data = await safeExternalFetch(
      cacheKey,
      () => defiLlamaFetcher.fetchTokenPrice(tokenAddress, chain),
      defiLlamaCircuitBreaker,
      10000,
      'token-price'
    );
    
    res.json(data);
  } catch (error) {
    logger.error('DeFiLlama token price error:', error);
    res.status(500).json({ error: 'Failed to fetch token price' });
  }
});

// NEW: Batch token prices endpoint
app.post('/api/defillama/batch-token-prices', async (req, res) => {
  try {
    const { tokens } = req.body;
    
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({ error: 'Invalid tokens array' });
    }
    
    // Create a cache key based on the token list
    const tokenSignature = tokens.map(t => `${t.chain || 'ethereum'}:${t.tokenAddress}`).sort().join(',');
    const cacheKey = `defillama:batch-prices:${Buffer.from(tokenSignature).toString('base64').slice(0, 32)}`;
    
    const data = await safeExternalFetch(
      cacheKey,
      () => defiLlamaFetcher.fetchMultipleTokenPrices(tokens),
      defiLlamaCircuitBreaker,
      15000,
      'token-price'
    );
    
    res.json(data);
  } catch (error) {
    logger.error('DeFiLlama batch token prices error:', error);
    res.status(500).json({ error: 'Failed to fetch batch token prices' });
  }
});

// Multiple token prices endpoint (simplified interface)
app.post('/api/defillama/multiple-token-prices', async (req, res) => {
  try {
    const { tokenAddresses, chain = 'ethereum' } = req.body;
    
    logger.info(`Batch price request for ${tokenAddresses?.length || 0} tokens`);
    
    if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
      return res.status(400).json({ error: 'Invalid tokenAddresses array' });
    }
    
    // Create a cache key based on the token list
    const tokenSignature = tokenAddresses.map(addr => `${chain}:${addr.toLowerCase()}`).sort().join(',');
    const cacheKey = `defillama:multiple-prices:${chain}:${Buffer.from(tokenSignature).toString('base64').slice(0, 32)}`;
    
    const data = await safeExternalFetch(
      cacheKey,
      async () => {
        // Convert to the format expected by fetchMultipleTokenPrices
        const tokenRequests = tokenAddresses.map(address => ({
          tokenAddress: address,
          chain: chain
        }));
        logger.info(`Fetching ${tokenRequests.length} token prices from DeFiLlama`);
        return await defiLlamaFetcher.fetchMultipleTokenPrices(tokenRequests);
      },
      defiLlamaCircuitBreaker,
      15000,
      'token-price'
    );
    
    logger.info(`Returning ${Object.keys(data || {}).length} token prices`);
    
    // Return prices in a format the client expects
    res.json({ prices: data });
  } catch (error) {
    logger.error('DeFiLlama multiple token prices error:', error);
    res.status(500).json({ error: 'Failed to fetch multiple token prices', prices: {} });
  }
});



// getProtocolInfo -> /api/defillama/protocol-info/:protocolSlug
app.get('/api/defillama/protocol-info/:protocolSlug', async (req, res) => {
  try {
    const { protocolSlug } = req.params;
    const cacheKey = `defillama:protocol-info:${protocolSlug}`;
    
    const data = await safeExternalFetch(
      cacheKey,
      () => defiLlamaFetcher.fetchProtocolInfo(protocolSlug),
      defiLlamaCircuitBreaker,
      12000,
      'protocol-info'
    );
    
    res.json(data);
  } catch (error) {
    logger.error('DeFiLlama protocol info error:', error);
    res.status(500).json({ error: 'Failed to fetch protocol info' });
  }
});

// getAllProtocols -> /api/defillama/all-protocols
app.get('/api/defillama/all-protocols', async (req, res) => {
  try {
    const cacheKey = 'defillama:all-protocols';
    
    const data = await safeExternalFetch(
      cacheKey,
      () => defiLlamaFetcher.fetchAllProtocols(),
      defiLlamaCircuitBreaker,
      20000, // Even longer timeout for large dataset
      'all-protocols'
    );
    
    res.json(data);
  } catch (error) {
    logger.error('DeFiLlama all protocols error:', error);
    res.status(500).json({ error: 'Failed to fetch all protocols' });
  }
});

// NEW: DefiLlama queue status monitoring endpoint
app.get('/api/defillama/queue-status', async (req, res) => {
  try {
    const queueStatus = defiLlamaFetcher.getQueueStatus();
    const healthCheck = await defiLlamaFetcher.healthCheck();
    
    res.json({
      ...queueStatus,
      health: healthCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('DeFiLlama queue status error:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

// NEW: The Graph queue status monitoring endpoint
app.get('/api/thegraph/queue-status', async (req, res) => {
  try {
    const queueStatus = theGraphFetcher.getQueueStatus();
    
    res.json({
      service: 'thegraph',
      ...queueStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('The Graph queue status error:', error);
    res.status(500).json({ error: 'Failed to get The Graph queue status' });
  }
});

// NEW: Stablecoin fetcher queue status monitoring endpoint
app.get('/api/stablecoin/queue-status', async (req, res) => {
  try {
    const queueStatus = stablecoinFetcher ? stablecoinFetcher.getQueueStatus() : null;
    
    res.json({
      service: 'stablecoin',
      ...(queueStatus || { message: 'Stablecoin fetcher not initialized' }),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Stablecoin queue status error:', error);
    res.status(500).json({ error: 'Failed to get Stablecoin queue status' });
  }
});

// NEW: CoinGecko queue status monitoring endpoint
app.get('/api/coingecko/queue-status', async (req, res) => {
  try {
    const queueStatus = coinGeckoFetcher.getQueueStatus();
    const healthCheck = await coinGeckoFetcher.healthCheck();
    
    res.json({
      service: 'coingecko',
      ...queueStatus,
      health: healthCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('CoinGecko queue status error:', error);
    res.status(500).json({ error: 'Failed to get CoinGecko queue status' });
  }
});

// NEW: Curve queue status monitoring endpoint
app.get('/api/curve/queue-status', async (req, res) => {
  try {
    const queueStatus = curveFetcher.getQueueStatus();
    const healthCheck = await curveFetcher.healthCheck();
    
    res.json({
      service: 'curve',
      ...queueStatus,
      health: healthCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Curve queue status error:', error);
    res.status(500).json({ error: 'Failed to get Curve queue status' });
  }
});

// NEW: Ethereum queue status monitoring endpoint
app.get('/api/ethereum/queue-status', async (req, res) => {
  try {
    const queueStatus = ethereumFetcher.getQueueStatus();
    const healthCheck = await ethereumFetcher.healthCheck();
    
    res.json({
      service: 'ethereum',
      ...queueStatus,
      health: healthCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Ethereum queue status error:', error);
    res.status(500).json({ error: 'Failed to get Ethereum queue status' });
  }
});

// NEW: Fluid queue status monitoring endpoint
app.get('/api/fluid/queue-status', async (req, res) => {
  try {
    const queueStatus = fluidFetcher.getQueueStatus();
    const healthCheck = await fluidFetcher.healthCheck();
    
    res.json({
      service: 'fluid',
      ...queueStatus,
      health: healthCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Fluid queue status error:', error);
    res.status(500).json({ error: 'Failed to get Fluid queue status' });
  }
});

// NEW: Morpho queue status monitoring endpoint
app.get('/api/morpho/queue-status', async (req, res) => {
  try {
    const queueStatus = morphoFetcher.getQueueStatus();
    const healthCheck = await morphoFetcher.healthCheck();
    
    res.json({
      service: 'morpho',
      ...queueStatus,
      health: healthCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Morpho queue status error:', error);
    res.status(500).json({ error: 'Failed to get Morpho queue status' });
  }
});

// NEW: Combined queue status monitoring endpoint
app.get('/api/admin/queue-status', async (req, res) => {
  try {
    const allQueues = {
      coinGecko: coinGeckoFetcher.getQueueStatus(),
      defiLlama: defiLlamaFetcher.getQueueStatus(),
      theGraph: theGraphFetcher.getQueueStatus(),
      curve: curveFetcher.getQueueStatus(),
      ethereum: ethereumFetcher.getQueueStatus(),
      fluid: fluidFetcher.getQueueStatus(),
      morpho: morphoFetcher.getQueueStatus(),
      pendle: pendleFetcher.getQueueStatus(),
      stablecoin: stablecoinFetcher ? stablecoinFetcher.getQueueStatus() : null,
      timestamp: new Date().toISOString()
    };
    
    res.json(allQueues);
  } catch (error) {
    logger.error('Combined queue status error:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

// getProtocolTVLHistory -> /api/defillama/protocol-tvl-history/:protocolSlug
app.get('/api/defillama/protocol-tvl-history/:protocolSlug', async (req, res) => {
  try {
    const { protocolSlug } = req.params;
    const { startDate, endDate } = req.query;
    const cacheKey = `defillama:tvl-history:${protocolSlug}:${startDate || 'all'}:${endDate || 'all'}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await defiLlamaFetcher.fetchProtocolTVLHistory(protocolSlug, startDate, endDate);
      await cacheManager.set(cacheKey, data, 1800); // 30 minutes for historical data
    }
    
    res.json(data);
  } catch (error) {
    logger.error('DeFiLlama protocol TVL history error:', error);
    res.status(500).json({ error: 'Failed to fetch protocol TVL history' });
  }
});

// getProtocolTVLByChain -> /api/defillama/protocol-tvl-by-chain/:protocolSlug
app.get('/api/defillama/protocol-tvl-by-chain/:protocolSlug', async (req, res) => {
  try {
    const { protocolSlug } = req.params;
    const cacheKey = `defillama:tvl-by-chain:${protocolSlug}`;
    
    const data = await safeExternalFetch(
      cacheKey,
      () => defiLlamaFetcher.fetchProtocolTVLByChain(protocolSlug),
      defiLlamaCircuitBreaker,
      12000,
      'protocol-tvl'
    );
    
    res.json(data);
  } catch (error) {
    logger.error('DeFiLlama protocol TVL by chain error:', error);
    res.status(500).json({ error: 'Failed to fetch protocol TVL by chain' });
  }
});

// ================= UNISWAP ENDPOINTS =================
// Mirror src/services/uniswap.js functions

// fetchUniswapTokenTVL -> /api/uniswap/v3/token-tvl/:tokenAddress
app.get('/api/uniswap/v3/token-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `uniswap:v3:token-tvl:${tokenAddress}`;
    
    const data = await safeExternalFetch(
      cacheKey,
      () => theGraphFetcher.fetchData('uniswap_v3', 'token_tvl', { tokenAddress })
    );
    
    res.json(data);
  } catch (error) {
    logger.error('Uniswap V3 token TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch Uniswap V3 token TVL' });
  }
});

// fetchUniswapTokenVolume -> /api/uniswap/v3/token-volume/:tokenAddress
app.get('/api/uniswap/v3/token-volume/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `uniswap:v3:token-volume:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData('uniswap_v3', 'token_volume', { tokenAddress });
      await cacheManager.set(cacheKey, data, 1800); // 30 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Uniswap V3 token volume error:', error);
    res.status(500).json({ error: 'Failed to fetch Uniswap V3 token volume' });
  }
});

// fetchUniswapV2TokenTVL -> /api/uniswap/v2/token-tvl/:tokenAddress
app.get('/api/uniswap/v2/token-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `uniswap:v2:token-tvl:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData('uniswap_v2', 'token_tvl', { tokenAddress });
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Uniswap V2 token TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch Uniswap V2 token TVL' });
  }
});

// fetchUniswapV2TokenVolume24h -> /api/uniswap/v2/token-volume/:tokenAddress
app.get('/api/uniswap/v2/token-volume/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `uniswap:v2:token-volume:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData('uniswap_v2', 'token_volume', { tokenAddress });
      await cacheManager.set(cacheKey, data, 1800); // 30 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Uniswap V2 token volume error:', error);
    res.status(500).json({ error: 'Failed to fetch Uniswap V2 token volume' });
  }
});

// getUniswapV2PairsForToken -> /api/uniswap/v2/pairs/:tokenAddress
app.get('/api/uniswap/v2/pairs/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `uniswap:v2:pairs:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData('uniswap_v2', 'token_pairs', { tokenAddress, first: 100 });
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Uniswap V2 pairs error:', error);
    res.status(500).json({ error: 'Failed to fetch Uniswap V2 pairs' });
  }
});

// getUniswapV3PoolsForToken -> /api/uniswap/v3/pools/:tokenAddress
app.get('/api/uniswap/v3/pools/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `uniswap:v3:pools:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData('uniswap_v3', 'token_pairs', { tokenAddress, first: 100 });
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Uniswap V3 pools error:', error);
    res.status(500).json({ error: 'Failed to fetch Uniswap V3 pools' });
  }
});

// ================= CURVE ENDPOINTS =================
// Mirror src/services/curve.js functions

// fetchCurveTokenTVL -> /api/curve/token-tvl/:tokenAddress
app.get('/api/curve/token-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `curve:token-tvl:${tokenAddress}`;
    
    const data = await safeExternalFetch(
      cacheKey,
      () => curveFetcher.fetchData('token_tvl', { tokenAddress })
    );
    
    res.json(data);
  } catch (error) {
    logger.error('Curve token TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch Curve token TVL' });
  }
});

// fetchCurveTokenVolume -> /api/curve/token-volume/:tokenAddress
app.get('/api/curve/token-volume/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `curve:token-volume:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await curveFetcher.fetchData('token_volume', { tokenAddress });
      await cacheManager.set(cacheKey, data, 1800); // 30 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Curve token volume error:', error);
    res.status(500).json({ error: 'Failed to fetch Curve token volume' });
  }
});

// fetchCurvePoolTVL -> /api/curve/pool-tvl/:poolAddress
app.get('/api/curve/pool-tvl/:poolAddress', async (req, res) => {
  try {
    const { poolAddress } = req.params;
    const cacheKey = `curve:pool-tvl:${poolAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await curveFetcher.fetchPoolTVL(poolAddress);
      await cacheManager.set(cacheKey, data, 600); // 10 minutes cache for pool TVL
    }
    
    res.json({ data });
  } catch (error) {
    logger.error('Curve pool TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch Curve pool TVL' });
  }
});

// fetchAllCurvePools -> /api/curve/all-pools
app.get('/api/curve/all-pools', async (req, res) => {
  try {
    const cacheKey = 'curve:all-pools';
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await curveFetcher.fetchData('all_pools', {});
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Curve all pools error:', error);
    res.status(500).json({ error: 'Failed to fetch all Curve pools' });
  }
});

// ================= FILTERED TVL ENDPOINTS =================
// These endpoints exclude same-protocol stablecoin pairs

// fetchCurveFilteredTVL -> /api/curve/filtered-tvl/:tokenAddress (with Pendle PT support)
app.get('/api/curve/filtered-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const additionalAddresses = req.query.additionalAddresses 
      ? req.query.additionalAddresses.split(',').map(addr => addr.trim())
      : [];
    
    const allTokenAddresses = [tokenAddress, ...additionalAddresses];
    const cacheKey = `curve:filtered-tvl:${allTokenAddresses.sort().join('-')}`;
    
    let totalTVL = await cacheManager.get(cacheKey);
    if (totalTVL === null || totalTVL === undefined) {
      logger.info(`[Curve Filtered] Fetching for ${allTokenAddresses.length} addresses with Pendle PT support`);
      
      // Step 1: Get Pendle PT tokens for all stablecoin addresses
      const allMarkets = await cacheManager.get('pendle:all-markets') || await pendleFetcher.fetchAllMarkets();
      const pendlePTData = pendleFetcher.getPTTokensForStablecoin(allTokenAddresses, allMarkets);
      const ptAddresses = pendlePTData.ptAddresses || [];
      
      logger.info(`[Curve Filtered] Found ${ptAddresses.length} PT tokens`);
      
      // Step 2: Fetch Curve TVL for base tokens
      const baseTokensTVL = await Promise.all(
        allTokenAddresses.map(addr => curveFetcher.fetchFilteredTokenTVL(addr))
      );
      const directTVL = baseTokensTVL.reduce((sum, tvl) => sum + tvl, 0);
      
      // Step 3: Fetch Curve TVL for PT tokens
      let ptTVL = 0;
      if (ptAddresses.length > 0) {
        const ptTokensTVL = await Promise.all(
          ptAddresses.map(addr => curveFetcher.fetchFilteredTokenTVL(addr))
        );
        ptTVL = ptTokensTVL.reduce((sum, tvl) => sum + tvl, 0);
      }
      
      totalTVL = directTVL + ptTVL;
      
      logger.info(`[Curve Filtered] ${tokenAddress}: Direct=$${directTVL.toFixed(2)}, PT=$${ptTVL.toFixed(2)}, Total=$${totalTVL.toFixed(2)}`);
      
      await cacheManager.set(cacheKey, totalTVL, 600);
    }
    
    res.json({ data: totalTVL });
  } catch (error) {
    logger.error('Curve filtered TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch Curve filtered TVL', data: 0 });
  }
});

// fetchUniswapV2FilteredTVL -> /api/uniswap/v2/filtered-tvl/:tokenAddress (with Pendle PT)
app.get('/api/uniswap/v2/filtered-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const additionalAddresses = req.query.additionalAddresses 
      ? req.query.additionalAddresses.split(',').map(addr => addr.trim())
      : [];
    
    const allTokenAddresses = [tokenAddress, ...additionalAddresses];
    const cacheKey = `uniswap:v2:filtered-tvl-pt:${allTokenAddresses.sort().join('-')}`;
    
    let totalTVL = await cacheManager.get(cacheKey);
    if (totalTVL === null || totalTVL === undefined) {
      // Get Pendle PT tokens
      const allMarkets = await cacheManager.get('pendle:all-markets') || await pendleFetcher.fetchAllMarkets();
      const pendlePTData = pendleFetcher.getPTTokensForStablecoin(allTokenAddresses, allMarkets);
      const ptAddresses = pendlePTData.ptAddresses || [];
      
      // Fetch TVL for base + PT tokens
      const [baseTokensTVL, ptTokensTVL] = await Promise.all([
        Promise.all(allTokenAddresses.map(addr => theGraphFetcher.fetchFilteredTokenTVL('uniswap_v2', addr))),
        Promise.all(ptAddresses.map(addr => theGraphFetcher.fetchFilteredTokenTVL('uniswap_v2', addr)))
      ]);
      
      const directTVL = baseTokensTVL.reduce((sum, tvl) => sum + tvl, 0);
      const ptTVL = ptTokensTVL.reduce((sum, tvl) => sum + tvl, 0);
      totalTVL = directTVL + ptTVL;
      
      logger.info(`[Uniswap V2 Filtered] Direct=$${directTVL.toFixed(2)}, PT=$${ptTVL.toFixed(2)}, Total=$${totalTVL.toFixed(2)}`);
      await cacheManager.set(cacheKey, totalTVL, 600);
    }
    
    res.json({ data: totalTVL });
  } catch (error) {
    logger.error('Uniswap V2 filtered TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch Uniswap V2 filtered TVL', data: 0 });
  }
});

// fetchUniswapV3FilteredTVL -> /api/uniswap/v3/filtered-tvl/:tokenAddress (with Pendle PT)
app.get('/api/uniswap/v3/filtered-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const additionalAddresses = req.query.additionalAddresses 
      ? req.query.additionalAddresses.split(',').map(addr => addr.trim())
      : [];
    
    const allTokenAddresses = [tokenAddress, ...additionalAddresses];
    const cacheKey = `uniswap:v3:filtered-tvl-pt:${allTokenAddresses.sort().join('-')}`;
    
    let totalTVL = await cacheManager.get(cacheKey);
    if (totalTVL === null || totalTVL === undefined) {
      // Get Pendle PT tokens
      const allMarkets = await cacheManager.get('pendle:all-markets') || await pendleFetcher.fetchAllMarkets();
      const pendlePTData = pendleFetcher.getPTTokensForStablecoin(allTokenAddresses, allMarkets);
      const ptAddresses = pendlePTData.ptAddresses || [];
      
      // Fetch TVL for base + PT tokens
      const [baseTokensTVL, ptTokensTVL] = await Promise.all([
        Promise.all(allTokenAddresses.map(addr => theGraphFetcher.fetchFilteredTokenTVL('uniswap_v3', addr))),
        Promise.all(ptAddresses.map(addr => theGraphFetcher.fetchFilteredTokenTVL('uniswap_v3', addr)))
      ]);
      
      const directTVL = baseTokensTVL.reduce((sum, tvl) => sum + tvl, 0);
      const ptTVL = ptTokensTVL.reduce((sum, tvl) => sum + tvl, 0);
      totalTVL = directTVL + ptTVL;
      
      logger.info(`[Uniswap V3 Filtered] Direct=$${directTVL.toFixed(2)}, PT=$${ptTVL.toFixed(2)}, Total=$${totalTVL.toFixed(2)}`);
      await cacheManager.set(cacheKey, totalTVL, 600);
    }
    
    res.json({ data: totalTVL });
  } catch (error) {
    logger.error('Uniswap V3 filtered TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch Uniswap V3 filtered TVL', data: 0 });
  }
});

// fetchSushiV2FilteredTVL -> /api/sushiswap/v2/filtered-tvl/:tokenAddress (with Pendle PT)
app.get('/api/sushiswap/v2/filtered-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const additionalAddresses = req.query.additionalAddresses 
      ? req.query.additionalAddresses.split(',').map(addr => addr.trim())
      : [];
    
    const allTokenAddresses = [tokenAddress, ...additionalAddresses];
    const cacheKey = `sushiswap:v2:filtered-tvl-pt:${allTokenAddresses.sort().join('-')}`;
    
    let totalTVL = await cacheManager.get(cacheKey);
    if (totalTVL === null || totalTVL === undefined) {
      // Get Pendle PT tokens
      const allMarkets = await cacheManager.get('pendle:all-markets') || await pendleFetcher.fetchAllMarkets();
      const pendlePTData = pendleFetcher.getPTTokensForStablecoin(allTokenAddresses, allMarkets);
      const ptAddresses = pendlePTData.ptAddresses || [];
      
      // Fetch TVL for base + PT tokens
      const [baseTokensTVL, ptTokensTVL] = await Promise.all([
        Promise.all(allTokenAddresses.map(addr => theGraphFetcher.fetchFilteredTokenTVL('sushi_v2', addr))),
        Promise.all(ptAddresses.map(addr => theGraphFetcher.fetchFilteredTokenTVL('sushi_v2', addr)))
      ]);
      
      const directTVL = baseTokensTVL.reduce((sum, tvl) => sum + tvl, 0);
      const ptTVL = ptTokensTVL.reduce((sum, tvl) => sum + tvl, 0);
      totalTVL = directTVL + ptTVL;
      
      logger.info(`[Sushi V2 Filtered] Direct=$${directTVL.toFixed(2)}, PT=$${ptTVL.toFixed(2)}, Total=$${totalTVL.toFixed(2)}`);
      await cacheManager.set(cacheKey, totalTVL, 600);
    }
    
    res.json({ data: totalTVL });
  } catch (error) {
    logger.error('SushiSwap V2 filtered TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch SushiSwap V2 filtered TVL', data: 0 });
  }
});

// fetchSushiV3FilteredTVL -> /api/sushiswap/v3/filtered-tvl/:tokenAddress (with Pendle PT)
app.get('/api/sushiswap/v3/filtered-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const additionalAddresses = req.query.additionalAddresses 
      ? req.query.additionalAddresses.split(',').map(addr => addr.trim())
      : [];
    
    const allTokenAddresses = [tokenAddress, ...additionalAddresses];
    const cacheKey = `sushiswap:v3:filtered-tvl-pt:${allTokenAddresses.sort().join('-')}`;
    
    let totalTVL = await cacheManager.get(cacheKey);
    if (totalTVL === null || totalTVL === undefined) {
      // Get Pendle PT tokens
      const allMarkets = await cacheManager.get('pendle:all-markets') || await pendleFetcher.fetchAllMarkets();
      const pendlePTData = pendleFetcher.getPTTokensForStablecoin(allTokenAddresses, allMarkets);
      const ptAddresses = pendlePTData.ptAddresses || [];
      
      // Fetch TVL for base + PT tokens
      const [baseTokensTVL, ptTokensTVL] = await Promise.all([
        Promise.all(allTokenAddresses.map(addr => theGraphFetcher.fetchFilteredTokenTVL('sushi_v3', addr))),
        Promise.all(ptAddresses.map(addr => theGraphFetcher.fetchFilteredTokenTVL('sushi_v3', addr)))
      ]);
      
      const directTVL = baseTokensTVL.reduce((sum, tvl) => sum + tvl, 0);
      const ptTVL = ptTokensTVL.reduce((sum, tvl) => sum + tvl, 0);
      totalTVL = directTVL + ptTVL;
      
      logger.info(`[Sushi V3 Filtered] Direct=$${directTVL.toFixed(2)}, PT=$${ptTVL.toFixed(2)}, Total=$${totalTVL.toFixed(2)}`);
      await cacheManager.set(cacheKey, totalTVL, 600);
    }
    
    res.json({ data: totalTVL });
  } catch (error) {
    logger.error('SushiSwap V3 filtered TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch SushiSwap V3 filtered TVL', data: 0 });
  }
});

// fetchBalancerV2FilteredTVL -> /api/balancer/v2/filtered-tvl/:tokenAddress (with Pendle PT)
app.get('/api/balancer/v2/filtered-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const additionalAddresses = req.query.additionalAddresses 
      ? req.query.additionalAddresses.split(',').map(addr => addr.trim())
      : [];
    
    const allTokenAddresses = [tokenAddress, ...additionalAddresses];
    const cacheKey = `balancer:v2:filtered-tvl-pt:${allTokenAddresses.sort().join('-')}`;
    
    let totalTVL = await cacheManager.get(cacheKey);
    if (totalTVL === null || totalTVL === undefined) {
      // Get Pendle PT tokens
      const allMarkets = await cacheManager.get('pendle:all-markets') || await pendleFetcher.fetchAllMarkets();
      const pendlePTData = pendleFetcher.getPTTokensForStablecoin(allTokenAddresses, allMarkets);
      const ptAddresses = pendlePTData.ptAddresses || [];
      
      // Fetch TVL for base + PT tokens
      const [baseTokensTVL, ptTokensTVL] = await Promise.all([
        Promise.all(allTokenAddresses.map(addr => theGraphFetcher.fetchFilteredTokenTVL('balancer', addr))),
        Promise.all(ptAddresses.map(addr => theGraphFetcher.fetchFilteredTokenTVL('balancer', addr)))
      ]);
      
      const directTVL = baseTokensTVL.reduce((sum, tvl) => sum + tvl, 0);
      const ptTVL = ptTokensTVL.reduce((sum, tvl) => sum + tvl, 0);
      totalTVL = directTVL + ptTVL;
      
      logger.info(`[Balancer V2 Filtered] Direct=$${directTVL.toFixed(2)}, PT=$${ptTVL.toFixed(2)}, Total=$${totalTVL.toFixed(2)}`);
      await cacheManager.set(cacheKey, totalTVL, 600);
    }
    
    res.json({ data: totalTVL });
  } catch (error) {
    logger.error('Balancer V2 filtered TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch Balancer V2 filtered TVL', data: 0 });
  }
});

// fetchBalancerV3FilteredTVL -> /api/balancer/v3/filtered-tvl/:tokenAddress (with Pendle PT)
app.get('/api/balancer/v3/filtered-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const additionalAddresses = req.query.additionalAddresses 
      ? req.query.additionalAddresses.split(',').map(addr => addr.trim())
      : [];
    
    const allTokenAddresses = [tokenAddress, ...additionalAddresses];
    const cacheKey = `balancer:v3:filtered-tvl-pt:${allTokenAddresses.sort().join('-')}`;
    
    let tvl = await cacheManager.get(cacheKey);
    if (tvl === null || tvl === undefined) {
      logger.info(`[Balancer V3 Filtered] Starting for ${allTokenAddresses.length} addresses`);
      
      // Get Pendle PT tokens
      const allMarkets = await cacheManager.get('pendle:all-markets') || await pendleFetcher.fetchAllMarkets();
      const pendlePTData = pendleFetcher.getPTTokensForStablecoin(allTokenAddresses, allMarkets);
      const ptAddresses = pendlePTData.ptAddresses || [];
      
      logger.info(`[Balancer V3 Filtered] Found ${ptAddresses.length} PT tokens`);
      
      // Fetch filtered poolTokens for base tokens
      const basePoolTokens = await Promise.all(
        allTokenAddresses.map(addr => theGraphFetcher.fetchFilteredTokenTVL('balancer_v3', addr))
      );
      
      // Fetch filtered poolTokens for PT tokens
      const ptPoolTokens = await Promise.all(
        ptAddresses.map(addr => theGraphFetcher.fetchFilteredTokenTVL('balancer_v3', addr))
      );
      
      // Combine all poolTokens
      const allPoolTokens = [...basePoolTokens.flat(), ...ptPoolTokens.flat()];
      
      logger.info(`[Balancer V3 Filtered] Got ${allPoolTokens.length} total pool tokens (${basePoolTokens.flat().length} base + ${ptPoolTokens.flat().length} PT)`);
      
      // Calculate TVL from the poolTokens
      if (allPoolTokens.length > 0) {
        logger.info(`[Balancer V3 Filtered] Calculating TVL from ${allPoolTokens.length} pool tokens...`);
        
        tvl = await theGraphFetcher.calculateBalancerV3TVL(allPoolTokens, async (tokenAddr) => {
          const priceData = await defiLlamaFetcher.fetchTokenPrice(tokenAddr, 'ethereum');
          const price = priceData?.price || 0;
          if (price > 0) {
            logger.info(`[Balancer V3 Price] ${tokenAddr}: $${price}`);
          }
          return price;
        });
        
        logger.info(`[Balancer V3 Filtered] Calculated TVL: $${tvl.toFixed(2)}`);
      } else {
        logger.info(`[Balancer V3 Filtered] No pool tokens found`);
        tvl = 0;
      }
      
      await cacheManager.set(cacheKey, tvl, 600); // 10 minutes cache
    } else {
      logger.info(`[Balancer V3 Filtered] Cache hit: $${tvl}`);
    }
    
    res.json({ data: tvl });
  } catch (error) {
    logger.error('[Balancer V3 Filtered] Error:', error);
    res.status(500).json({ error: 'Failed to fetch Balancer V3 filtered TVL', data: 0 });
  }
});

// Legacy filtered endpoint (V2 only for backward compatibility)
app.get('/api/F/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `balancer:filtered-tvl:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchFilteredTokenTVL('balancer', tokenAddress);
      await cacheManager.set(cacheKey, data, 600); // 10 minutes cache
    }
    
    res.json({ data });
  } catch (error) {
    logger.error('Balancer filtered TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch Balancer filtered TVL' });
  }
});

// Combined filtered TVL (V2 + V3) with Pendle PT support
app.get('/api/balancer/total-filtered-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const additionalAddresses = req.query.additionalAddresses 
      ? req.query.additionalAddresses.split(',').map(addr => addr.trim())
      : [];
    
    const allTokenAddresses = [tokenAddress, ...additionalAddresses];
    const cacheKey = `balancer:total-filtered-tvl-pt:${allTokenAddresses.sort().join('-')}`;
    
    let totalTVL = await cacheManager.get(cacheKey);
    if (totalTVL === null || totalTVL === undefined) {
      logger.info(`[Balancer Total Filtered] Fetching for ${allTokenAddresses.length} addresses with Pendle PT`);
      
      // Get Pendle PT tokens
      const allMarkets = await cacheManager.get('pendle:all-markets') || await pendleFetcher.fetchAllMarkets();
      const pendlePTData = pendleFetcher.getPTTokensForStablecoin(allTokenAddresses, allMarkets);
      const ptAddresses = pendlePTData.ptAddresses || [];
      
      logger.info(`[Balancer Total Filtered] Found ${ptAddresses.length} PT tokens`);
      
      // Fetch V2 TVL for base + PT tokens
      const [v2BaseTokensTVL, v2PTTokensTVL] = await Promise.all([
        Promise.all(allTokenAddresses.map(addr => theGraphFetcher.fetchFilteredTokenTVL('balancer', addr))),
        Promise.all(ptAddresses.map(addr => theGraphFetcher.fetchFilteredTokenTVL('balancer', addr)))
      ]);
      
      const v2DirectTVL = v2BaseTokensTVL.reduce((sum, tvl) => sum + tvl, 0);
      const v2PTTVL = v2PTTokensTVL.reduce((sum, tvl) => sum + tvl, 0);
      const v2TVL = v2DirectTVL + v2PTTVL;
      
      // Fetch V3 filtered poolTokens for base tokens
      const v3FilteredPoolTokensBase = await Promise.all(
        allTokenAddresses.map(addr => theGraphFetcher.fetchFilteredTokenTVL('balancer_v3', addr))
      );
      
      // Fetch V3 filtered poolTokens for PT tokens
      const v3FilteredPoolTokensPT = await Promise.all(
        ptAddresses.map(addr => theGraphFetcher.fetchFilteredTokenTVL('balancer_v3', addr))
      );
      
      // Calculate V3 TVL from poolTokens (both base and PT)
      const allV3PoolTokens = [...v3FilteredPoolTokensBase.flat(), ...v3FilteredPoolTokensPT.flat()];
      
      let v3TVL = 0;
      if (allV3PoolTokens.length > 0) {
        v3TVL = await theGraphFetcher.calculateBalancerV3TVL(allV3PoolTokens, async (tokenAddr) => {
          const priceData = await defiLlamaFetcher.fetchTokenPrice(tokenAddr, 'ethereum');
          return priceData?.price || 0;
        });
      }
      
      totalTVL = v2TVL + v3TVL;
      await cacheManager.set(cacheKey, totalTVL, 600); // 10 minutes cache
      
      logger.info(`[Balancer Total Filtered] V2=$${v2TVL.toFixed(2)} (Direct:$${v2DirectTVL.toFixed(2)}, PT:$${v2PTTVL.toFixed(2)}), V3=$${v3TVL.toFixed(2)}, Total=$${totalTVL.toFixed(2)}`);
    }
    
    res.json({ data: totalTVL });
  } catch (error) {
    logger.error('Balancer total filtered TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch Balancer total filtered TVL', data: 0 });
  }
});

// ================= FLUID ENDPOINTS =================
// Fluid Protocol collateral/supply data
// Note: All endpoints return collateral (supply liquidity) - when a token is used as supplyToken in vaults

// fetchFluidTokenCollateral -> /api/fluid/token-borrow/:tokenAddress
// NOTE: Despite the name "token-borrow", this returns COLLATERAL data (supply liquidity)
app.get('/api/fluid/token-borrow/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `fluid:token-collateral:${tokenAddress}`;
    
    const data = await safeExternalFetch(
      cacheKey,
      () => fluidFetcher.fetchData('token_borrow', { tokenAddress })
    );
    
    res.json(data);
  } catch (error) {
    logger.error('Fluid token collateral error:', error);
    res.status(500).json({ error: 'Failed to fetch Fluid token collateral' });
  }
});

// fetchFluidTokenSupplyLiquidity -> /api/fluid/token-supply/:tokenAddress
// Returns collateral (supply liquidity) for a token used in Fluid vaults
app.get('/api/fluid/token-supply/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `fluid:token-supply:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      const liquidityValue = await fluidFetcher.fetchTokenSupplyLiquidity(tokenAddress);
      data = {
        protocol: 'fluid',
        queryType: 'token_supply',
        data: liquidityValue,
        fetched_at: new Date().toISOString()
      };
      await cacheManager.set(cacheKey, data, 1800); // 30 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Fluid token supply liquidity error:', error);
    res.status(500).json({ error: 'Failed to fetch Fluid token supply liquidity' });
  }
});

// fetchFluidCollateral -> /api/fluid/collateral/:tokenAddress (primary endpoint)
// Returns total USD value of a token used as collateral across all Fluid vaults
app.get('/api/fluid/collateral/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `fluid:collateral:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      // Get collateral (supply liquidity) for this token in Fluid vaults
      const collateralValue = await fluidFetcher.fetchTokenBorrowLiquidity(tokenAddress);
      data = {
        data: collateralValue,
        source: 'fluid_api',
        fetched_at: new Date().toISOString()
      };
      await cacheManager.set(cacheKey, data, 1800); // 30 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Fluid collateral error:', error);
    res.status(500).json({ error: 'Failed to fetch Fluid collateral data' });
  }
});

// fetchAllFluidVaults -> /api/fluid/all-vaults
app.get('/api/fluid/all-vaults', async (req, res) => {
  try {
    const cacheKey = 'fluid:all-vaults';
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await fluidFetcher.fetchData('all_vaults', {});
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Fluid all vaults error:', error);
    res.status(500).json({ error: 'Failed to fetch all Fluid vaults' });
  }
});

// ================= FRAXSWAP ENDPOINTS =================
// Mirror src/services/fraxswap.js functions

// fetchFraxswapTokenTVL -> /api/fraxswap/token-tvl/:tokenAddress
app.get('/api/fraxswap/token-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `fraxswap:token-tvl:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      // Use circuit breaker and quick timeout
      try {
        data = await theGraphCircuitBreaker.call(async () => {
          const fetchPromise = theGraphFetcher.fetchData('fraxswap', 'token_tvl', { tokenAddress });
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('External API timeout')), 8000)
          );
          return Promise.race([fetchPromise, timeoutPromise]);
        });
        await cacheManager.setWithSmartTTL(cacheKey, data, 'protocol-tvl');
      } catch (fetchError) {
        // Return stale data or default
        const staleKey = `${cacheKey}:stale`;
        const staleData = await cacheManager.get(staleKey);
        if (staleData) {
          logger.info(`Returning stale Fraxswap TVL data for ${tokenAddress}`);
          res.json({ ...staleData, _stale: true });
          return;
        }
        // No stale data, return default
        data = { data: 0, _unavailable: true };
      }
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Fraxswap token TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch Fraxswap token TVL' });
  }
});

// fetchFraxswapTokenVolume -> /api/fraxswap/token-volume/:tokenAddress
app.get('/api/fraxswap/token-volume/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `fraxswap:token-volume:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData('fraxswap', 'token_volume', { tokenAddress });
      await cacheManager.set(cacheKey, data, 1800); // 30 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Fraxswap token volume error:', error);
    res.status(500).json({ error: 'Failed to fetch Fraxswap token volume' });
  }
});

// getFraxswapPairsForToken -> /api/fraxswap/pairs/:tokenAddress
app.get('/api/fraxswap/pairs/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `fraxswap:pairs:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData('fraxswap', 'token_pairs', { tokenAddress, first: 100 });
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Fraxswap pairs error:', error);
    res.status(500).json({ error: 'Failed to fetch Fraxswap pairs' });
  }
});

// ================= SUSHISWAP ENDPOINTS =================
// Mirror src/services/sushiswap.js functions

// fetchSushiTokenTVL -> /api/sushiswap/v3/token-tvl/:tokenAddress
app.get('/api/sushiswap/v3/token-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `sushiswap:v3:token-tvl:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData('sushi_v3', 'token_tvl', { tokenAddress });
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('SushiSwap V3 token TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch SushiSwap V3 token TVL' });
  }
});

// fetchSushiV2TokenTVL -> /api/sushiswap/v2/token-tvl/:tokenAddress
app.get('/api/sushiswap/v2/token-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `sushiswap:v2:token-tvl:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData('sushi_v2', 'token_tvl', { tokenAddress });
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('SushiSwap V2 token TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch SushiSwap V2 token TVL' });
  }
});

// getSushiV2PairsForToken -> /api/sushiswap/v2/pairs/:tokenAddress
app.get('/api/sushiswap/v2/pairs/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `sushiswap:v2:pairs:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData('sushi_v2', 'token_pairs', { tokenAddress, first: 100 });
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('SushiSwap V2 pairs error:', error);
    res.status(500).json({ error: 'Failed to fetch SushiSwap V2 pairs' });
  }
});

// fetchSushiTokenVolume -> /api/sushiswap/v3/token-volume/:tokenAddress  
app.get('/api/sushiswap/v3/token-volume/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `sushiswap:v3:volume:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData('sushi_v3', 'token_volume', { tokenAddress });
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('SushiSwap V3 volume error:', error);
    res.status(500).json({ error: 'Failed to fetch SushiSwap V3 volume' });
  }
});

// fetchSushiV2TokenVolume24h -> /api/sushiswap/v2/token-volume/:tokenAddress
app.get('/api/sushiswap/v2/token-volume/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `sushiswap:v2:volume:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData('sushi_v2', 'token_volume', { tokenAddress });
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('SushiSwap V2 volume error:', error);
    res.status(500).json({ error: 'Failed to fetch SushiSwap V2 volume' });
  }
});

// ================= BALANCER ENDPOINTS =================
// Mirror src/services/balancer.js functions

// fetchBalancerTokenTVL -> /api/balancer/v2/token-tvl/:tokenAddress
app.get('/api/balancer/v2/token-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `balancer:v2:token-tvl:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData('balancer', 'token_tvl', { tokenAddress });
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Balancer V2 token TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch Balancer V2 token TVL' });
  }
});

// fetchBalancerV3TokenTVL -> /api/balancer/v3/token-tvl/:tokenAddress
app.get('/api/balancer/v3/token-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `balancer:v3:token-tvl:${tokenAddress}`;
    
    let tvl = await cacheManager.get(cacheKey);
    if (tvl === null || tvl === undefined) {
      // Fetch poolTokens data from subgraph
      const graphData = await theGraphFetcher.fetchData('balancer_v3', 'token_tvl', { tokenAddress });
      const poolTokens = graphData?.data || [];
      
      logger.info(`Balancer V3: Found ${poolTokens.length} pool tokens for ${tokenAddress}`);
      
      // Calculate TVL from balances using DeFiLlama prices
      tvl = await theGraphFetcher.calculateBalancerV3TVL(poolTokens, async (tokenAddr) => {
        const priceData = await defiLlamaFetcher.fetchTokenPrice(tokenAddr, 'ethereum');
        return priceData?.price || 0;
      });
      
      logger.info(`Balancer V3 TVL for ${tokenAddress}: $${tvl.toFixed(2)}`);
      
      await cacheManager.set(cacheKey, tvl, 3600); // 1 hour
    }
    
    res.json({ 
      protocol: 'balancer_v3',
      queryType: 'token_tvl',
      data: tvl,
      fetched_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Balancer V3 token TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch Balancer V3 token TVL', data: 0 });
  }
});

// Legacy endpoint (V2 only for backward compatibility)
app.get('/api/balancer/token-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `balancer:token-tvl:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData('balancer', 'token_tvl', { tokenAddress });
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Balancer token TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch Balancer token TVL' });
  }
});

// Combined Balancer TVL (V2 + V3)
app.get('/api/balancer/total-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `balancer:total-tvl:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      // Fetch V2 data (already returns number)
      const v2Data = await theGraphFetcher.fetchData('balancer', 'token_tvl', { tokenAddress });
      const v2TVL = Number(v2Data?.data || 0);
      
      // Fetch V3 data (returns poolTokens array)
      const v3GraphData = await theGraphFetcher.fetchData('balancer_v3', 'token_tvl', { tokenAddress });
      const v3PoolTokens = v3GraphData?.data || [];
      
      // Calculate V3 TVL from poolTokens
      const v3TVL = await theGraphFetcher.calculateBalancerV3TVL(v3PoolTokens, async (tokenAddr) => {
        const priceData = await defiLlamaFetcher.fetchTokenPrice(tokenAddr, 'ethereum');
        return priceData?.price || 0;
      });
      
      data = {
        protocol: 'balancer',
        tokenAddress,
        v2TVL,
        v3TVL,
        totalTVL: v2TVL + v3TVL,
        fetched_at: new Date().toISOString()
      };
      
      logger.info(`Balancer total TVL for ${tokenAddress}: V2=$${v2TVL.toFixed(2)}, V3=$${v3TVL.toFixed(2)}, Total=$${data.totalTVL.toFixed(2)}`);
      
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Balancer total TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch Balancer total TVL' });
  }
});

// fetchBalancerTokenVolume -> /api/balancer/v2/token-volume/:tokenAddress
app.get('/api/balancer/v2/token-volume/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `balancer:v2:token-volume:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData('balancer', 'token_volume', { tokenAddress });
      await cacheManager.set(cacheKey, data, 1800); // 30 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Balancer V2 token volume error:', error);
    res.status(500).json({ error: 'Failed to fetch Balancer V2 token volume' });
  }
});

// fetchBalancerV3TokenVolume -> /api/balancer/v3/token-volume/:tokenAddress
app.get('/api/balancer/v3/token-volume/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `balancer:v3:token-volume:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData('balancer_v3', 'token_volume', { tokenAddress });
      await cacheManager.set(cacheKey, data, 1800); // 30 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Balancer V3 token volume error:', error);
    res.status(500).json({ error: 'Failed to fetch Balancer V3 token volume' });
  }
});

// Legacy volume endpoint (V2 only)
app.get('/api/balancer/token-volume/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `balancer:token-volume:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData('balancer', 'token_volume', { tokenAddress });
      await cacheManager.set(cacheKey, data, 1800); // 30 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Balancer token volume error:', error);
    res.status(500).json({ error: 'Failed to fetch Balancer token volume' });
  }
});

// ================= THE GRAPH GENERIC ENDPOINTS =================
// Legacy generic endpoint
app.get('/api/graph/:protocol/:query', async (req, res) => {
  try {
    const { protocol, query } = req.params;
    const cacheKey = `graph:${protocol}:${query}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await theGraphFetcher.fetchData(protocol, query, req.query);
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('The Graph API error:', error);
    res.status(500).json({ error: 'Failed to fetch graph data' });
  }
});

// ================= ETHEREUM ENDPOINTS =================
// Mirror src/services/ethereum.js functions

// getTokenBalance -> /api/ethereum/token-balance/:tokenAddress/:holderAddress
app.get('/api/ethereum/token-balance/:tokenAddress/:holderAddress', async (req, res) => {
  try {
    const { tokenAddress, holderAddress } = req.params;
    const cacheKey = `ethereum:token-balance:${tokenAddress}:${holderAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await ethereumFetcher.getTokenBalanceFormatted(tokenAddress, holderAddress);
      await cacheManager.set(cacheKey, data, 60); // 1 minute for balances
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Ethereum token balance error:', error);
    res.status(500).json({ error: 'Failed to fetch token balance' });
  }
});

// getTokenDecimals -> /api/ethereum/token-decimals/:tokenAddress
app.get('/api/ethereum/token-decimals/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `ethereum:token-decimals:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await ethereumFetcher.getTokenDecimalsFormatted(tokenAddress);
      await cacheManager.set(cacheKey, data, 86400); // 24 hours for decimals
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Ethereum token decimals error:', error);
    res.status(500).json({ error: 'Failed to fetch token decimals' });
  }
});

// getTokenName -> /api/ethereum/token-name/:tokenAddress
app.get('/api/ethereum/token-name/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `ethereum:token-name:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await ethereumFetcher.getTokenNameFormatted(tokenAddress);
      await cacheManager.set(cacheKey, data, 86400); // 24 hours for name
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Ethereum token name error:', error);
    res.status(500).json({ error: 'Failed to fetch token name' });
  }
});

// getTokenSymbol -> /api/ethereum/token-symbol/:tokenAddress
app.get('/api/ethereum/token-symbol/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `ethereum:token-symbol:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await ethereumFetcher.getTokenSymbolFormatted(tokenAddress);
      await cacheManager.set(cacheKey, data, 86400); // 24 hours for symbol
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Ethereum token symbol error:', error);
    res.status(500).json({ error: 'Failed to fetch token symbol' });
  }
});

// getTotalSupply -> /api/ethereum/total-supply/:tokenAddress
app.get('/api/ethereum/total-supply/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `ethereum:total-supply:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await ethereumFetcher.getTotalSupplyFormatted(tokenAddress);
      await cacheManager.set(cacheKey, data, 600); // 10 minutes for total supply
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Ethereum total supply error:', error);
    res.status(500).json({ error: 'Failed to fetch total supply' });
  }
});

// getCurrentBlock -> /api/ethereum/current-block
app.get('/api/ethereum/current-block', async (req, res) => {
  try {
    const cacheKey = 'ethereum:current-block';
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await ethereumFetcher.getCurrentBlock();
      await cacheManager.set(cacheKey, data, 15); // 15 seconds for current block
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Ethereum current block error:', error);
    res.status(500).json({ error: 'Failed to fetch current block' });
  }
});

// getGasPrice -> /api/ethereum/gas-price
app.get('/api/ethereum/gas-price', async (req, res) => {
  try {
    const cacheKey = 'ethereum:gas-price';
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await ethereumFetcher.getGasPrice();
      await cacheManager.set(cacheKey, data, 30); // 30 seconds for gas price
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Ethereum gas price error:', error);
    res.status(500).json({ error: 'Failed to fetch gas price' });
  }
});

// getTokenInfo -> /api/ethereum/token-info/:tokenAddress
app.get('/api/ethereum/token-info/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `ethereum:token-info:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await ethereumFetcher.getTokenInfo(tokenAddress);
      await cacheManager.set(cacheKey, data, 3600); // 1 hour for token info
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Ethereum token info error:', error);
    res.status(500).json({ error: 'Failed to fetch token info' });
  }
});

// getAllowance -> /api/ethereum/allowance/:tokenAddress/:ownerAddress/:spenderAddress
app.get('/api/ethereum/allowance/:tokenAddress/:ownerAddress/:spenderAddress', async (req, res) => {
  try {
    const { tokenAddress, ownerAddress, spenderAddress } = req.params;
    const cacheKey = `ethereum:allowance:${tokenAddress}:${ownerAddress}:${spenderAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await ethereumFetcher.getAllowanceFormatted(tokenAddress, ownerAddress, spenderAddress);
      await cacheManager.set(cacheKey, data, 300); // 5 minutes for allowance (can change frequently)
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Ethereum allowance error:', error);
    res.status(500).json({ error: 'Failed to fetch allowance' });
  }
});

// Legacy generic endpoint
app.get('/api/ethereum/:method', async (req, res) => {
  try {
    const { method } = req.params;
    const cacheKey = `ethereum:${method}:${JSON.stringify(req.query)}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await ethereumFetcher.fetchData(method, req.query);
      // Different TTL based on method
      const ttl = method === 'currentBlock' ? 15 : 3600; // 15s for blocks, 1h for others
      await cacheManager.set(cacheKey, data, ttl);
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Ethereum RPC error:', error);
    res.status(500).json({ error: 'Failed to fetch ethereum data' });
  }
});

// ================= STABLECOIN API ENDPOINTS =================

// Aave collateral usage
app.get('/api/aave/collateral/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `aave-collateral-${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await stablecoinFetcher.getAaveCollateralUsage(tokenAddress);
      await cacheManager.set(cacheKey, data, 900); // 15 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Aave collateral error:', error);
    res.status(500).json({ error: 'Failed to fetch Aave collateral data' });
  }
});

// Morpho collateral usage
app.get('/api/morpho/collateral/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `morpho-collateral-${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await stablecoinFetcher.getMorphoCollateralUsage(tokenAddress);
      await cacheManager.set(cacheKey, data, 900); // 15 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Morpho collateral error:', error);
    res.status(500).json({ error: 'Failed to fetch Morpho collateral data' });
  }
});

// Euler collateral usage
app.get('/api/euler/collateral/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `euler-collateral-${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await stablecoinFetcher.getEulerCollateralUsage(tokenAddress);
      await cacheManager.set(cacheKey, data, 900); // 15 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Euler collateral error:', error);
    res.status(500).json({ error: 'Failed to fetch Euler collateral data' });
  }
});

// Fluid collateral usage
app.get('/api/fluid/collateral/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `fluid-collateral-${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await stablecoinFetcher.getFluidCollateralUsage(tokenAddress);
      await cacheManager.set(cacheKey, data, 900); // 15 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Fluid collateral error:', error);
    res.status(500).json({ error: 'Failed to fetch Fluid collateral data' });
  }
});

// Bridge secured supply
app.get('/api/stablecoin/bridge-supply/:stablecoinSymbol', async (req, res) => {
  try {
    const { stablecoinSymbol } = req.params;
    const cacheKey = `bridge-supply-${stablecoinSymbol}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await stablecoinFetcher.getBridgeSecuredSupply(stablecoinSymbol);
      await cacheManager.set(cacheKey, data, 1800); // 30 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Bridge supply error:', error);
    res.status(500).json({ error: 'Failed to fetch bridge supply data' });
  }
});

// Insurance fund data
app.get('/api/stablecoin/insurance-fund/:stablecoinSymbol', async (req, res) => {
  try {
    const { stablecoinSymbol } = req.params;
    const cacheKey = `insurance-fund-${stablecoinSymbol}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await stablecoinFetcher.getInsuranceFund(stablecoinSymbol);
      await cacheManager.set(cacheKey, data, 3600); // 1 hour
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Insurance fund error:', error);
    res.status(500).json({ error: 'Failed to fetch insurance fund data' });
  }
});

// Collateralization ratio
app.get('/api/stablecoin/collateralization-ratio/:stablecoinSymbol', async (req, res) => {
  try {
    const { stablecoinSymbol } = req.params;
    const cacheKey = `collateralization-ratio-${stablecoinSymbol}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await stablecoinFetcher.getCollateralizationRatio(stablecoinSymbol);
      await cacheManager.set(cacheKey, data, 900); // 15 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Collateralization ratio error:', error);
    res.status(500).json({ error: 'Failed to fetch collateralization ratio data' });
  }
});

// Staking data
app.get('/api/stablecoin/staking/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const { stakingContracts } = req.query;
    const contractsArray = stakingContracts ? stakingContracts.split(',') : [];
    const cacheKey = `staking-data-${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await stablecoinFetcher.getStakingData(tokenAddress, contractsArray);
      await cacheManager.set(cacheKey, data, 900); // 15 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Staking data error:', error);
    res.status(500).json({ error: 'Failed to fetch staking data' });
  }
});

// ================= PENDLE ENDPOINTS =================

// Get all Pendle markets
app.get('/api/pendle/all-markets', async (req, res) => {
  try {
    const cacheKey = 'pendle:all-markets';
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await pendleFetcher.fetchAllMarkets();
      await cacheManager.set(cacheKey, data, 3600); // 1 hour cache
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Pendle all markets error:', error);
    res.status(500).json({ error: 'Failed to fetch Pendle markets' });
  }
});

// Get PT token addresses for a stablecoin
app.get('/api/pendle/pt-tokens/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `pendle:pt-tokens:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      // Get all markets from cache
      const allMarkets = await cacheManager.get('pendle:all-markets');
      if (!allMarkets) {
        const freshMarkets = await pendleFetcher.fetchAllMarkets();
        await cacheManager.set('pendle:all-markets', freshMarkets, 3600);
        data = pendleFetcher.getPTTokensForStablecoin([tokenAddress], freshMarkets);
      } else {
        data = pendleFetcher.getPTTokensForStablecoin([tokenAddress], allMarkets);
      }
      await cacheManager.set(cacheKey, data, 1800); // 30 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Pendle PT tokens error:', error);
    res.status(500).json({ error: 'Failed to fetch PT tokens' });
  }
});

// Pendle queue status monitoring endpoint
app.get('/api/pendle/queue-status', async (req, res) => {
  try {
    const queueStatus = pendleFetcher.getQueueStatus();
    const healthCheck = await pendleFetcher.healthCheck();
    
    res.json({
      service: 'pendle',
      ...queueStatus,
      health: healthCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Pendle queue status error:', error);
    res.status(500).json({ error: 'Failed to get Pendle queue status' });
  }
});

// ================= LENDING PROTOCOL ENDPOINTS =================

// Aave V3 reserve data
app.get('/api/lending/aave-v3/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `aave-v3-reserve-${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      const graphData = await theGraphFetcher.fetchData('aave_v3', 'lending_reserves', { tokenAddress });
      const reserves = graphData?.data?.markets || [];
      
      data = {
        protocol: 'aave_v3',
        tokenAddress,
        markets: reserves,
        totalTVL: reserves.reduce((sum, market) => sum + (Number(market.totalValueLockedUSD) || 0), 0),
        totalDeposits: reserves.reduce((sum, market) => sum + (Number(market.totalDepositBalanceUSD) || 0), 0),
        totalBorrows: reserves.reduce((sum, market) => sum + (Number(market.totalBorrowBalanceUSD) || 0), 0),
        fetched_at: new Date().toISOString()
      };
      await cacheManager.set(cacheKey, data, 900); // 15 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Aave V3 data error:', error);
    res.status(500).json({ error: 'Failed to fetch Aave V3 data' });
  }
});

// Unified Morpho market data using official API
app.get('/api/lending/morpho/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `morpho-unified-${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await morphoFetcher.getTokenMarkets(tokenAddress);
      await cacheManager.set(cacheKey, data, 900); // 15 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Morpho unified data error:', error);
    res.status(500).json({ error: 'Failed to fetch Morpho data' });
  }
});

// Euler market data - Updated for Euler V2 subgraph
app.get('/api/lending/euler/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `euler-market-${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      // Step 1: Get vault creation data for the token
      const graphData = await theGraphFetcher.fetchData('euler', 'lending_markets', { tokenAddress });
      const vaultCreations = graphData?.data?.evaultCreateds || [];
      
      let totalTVL = 0;
      let totalSupply = 0;
      let totalBorrows = 0;
      const markets = [];
      
      if (vaultCreations.length > 0) {
        logger.info(`Found ${vaultCreations.length} USR vaults, fetching cash balances directly from contracts`);
        
        // Step 2: Get cash balances directly from dToken contracts on-chain (more reliable than subgraph matching)
        for (const vault of vaultCreations) {
          let vaultTVL = 0;
          let vaultSupply = 0;
          let vaultBorrows = 0;
          let hasActivity = false;
          
          try {
            // Get vault data directly from blockchain using our new on-chain method
            const vaultData = await ethereumFetcher.getEulerVaultData(vault.dToken);
            
            if (vaultData && !vaultData.error) {
              vaultSupply = vaultData.totalAssetsUSD;  // Total assets (deposits)
              vaultBorrows = vaultData.borrowsUSD;     // Total borrows
              vaultTVL = vaultData.tvlUSD;             // TVL = total assets for lending
              hasActivity = vaultData.hasActivity;
              
              logger.info(`Euler vault ${vault.dToken.slice(0, 8)}: eVault=${vaultData.eVaultAddress}, TotalAssets=${vaultSupply.toFixed(6)}, Borrows=${vaultBorrows.toFixed(6)}, TVL=${vaultTVL.toFixed(6)} USD`);
            } else {
              logger.warn(`Could not fetch on-chain data for vault ${vault.dToken.slice(0, 8)}: ${vaultData?.error || 'Unknown error'}`);
            }
          } catch (vaultError) {
            logger.warn(`Error fetching on-chain data for vault ${vault.dToken}:`, vaultError.message);
          }
          
          const market = {
            id: vault.id,
            name: `Euler Vault ${vault.dToken.slice(0, 8)}...`,
            asset: vault.asset,
            dToken: vault.dToken,
            creator: vault.creator,
            createdAt: vault.blockTimestamp,
            totalValueLockedUSD: vaultTVL,
            totalDepositBalanceUSD: vaultSupply,
            totalBorrowBalanceUSD: vaultBorrows,
            isActive: true,
            decimals: 18,
            hasActivity,
            statusFound: hasActivity
          };
          
          markets.push(market);
          totalTVL += market.totalValueLockedUSD;
          totalSupply += market.totalDepositBalanceUSD;
          totalBorrows += market.totalBorrowBalanceUSD;
        }
      }
      
      data = {
        protocol: 'euler',
        tokenAddress,
        markets,
        totalTVL,
        totalSupply,
        totalBorrows,
        vaultCount: vaultCreations.length,
        activeVaults: markets.filter(m => m.hasActivity).length,
        inactiveVaults: markets.filter(m => !m.hasActivity).length,
        note: vaultCreations.length > 0 && totalTVL === 0 ? 'Vaults exist but have no deposits yet' : null,
        fetched_at: new Date().toISOString()
      };
      
      await cacheManager.set(cacheKey, data, 900); // 15 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Euler data error:', error);
    res.status(500).json({ error: 'Failed to fetch Euler data' });
  }
});

// Combined lending TVL for a token with Pendle PT support
app.get('/api/lending/total-tvl/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    // Support multiple token addresses via query param (for staked versions)
    const additionalAddresses = req.query.additionalAddresses 
      ? req.query.additionalAddresses.split(',').map(addr => addr.trim())
      : [];
    
    const allTokenAddresses = [tokenAddress, ...additionalAddresses];
    const cacheKey = `total-lending-tvl-${allTokenAddresses.sort().join('-')}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      logger.info(`Fetching enhanced lending TVL for ${allTokenAddresses.length} addresses: ${allTokenAddresses.join(', ')}`);
      
      // Step 1: Get Pendle markets and extract PT tokens for ALL stablecoin addresses
      const allMarkets = await cacheManager.get('pendle:all-markets') || await pendleFetcher.fetchAllMarkets();
      const pendlePTData = pendleFetcher.getPTTokensForStablecoin(allTokenAddresses, allMarkets);
      const ptAddresses = pendlePTData.ptAddresses || [];
      
      logger.info(`Found ${ptAddresses.length} PT tokens for ${allTokenAddresses.join(', ')}`);
      
      // Step 2: Fetch direct lending data for base tokens
      const [aaveData, morphoData, eulerData, fluidData] = await Promise.all([
        Promise.all(allTokenAddresses.map(addr => 
          theGraphFetcher.fetchData('aave_v3', 'lending_reserves', { tokenAddress: addr })
        )),
        Promise.all(allTokenAddresses.map(addr => 
          morphoFetcher.getTokenMarkets(addr)
        )),
        Promise.all(allTokenAddresses.map(addr => 
          theGraphFetcher.fetchData('euler', 'lending_markets', { tokenAddress: addr })
        )),
        Promise.all(allTokenAddresses.map(addr => 
          fluidFetcher.fetchData('token_borrow', { tokenAddress: addr })
        ))
      ]);
      
      // Step 3: Fetch lending data for PT tokens (if any found)
      let aavePTData = [];
      let morphoPTData = [];
      let eulerPTData = [];
      let fluidPTData = [];
      
      if (ptAddresses.length > 0) {
        logger.info(`Querying lending protocols for ${ptAddresses.length} PT tokens...`);
        [aavePTData, morphoPTData, eulerPTData, fluidPTData] = await Promise.all([
          Promise.all(ptAddresses.map(addr => 
            theGraphFetcher.fetchData('aave_v3', 'lending_reserves', { tokenAddress: addr })
          )),
          Promise.all(ptAddresses.map(addr => 
            morphoFetcher.getTokenMarkets(addr)
          )),
          Promise.all(ptAddresses.map(addr => 
            theGraphFetcher.fetchData('euler', 'lending_markets', { tokenAddress: addr })
          )),
          Promise.all(ptAddresses.map(addr => 
            fluidFetcher.fetchData('token_borrow', { tokenAddress: addr })
          ))
        ]);
      }
      
      // Step 4: Aggregate Aave TVL (direct + PT)
      const aaveDirectMarkets = aaveData.flatMap(d => d?.data?.markets || []);
      const aavePTMarkets = aavePTData.flatMap(d => d?.data?.markets || []);
      const aaveDirectTVL = aaveDirectMarkets.reduce((sum, m) => sum + (Number(m.totalValueLockedUSD) || 0), 0);
      const aavePTTVL = aavePTMarkets.reduce((sum, m) => sum + (Number(m.totalValueLockedUSD) || 0), 0);
      
      // Step 5: Aggregate Morpho TVL (direct + PT)
      const morphoDirectTVL = morphoData.reduce((sum, d) => sum + (d?.totalCollateralTVL || 0), 0);
      const morphoPTTVL = morphoPTData.reduce((sum, d) => sum + (d?.totalCollateralTVL || 0), 0);
      
      // Step 6: Aggregate Euler TVL (direct + PT)
      const eulerDirectMarkets = eulerData.flatMap(d => d?.data?.evaultCreateds || []);
      const eulerPTMarkets = eulerPTData.flatMap(d => d?.data?.evaultCreateds || []);
      
      // For Euler, we need to get on-chain data
      let eulerDirectTVL = 0;
      let eulerPTTVL = 0;
      
      for (const vault of eulerDirectMarkets) {
        try {
          const vaultData = await ethereumFetcher.getEulerVaultData(vault.dToken);
          eulerDirectTVL += vaultData?.tvlUSD || 0;
        } catch (error) {
          logger.warn(`Error fetching Euler vault data:`, error.message);
        }
      }
      
      for (const vault of eulerPTMarkets) {
        try {
          const vaultData = await ethereumFetcher.getEulerVaultData(vault.dToken);
          eulerPTTVL += vaultData?.tvlUSD || 0;
        } catch (error) {
          logger.warn(`Error fetching Euler PT vault data:`, error.message);
        }
      }
      
      // Step 7: Aggregate Fluid TVL (direct + PT)
      const fluidDirectTVL = fluidData.reduce((sum, d) => sum + (Number(d?.data) || 0), 0);
      const fluidPTTVL = fluidPTData.reduce((sum, d) => sum + (Number(d?.data) || 0), 0);
      
      // Step 8: Build response with PT breakdown
      data = {
        tokenAddress,
        allTokenAddresses,
        protocols: {
          aave_v3: {
            totalTVL: aaveDirectTVL + aavePTTVL,
            directTVL: aaveDirectTVL,
            ptTVL: aavePTTVL,
            directMarkets: aaveDirectMarkets.length,
            ptMarkets: aavePTMarkets.length,
            totalDeposits: aaveDirectMarkets.reduce((sum, m) => sum + (Number(m.totalDepositBalanceUSD) || 0), 0),
            totalBorrows: aaveDirectMarkets.reduce((sum, m) => sum + (Number(m.totalBorrowBalanceUSD) || 0), 0)
          },
          morpho_combined: {
            totalTVL: morphoDirectTVL + morphoPTTVL,
            directTVL: morphoDirectTVL,
            ptTVL: morphoPTTVL,
            directMarkets: morphoData.reduce((sum, d) => sum + (d?.marketCount || 0), 0),
            ptMarkets: morphoPTData.reduce((sum, d) => sum + (d?.marketCount || 0), 0),
            totalSupplyTVL: morphoData.reduce((sum, d) => sum + (d?.totalSupplyTVL || 0), 0)
          },
          euler: {
            totalTVL: eulerDirectTVL + eulerPTTVL,
            directTVL: eulerDirectTVL,
            ptTVL: eulerPTTVL,
            directMarkets: eulerDirectMarkets.length,
            ptMarkets: eulerPTMarkets.length
          },
          fluid: {
            totalTVL: fluidDirectTVL + fluidPTTVL,
            directTVL: fluidDirectTVL,
            ptTVL: fluidPTTVL,
            directMarkets: allTokenAddresses.length,
            ptMarkets: ptAddresses.length
          }
        },
        pendle: {
          ptTokensFound: ptAddresses.length,
          ptDetails: pendlePTData.ptDetails || [],
          marketsMatched: pendlePTData.marketCount || 0
        },
        totalLendingTVL: 0,
        lastUpdated: new Date().toISOString()
      };
      
      // Calculate total TVL (direct + PT for all protocols)
      data.totalLendingTVL = 
        (data.protocols.aave_v3.totalTVL || 0) +
        (data.protocols.morpho_combined.totalTVL || 0) +
        (data.protocols.euler.totalTVL || 0) +
        (data.protocols.fluid.totalTVL || 0);
      
      logger.info(`Total lending TVL for ${tokenAddress}:`, {
        total: data.totalLendingTVL,
        aave: data.protocols.aave_v3.totalTVL,
        morpho: data.protocols.morpho_combined.totalTVL,
        euler: data.protocols.euler.totalTVL,
        fluid: data.protocols.fluid.totalTVL,
        ptTokensFound: ptAddresses.length
      });
      
      await cacheManager.set(cacheKey, data, 900); // 15 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Total lending TVL error:', error);
    res.status(500).json({ error: 'Failed to fetch total lending TVL' });
  }
});

// Total supply endpoint (reuse existing Ethereum endpoint but with alias)
app.get('/api/ethereum/token-total-supply/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const cacheKey = `ethereum:total-supply:${tokenAddress}`;
    
    let data = await cacheManager.get(cacheKey);
    if (!data) {
      data = await ethereumFetcher.getTotalSupplyFormatted(tokenAddress);
      await cacheManager.set(cacheKey, data, 1800); // 30 minutes
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Token total supply error:', error);
    res.status(500).json({ error: 'Failed to fetch token total supply' });
  }
});

// ================= MANUAL DATA ENDPOINTS =================
// For operator-entered data like Bridge Supply and CR

// Simple API key for operator access
const OPERATOR_API_KEY = process.env.OPERATOR_API_KEY || 'operator-key-change-in-production';

// Debug endpoint to check what API key is loaded (remove in production!)
app.get('/api/debug/operator-key-check', (req, res) => {
  res.json({
    keyIsSet: !!process.env.OPERATOR_API_KEY,
    keyPrefix: OPERATOR_API_KEY ? OPERATOR_API_KEY.substring(0, 3) + '***' : 'not set',
    usingDefault: OPERATOR_API_KEY === 'operator-key-change-in-production'
  });
});

// Middleware to check operator authentication
function requireOperator(req, res, next) {
  const apiKey = req.headers['x-operator-key'] || req.query.apiKey;
  
  if (apiKey === OPERATOR_API_KEY) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized - Invalid operator key' });
  }
}

// GET /api/manual-data/:symbol/:metric - Public endpoint to retrieve manual data
app.get('/api/manual-data/:symbol/:metric', async (req, res) => {
  try {
    const { symbol, metric } = req.params;
    const key = `manual:${symbol.toLowerCase()}:${metric}`;
    
    const data = await redis.get(key);
    
    if (data) {
      const parsed = JSON.parse(data);
      res.json({
        success: true,
        data: parsed.value,
        metadata: {
          symbol,
          metric,
          lastUpdated: parsed.lastUpdated,
          updatedBy: parsed.updatedBy || 'operator',
          source: 'manual_entry'
        }
      });
    } else {
      res.json({
        success: true,
        data: null,
        metadata: {
          symbol,
          metric,
          message: 'No manual data available'
        }
      });
    }
  } catch (error) {
    logger.error('Error retrieving manual data:', error);
    res.status(500).json({ error: 'Failed to retrieve manual data' });
  }
});

// GET /api/manual-data/:symbol - Public endpoint to retrieve all manual data for a stablecoin
app.get('/api/manual-data/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const pattern = `manual:${symbol.toLowerCase()}:*`;
    
    const keys = await redis.keys(pattern);
    const allData = {};
    
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        const metric = key.split(':')[2]; // Extract metric from key
        allData[metric] = {
          value: parsed.value,
          lastUpdated: parsed.lastUpdated,
          updatedBy: parsed.updatedBy || 'operator'
        };
      }
    }
    
    res.json({
      success: true,
      symbol,
      data: allData,
      source: 'manual_entry'
    });
  } catch (error) {
    logger.error('Error retrieving manual data:', error);
    res.status(500).json({ error: 'Failed to retrieve manual data' });
  }
});

// POST /api/manual-data/:symbol/:metric - Operator endpoint to save manual data
app.post('/api/manual-data/:symbol/:metric', requireOperator, async (req, res) => {
  try {
    const { symbol, metric } = req.params;
    const { value, notes } = req.body;
    
    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'Value is required' });
    }
    
    // Validate metric type
    const allowedMetrics = ['bridgeSupply', 'collateralizationRatio'];
    if (!allowedMetrics.includes(metric)) {
      return res.status(400).json({ 
        error: 'Invalid metric', 
        allowedMetrics 
      });
    }
    
    // Validate value is a number
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return res.status(400).json({ error: 'Value must be a number' });
    }
    
    const key = `manual:${symbol.toLowerCase()}:${metric}`;
    const data = {
      value: numValue,
      lastUpdated: new Date().toISOString(),
      updatedBy: req.headers['x-operator-name'] || 'operator',
      notes: notes || ''
    };
    
    // Store in Redis with no expiration (manual data persists)
    await redis.set(key, JSON.stringify(data));
    
    logger.info(`Manual data updated: ${key} = ${numValue}`);
    
    res.json({
      success: true,
      message: 'Data saved successfully',
      data: {
        symbol,
        metric,
        value: numValue,
        lastUpdated: data.lastUpdated
      }
    });
  } catch (error) {
    logger.error('Error saving manual data:', error);
    res.status(500).json({ error: 'Failed to save manual data' });
  }
});

// DELETE /api/manual-data/:symbol/:metric - Operator endpoint to delete manual data
app.delete('/api/manual-data/:symbol/:metric', requireOperator, async (req, res) => {
  try {
    const { symbol, metric } = req.params;
    const key = `manual:${symbol.toLowerCase()}:${metric}`;
    
    const deleted = await redis.del(key);
    
    if (deleted > 0) {
      res.json({
        success: true,
        message: 'Data deleted successfully'
      });
    } else {
      res.status(404).json({ error: 'Data not found' });
    }
  } catch (error) {
    logger.error('Error deleting manual data:', error);
    res.status(500).json({ error: 'Failed to delete manual data' });
  }
});

// POST /api/manual-data/load-defaults - Operator endpoint to load defaults from config file
// This will load default values from manualDefaults.js for any stablecoin/metric that doesn't already have manual data
app.post('/api/manual-data/load-defaults', requireOperator, async (req, res) => {
  try {
    let manualDefaults;
    
    // Try to import the manual defaults config file
    try {
      const defaultsModule = await import('./config/manualDefaults.js');
      manualDefaults = defaultsModule.manualDefaults;
      
      // Validate the defaults
      const validation = defaultsModule.validateDefaults(manualDefaults);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Invalid defaults configuration',
          validationErrors: validation.errors
        });
      }
    } catch (error) {
      logger.warn('Could not load manualDefaults.js, no defaults available:', error.message);
      return res.status(404).json({
        error: 'Manual defaults config file not found or has errors',
        message: 'Please create src/config/manualDefaults.js with default values'
      });
    }
    
    const results = {
      loaded: [],
      skipped: [],
      errors: []
    };
    
    const allowedMetrics = ['bridgeSupply', 'collateralizationRatio'];
    
    // Process each stablecoin in the defaults
    for (const [symbol, metrics] of Object.entries(manualDefaults)) {
      for (const metric of allowedMetrics) {
        if (metrics[metric] !== undefined) {
          const key = `manual:${symbol.toLowerCase()}:${metric}`;
          
          // Check if manual data already exists
          const existing = await redis.get(key);
          
          if (existing) {
            // Skip if manual entry already exists
            results.skipped.push({
              symbol,
              metric,
              reason: 'Manual entry already exists'
            });
          } else {
            // Load the default value
            try {
              const data = {
                value: metrics[metric],
                lastUpdated: new Date().toISOString(),
                updatedBy: 'defaults-config',
                notes: 'Loaded from manualDefaults.js',
                isDefault: true
              };
              
              await redis.set(key, JSON.stringify(data));
              
              results.loaded.push({
                symbol,
                metric,
                value: metrics[metric]
              });
              
              logger.info(`Loaded default for ${symbol}.${metric} = ${metrics[metric]}`);
            } catch (error) {
              results.errors.push({
                symbol,
                metric,
                error: error.message
              });
            }
          }
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Defaults loading completed',
      results: {
        loaded: results.loaded.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
        details: results
      }
    });
    
  } catch (error) {
    logger.error('Error loading default manual data:', error);
    res.status(500).json({ error: 'Failed to load defaults' });
  }
});

// GET /api/manual-data/defaults-status - Public endpoint to check which defaults are configured
app.get('/api/manual-data/defaults-status', async (req, res) => {
  try {
    let manualDefaults;
    
    // Try to import the manual defaults config file
    try {
      const defaultsModule = await import('./config/manualDefaults.js');
      manualDefaults = defaultsModule.manualDefaults;
    } catch (error) {
      return res.json({
        success: true,
        configured: false,
        message: 'No defaults config file found'
      });
    }
    
    const status = {};
    
    for (const [symbol, metrics] of Object.entries(manualDefaults)) {
      status[symbol] = {};
      
      for (const metric of ['bridgeSupply', 'collateralizationRatio']) {
        if (metrics[metric] !== undefined) {
          const key = `manual:${symbol.toLowerCase()}:${metric}`;
          const existing = await redis.get(key);
          
          if (existing) {
            const parsed = JSON.parse(existing);
            status[symbol][metric] = {
              hasDefault: true,
              defaultValue: metrics[metric],
              currentValue: parsed.value,
              isUsingDefault: parsed.isDefault === true,
              source: parsed.isDefault ? 'default' : 'manual_entry'
            };
          } else {
            status[symbol][metric] = {
              hasDefault: true,
              defaultValue: metrics[metric],
              currentValue: null,
              isUsingDefault: false,
              source: 'not_loaded'
            };
          }
        }
      }
    }
    
    res.json({
      success: true,
      configured: true,
      status
    });
    
  } catch (error) {
    logger.error('Error checking defaults status:', error);
    res.status(500).json({ error: 'Failed to check defaults status' });
  }
});

// Simplified data refresh function aligned with dashboard protocols
async function refreshAllData() {
  logger.info('Starting scheduled data refresh...');
  
  try {
    // Stablecoins for refresh - matching the StablecoinDashboard configuration
    const coreStablecoins = [
      { coingeckoIds: ['dai', 'usds'], symbol: 'USDS_DAI' }, // Include both DAI and USDS
      { coingeckoIds: ['ethena-usde'], symbol: 'USDe' },
      { coingeckoIds: ['resolv-usr'], symbol: 'USR' },
      { coingeckoIds: ['elixir-deusd'], symbol: 'deUSD' },
      { coingeckoIds: ['crvusd'], symbol: 'crvUSD' },
      { coingeckoIds: ['openeden-open-dollar'], symbol: 'USDO' },
      { coingeckoIds: ['f-x-protocol-fxusd'], symbol: 'fxUSD' },
      { coingeckoIds: ['resupply-usd'], symbol: 'reUSD' }
    ];


    // Stablecoin refresh - market data for each CoinGecko ID
    const stablecoinRefreshPromises = coreStablecoins.flatMap(stablecoin => 
      stablecoin.coingeckoIds.map(coingeckoId => 
        (async () => {
          try {
            const marketData = await coinGeckoFetcher.fetchCoinData(coingeckoId);
            await cacheManager.setWithSmartTTL(`coingecko:market-data:${coingeckoId}`, marketData, 'market-data');
            logger.info(`Light refresh stablecoin: ${coingeckoId} (${stablecoin.symbol})`);
          } catch (error) {
            logger.error(`Light refresh failed for stablecoin ${coingeckoId}:`, error);
          }
        })()
      )
    );

    // Execute all refresh operations in parallel
    await Promise.allSettled([...stablecoinRefreshPromises]);
    
    // Clean up expired cache entries
    await cacheManager.cleanup();
    
    // Update last refresh timestamp
    lastRefreshTimestamp = new Date().toISOString();
    
    logger.info(`Scheduled data refresh completed at ${lastRefreshTimestamp}`);
  } catch (error) {
    logger.error('Error during data refresh:', error);
  }
}

// Initialize server
async function startServer() {
  try {
    logger.info('Starting cache service...');
    logger.info(`Environment: NODE_ENV=${process.env.NODE_ENV}`);
    logger.info(`Port: ${PORT}`);
    
    // Try to connect to Redis (but don't fail if it's not available)
    try {
      logger.info('Connecting to Redis...');
      await redis.connect();
      logger.info('Redis connection successful');
      cacheManager = new CacheManager(redis);
      
      // Initialize stablecoin fetcher with Redis connection
      stablecoinFetcher = new StablecoinFetcher(logger, redis);
    } catch (redisError) {
      logger.warn('Redis connection failed - service will run without caching:', redisError.message);
      logger.warn('This may result in slower response times and higher API usage');
      // Set cacheManager to null - endpoints will handle this gracefully
      cacheManager = null;
      stablecoinFetcher = null;
    }
    
    // Schedule data refresh every hour as requested (only if Redis is available)
    if (cacheManager) {
      cron.schedule('0 * * * *', refreshAllData);
      
      // Initial data refresh
      setTimeout(async () => {
        logger.info('Starting initial data refresh...');
        await refreshAllData();
      }, 5000); // 5 seconds after startup
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Cache service running on port ${PORT} (all interfaces)`);
      logger.info('Service fully initialized and ready to accept requests');
      logger.info(`Redis caching: ${cacheManager ? 'ENABLED' : 'DISABLED'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    logger.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (redis.isOpen) {
    await redis.quit();
  }
  process.exit(0);
});

startServer(); 