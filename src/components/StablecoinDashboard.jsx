import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  Badge,
  Skeleton,
  Container,
  HStack,
  VStack,
  Tooltip,
  useColorModeValue,
  Alert,
  AlertTitle,
  AlertDescription,
  Icon,
  Link,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  useDisclosure,
  Flex
} from '@chakra-ui/react';

import { AlertIcon, TriangleUpIcon, TriangleDownIcon, ExternalLinkIcon, InfoIcon, DownloadIcon } from '@chakra-ui/icons';
import { useState, useEffect, useMemo } from 'react';

import { 
  stablecoins, 
  metricsStructure, 
  formatStablecoinAmount, 
  formatPercentage, 
  formatRatio 
} from '../config/stablecoins.js';

import {
  useStablecoinCompleteMetrics,
  useCurveTVL,
  useBalancerTVL,
  useUniswapTotalTVL,
  useSushiTotalTVL
} from '../hooks/index.js';

import DataSourceBadge from './DataSourceBadge.jsx';
import { exportStablecoinMetricsToCSV, exportDetailedStablecoinMetricsToCSV } from '../utils/stablecoinCsvExport.js';

// ================= STABLECOIN ROW COMPONENT =================

function StablecoinRow({ stablecoin, shouldLoad }) {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  
  // Get all metrics for this stablecoin
  const metrics = useStablecoinCompleteMetrics(stablecoin, { enabled: shouldLoad });
  
  if (!shouldLoad) {
    return (
      <Tr>
        <Td 
          position="sticky"
          left={0}
          bg={bgColor}
          borderRight="2px solid"
          borderRightColor={borderColor}
          zIndex={2}
          boxShadow="2px 0 4px rgba(0,0,0,0.1)"
        >
          <Skeleton height="20px" />
        </Td>
        {/* Render skeleton cells for all columns */}
        {Array.from({ length: 20 }).map((_, index) => (
          <Td key={index}>
            <Skeleton height="20px" />
          </Td>
        ))}
      </Tr>
    );
  }

  return (
    <Tr>
      {/* Stablecoin Name (Sticky) */}
      <Td 
        position="sticky"
        left={0}
        bg={bgColor}
        borderRight="2px solid"
        borderRightColor={borderColor}
        zIndex={2}
        boxShadow="2px 0 4px rgba(0,0,0,0.1)"
        minW={{ base: "120px", sm: "150px", md: "180px" }}
        maxW={{ base: "120px", sm: "150px", md: "180px" }}
      >
        <VStack spacing={1} align="start">
          <Text fontWeight="bold" fontSize="sm">
            {stablecoin.name}
          </Text>
          <Badge 
            size="sm" 
            colorScheme={
              stablecoin.category === 'maker_ecosystem' ? 'orange' :
              stablecoin.category === 'synthetic' ? 'purple' :
              stablecoin.category === 'curve_ecosystem' ? 'red' :
              'blue'
            }
          >
            {stablecoin.category.replace('_', ' ')}
          </Badge>
        </VStack>
      </Td>

      {/* Supply Metrics */}
      <Td textAlign="center">
        {metrics.totalSupply?.isLoading ? (
          <Skeleton height="20px" />
        ) : (
          <Text fontSize="sm">
            {formatStablecoinAmount(metrics.totalSupply?.data?.data || 0)}
          </Text>
        )}
      </Td>

      <Td textAlign="center">
        {metrics.bridgeSupply?.isLoading ? (
          <Skeleton height="20px" />
        ) : (
          <Text fontSize="sm" color="gray.500">
            {metrics.bridgeSupply?.data?._placeholder ? 'N/A' : formatStablecoinAmount(metrics.bridgeSupply?.data?.data || 0)}
          </Text>
        )}
      </Td>

      <Td textAlign="center">
        {metrics.mainnetSupply?.isLoading ? (
          <Skeleton height="20px" />
        ) : (
          <Text fontSize="sm">
            {formatStablecoinAmount(metrics.mainnetSupply?.data?.data || 0)}
          </Text>
        )}
      </Td>

      <Td textAlign="center">
        <Text fontSize="sm" color="gray.500">
          N/A
        </Text>
      </Td>

      {/* Mainnet Liquidity */}
      <Td textAlign="center">
        {metrics.curveTVL?.isLoading ? (
          <Skeleton height="20px" />
        ) : (
          <Text fontSize="sm">
            {formatStablecoinAmount(metrics.curveTVL?.data?.data || 0)}
          </Text>
        )}
      </Td>

      <Td textAlign="center">
        {metrics.balancerTVL?.isLoading ? (
          <Skeleton height="20px" />
        ) : (
          <Text fontSize="sm">
            {formatStablecoinAmount(metrics.balancerTVL?.data?.data || 0)}
          </Text>
        )}
      </Td>

      <Td textAlign="center">
        {metrics.uniswapTVL?.isLoading ? (
          <Skeleton height="20px" />
        ) : (
          <Text fontSize="sm">
            {formatStablecoinAmount(metrics.uniswapTVL?.data?.data || 0)}
          </Text>
        )}
      </Td>

      <Td textAlign="center">
        {metrics.sushiTVL?.isLoading ? (
          <Skeleton height="20px" />
        ) : (
          <Text fontSize="sm">
            {formatStablecoinAmount(metrics.sushiTVL?.data?.data || 0)}
          </Text>
        )}
      </Td>

      <Td textAlign="center" fontWeight="bold" color="blue.600">
        {metrics.totalMainnetLiquidity?.isLoading ? (
          <Skeleton height="20px" />
        ) : (
          <Text fontSize="sm">
            {formatStablecoinAmount(metrics.totalMainnetLiquidity?.data || 0)}
          </Text>
        )}
      </Td>

      {/* Competitor Markets */}
      <Td textAlign="center">
        <Text fontSize="sm" color="gray.500">
          N/A
        </Text>
      </Td>

      <Td textAlign="center">
        <Text fontSize="sm" color="gray.500">
          N/A
        </Text>
      </Td>

      <Td textAlign="center">
        <Text fontSize="sm" color="gray.500">
          N/A
        </Text>
      </Td>

      <Td textAlign="center">
        <Text fontSize="sm" color="gray.500">
          N/A
        </Text>
      </Td>

      <Td textAlign="center" fontWeight="bold" color="purple.600">
        <Text fontSize="sm" color="gray.500">
          N/A
        </Text>
      </Td>

      {/* Safety Buffer */}
      <Td textAlign="center">
        {metrics.insuranceFund?.isLoading ? (
          <Skeleton height="20px" />
        ) : (
          <Text fontSize="sm" color="gray.500">
            {metrics.insuranceFund?.data?._unavailable ? 'N/A' : formatStablecoinAmount(metrics.insuranceFund?.data?.data || 0)}
          </Text>
        )}
      </Td>

      <Td textAlign="center">
        {metrics.collateralizationRatio?.isLoading ? (
          <Skeleton height="20px" />
        ) : (
          <Text fontSize="sm" color="gray.500">
            {metrics.collateralizationRatio?.data?._unavailable ? 'N/A' : formatRatio(metrics.collateralizationRatio?.data?.data || 0)}
          </Text>
        )}
      </Td>

      <Td textAlign="center">
        {metrics.stakedSupply?.isLoading ? (
          <Skeleton height="20px" />
        ) : (
          <Text fontSize="sm" color="gray.500">
            {metrics.stakedSupply?.data?._unavailable ? 'N/A' : formatStablecoinAmount(metrics.stakedSupply?.data?.data || 0)}
          </Text>
        )}
      </Td>

      <Td textAlign="center">
        {metrics.supplyOnMainnetPercent?.isLoading ? (
          <Skeleton height="20px" />
        ) : (
          <Text fontSize="sm">
            {formatPercentage(metrics.supplyOnMainnetPercent?.data || 0)}
          </Text>
        )}
      </Td>

      <Td textAlign="center">
        <Text fontSize="sm" color="gray.500">
          N/A
        </Text>
      </Td>
    </Tr>
  );
}

