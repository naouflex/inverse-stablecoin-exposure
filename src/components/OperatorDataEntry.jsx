import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  VStack,
  Text,
  useToast,
  HStack,
  Badge,
  Textarea,
  Link,
  Icon,
  Divider,
  Select,
  useColorModeValue
} from '@chakra-ui/react';
import { ExternalLinkIcon, EditIcon, CheckIcon } from '@chakra-ui/icons';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { stablecoins } from '../config/stablecoins.js';

const API_BASE = '/api';

export default function OperatorDataEntry({ isOpen, onClose, initialStablecoin = null, initialMetric = null }) {
  const dataSourceBg = useColorModeValue('blue.50', 'blue.900');
  const dataSourceBorder = useColorModeValue('blue.200', 'blue.700');
  const [selectedStablecoin, setSelectedStablecoin] = useState(null);
  const [bridgeSupply, setBridgeSupply] = useState('');
  const [collateralizationRatio, setCollateralizationRatio] = useState('');
  const [notes, setNotes] = useState('');
  const [apiKey, setApiKey] = useState(localStorage.getItem('operatorApiKey') || '');
  const [isLoading, setIsLoading] = useState(false);
  const [existingData, setExistingData] = useState({});
  const [focusedMetric, setFocusedMetric] = useState(null);
  const [defaultsStatus, setDefaultsStatus] = useState(null);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  
  const toast = useToast();
  const queryClient = useQueryClient();

  // Set initial stablecoin when modal opens
  useEffect(() => {
    if (isOpen && initialStablecoin) {
      const stablecoin = stablecoins.find(s => s.symbol === initialStablecoin);
      if (stablecoin) {
        setSelectedStablecoin(stablecoin);
        setFocusedMetric(initialMetric);
      }
    }
  }, [isOpen, initialStablecoin, initialMetric]);

  // Load defaults status when modal opens
  useEffect(() => {
    if (isOpen) {
      loadDefaultsStatus();
    }
  }, [isOpen]);

  // Load existing manual data when stablecoin is selected
  useEffect(() => {
    if (selectedStablecoin) {
      loadExistingData(selectedStablecoin.symbol);
    }
  }, [selectedStablecoin]);

  const loadDefaultsStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/manual-data/defaults-status`);
      if (response.data.success && response.data.configured) {
        setDefaultsStatus(response.data.status);
      } else {
        setDefaultsStatus(null);
      }
    } catch (error) {
      console.error('Error loading defaults status:', error);
      setDefaultsStatus(null);
    }
  };

  const loadExistingData = async (symbol) => {
    try {
      const response = await axios.get(`${API_BASE}/manual-data/${symbol}`);
      if (response.data.success && response.data.data) {
        setExistingData(response.data.data);
        setBridgeSupply(response.data.data.bridgeSupply?.value || '');
        setCollateralizationRatio(response.data.data.collateralizationRatio?.value || '');
      } else {
        setExistingData({});
        setBridgeSupply('');
        setCollateralizationRatio('');
      }
    } catch (error) {
      console.error('Error loading existing data:', error);
      setExistingData({});
    }
  };

  const handleLoadDefaults = async () => {
    if (!apiKey) {
      toast({
        title: 'API Key Required',
        description: 'Please enter your operator API key to load defaults',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setLoadingDefaults(true);
      
      const response = await axios.post(
        `${API_BASE}/manual-data/load-defaults`,
        {},
        {
          headers: {
            'x-operator-key': apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        toast({
          title: 'Defaults Loaded',
          description: `Loaded ${response.data.results.loaded} defaults, skipped ${response.data.results.skipped} existing entries`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        
        // Invalidate React Query cache to refresh the table
        queryClient.invalidateQueries({
          predicate: (query) => 
            query.queryKey[0] === 'stablecoin-bridge-supply' ||
            query.queryKey[0] === 'stablecoin-cr'
        });
        
        // Reload defaults status and existing data if a stablecoin is selected
        await loadDefaultsStatus();
        if (selectedStablecoin) {
          await loadExistingData(selectedStablecoin.symbol);
        }
      }
    } catch (error) {
      console.error('Error loading defaults:', error);
      toast({
        title: 'Error Loading Defaults',
        description: error.response?.data?.message || error.response?.data?.error || 'Failed to load defaults',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoadingDefaults(false);
    }
  };

  const saveData = async (metric, value) => {
    if (!apiKey) {
      toast({
        title: 'API Key Required',
        description: 'Please enter your operator API key',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return false;
    }

    if (!value || isNaN(parseFloat(value))) {
      toast({
        title: 'Invalid Value',
        description: `Please enter a valid number for ${metric}`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return false;
    }

    try {
      setIsLoading(true);
      
      const response = await axios.post(
        `${API_BASE}/manual-data/${selectedStablecoin.symbol}/${metric}`,
        {
          value: parseFloat(value),
          notes: notes
        },
        {
          headers: {
            'x-operator-key': apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        toast({
          title: 'Success',
          description: `${metric} saved successfully`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Invalidate React Query cache to refresh the table immediately
        // Invalidate the specific metric query
        queryClient.invalidateQueries({ 
          queryKey: ['stablecoin-bridge-supply', selectedStablecoin.symbol] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['stablecoin-cr', selectedStablecoin.symbol] 
        });
        
        // Also invalidate all stablecoin metrics to recalculate derived values
        queryClient.invalidateQueries({
          predicate: (query) => 
            query.queryKey[0] === 'stablecoin-bridge-supply' ||
            query.queryKey[0] === 'stablecoin-cr' ||
            query.queryKey[0] === 'stablecoin-mainnet-supply-cg' ||
            query.queryKey[0] === 'stablecoin-total-supply-cg'
        });
        
        // Reload existing data in the form
        await loadExistingData(selectedStablecoin.symbol);
        return true;
      }
    } catch (error) {
      console.error('Error saving data:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to save data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAll = async () => {
    const results = [];
    
    if (bridgeSupply) {
      results.push(await saveData('bridgeSupply', bridgeSupply));
    }
    
    if (collateralizationRatio) {
      results.push(await saveData('collateralizationRatio', collateralizationRatio));
    }

    if (results.every(r => r === true)) {
      setNotes('');
    }
  };

  const handleApiKeyChange = (value) => {
    setApiKey(value);
    localStorage.setItem('operatorApiKey', value);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack>
            <EditIcon />
            <Text>Operator Data Entry</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* API Key */}
            <FormControl isRequired>
              <FormLabel>Operator API Key</FormLabel>
              <Input
                type="password"
                placeholder="Enter your operator API key"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Stored locally in browser
              </Text>
            </FormControl>

            {/* Load Defaults Button */}
            {defaultsStatus && Object.keys(defaultsStatus).length > 0 && (
              <Box 
                p={3} 
                bg={useColorModeValue('green.50', 'green.900')}
                borderRadius="md"
                border="1px solid"
                borderColor={useColorModeValue('green.200', 'green.700')}
              >
                <VStack align="stretch" spacing={2}>
                  <HStack justify="space-between" align="center">
                    <VStack align="start" spacing={0} flex="1">
                      <Text fontWeight="bold" fontSize="sm">Default Values Available</Text>
                      <Text fontSize="xs" color="gray.600">
                        {Object.keys(defaultsStatus).length} stablecoin(s) configured in manualDefaults.js
                      </Text>
                    </VStack>
                    <Button
                      size="sm"
                      colorScheme="green"
                      onClick={handleLoadDefaults}
                      isLoading={loadingDefaults}
                      isDisabled={!apiKey}
                    >
                      Load Defaults
                    </Button>
                  </HStack>
                  <Text fontSize="xs" color="gray.600">
                    This will load default values for any stablecoin that doesn't have manual entries yet.
                    Existing manual entries will not be overwritten.
                  </Text>
                </VStack>
              </Box>
            )}

            <Divider />

            {/* Stablecoin Selection */}
            <FormControl isRequired>
              <FormLabel>Select Stablecoin</FormLabel>
              <Select
                placeholder="Choose a stablecoin"
                value={selectedStablecoin?.symbol || ''}
                onChange={(e) => {
                  const stablecoin = stablecoins.find(s => s.symbol === e.target.value);
                  setSelectedStablecoin(stablecoin);
                }}
              >
                {stablecoins.map((stablecoin) => (
                  <option key={stablecoin.symbol} value={stablecoin.symbol}>
                    {stablecoin.name} ({stablecoin.symbol})
                  </option>
                ))}
              </Select>
            </FormControl>

              {selectedStablecoin && (
              <>
                {/* Data Source Links */}
                {selectedStablecoin.manualDataSources && (
                  <Box 
                    p={3} 
                    bg={dataSourceBg}
                    borderRadius="md"
                    border="1px solid"
                    borderColor={dataSourceBorder}
                  >
                    <Text fontWeight="bold" mb={2}>Data Sources:</Text>
                    
                    {/* Bridge Supply Sources */}
                    {selectedStablecoin.manualDataSources.bridgeSupply && 
                     selectedStablecoin.manualDataSources.bridgeSupply.length > 0 && (
                      <Box mb={3}>
                        <Text fontSize="sm" fontWeight="semibold" mb={1}>Bridge Supply:</Text>
                        <VStack align="stretch" spacing={1} pl={2}>
                          {selectedStablecoin.manualDataSources.bridgeSupply.map((source, index) => (
                            <HStack key={index} spacing={2}>
                              <Text fontSize="sm" color="gray.600">•</Text>
                              <Link
                                href={source.url}
                                isExternal
                                color="blue.500"
                                fontSize="sm"
                                _hover={{ color: 'blue.400', textDecoration: 'underline' }}
                              >
                                {source.description} <ExternalLinkIcon mx="2px" />
                              </Link>
                            </HStack>
                          ))}
                        </VStack>
                      </Box>
                    )}
                    
                    {/* Collateralization Ratio Sources */}
                    {selectedStablecoin.manualDataSources.collateralizationRatio && 
                     selectedStablecoin.manualDataSources.collateralizationRatio.length > 0 && (
                      <Box>
                        <Text fontSize="sm" fontWeight="semibold" mb={1}>Collateralization Ratio:</Text>
                        <VStack align="stretch" spacing={1} pl={2}>
                          {selectedStablecoin.manualDataSources.collateralizationRatio.map((source, index) => (
                            <HStack key={index} spacing={2}>
                              <Text fontSize="sm" color="gray.600">•</Text>
                              <Link
                                href={source.url}
                                isExternal
                                color="blue.500"
                                fontSize="sm"
                                _hover={{ color: 'blue.400', textDecoration: 'underline' }}
                              >
                                {source.description} <ExternalLinkIcon mx="2px" />
                              </Link>
                            </HStack>
                          ))}
                        </VStack>
                      </Box>
                    )}
                    
                    {/* Show message if no sources are available */}
                    {(!selectedStablecoin.manualDataSources.bridgeSupply || selectedStablecoin.manualDataSources.bridgeSupply.length === 0) &&
                     (!selectedStablecoin.manualDataSources.collateralizationRatio || selectedStablecoin.manualDataSources.collateralizationRatio.length === 0) && (
                      <Text fontSize="sm" color="gray.500" fontStyle="italic">
                        No data sources configured for this stablecoin
                      </Text>
                    )}
                  </Box>
                )}

                <Divider />

                {/* Bridge Supply */}
                <FormControl>
                  <FormLabel>
                    <HStack>
                      <Text>Bridge Supply (USD)</Text>
                      {focusedMetric === 'bridgeSupply' && (
                        <Badge colorScheme="orange" fontSize="xs">
                          ← Selected
                        </Badge>
                      )}
                      {existingData.bridgeSupply && (
                        <Badge 
                          colorScheme={existingData.bridgeSupply.updatedBy === 'defaults-config' ? 'blue' : 'green'} 
                          fontSize="xs"
                        >
                          <CheckIcon mr={1} boxSize={2} />
                          {existingData.bridgeSupply.updatedBy === 'defaults-config' ? 'Default: ' : 'Last: '}
                          ${existingData.bridgeSupply.value.toLocaleString()}
                        </Badge>
                      )}
                    </HStack>
                  </FormLabel>
                  <Input
                    type="number"
                    placeholder="e.g., 100000000"
                    value={bridgeSupply}
                    onChange={(e) => setBridgeSupply(e.target.value)}
                    autoFocus={focusedMetric === 'bridgeSupply'}
                    borderColor={focusedMetric === 'bridgeSupply' ? 'orange.400' : undefined}
                    borderWidth={focusedMetric === 'bridgeSupply' ? '2px' : '1px'}
                  />
                  {existingData.bridgeSupply && (
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      Last updated: {new Date(existingData.bridgeSupply.lastUpdated).toLocaleString()}
                    </Text>
                  )}
                </FormControl>

                {/* Collateralization Ratio */}
                <FormControl>
                  <FormLabel>
                    <HStack>
                      <Text>Collateralization Ratio</Text>
                      {focusedMetric === 'collateralizationRatio' && (
                        <Badge colorScheme="orange" fontSize="xs">
                          ← Selected
                        </Badge>
                      )}
                      {existingData.collateralizationRatio && (
                        <Badge 
                          colorScheme={existingData.collateralizationRatio.updatedBy === 'defaults-config' ? 'blue' : 'green'} 
                          fontSize="xs"
                        >
                          <CheckIcon mr={1} boxSize={2} />
                          {existingData.collateralizationRatio.updatedBy === 'defaults-config' ? 'Default: ' : 'Last: '}
                          {existingData.collateralizationRatio.value}
                        </Badge>
                      )}
                    </HStack>
                  </FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 1.5 (for 150%)"
                    value={collateralizationRatio}
                    onChange={(e) => setCollateralizationRatio(e.target.value)}
                    autoFocus={focusedMetric === 'collateralizationRatio'}
                    borderColor={focusedMetric === 'collateralizationRatio' ? 'orange.400' : undefined}
                    borderWidth={focusedMetric === 'collateralizationRatio' ? '2px' : '1px'}
                  />
                  {existingData.collateralizationRatio && (
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      Last updated: {new Date(existingData.collateralizationRatio.lastUpdated).toLocaleString()}
                    </Text>
                  )}
                </FormControl>

                {/* Notes */}
                <FormControl>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <Textarea
                    placeholder="Add any notes about this data entry..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </FormControl>
              </>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleSaveAll}
            isLoading={isLoading}
            isDisabled={!selectedStablecoin || !apiKey || (!bridgeSupply && !collateralizationRatio)}
          >
            Save Data
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
