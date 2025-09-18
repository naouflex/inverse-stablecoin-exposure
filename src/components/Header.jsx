import {
  Box,
  Heading,
  Container,
  IconButton,
  Tooltip,
  useColorMode,
  useColorModeValue,
  Flex,
  Image,
  HStack,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  useDisclosure,
  VStack,
  Badge,
  Link
} from '@chakra-ui/react';
import { SunIcon, MoonIcon, InfoIcon, ExternalLinkIcon } from '@chakra-ui/icons';

function ColorModeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();
  
  return (
    <Tooltip label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`} hasArrow>
      <IconButton
        aria-label="Toggle color mode"
        icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
        onClick={toggleColorMode}
        variant="ghost"
        size="md"
        _hover={{
          bg: useColorModeValue('gray.200', 'gray.600')
        }}
      />
    </Tooltip>
  );
}

function DataSourcesModal() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  const dataSources = [
    {
      name: "CoinGecko API",
      description: "Stablecoin market data, prices, and trading volumes",
      url: "https://docs.coingecko.com/reference/introduction",
      category: "Market Data"
    },
    {
      name: "Ethereum RPC",
      description: "On-chain stablecoin supplies, balances and contract data",
      url: "https://ethereum.org/en/developers/docs/apis/json-rpc/",
      category: "Blockchain Data"
    },
    {
      name: "Curve API",
      description: "Curve Finance pools and stablecoin liquidity data",
      url: "https://curve.fi/api",
      category: "DEX Liquidity"
    },
    {
      name: "Uniswap Subgraph",
      description: "Uniswap pools and stablecoin liquidity metrics",
      url: "https://thegraph.com/explorer/subgraphs/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV",
      category: "DEX Liquidity"
    },
    {
      name: "Balancer Subgraph",
      description: "Balancer pools and stablecoin liquidity data",
      url: "https://thegraph.com/explorer/subgraphs/C4ayEZP2yTXRAB8vSaTrgN4m9anTe9Mdm2ViyiAuV9TV",
      category: "DEX Liquidity"
    },
    {
      name: "SushiSwap Subgraph",
      description: "SushiSwap pools and stablecoin trading data",
      url: "https://thegraph.com/explorer/subgraphs/5nnoU1nUFeWqtXgbpC54L9PWdpgo7Y9HYinR3uTMsfzs",
      category: "DEX Liquidity"
    },
    {
      name: "Aave Protocol",
      description: "Stablecoin collateral usage and lending data",
      url: "https://docs.aave.com/developers/",
      category: "Lending Markets"
    },
    {
      name: "Morpho Protocol",
      description: "Morpho lending markets and collateral metrics",
      url: "https://docs.morpho.org/",
      category: "Lending Markets"
    },
    {
      name: "Euler Finance",
      description: "Euler lending protocol collateral data",
      url: "https://docs.euler.finance/",
      category: "Lending Markets"
    },
    {
      name: "Fluid Protocol",
      description: "Fluid lending markets and stablecoin usage",
      url: "https://docs.fluid.instadapp.io/",
      category: "Lending Markets"
    },
    {
      name: "Bridge APIs",
      description: "Cross-chain stablecoin supply and bridge collateral data",
      url: "#",
      category: "Bridge Data"
    },
    {
      name: "Protocol APIs",
      description: "Insurance funds, collateralization ratios, and safety metrics",
      url: "#",
      category: "Safety Metrics"
    }
  ];

  return (
    <>
      <Tooltip label="View Data Sources" hasArrow>
        <IconButton
          aria-label="Data sources info"
          icon={<InfoIcon />}
          onClick={onOpen}
          variant="ghost"
          size="md"
          _hover={{
            bg: useColorModeValue('gray.200', 'gray.600')
          }}
        />
      </Tooltip>

      <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent mx={{ base: 4, sm: 6, md: 8 }}>
          <ModalHeader>Data Sources</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color="gray.500" mb={4}>
              This dashboard aggregates data from multiple reliable sources to provide comprehensive stablecoin exposure and risk metrics for Inverse Finance.
            </Text>
            <VStack spacing={4} align="stretch">
              {dataSources.map((source, index) => (
                <Box 
                  key={index} 
                  p={4} 
                  border="1px solid" 
                  borderColor={useColorModeValue('gray.200', 'gray.600')}
                  borderRadius="md"
                >
                  <HStack justify="space-between" mb={2}>
                    <Text fontWeight="bold" fontSize="md">{source.name}</Text>
                    <Badge colorScheme="blue" size="sm">{source.category}</Badge>
                  </HStack>
                  <Text fontSize="sm" color="gray.600" mb={2}>
                    {source.description}
                  </Text>
                  <Link 
                    href={source.url} 
                    isExternal 
                    color="blue.400" 
                    _hover={{ color: 'blue.300' }}
                    fontSize="sm"
                    display="flex"
                    alignItems="center"
                    gap={1}
                  >
                    Visit {source.name}
                    <ExternalLinkIcon boxSize={3} />
                  </Link>
                </Box>
              ))}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose} size="sm">Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export default function Header() {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box 
      as="header" 
      bg={bgColor}
      borderBottom="1px solid"
      borderColor={borderColor}
      shadow="sm"
      position="sticky"
      top={0}
      zIndex={1000}
      w="100vw"
      maxW="100vw"
      minW="100vw"
      overflow="hidden"
    >
      <Container maxW="none" px={{ base: 4, md: 6 }} py={{ base: 1, md: 2 }}>
        <Flex justify="space-between" align="center" minH={{ base: "50px", sm: "55px", md: "60px" }} position="relative">
          {/* Logo on the left */}
          <Image 
            src="/logo.svg" 
            alt="Inverse Logo" 
            height={{ base: "30px", sm: "35px", md: "40px" }}
            width={{ base: "30px", sm: "35px", md: "40px" }}
            flexShrink={0}
          />
          
          {/* Title centered both horizontally and vertically */}
          <Box 
            position="absolute"
            left="50%"
            top="50%"
            transform="translate(-50%, -50%)"
            zIndex={1}
            maxW={{ base: "220px", sm: "500px", md: "700px", lg: "800px" }}
          >
            <VStack spacing={0} align="center">
              {/* Main Title */}
              <Heading 
                size={{ base: "sm", sm: "md", md: "lg" }}
                color={useColorModeValue('gray.800', 'white')}
                noOfLines={1}
                fontWeight="bold"
                fontFamily="Inter"
                textAlign="center"
                lineHeight="1.2"
              >
                {/* Mobile: Short version */}
                <Text as="span" display={{ base: "inline", sm: "none" }}>
                  Stablecoin Limits
                </Text>
                {/* Small: Medium version */}
                <Text as="span" display={{ base: "none", sm: "inline", md: "none" }}>
                  Stablecoin Exposure Limits
                </Text>
                {/* Medium and up: Full title */}
                <Text as="span" display={{ base: "none", md: "inline" }}>
                  Stablecoin Exposure Limits Dashboard
                </Text>
              </Heading>
              
              {/* Subtitle */}
              <Text
                fontSize={{ base: "2xs", sm: "xs", md: "sm" }}
                color={useColorModeValue('gray.600', 'gray.400')}
                textAlign="center"
                fontWeight="normal"
                mt={0.5}
              >
                {/* Mobile: Short version */}
                <Text as="span" display={{ base: "inline", sm: "none" }}>
                  Inverse Finance Risk Monitoring
                </Text>
                {/* Small and up: Full version */}
                <Text as="span" display={{ base: "none", sm: "inline" }}>
                  Inverse Finance Risk Monitoring & Analysis
                </Text>
              </Text>
            </VStack>
          </Box>
          
          {/* Controls on the right */}
          <HStack spacing={2}>
            <DataSourcesModal />
            <ColorModeToggle />
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
} 