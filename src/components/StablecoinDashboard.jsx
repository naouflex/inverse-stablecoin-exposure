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

// ================= METRIC ROW COMPONENT =================

function MetricRow({ metricKey, metricLabel, sectionColor, allStablecoinMetrics, loadedStablecoins, isLoading }) {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const getMetricValue = (stablecoinIndex, metricKey) => {
    if (!loadedStablecoins.has(stablecoinIndex)) {
      return <Skeleton height="20px" />;
    }

    const metrics = allStablecoinMetrics[stablecoinIndex];
    if (!metrics) {
      return <Text fontSize="sm" color="gray.500">N/A</Text>;
    }

    switch (metricKey) {
      case 'totalSupply':
        return metrics.totalSupply?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm">{formatStablecoinAmount(metrics.totalSupply?.data?.data || 0)}</Text>;
      
      case 'bridgeSupply':
        return metrics.bridgeSupply?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm" color="gray.500">{metrics.bridgeSupply?.data?._placeholder ? 'N/A' : formatStablecoinAmount(metrics.bridgeSupply?.data?.data || 0)}</Text>;
      
      case 'mainnetSupply':
        return metrics.mainnetSupply?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm">{formatStablecoinAmount(metrics.mainnetSupply?.data?.data || 0)}</Text>;
      
      case 'exclLendingOtherNetworks':
        return <Text fontSize="sm" color="gray.500">N/A</Text>;
      
      case 'curveTVL':
        return metrics.curveTVL?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm">{formatStablecoinAmount(metrics.curveTVL?.data?.data || 0)}</Text>;
      
      case 'balancerTVL':
        return metrics.balancerTVL?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm">{formatStablecoinAmount(metrics.balancerTVL?.data?.data || 0)}</Text>;
      
      case 'uniswapTVL':
        return metrics.uniswapTVL?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm">{formatStablecoinAmount(metrics.uniswapTVL?.data?.data || 0)}</Text>;
      
      case 'sushiswapTVL':
        return metrics.sushiTVL?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm">{formatStablecoinAmount(metrics.sushiTVL?.data?.data || 0)}</Text>;
      
      case 'totalMainnetLiquidity':
        return metrics.totalMainnetLiquidity?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm" fontWeight="bold" color="blue.600">{formatStablecoinAmount(metrics.totalMainnetLiquidity?.data || 0)}</Text>;
      
      case 'aaveCollateral':
        return metrics.totalLendingUsage?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm">{formatStablecoinAmount(metrics.totalLendingUsage?.data?.protocols?.aave_v3?.totalTVL || 0)}</Text>;
      
      case 'morphoCollateral':
        return metrics.totalLendingUsage?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm">{formatStablecoinAmount(metrics.totalLendingUsage?.data?.protocols?.morpho_combined?.totalTVL || 0)}</Text>;
      
      case 'eulerCollateral':
        return metrics.totalLendingUsage?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm">{formatStablecoinAmount(metrics.totalLendingUsage?.data?.protocols?.euler?.totalTVL || 0)}</Text>;
      
      case 'fluidCollateral':
        return <Text fontSize="sm" color="gray.500">N/A</Text>; // Not implemented yet
      
      case 'totalLendingMarkets':
        return metrics.totalLendingUsage?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm" fontWeight="bold" color="purple.600">{formatStablecoinAmount(metrics.totalLendingUsage?.data?.totalLendingTVL || 0)}</Text>;
      
      case 'insuranceFund':
        return metrics.insuranceFund?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm" color="gray.500">{metrics.insuranceFund?.data?._unavailable ? 'N/A' : formatStablecoinAmount(metrics.insuranceFund?.data?.data || 0)}</Text>;
      
      case 'collateralizationRatio':
        return metrics.collateralizationRatio?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm" color="gray.500">{metrics.collateralizationRatio?.data?._unavailable ? 'N/A' : formatRatio(metrics.collateralizationRatio?.data?.data || 0)}</Text>;
      
      case 'stakedSupply':
        return metrics.stakedSupply?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm" color="gray.500">{metrics.stakedSupply?.data?._unavailable ? 'N/A' : formatStablecoinAmount(metrics.stakedSupply?.data?.data || 0)}</Text>;
      
      case 'supplyOnMainnetPercent':
        return metrics.supplyOnMainnetPercent?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm">{formatPercentage(metrics.supplyOnMainnetPercent?.data || 0)}</Text>;
      
      case 'factorOfSafety':
        return <Text fontSize="sm" color="gray.500">N/A</Text>;
      
      default:
        return <Text fontSize="sm" color="gray.500">N/A</Text>;
    }
  };

  return (
    <Tr>
      {/* Metric Name (Sticky) */}
      <Td 
        position="sticky"
        left={0}
        bg={bgColor}
        borderRight="2px solid"
        borderRightColor={borderColor}
        zIndex={2}
        boxShadow="2px 0 4px rgba(0,0,0,0.1)"
        minW={{ base: "200px", sm: "250px", md: "300px" }}
        maxW={{ base: "200px", sm: "250px", md: "300px" }}
        borderLeft={`4px solid`}
        borderLeftColor={sectionColor}
      >
        <Text fontSize="sm" fontWeight="medium">
          {metricLabel}
        </Text>
      </Td>

      {/* Values for each stablecoin */}
      {stablecoins.map((stablecoin, index) => (
        <Td key={stablecoin.symbol} textAlign="center" minW="120px">
          {getMetricValue(index, metricKey)}
        </Td>
      ))}
    </Tr>
  );
}

