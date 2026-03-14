/**
 * foc-storage.ts — Filecoin Onchain Cloud storage for brand extraction results.
 *
 * Stores brand assets JSON to FOC via the Synapse SDK and returns a content CID.
 * The CID is then registered on DataListingRegistry and the storage cost is
 * recorded on AgentEconomyRegistry.
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
} from 'viem';
import { filecoinCalibration } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const REGISTRY_ABI = parseAbi([
  'function createListing(string contentCid, uint256 agentId, uint256 priceUsdc, string license, string category, string metadataUri) returns (uint256 id)',
  'event ListingCreated(uint256 indexed id, address indexed producer, uint256 indexed agentId, string contentCid, uint256 priceUsdc, string category)',
]);

const ECONOMY_ABI = parseAbi([
  'function recordStorageCost(uint256 agentId, uint256 costWei, string cid)',
]);

export interface CompletedStorageResult {
  cid: string;
  listingId: string | null;
  costWei: bigint;
  dryRun: boolean;
}

function getRpcUrl(): string {
  return (
    process.env.FILECOIN_CALIBRATION_RPC_URL ||
    'https://api.calibration.node.glif.io/rpc/v1'
  );
}

function makeClients() {
  const pk = process.env.AGENT_PRIVATE_KEY?.trim();
  if (!pk) throw new Error('AGENT_PRIVATE_KEY not set');
  const account = privateKeyToAccount(pk as `0x${string}`);
  const wc = createWalletClient({
    account,
    chain: filecoinCalibration,
    transport: http(getRpcUrl()),
  });
  const pc = createPublicClient({
    chain: filecoinCalibration,
    transport: http(getRpcUrl()),
  });
  return { wc, pc, account };
}

/**
 * Store brand extraction result to Filecoin Onchain Cloud, list on DataListingRegistry,
 * and record storage cost on AgentEconomyRegistry.
 */
export async function storeBrandResult(
  runId: string,
  url: string,
  brandData: unknown,
  agentId: number,
  dryRun: boolean = process.env.FOC_DRY_RUN === 'true'
): Promise<CompletedStorageResult> {
  const content = JSON.stringify(
    { runId, url, brandData, storedAt: new Date().toISOString() },
    null,
    2
  );

  if (dryRun) {
    const mockCid = `bafyDRYRUN${content.length}x${Date.now().toString(36)}`;
    return {
      cid: mockCid,
      listingId: null,
      costWei: BigInt(5_000_000_000_000_000),
      dryRun: true,
    };
  }

  const { wc, pc, account } = makeClients();
  let cid: string;
  let costWei: bigint;

  {
    const { Synapse } = await import('@filoz/synapse-sdk');
    const synapse = Synapse.create({ account, withCDN: false, source: null });
    const fileBytes = new TextEncoder().encode(content);
    const uploadResult = await synapse.storage.upload(fileBytes);
    cid = uploadResult.pieceCid.toString();
    costWei = BigInt(uploadResult.size) * BigInt(5_000_000_000_000);
  }

  const registryAddress =
    (process.env.DATA_LISTING_REGISTRY_ADDRESS as `0x${string}`) ||
    '0xdd6c9772e4a3218f8ca7acbaeeea2ce02eb1dbf6';

  const economyAddress = process.env
    .AGENT_ECONOMY_REGISTRY_ADDRESS as `0x${string}` | undefined;

  let listingId: string | null = null;

  if (agentId <= 0) {
    return { cid, listingId: null, costWei, dryRun };
  }

  try {
    const priceRaw = BigInt(100_000); // 0.10 USDC in 6-decimal
    const txHash = await wc.writeContract({
      address: registryAddress,
      abi: REGISTRY_ABI,
      functionName: 'createListing',
      args: [
        cid,
        BigInt(agentId),
        priceRaw,
        'CC-BY-4.0',
        'brand',
        `ipfs://${cid}`,
      ],
    });
    const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
    for (const log of receipt.logs) {
      if (log.topics[1]) {
        listingId = BigInt(log.topics[1]).toString();
        break;
      }
    }
    console.log(
      `[foc-storage] createListing tx: ${txHash}, listingId: ${listingId}`
    );
  } catch (e) {
    console.error('[foc-storage] createListing failed:', e);
    listingId = null;
  }

  if (
    economyAddress &&
    economyAddress !== '0x0000000000000000000000000000000000000000'
  ) {
    try {
      const costHash = await wc.writeContract({
        address: economyAddress,
        abi: ECONOMY_ABI,
        functionName: 'recordStorageCost',
        args: [BigInt(agentId), costWei, cid],
      });
      await pc.waitForTransactionReceipt({ hash: costHash });
      console.log(`[foc-storage] recordStorageCost tx: ${costHash}`);
    } catch (e) {
      console.error('[foc-storage] recordStorageCost failed:', e);
    }
  }

  return { cid, listingId, costWei, dryRun };
}
