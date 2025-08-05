import { FastMCP } from "fastmcp";
import { ServerResponse } from 'http';
import { z } from "zod";
import { Wallet } from "ethers";
import BitlySDK from './mock-bitly-sdk';
import { providers } from 'ethers';
import { URL } from 'url';

// Configuration interface
interface Config {
	WALLET_PRIVATE_KEY: string | undefined;
	INFURA_API_KEY: string | undefined;
}

// Parse base64 encoded JSON config from URL parameter
function parseConfigFromURL(url: string): Config | null {
	try {
		const urlObj = new URL(url);
		const configParam = urlObj.searchParams.get('config');
		
		if (!configParam) {
			return null;
		}
		
		// Decode base64 and parse JSON
		const decodedConfig = Buffer.from(configParam, 'base64').toString('utf-8');
		const config = JSON.parse(decodedConfig) as Config;
		
		// Validate required fields
		if (!config.WALLET_PRIVATE_KEY || !config.INFURA_API_KEY) {
			throw new Error('Missing required config fields: WALLET_PRIVATE_KEY, INFURA_API_KEY');
		}
		
		return config;
	} catch (error) {
		console.error('Failed to parse config from URL:', error);
		return null;
	}
}

// Global config - must be set from URL
let globalConfig: Config = {
	WALLET_PRIVATE_KEY: undefined,
	INFURA_API_KEY: undefined
};

const DEFAULT_NETWORK_ID = 84532; // Base Sepolia
const DEFAULT_BLOCK_TIME = 2000;

// Function to create providers with current config
const createProviders = (config: Config): Record<number, providers.JsonRpcProvider> => {
	if (!config.INFURA_API_KEY) {
		throw new Error('INFURA_API_KEY is required in config');
	}
	
	return {
		[DEFAULT_NETWORK_ID]: new providers.JsonRpcProvider(
			`https://base-sepolia.infura.io/v3/${config.INFURA_API_KEY}`,
			DEFAULT_NETWORK_ID
		),
		8453: new providers.JsonRpcProvider(
			`https://base-mainnet.infura.io/v3/${config.INFURA_API_KEY}`,
			8453
		),
		137: new providers.JsonRpcProvider(
			`https://polygon-mainnet.infura.io/v3/${config.INFURA_API_KEY}`,
			137
		),
		690: new providers.JsonRpcProvider(
			`https://rpc.redstonechain.com`,
			690
		),
	};
};

// Initialize providers - will be created when config is available
let PROVIDERS: Record<number, providers.JsonRpcProvider> = {};

const BLOCK_TIME: Record<number, number> = {
	84532: 2000, // Base Sepolia
	8453: 2000, // Base Mainnet
	137: 2000, // Polygon Mainnet
	690: 2000, // Redstone Chain
};


const createSDK = async (networkId: number) => {
	if (!globalConfig.WALLET_PRIVATE_KEY || !globalConfig.INFURA_API_KEY) {
		throw new Error('Configuration not provided. Use configure_from_url tool or set MCP_SERVER_URL with base64 encoded config parameter.');
	}
	
	const provider = PROVIDERS[networkId];
	if (!provider) {
		throw new Error(`Provider not available for network ${networkId}. Configuration may not be properly set.`);
	}
	const feeData = await provider.getFeeData();
	provider.getFeeData = async () => {
		// Force using legacy mode to send the transaction (type 0)
		return {
			lastBaseFeePerGas: null,
			maxFeePerGas: null,
			maxPriorityFeePerGas: null,
			gasPrice: feeData.gasPrice,
		};
	};
	const sdk = new BitlySDK({
		networkId: networkId,
		provider: provider,
	})

	try {
		await sdk.setSigner(new Wallet(globalConfig.WALLET_PRIVATE_KEY, PROVIDERS[networkId]));
	} catch (error) {
		const res = new ServerResponse({} as any);
		res.statusCode = 401;
		res.statusMessage = "Unauthorized - " + (error instanceof Error ? error.message : 'Invalid wallet configuration');
		throw res;
	}
	return sdk;
}