// ================= SECTION HEADER ROW COMPONENT =================

function SectionHeaderRow({ sectionTitle, sectionColor }) {
  const bgColor = useColorModeValue('gray.100', 'gray.700');
  
  return (
    <Tr bg={bgColor}>
      <Td 
        position="sticky"
        left={0}
        bg={bgColor}
        zIndex={2}
        boxShadow="2px 0 4px rgba(0,0,0,0.1)"
        borderLeft={`6px solid`}
        borderLeftColor={sectionColor}
        colSpan={stablecoins.length + 1}
      >
        <Text fontSize="md" fontWeight="bold" color={sectionColor} py={2}>
          {sectionTitle}
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

  // Load all stablecoin metrics at the top level (following Rules of Hooks)
  const allStablecoinMetrics = stablecoins.map((stablecoin, index) => 
    useStablecoinCompleteMetrics(stablecoin, { enabled: loadedStablecoins.has(index) })
  );

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

  // Export to CSV handlers
  const handleExportCSV = () => {
    try {
      exportStablecoinMetricsToCSV(stablecoins, allStablecoinMetrics);
    } catch (error) {
      console.error('CSV export failed:', error);
      alert('CSV export failed. Please try again.');
    }
  };

  const handleExportDetailedCSV = () => {
    try {
      exportDetailedStablecoinMetricsToCSV(stablecoins, allStablecoinMetrics);
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
              {/* Metric Name Column (Sticky) */}
              <Th 
                fontSize="xs"
                textAlign="left"
                position="sticky"
                left={0}
                bg={tableHeaderBg}
                zIndex={4}
                borderRight="2px solid"
                borderRightColor={useColorModeValue('gray.300', 'gray.600')}
                boxShadow="2px 0 4px rgba(0,0,0,0.1)"
                minW={{ base: "200px", sm: "250px", md: "300px" }}
                maxW={{ base: "200px", sm: "250px", md: "300px" }}
              >
                <Box py={2}>
                  <Text fontWeight="bold">Metrics</Text>
                </Box>
              </Th>

              {/* Stablecoin Columns */}
              {stablecoins.map((stablecoin) => (
                <Th 
                  key={stablecoin.symbol}
                  fontSize="xs" 
                  textAlign="center"
                  minW="120px"
                  maxW="140px"
                >
                  <VStack spacing={1} py={2}>
                    <Text fontWeight="bold" fontSize="sm" noOfLines={1}>
                      {stablecoin.name}
                    </Text>
                    <Badge 
                      size="sm" 
                      colorScheme={
                        stablecoin.category === 'sky' ? 'orange' :
                        stablecoin.category === 'ethena' ? 'purple' :
                        stablecoin.category === 'resolv' ? 'red' :
                        stablecoin.category === 'elixir' ? 'green' :
                        stablecoin.category === 'curve' ? 'blue' :
                        stablecoin.category === 'openeden' ? 'cyan' :
                        stablecoin.category === 'fx' ? 'pink' :
                        stablecoin.category === 'reserve' ? 'teal' :
                        'gray'
                      }
                    >
                      {stablecoin.category.replace('_', ' ')}
                    </Badge>
                  </VStack>
                </Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {/* Supply Metrics Section */}
            <SectionHeaderRow sectionTitle="Supply Metrics" sectionColor="blue.500" />
            <MetricRow 
              metricKey="totalSupply" 
              metricLabel="Total Supply" 
              sectionColor="blue.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />
            <MetricRow 
              metricKey="bridgeSupply" 
              metricLabel="Supply secured by bridge" 
              sectionColor="blue.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />
            <MetricRow 
              metricKey="mainnetSupply" 
              metricLabel="Mainnet Supply" 
              sectionColor="blue.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />
            <MetricRow 
              metricKey="exclLendingOtherNetworks" 
              metricLabel="Excl. lending markets, other networks" 
              sectionColor="blue.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />

            {/* Mainnet Liquidity Section */}
            <SectionHeaderRow sectionTitle="Mainnet Liquidity" sectionColor="green.500" />
            <MetricRow 
              metricKey="curveTVL" 
              metricLabel="Curve" 
              sectionColor="green.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />
            <MetricRow 
              metricKey="balancerTVL" 
              metricLabel="Balancer" 
              sectionColor="green.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />
            <MetricRow 
              metricKey="uniswapTVL" 
              metricLabel="Uniswap" 
              sectionColor="green.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />
            <MetricRow 
              metricKey="sushiswapTVL" 
              metricLabel="Sushiswap" 
              sectionColor="green.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />
            <MetricRow 
              metricKey="totalMainnetLiquidity" 
              metricLabel="Total mainnet liquidity" 
              sectionColor="green.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />

            {/* Competitor Markets Section */}
            <SectionHeaderRow sectionTitle="Competitor Markets" sectionColor="purple.500" />
            <MetricRow 
              metricKey="aaveCollateral" 
              metricLabel="Aave Collateral" 
              sectionColor="purple.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />
            <MetricRow 
              metricKey="morphoCollateral" 
              metricLabel="Morpho Collateral" 
              sectionColor="purple.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />
            <MetricRow 
              metricKey="eulerCollateral" 
              metricLabel="Euler Collateral" 
              sectionColor="purple.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />
            <MetricRow 
              metricKey="fluidCollateral" 
              metricLabel="Fluid Collateral" 
              sectionColor="purple.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />
            <MetricRow 
              metricKey="totalLendingMarkets" 
              metricLabel="Total lending markets" 
              sectionColor="purple.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />

            {/* Safety Buffer Section */}
            <SectionHeaderRow sectionTitle="Safety Buffer" sectionColor="red.500" />
            <MetricRow 
              metricKey="insuranceFund" 
              metricLabel="Insurance Layer/Fund" 
              sectionColor="red.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />
            <MetricRow 
              metricKey="collateralizationRatio" 
              metricLabel="CR" 
              sectionColor="red.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />
            <MetricRow 
              metricKey="stakedSupply" 
              metricLabel="Staked Supply" 
              sectionColor="red.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />
            <MetricRow 
              metricKey="supplyOnMainnetPercent" 
              metricLabel="% Supply on Mainnet" 
              sectionColor="red.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />
            <MetricRow 
              metricKey="factorOfSafety" 
              metricLabel="Factor of Safety" 
              sectionColor="red.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
            />
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
}
