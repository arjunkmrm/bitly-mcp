// Mock implementation of BitlySDK for development/testing purposes

export interface BitlySDKConfig {
  networkId: number;
  provider: any;
}

export interface ContractTransaction {
  hash: string;
  to?: string;
  from?: string;
  gasLimit?: string;
  gasPrice?: string;
  value?: string;
  data?: string;
}

export class MockBitlySDK {
  private networkId: number;
  private provider: any;
  private signer: any;

  constructor(config: BitlySDKConfig) {
    this.networkId = config.networkId;
    this.provider = config.provider;
  }

  async setSigner(signer: any): Promise<void> {
    this.signer = signer;
    return Promise.resolve();
  }

  async setProvider(provider: any): Promise<void> {
    this.provider = provider;
    return Promise.resolve();
  }

  // Mock wallet methods
  wallet = {
    balancesInBank: async (tokenAddresses: string[]): Promise<Record<string, string>> => {
      const mockBalances: Record<string, string> = {};
      tokenAddresses.forEach(address => {
        mockBalances[address] = (Math.random() * 1000).toFixed(6);
      });
      return mockBalances;
    }
  };

  // Mock exchange methods
  exchange = {
    getMarketsInfo: async (pairIds: string[]): Promise<any[]> => {
      return pairIds.map(id => ({
        marketAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
        displayName: `${id}_MOCK`,
        tokenX: {
          symbol: 'TOKX',
          name: 'Token X',
          decimals: 18,
          address: `0x${Math.random().toString(16).substr(2, 40)}`
        },
        tokenY: {
          symbol: 'TOKY',
          name: 'Token Y',
          decimals: 18,
          address: `0x${Math.random().toString(16).substr(2, 40)}`
        }
      }));
    },

    getTokensInfo: async (tokenAddresses: string[]): Promise<any[]> => {
      return tokenAddresses.map(address => ({
        symbol: 'MOCK',
        name: 'Mock Token',
        decimals: 18,
        address: address
      }));
    },

    getVolumes: async (pairIds: string[], relativeTimeInSec: number): Promise<Record<string, string>> => {
      const volumes: Record<string, string> = {};
      pairIds.forEach(id => {
        volumes[id] = (Math.random() * 10000).toFixed(6);
      });
      return volumes;
    },

    getOrderbook: async (pairId: string, priceRange: { low: number, high: number }): Promise<any> => {
      return {
        asks: Array.from({ length: 5 }, (_, i) => ({
          direction: 'SELL',
          price: priceRange.low + (Math.random() * (priceRange.high - priceRange.low)),
          amount: Math.random() * 100
        })),
        bids: Array.from({ length: 5 }, (_, i) => ({
          direction: 'BUY',
          price: priceRange.low + (Math.random() * (priceRange.high - priceRange.low)),
          amount: Math.random() * 100
        }))
      };
    },

    getLimitOrders: async (pairIds: string[]): Promise<Record<string, any[]>> => {
      const orders: Record<string, any[]> = {};
      pairIds.forEach(id => {
        orders[id] = Array.from({ length: Math.floor(Math.random() * 3) }, () => ({
          sold: Math.random() * 50,
          earned: Math.random() * 100,
          selling: Math.random() * 200,
          price: Math.random() * 2000,
          direction: Math.random() > 0.5 ? 'BUY' : 'SELL'
        }));
      });
      return orders;
    },

    placeLimitOrder: async (pairId: string, direction: string, price: number, volume: number): Promise<ContractTransaction> => {
      return {
        hash: `0x${Math.random().toString(16).substr(2, 64)}`,
        to: `0x${Math.random().toString(16).substr(2, 40)}`,
        from: this.signer?.address || `0x${Math.random().toString(16).substr(2, 40)}`,
        gasLimit: '200000',
        gasPrice: '20000000000',
        value: '0'
      };
    },

    placeMarketOrder: async (pairId: string, direction: string, volume: number, curPrice: number, slippage: number): Promise<ContractTransaction> => {
      return {
        hash: `0x${Math.random().toString(16).substr(2, 64)}`,
        to: `0x${Math.random().toString(16).substr(2, 40)}`,
        from: this.signer?.address || `0x${Math.random().toString(16).substr(2, 40)}`,
        gasLimit: '300000',
        gasPrice: '20000000000',
        value: '0'
      };
    },

    cancelLimitOrder: async (pairId: string, direction: string, point: number): Promise<ContractTransaction> => {
      return {
        hash: `0x${Math.random().toString(16).substr(2, 64)}`,
        to: `0x${Math.random().toString(16).substr(2, 40)}`,
        from: this.signer?.address || `0x${Math.random().toString(16).substr(2, 40)}`,
        gasLimit: '150000',
        gasPrice: '20000000000',
        value: '0'
      };
    },

    cancelAllLimitOrder: async (pairId: string): Promise<ContractTransaction> => {
      return {
        hash: `0x${Math.random().toString(16).substr(2, 64)}`,
        to: `0x${Math.random().toString(16).substr(2, 40)}`,
        from: this.signer?.address || `0x${Math.random().toString(16).substr(2, 40)}`,
        gasLimit: '500000',
        gasPrice: '20000000000',
        value: '0'
      };
    },

    claimEarning: async (pairId: string, direction: string, point: number): Promise<ContractTransaction> => {
      return {
        hash: `0x${Math.random().toString(16).substr(2, 64)}`,
        to: `0x${Math.random().toString(16).substr(2, 40)}`,
        from: this.signer?.address || `0x${Math.random().toString(16).substr(2, 40)}`,
        gasLimit: '180000',
        gasPrice: '20000000000',
        value: '0'
      };
    },

    claimAllEarnings: async (pairId: string): Promise<ContractTransaction> => {
      return {
        hash: `0x${Math.random().toString(16).substr(2, 64)}`,
        to: `0x${Math.random().toString(16).substr(2, 40)}`,
        from: this.signer?.address || `0x${Math.random().toString(16).substr(2, 40)}`,
        gasLimit: '400000',
        gasPrice: '20000000000',
        value: '0'
      };
    },

    getFinishedOrders: async (pairIds: string[], relativeFromInSec: number, relativeToInSec: number): Promise<Record<string, any[]>> => {
      const orders: Record<string, any[]> = {};
      pairIds.forEach(id => {
        orders[id] = Array.from({ length: Math.floor(Math.random() * 10) }, () => ({
          direction: Math.random() > 0.5 ? 'BUY' : 'SELL',
          volume: Math.random() * 1000,
          price: Math.random() * 2000,
          timestamp: Date.now() - Math.random() * (relativeFromInSec - relativeToInSec) * 1000,
          transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`
        }));
      });
      return orders;
    },

    getMarketOrderHistory: async (pairIds: string[], relativeFromInSec: number, relativeToInSec: number): Promise<Record<string, any[]>> => {
      const orders: Record<string, any[]> = {};
      pairIds.forEach(id => {
        orders[id] = Array.from({ length: Math.floor(Math.random() * 15) }, () => ({
          direction: Math.random() > 0.5 ? 'BUY' : 'SELL',
          volume: Math.random() * 500,
          price: Math.random() * 2000,
          timestamp: Date.now() - Math.random() * (relativeFromInSec - relativeToInSec) * 1000,
          transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`
        }));
      });
      return orders;
    }
  };

  // Mock prices methods
  prices = {
    getPrices: async (pairIds: string[], relativeTimeInSec: number): Promise<Record<string, number>> => {
      const prices: Record<string, number> = {};
      pairIds.forEach(id => {
        prices[id] = Math.random() * 2000;
      });
      return prices;
    },

    getKlines: async (pairIds: string[], resolution: string, relativeFromInSec: number, relativeToInSec: number): Promise<any[]> => {
      return pairIds.map(id => ({
        symbol: id,
        time: Date.now(),
        open: Math.random() * 2000,
        high: Math.random() * 2000,
        low: Math.random() * 2000,
        close: Math.random() * 2000,
        volume: Math.random() * 10000
      }));
    },

    updateKline: async (pairId: string): Promise<void> => {
      // Mock implementation - just resolve
      return Promise.resolve();
    }
  };
}

export default MockBitlySDK;