const TOOLS = [
	{
		name: "get_balance",
		description: "Retrieves the current token balance deposited in Bitly Exchange for a specific token contract. Requires network ID (chain ID) and ERC20 token contract address. Returns a stringified JSON object mapping token addresses to their real (human-readable) balance amounts.",
		parameters: z.object({
			networkId: z.number(),
			tokenAddress: z.string(),
		}),
		execute: async (args: any) => {
			const sdk = await createSDK(args.networkId);
			await sdk.setProvider(PROVIDERS[args.networkId]);
			const balance = await sdk.wallet.balancesInBank([args.tokenAddress]);
			return JSON.stringify(balance);
		},
	},
	{
		name: "get_trade_pairs_info",
		description: "Fetches trading pair information including market addresses, display names, and base/quote token details. Requires network ID and array of pair IDs. Returns an array of ExchangeMarketType objects containing marketAddress, displayName, tokenX, and tokenY information. Leave pairIds to empty array to get all pairs.",
		parameters: z.object({
			networkId: z.number(),
			pairIds: z.array(z.string()),
		}),
		execute: async (args: any) => {
			const sdk = await createSDK(args.networkId);
			await sdk.setProvider(PROVIDERS[args.networkId]);
			const info = await sdk.exchange.getMarketsInfo(args.pairIds);
			return JSON.stringify(info);
		}
	},
	{
		name: "get_tokens_info",
		description: "Retrieves metadata and on-chain information for specified ERC20 tokens. Requires network ID and array of token contract addresses. Returns an array of TokenInfoTypeWithAddress objects containing symbol, name, decimals, and address for each token. Leave tokensAddress to empty array to get all tokens.",
		parameters: z.object({
			networkId: z.number(),
			tokensAddress: z.array(z.string()),
		}),
		execute: async (args: any) => {
			const sdk = await createSDK(args.networkId);
			await sdk.setProvider(PROVIDERS[args.networkId]);
			const info = await sdk.exchange.getTokensInfo(args.tokensAddress);
			return JSON.stringify(info);
		}
	},
	{
		name: "get_trade_volumes",
		description: "Calculates trading volumes for specified pairs over a given time period. Requires network ID, array of pair IDs, and relative time window in seconds. Returns a MarketsVolumes object mapping market addresses to their real (human-readable) volume amounts.",
		parameters: z.object({
			networkId: z.number(),
			pairIds: z.array(z.string()),
			relativeTimeInSec: z.number(),
		}),
		execute: async (args: any) => {
			const sdk = await createSDK(args.networkId);
			await sdk.setProvider(PROVIDERS[args.networkId]);
			const info = await sdk.exchange.getVolumes(args.pairIds, args.relativeTimeInSec);
			return JSON.stringify(info);
		}
	},
	{
		name: "get_orderbook",
		description: "Retrieves the complete order book for a trading pair within specified price range. Requires network ID, pair ID, and price range (low/high). Returns an OrderbookType object with arrays of asks and bids, each containing direction, price and amount information.",
		parameters: z.object({
			networkId: z.number(),
			pairId: z.string(),
			priceRangeLow: z.number(),
			priceRangeHigh: z.number(),
		}),
		execute: async (args: any) => {
			const sdk = await createSDK(args.networkId);
			await sdk.setProvider(PROVIDERS[args.networkId]);
			const info = await sdk.exchange.getOrderbook(args.pairId, {low: args.priceRangeLow, high: args.priceRangeHigh});
			return JSON.stringify(info);
		}
	},
	{
		name: "get_my_open_orders",
		description: "Lists all currently open limit orders for the authenticated wallet across specified trading pairs. Requires network ID and array of pair IDs. Returns an ExchangeOrderDetails object mapping market addresses to arrays of objects with the following properties: sold (number), earned (number), selling (number), price (number), and direction (OrderDirection).",
		parameters: z.object({
			networkId: z.number(),
			pairIds: z.array(z.string()),
		}),
		execute: async (args: any) => {
			const sdk = await createSDK(args.networkId);
			await sdk.setProvider(PROVIDERS[args.networkId]);
			const info = await sdk.exchange.getLimitOrders(args.pairIds);
			return JSON.stringify(info);
		}
	},
	{
		// public async placeLimitOrder(market: string, direction: OrderDirection, price: number, volume: number)
		name: "place_limit_order",
		description: "Submits a new limit order to the exchange. Requires network ID, pair ID, direction (BUY/SELL), price, and volume(in base token(X) if direction is SELL, in quote token(Y) if direction is BUY). Returns a stringified ContractTransaction object containing the transaction details.",
		parameters: z.object({
			networkId: z.number(),
			pairId: z.string(),
			direction: z.enum(["BUY", "SELL"]),
			price: z.number(),
			volume: z.number(),
		}),
		execute: async (args: any) => {
			const sdk = await createSDK(args.networkId);
			await sdk.setProvider(PROVIDERS[args.networkId]);
			const info = await sdk.exchange.placeLimitOrder(args.pairId, args.direction, args.price, args.volume);
			await setTimeout(()=>{}, (BLOCK_TIME[args.networkId] ?? DEFAULT_BLOCK_TIME) + 1000);
			await sdk.prices.updateKline(args.pairId);
			return JSON.stringify(info);
		}
	},
	{
		// public async placeMarketOrder(market: string, direction: OrderDirection, volume: number, curPrice: number, 
		// slippage: number): Promise<ContractTransaction>
		name: "place_market_order",
		description: "Executes an immediate market order at current best available price. Requires network ID, pair ID, direction (BUY/SELL), volume(in base token(X) if direction is SELL, in quote token(Y) if direction is BUY), current price estimate, and maximum acceptable slippage percentage(500 means 5% slippage, etc.). Returns a stringified ContractTransaction object containing the transaction details.",
		parameters: z.object({
			networkId: z.number(),
			pairId: z.string(),
			direction: z.enum(["BUY", "SELL"]),
			volume: z.number(),
			curPrice: z.number(),
			slippage: z.number(),
		}),
		execute: async (args: any) => {
			const sdk = await createSDK(args.networkId);
			await sdk.setProvider(PROVIDERS[args.networkId]);
			const info = await sdk.exchange.placeMarketOrder(args.pairId, args.direction, args.volume, args.curPrice, args.slippage);
			await setTimeout(()=>{}, (BLOCK_TIME[args.networkId] ?? DEFAULT_BLOCK_TIME) + 1000);
			await sdk.prices.updateKline(args.pairId);
			return JSON.stringify(info);
		}
	},
	{
		// public async cancelLimitOrder(market: string, direction: OrderDirection, point: number)
		name: "cancel_limit_order",
		description: "Cancels a specific open limit order identified by its market, direction and price point. Requires network ID, pair ID, direction (BUY/SELL), and exact price point. Returns a stringified ContractTransaction object containing the transaction details.",
		parameters: z.object({
			networkId: z.number(),
			pairId: z.string(),
			direction: z.enum(["BUY", "SELL"]),
			point: z.number(),
		}),
		execute: async (args: any) => {
			const sdk = await createSDK(args.networkId);
			await sdk.setProvider(PROVIDERS[args.networkId]);
			const info = await sdk.exchange.cancelLimitOrder(args.pairId, args.direction, args.point);
			return JSON.stringify(info);
		}
	},
	{
		// public async cancelAllLimitOrder(market: string): Promise<ContractTransaction>
		name: "cancel_all_limit_order",
		description: "Cancels all open limit orders for the authenticated wallet in a specific market. Requires network ID and pair ID. Returns a stringified ContractTransaction object containing the transaction details.",
		parameters: z.object({
			networkId: z.number(),
			pairId: z.string(),
		}),
		execute: async (args: any) => {
			const sdk = await createSDK(args.networkId);
			await sdk.setProvider(PROVIDERS[args.networkId]);
			const info = await sdk.exchange.cancelAllLimitOrder(args.pairId);
			return JSON.stringify(info);
		}
	},
	{
		// public async claimEarning(market: string, direction: OrderDirection, point: number): Promise<ContractTransaction>
		name: "claim_earning",
		description: "Claims trading rewards for a specific filled limit order. Requires network ID, pair ID, direction (BUY/SELL), and exact price point. Returns a stringified ContractTransaction object containing the transaction details.",
		parameters: z.object({
			networkId: z.number(),
			pairId: z.string(),
			direction: z.enum(["BUY", "SELL"]),
			point: z.number(),
		}),
		execute: async (args: any) => {
			const sdk = await createSDK(args.networkId);
			await sdk.setProvider(PROVIDERS[args.networkId]);
			const info = await sdk.exchange.claimEarning(args.pairId, args.direction, args.point);
			return JSON.stringify(info);
		}
	},
	{
		// public async claimAllEarnings(market: string): Promise<ContractTransaction>
		name: "claim_all_earnings",
		description: "Claims all available trading rewards for the authenticated wallet in a specific market. Requires network ID and pair ID. Returns a stringified ContractTransaction object containing the transaction details.",
		parameters: z.object({
			networkId: z.number(),
			pairId: z.string(),
		}),
		execute: async (args: any) => {
			const sdk = await createSDK(args.networkId);
			await sdk.setProvider(PROVIDERS[args.networkId]);
			const info = await sdk.exchange.claimAllEarnings(args.pairId);
			return JSON.stringify(info);
		}
	},
	{
		// public async getFinishedOrders(markets: string[], relativeFromInSec: number, relativeToInSec: number)
		name: "get_finished_orders",
		description: "Retrieves historical order data for filled/cancelled orders within a specified time range. Requires network ID, array of pair IDs, and from/to timestamps (in seconds relative to now). Returns an ExchangeOrdersType object mapping market addresses to arrays of order information including direction, volume, price, timestamp, and transaction hash.",
		parameters: z.object({
			networkId: z.number(),
			pairIds: z.array(z.string()),
			relativeFromInSec: z.number(),
			relativeToInSec: z.number(),
		}),
		execute: async (args: any) => {
			const sdk = await createSDK(args.networkId);
			await sdk.setProvider(PROVIDERS[args.networkId]);
			const info = await sdk.exchange.getFinishedOrders(args.pairIds, args.relativeFromInSec, args.relativeToInSec);
			return JSON.stringify(info);
		}
	},
	{
		// public async getMarketOrderHistory(markets: string[], relativeFromInSec: number, relativeToInSec: number)
		name: "get_market_order_history",
		description: "Fetches trade history for specified markets. Requires network ID, array of pair IDs, and from/to timestamps (in seconds relative to now). Returns an ExchangeOrdersType object mapping market addresses to arrays of order information including direction, volume, price, timestamp, and transaction hash.",
		parameters: z.object({
			networkId: z.number(),
			pairIds: z.array(z.string()),
			relativeFromInSec: z.number(),
			relativeToInSec: z.number(),
		}),
		execute: async (args: any) => {
			const sdk = await createSDK(args.networkId);
			await sdk.setProvider(PROVIDERS[args.networkId]);
			const info = await sdk.exchange.getMarketOrderHistory(args.pairIds, args.relativeFromInSec, args.relativeToInSec);
			return JSON.stringify(info);
		}
	},
	{
		// public async getPrices(markets: string[], relativeTimeInSec: number): Promise<PricesMap> {
		name: "get_prices",
		description: "Retrieves current or historical price data for specified trading pairs. Requires network ID, array of pair IDs, and timestamp (in seconds relative to now). Returns a PricesMap object mapping market addresses to their current price values.",
		parameters: z.object({
			networkId: z.number(),
			pairIds: z.array(z.string()),
			relativeTimeInSec: z.number(),
		}),
		execute: async (args: any) => {
			const sdk = await createSDK(args.networkId);
			await sdk.setProvider(PROVIDERS[args.networkId]);
			const info = await sdk.prices.getPrices(args.pairIds, args.relativeTimeInSec);
			return JSON.stringify(info);
		}
	},
	{
		// public async getKlines(markets: string[], resolution: KLINE_SOLUTION, relativeFromInSec: number,
		// relativeToInSec: number): 
		name: "get_klines",
		description: "Fetches OHLCV (Open-High-Low-Close-Volume) candle data for technical analysis. Requires network ID, array of pair IDs, candle resolution (60s, 240s, 1D), and from/to timestamps. Returns arrays of CandleResult objects containing open, high, low, close, volume, symbol, and time information.",
		parameters: z.object({
			networkId: z.number(),
			pairIds: z.array(z.string()),
			resolution: z.enum(["60", "240", "1D"]),
			relativeFromInSec: z.number(),
			relativeToInSec: z.number(),
		}),
		execute: async (args: any) => {
			const sdk = await createSDK(args.networkId);
			await sdk.setProvider(PROVIDERS[args.networkId]);
			const info = await sdk.prices.getKlines(args.pairIds, args.resolution, args.relativeFromInSec, args.relativeToInSec);
			return JSON.stringify(info);
		}
	},
]

