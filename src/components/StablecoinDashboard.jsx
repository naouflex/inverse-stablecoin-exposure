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
  Flex,
  Progress,
  IconButton
} from '@chakra-ui/react';

import { AlertIcon, TriangleUpIcon, TriangleDownIcon, ExternalLinkIcon, InfoIcon, DownloadIcon, EditIcon } from '@chakra-ui/icons';
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
import OperatorDataEntry from './OperatorDataEntry.jsx';
import { exportStablecoinMetricsToCSV, exportDetailedStablecoinMetricsToCSV } from '../utils/stablecoinCsvExport.js';
import { extractStablecoinMetricValues, extractSortableValues, calculateAggregateStats } from '../utils/stablecoinMetricHelpers.js';

// ================= METRIC ROW COMPONENT =================

function MetricRow({ metricKey, metricLabel, sectionColor, allStablecoinMetrics, loadedStablecoins, isLoading, openOperatorModal }) {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const hoverBg = useColorModeValue('orange.50', 'orange.900');
  
  // Define which metrics are manually entered
  const manualMetrics = ['bridgeSupply', 'collateralizationRatio'];

  const getMetricValue = (stablecoinIndex, metricKey) => {
    // Sequential loading check - similar to ProtocolRow's shouldLoad pattern
    const shouldLoad = loadedStablecoins.has(stablecoinIndex);
    
    if (!shouldLoad) {
      return <Skeleton height="20px" />;
    }

    const metrics = allStablecoinMetrics[stablecoinIndex];
    if (!metrics) {
      return <Text fontSize="sm" color="gray.500">N/A</Text>;
    }

    // NOTE: Alternative approach using extractStablecoinMetricValues helper:
    // const extracted = extractStablecoinMetricValues(metrics, stablecoins[stablecoinIndex]);
    // const metric = extracted[metricKey];
    // if (metric.isLoading) return <Skeleton height="20px" />;
    // return <Text fontSize="sm">{formatValue(metric.value)}</Text>;
    //
    // For now, keeping the explicit switch statement for clarity and full control

    switch (metricKey) {
      case 'totalSupply':
        return metrics.totalSupply?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm">{formatStablecoinAmount(metrics.totalSupply?.data?.data || 0)}</Text>;
      
      case 'bridgeSupply':
        return metrics.bridgeSupply?.isLoading ? <Skeleton height="20px" /> : 
          <HStack spacing={1} justify="center">
            <Text fontSize="sm" color={metrics.bridgeSupply?.data?.source === 'manual_entry' ? 'orange.500' : 'gray.500'}>
              {metrics.bridgeSupply?.data?._placeholder ? 'N/A' : formatStablecoinAmount(metrics.bridgeSupply?.data?.data || 0)}
            </Text>
            <EditIcon boxSize={2.5} color="gray.400" opacity={0.6} />
          </HStack>;
      
      case 'mainnetSupply':
        return metrics.mainnetSupply?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm">{formatStablecoinAmount(metrics.mainnetSupply?.data?.data || 0)}</Text>;
      
      case 'exclLendingOtherNetworks': {
        // Calculate: Total Supply - Bridge Supply - Total Lending Markets
        // Use helper to get calculated value (N/A values treated as 0)
        const extracted = extractStablecoinMetricValues(metrics, stablecoins[stablecoinIndex]);
        const calculatedValue = extracted.exclLendingOtherNetworks.value;
        const isCalculating = extracted.exclLendingOtherNetworks.isLoading;
        
        return isCalculating ? <Skeleton height="20px" /> : 
          <Text fontSize="sm">{formatStablecoinAmount(calculatedValue)}</Text>;
      }
      
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
        return metrics.totalLendingUsage?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm">{formatStablecoinAmount(metrics.totalLendingUsage?.data?.protocols?.fluid?.totalTVL || 0)}</Text>;
      
      case 'totalLendingMarkets':
        return metrics.totalLendingUsage?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm" fontWeight="bold" color="purple.600">{formatStablecoinAmount(metrics.totalLendingUsage?.data?.totalLendingTVL || 0)}</Text>;
      
      case 'insuranceFund':
        return metrics.insuranceFund?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm" color="gray.500">{metrics.insuranceFund?.data?._unavailable ? 'N/A' : formatStablecoinAmount(metrics.insuranceFund?.data?.data || 0)}</Text>;
      
      case 'collateralizationRatio':
        return metrics.collateralizationRatio?.isLoading ? <Skeleton height="20px" /> : 
          <HStack spacing={1} justify="center">
            <Text fontSize="sm" color={metrics.collateralizationRatio?.data?.source === 'manual_entry' ? 'orange.500' : 'gray.500'}>
              {metrics.collateralizationRatio?.data?._unavailable ? 'N/A' : formatRatio(metrics.collateralizationRatio?.data?.data || 0)}
            </Text>
            <EditIcon boxSize={2.5} color="gray.400" opacity={0.6} />
          </HStack>;
      
      case 'stakedSupply':
        return metrics.stakedSupply?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm" color="gray.500">{metrics.stakedSupply?.data?._unavailable ? 'N/A' : formatStablecoinAmount(metrics.stakedSupply?.data?.data || 0)}</Text>;
      
      case 'supplyOnMainnetPercent':
        return metrics.supplyOnMainnetPercent?.isLoading ? <Skeleton height="20px" /> : 
          <Text fontSize="sm">{formatPercentage(metrics.supplyOnMainnetPercent?.data || 0)}</Text>;
      
      case 'factorOfSafety': {
        // Calculate Factor of Safety score (composite risk metric)
        const extracted = extractStablecoinMetricValues(metrics, stablecoins[stablecoinIndex]);
        const fosValue = extracted.factorOfSafety.value;
        const isCalculating = extracted.factorOfSafety.isLoading;
        
        // Color code based on score
        let color = 'gray.600';
        if (fosValue >= 0.8) color = 'green.600';      // Excellent safety
        else if (fosValue >= 0.6) color = 'blue.600';  // Good safety
        else if (fosValue >= 0.4) color = 'orange.600';// Moderate safety
        else color = 'red.600';                        // Poor safety
        
        return isCalculating ? <Skeleton height="20px" /> : 
          <Tooltip 
            label={`Components: Base(0.5) + Insurance(${extracted.factorOfSafety.components.insuranceComponent}) + CR(${extracted.factorOfSafety.components.crComponent}) + Staked(${extracted.factorOfSafety.components.stakedComponent}) + Mainnet(${extracted.factorOfSafety.components.mainnetComponent})`}
            placement="top"
          >
            <Text fontSize="sm" fontWeight="bold" color={color}>
              {fosValue.toFixed(2)}
            </Text>
          </Tooltip>;
      }
      
      case 'theoreticalSupplyLimit': {
        // Calculate Theoretical Supply Limit
        const extracted = extractStablecoinMetricValues(metrics, stablecoins[stablecoinIndex]);
        const limitValue = extracted.theoreticalSupplyLimit.value;
        const isCalculating = extracted.theoreticalSupplyLimit.isLoading;
        
        return isCalculating ? <Skeleton height="20px" /> : 
          <Tooltip 
            label={`FoS(${extracted.theoreticalSupplyLimit.components.factorOfSafety.toFixed(2)}) × min(Excl.Lending: ${formatStablecoinAmount(extracted.theoreticalSupplyLimit.components.exclLendingMarkets)}, Liquidity: ${formatStablecoinAmount(extracted.theoreticalSupplyLimit.components.totalMainnetLiquidity)}) | Limited by: ${extracted.theoreticalSupplyLimit.components.limitedBy}`}
            placement="top"
          >
            <Text fontSize="sm" fontWeight="bold" color="teal.600">
              {formatStablecoinAmount(limitValue)}
            </Text>
          </Tooltip>;
      }
      
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
        width="200px"
        borderLeft={`4px solid`}
        borderLeftColor={sectionColor}
      >
        <Text fontSize="sm" fontWeight="medium">
          {metricLabel}
        </Text>
      </Td>

      {/* Values for each stablecoin */}
      {stablecoins.map((stablecoin, index) => {
        const isManualMetric = manualMetrics.includes(metricKey);
        
        return (
          <Td 
            key={stablecoin.symbol} 
            textAlign="center" 
            width="80px"
            cursor={isManualMetric ? 'pointer' : 'default'}
            onClick={isManualMetric ? () => openOperatorModal(stablecoin.symbol, metricKey) : undefined}
            _hover={isManualMetric ? { bg: hoverBg } : undefined}
            title={isManualMetric ? 'Click to edit manual data' : undefined}
          >
            {getMetricValue(index, metricKey)}
          </Td>
        );
      })}
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
  
  // Operator data entry modal with initial selection
  const { isOpen: isOperatorModalOpen, onOpen: onOperatorModalOpen, onClose: onOperatorModalClose } = useDisclosure();
  const [operatorInitialStablecoin, setOperatorInitialStablecoin] = useState(null);
  const [operatorInitialMetric, setOperatorInitialMetric] = useState(null);
  
  // Function to open operator modal with specific stablecoin and metric
  const openOperatorModal = (stablecoinSymbol = null, metric = null) => {
    setOperatorInitialStablecoin(stablecoinSymbol);
    setOperatorInitialMetric(metric);
    onOperatorModalOpen();
  };
  
  // Track if all stablecoins are loaded (similar to DeFi dashboard pattern)
  const allStablecoinsLoaded = loadedStablecoins.size === stablecoins.length;

  // Load all stablecoin metrics at the top level (following Rules of Hooks)
  // Use allStablecoinsLoaded flag for more efficient batch loading
  const allStablecoinMetrics = stablecoins.map((stablecoin, index) => 
    useStablecoinCompleteMetrics(stablecoin, { 
      enabled: loadedStablecoins.has(index) || allStablecoinsLoaded 
    })
  );

  useEffect(() => {
    // Load stablecoins one by one with short delays
    // Similar to ProtocolRow pattern in DeFi dashboard where each row loads with shouldLoad prop
    // Here, stablecoins are columns, so we enable them sequentially via loadedStablecoins Set
    const loadStablecoinsSequentially = async () => {
      for (let i = 0; i < stablecoins.length; i++) {
        setLoadedStablecoins(prev => new Set([...prev, i]));
        if (i < stablecoins.length - 1) {
          // Increased from 500ms to 3500ms to allow each stablecoin's staggered groups to complete
          // Each stablecoin takes ~2800ms to load all groups, so 3500ms ensures no overlap
          await new Promise(resolve => setTimeout(resolve, 3500));
        }
      }
    };

    loadStablecoinsSequentially();
  }, []);
  
  // Calculate loading progress
  const loadingProgress = useMemo(() => {
    const loaded = loadedStablecoins.size;
    const total = stablecoins.length;
    return {
      loaded,
      total,
      percentage: total > 0 ? (loaded / total) * 100 : 0,
      isComplete: loaded === total
    };
  }, [loadedStablecoins]);

  // Extract sortable values for future sorting functionality
  // Similar to protocolsWithData in DeFi dashboard
  const stablecoinsWithSortableValues = useMemo(() => {
    return extractSortableValues(stablecoins, allStablecoinMetrics);
  }, [allStablecoinMetrics]);

  // Calculate aggregate statistics across all stablecoins
  const aggregateStats = useMemo(() => {
    return calculateAggregateStats(allStablecoinMetrics);
  }, [allStablecoinMetrics]);

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
      pt={{ base: 1, sm: 2, md: 3 }}
      pb={{ base: 4, sm: 6, md: 8 }}
      px={{ base: 1, sm: 2, md: 3 }}
    >
      {/* Loading Progress & Export Buttons */}
      <Flex 
        justify="space-between" 
        align="center" 
        mb={2}
        px={2}
        gap={4}
      >
        {/* Sequential Loading Progress Indicator */}
        {!loadingProgress.isComplete && (
          <Box flex="1" maxW="300px">
            <HStack spacing={2} mb={1}>
              <Text fontSize="xs" color="gray.600">
                Loading stablecoins: {loadingProgress.loaded} / {loadingProgress.total}
              </Text>
            </HStack>
            <Progress 
              value={loadingProgress.percentage} 
              size="sm" 
              colorScheme="blue"
              borderRadius="md"
            />
          </Box>
        )}
        
        {/* Spacer when loading is complete */}
        {loadingProgress.isComplete && <Box flex="1" />}
        
        {/* Operator & Export Buttons */}
        <HStack spacing={2}>
          <Tooltip label="Enter manual data (Bridge Supply & CR)" placement="bottom">
            <Button
              leftIcon={<EditIcon />}
              colorScheme="orange"
              size="sm"
              onClick={onOperatorModalOpen}
              variant="outline"
              _hover={{ bg: 'orange.50' }}
            >
              Operator
            </Button>
          </Tooltip>
          
          <Button
            leftIcon={<DownloadIcon />}
            colorScheme="blue"
            size="sm"
            onClick={handleExportCSV}
            isDisabled={!loadingProgress.isComplete}
            _hover={{ bg: 'blue.600' }}
          >
            Export to CSV
          </Button>
          <Button
            leftIcon={<DownloadIcon />}
            colorScheme="purple"
            size="sm"
            onClick={handleExportDetailedCSV}
            isDisabled={!loadingProgress.isComplete}
            _hover={{ bg: 'purple.600' }}
          >
            Detailed Export
          </Button>
        </HStack>
      </Flex>
      
      {/* Operator Data Entry Modal */}
      <OperatorDataEntry 
        isOpen={isOperatorModalOpen} 
        onClose={onOperatorModalClose}
        initialStablecoin={operatorInitialStablecoin}
        initialMetric={operatorInitialMetric}
      />

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
        pb={4}
      >
        <Table 
          size="xs"
          variant="simple"
          w="100%"
          sx={{ 
            '& td:first-child, & th:first-child': { position: 'sticky !important', left: 0 },
            '& td, & th': { 
              padding: '4px 4px !important'
            },
            tableLayout: 'fixed',
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
                width="200px"
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
                  width="80px"
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
              openOperatorModal={openOperatorModal}
            />
            <MetricRow 
              metricKey="bridgeSupply" 
              metricLabel="Supply secured by bridge" 
              sectionColor="blue.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />
            <MetricRow 
              metricKey="mainnetSupply" 
              metricLabel="Mainnet Supply" 
              sectionColor="blue.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />
            <MetricRow 
              metricKey="exclLendingOtherNetworks" 
              metricLabel="Excl. lending markets, other networks" 
              sectionColor="blue.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />

            {/* Mainnet Liquidity Section */}
            <SectionHeaderRow sectionTitle="Mainnet Liquidity" sectionColor="green.500" />
            <MetricRow 
              metricKey="curveTVL" 
              metricLabel="Curve" 
              sectionColor="green.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />
            <MetricRow 
              metricKey="balancerTVL" 
              metricLabel="Balancer" 
              sectionColor="green.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />
            <MetricRow 
              metricKey="uniswapTVL" 
              metricLabel="Uniswap" 
              sectionColor="green.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />
            <MetricRow 
              metricKey="sushiswapTVL" 
              metricLabel="Sushiswap" 
              sectionColor="green.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />
            <MetricRow 
              metricKey="totalMainnetLiquidity" 
              metricLabel="Total mainnet liquidity" 
              sectionColor="green.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />

            {/* Competitor Markets Section */}
            <SectionHeaderRow sectionTitle="Competitor Markets" sectionColor="purple.500" />
            <MetricRow 
              metricKey="aaveCollateral" 
              metricLabel="Aave Collateral" 
              sectionColor="purple.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />
            <MetricRow 
              metricKey="morphoCollateral" 
              metricLabel="Morpho Collateral" 
              sectionColor="purple.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />
            <MetricRow 
              metricKey="eulerCollateral" 
              metricLabel="Euler Collateral" 
              sectionColor="purple.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />
            <MetricRow 
              metricKey="fluidCollateral" 
              metricLabel="Fluid Collateral" 
              sectionColor="purple.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />
            <MetricRow 
              metricKey="totalLendingMarkets" 
              metricLabel="Total lending markets" 
              sectionColor="purple.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />

            {/* Safety Buffer Section */}
            <SectionHeaderRow sectionTitle="Safety Buffer" sectionColor="red.500" />
            <MetricRow 
              metricKey="insuranceFund" 
              metricLabel="Insurance Layer/Fund" 
              sectionColor="red.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />
            <MetricRow 
              metricKey="collateralizationRatio" 
              metricLabel="CR" 
              sectionColor="red.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />
            <MetricRow 
              metricKey="stakedSupply" 
              metricLabel="Staked Supply" 
              sectionColor="red.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />
            <MetricRow 
              metricKey="supplyOnMainnetPercent" 
              metricLabel="% Supply on Mainnet" 
              sectionColor="red.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />
            <MetricRow 
              metricKey="factorOfSafety" 
              metricLabel="Factor of Safety" 
              sectionColor="red.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />
            <MetricRow 
              metricKey="theoreticalSupplyLimit" 
              metricLabel="Theoretical Supply Limit" 
              sectionColor="red.500"
              allStablecoinMetrics={allStablecoinMetrics}
              loadedStablecoins={loadedStablecoins}
              openOperatorModal={openOperatorModal}
            />
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
}