// ================= MAIN STABLECOIN DASHBOARD COMPONENT =================

export default function StablecoinDashboard() {
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const tableHeaderBg = useColorModeValue('gray.100', 'gray.700');
  
  const [loadedStablecoins, setLoadedStablecoins] = useState(new Set());
  const [allMetricsData, setAllMetricsData] = useState({});

  useEffect(() => {
    // Load stablecoins one by one with short delays
    const loadStablecoinsSequentially = async () => {
      for (let i = 0; i < stablecoins.length; i++) {
        setLoadedStablecoins(prev => new Set([...prev, i]));
        if (i < stablecoins.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay
        }
      }
    };

    loadStablecoinsSequentially();
  }, []);

  // Collect all metrics data for CSV export
  useEffect(() => {
    const collectMetricsData = () => {
      const metricsData = {};
      stablecoins.forEach((stablecoin, index) => {
        if (loadedStablecoins.has(index)) {
          metricsData[index] = useStablecoinCompleteMetrics(stablecoin, { enabled: true });
        }
      });
      setAllMetricsData(metricsData);
    };

    if (loadedStablecoins.size > 0) {
      collectMetricsData();
    }
  }, [loadedStablecoins]);

  // Export to CSV handlers
  const handleExportCSV = () => {
    try {
      const metricsArray = stablecoins.map((_, index) => allMetricsData[index] || {});
      exportStablecoinMetricsToCSV(stablecoins, metricsArray);
    } catch (error) {
      console.error('CSV export failed:', error);
      alert('CSV export failed. Please try again.');
    }
  };

  const handleExportDetailedCSV = () => {
    try {
      const metricsArray = stablecoins.map((_, index) => allMetricsData[index] || {});
      exportDetailedStablecoinMetricsToCSV(stablecoins, metricsArray);
    } catch (error) {
      console.error('Detailed CSV export failed:', error);
      alert('Detailed CSV export failed. Please try again.');
    }
  };

  return (
    <Box 
      display="flex" 
      flexDirection="column" 
      h={{ 
        base: "calc(100vh - 145px)",
        sm: "calc(100vh - 145px)",
        md: "calc(100vh - 145px)"
      }}
      w="100vw"
      maxW="100vw"
      py={{ base: 1, sm: 2, md: 3 }}
      px={{ base: 1, sm: 2, md: 3 }}
    >
      {/* Export Buttons */}
      <Flex 
        justify="flex-end" 
        align="center" 
        mb={2}
        px={2}
        gap={2}
      >
        <Button
          leftIcon={<DownloadIcon />}
          colorScheme="blue"
          size="sm"
          onClick={handleExportCSV}
          _hover={{ bg: 'blue.600' }}
        >
          Export to CSV
        </Button>
        <Button
          leftIcon={<DownloadIcon />}
          colorScheme="purple"
          size="sm"
          onClick={handleExportDetailedCSV}
          _hover={{ bg: 'purple.600' }}
        >
          Detailed Export
        </Button>
      </Flex>

      <Box 
        flex="1"
        overflowX="auto" 
        overflowY="auto"
        border="1px solid" 
        borderColor={useColorModeValue('gray.200', 'gray.600')}
        borderRadius="md"
        position="relative"
        w="100%"
        maxW="100%"
      >
        <Table 
          size={{ base: "xs", sm: "sm" }} 
          variant="simple"
          w="100%"
          sx={{ 
            '& td:first-child, & th:first-child': { position: 'sticky !important', left: 0 },
            tableLayout: 'auto',
            width: '100%',
            minWidth: '100%',
            borderSpacing: 0,
            borderCollapse: 'collapse'
          }}
        >
          <Thead bg={tableHeaderBg} position="sticky" top={0} zIndex={3}>
            <Tr>
              {/* Stablecoin Name (Sticky) */}
              <Th 
                fontSize="xs"
                textAlign="center"
                position="sticky"
                left={0}
                bg={tableHeaderBg}
                zIndex={4}
                borderRight="2px solid"
                borderRightColor={useColorModeValue('gray.300', 'gray.600')}
                boxShadow="2px 0 4px rgba(0,0,0,0.1)"
                minW={{ base: "120px", sm: "150px", md: "180px" }}
                maxW={{ base: "120px", sm: "150px", md: "180px" }}
              >
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2}>Stablecoin</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Config" />
                  </Box>
                </Box>
              </Th>

              {/* Supply Metrics Section */}
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="blue.500" bg="blue.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="blue.600">Total Supply</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Blockchain" />
                  </Box>
                </Box>
              </Th>
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="blue.500" bg="blue.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="blue.600">Supply secured by bridge</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Bridge APIs" />
                  </Box>
                </Box>
              </Th>
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="blue.500" bg="blue.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="blue.600">Mainnet Supply</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Blockchain" />
                  </Box>
                </Box>
              </Th>
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="blue.500" bg="blue.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="blue.600">Excl. lending markets, other networks</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Calculated" />
                  </Box>
                </Box>
              </Th>

              {/* Mainnet Liquidity Section */}
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="green.500" bg="green.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="green.600">Curve</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Curve API" />
                  </Box>
                </Box>
              </Th>
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="green.500" bg="green.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="green.600">Balancer</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Balancer Subgraph" />
                  </Box>
                </Box>
              </Th>
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="green.500" bg="green.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="green.600">Uniswap</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Uniswap Subgraph" />
                  </Box>
                </Box>
              </Th>
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="green.500" bg="green.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="green.600">Sushiswap</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Sushiswap Subgraph" />
                  </Box>
                </Box>
              </Th>
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="green.500" bg="green.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="green.600">Total mainnet liquidity</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Calculated" />
                  </Box>
                </Box>
              </Th>

              {/* Competitor Markets Section */}
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="purple.500" bg="purple.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="purple.600">Aave Collateral</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Aave API" />
                  </Box>
                </Box>
              </Th>
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="purple.500" bg="purple.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="purple.600">Morpho Collateral</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Morpho API" />
                  </Box>
                </Box>
              </Th>
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="purple.500" bg="purple.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="purple.600">Euler Collateral</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Euler API" />
                  </Box>
                </Box>
              </Th>
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="purple.500" bg="purple.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="purple.600">Fluid Collateral</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Fluid API" />
                  </Box>
                </Box>
              </Th>
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="purple.500" bg="purple.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="purple.600">Total lending markets</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Calculated" />
                  </Box>
                </Box>
              </Th>

              {/* Safety Buffer Section */}
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="red.500" bg="red.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="red.600">Insurance Layer/Fund</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Protocol API" />
                  </Box>
                </Box>
              </Th>
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="red.500" bg="red.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="red.600">CR</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Protocol API" />
                  </Box>
                </Box>
              </Th>
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="red.500" bg="red.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="red.600">Staked Supply</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Staking Contracts" />
                  </Box>
                </Box>
              </Th>
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="red.500" bg="red.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="red.600">% Supply on Mainnet</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Calculated" />
                  </Box>
                </Box>
              </Th>
              <Th fontSize="xs" textAlign="center" borderBottom="3px solid" borderBottomColor="red.500" bg="red.50">
                <Box position="relative" h="90px" display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start" pt={2}>
                  <Text mb={2} fontWeight="bold" color="red.600">Factor of Safety</Text>
                  <Box position="absolute" bottom={1}>
                    <DataSourceBadge source="Calculated" />
                  </Box>
                </Box>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {stablecoins.map((stablecoin, index) => (
              <StablecoinRow
                key={stablecoin.symbol}
                stablecoin={stablecoin}
                shouldLoad={loadedStablecoins.has(index)}
              />
            ))}
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
}