const server = new FastMCP({
	name: "Bitly MCP Server",
	version: "0.1.0"
});

// Function to update config from URL and reinitialize providers
function updateConfigFromURL(url: string) {
	const urlConfig = parseConfigFromURL(url);
	if (urlConfig) {
		console.log('Config parsed from URL successfully');
		globalConfig = urlConfig;
		try {
			PROVIDERS = createProviders(globalConfig);
			console.log('Providers initialized successfully');
		} catch (error) {
			console.error('Failed to initialize providers:', error instanceof Error ? error.message : 'Unknown error');
		}
	} else {
		console.log('Failed to parse config from URL - configuration required');
	}
}

for (const tool of TOOLS) {
	server.addTool(tool as any);
}

// Add middleware to parse config from URL on first request
server.addTool({
	name: "configure_from_url",
	description: "Internal tool to configure the server from URL parameters. Pass the full URL with base64 encoded config parameter.",
	parameters: z.object({
		url: z.string().describe("The full URL containing the base64 encoded config parameter")
	}),
	execute: async (args: any) => {
		updateConfigFromURL(args.url);
		return JSON.stringify({ message: "Configuration updated successfully" });
	}
} as any);

// Try to parse config from URL at startup if provided via environment variable
const startupURL = process.env.MCP_SERVER_URL;
if (startupURL) {
	console.log('Attempting to parse config from MCP_SERVER_URL environment variable');
	updateConfigFromURL(startupURL);
}

server.start({
	transportType: "httpStream",
	httpStream: {
		endpoint: "/mcp",
		port: 8080
	}
});

console.log('Bitly MCP Server started on port 8080');
console.log('Configuration status:', globalConfig.INFURA_API_KEY ? 'Configured ✓' : 'Not configured - URL config required');
console.log('Available endpoints:');
console.log('- POST /mcp - MCP protocol endpoint');
console.log('');
console.log('CONFIGURATION REQUIRED:');
console.log('- Use the configure_from_url tool, or');
console.log('- Set MCP_SERVER_URL environment variable, or');
console.log('- Connect directly to: http://localhost:8080/mcp?config=<base64-encoded-json>');
console.log('');
console.log('Required config JSON structure:');
console.log(JSON.stringify({
	WALLET_PRIVATE_KEY: "your-wallet-private-key",
	INFURA_API_KEY: "your-infura-api-key"
}, null, 2));