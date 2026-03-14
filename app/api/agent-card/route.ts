import { NextResponse } from 'next/server';
import { COST_CONFIG, BASE_URL } from '@/lib/config';

/**
 * ERC-8004 Agent Card (AgentURI metadata)
 * Served at /.well-known/agent-card.json for agent discovery
 */
export async function GET() {
  const receivingWallet = process.env.USDC_RECEIVING_WALLET_ADDRESS;
  const agentId = process.env.ERC8004_AGENT_ID;
  const agentRegistry = process.env.ERC8004_AGENT_REGISTRY;

  const agentCard = {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: 'OpenBrand Agent',
    description:
      'Extract brand assets (logos, colors, backdrop images) from any website URL. Payment-gated via x402 (USDC on Base Sepolia). Results stored on Filecoin Onchain Cloud.',
    image: `${BASE_URL}/logo.png`,
    active: true,
    x402Support: true,
    healthUrl: `${BASE_URL}/api/health`,

    services: [
      {
        name: 'agent',
        version: '1.0.0',
        endpoint: `${BASE_URL}/api/brand-extraction`,
        description:
          'Extract brand assets from a URL. POST with { url, userId }. Returns runId, cid, data. Stored on Filecoin.',
        protocol: 'http',
        type: 'x402',
        cost: COST_CONFIG.brandExtraction.toString(),
        currency: 'USDC',
        network: 'eip155:84532',
        payment: {
          required: true,
          protocol: 'x402',
          network: 'eip155:84532',
          asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
          amount: COST_CONFIG.brandExtraction.toString(),
          currency: 'USDC',
        },
        inputSchema: {
          type: 'object',
          required: ['url', 'userId'],
          properties: {
            url: {
              type: 'string',
              description: 'Website URL to extract brand assets from, e.g. https://stripe.com',
            },
            userId: {
              type: 'string',
              description: 'Wallet address (CAIP-10 or 0x...)',
            },
          },
        },
        requestSchema: {
          method: 'POST',
          contentType: 'application/json',
          body: {
            url: 'string (required) - Website URL, e.g. https://stripe.com',
            userId: 'string (required) - Wallet address',
          },
        },
        responseSchema: {
          success: 'boolean',
          runId: 'string',
          cid: 'string - Filecoin CID',
          listingId: 'string | null',
          data: 'object - brand_name, logos, colors, backdrop_images',
        },
      },
      ...(receivingWallet
        ? [
            {
              name: 'agentWallet',
              endpoint: `eip155:84532:${receivingWallet}`,
            },
          ]
        : []),
    ],

    ...(agentId && agentRegistry
      ? {
          registrations: [
            {
              agentId: parseInt(agentId, 10),
              agentRegistry,
            },
          ],
        }
      : {}),

    supportedTrust: ['reputation', 'crypto-economic'],
  };

  return NextResponse.json(agentCard, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
