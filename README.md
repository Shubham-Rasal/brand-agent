# OpenBrand Agent

API-only agent that extracts brand assets (logos, colors, backdrop images) from any website URL using [openbrand](https://www.npmjs.com/package/openbrand). Payment-gated via x402 (USDC on Base Sepolia). Results stored on Filecoin Onchain Cloud.

## Endpoints

- `GET /.well-known/agent-card.json` — ERC-8004 agent card
- `GET /api/health` — Health check
- `POST /api/brand-extraction` — Extract brand assets (x402 payment required)

## Usage

```bash
# With x402 payment
curl -X POST https://brand-agent.vercel.app/api/brand-extraction \
  -H "Content-Type: application/json" \
  -d '{"url": "https://stripe.com", "userId": "0x..."}'
```

Response:
```json
{
  "success": true,
  "runId": "brand_...",
  "cid": "bafy...",
  "listingId": null,
  "data": {
    "brand_name": "Stripe",
    "logos": [...],
    "colors": [...],
    "backdrop_images": [...]
  }
}
```

## Setup

1. Copy `.env.example` to `.env`
2. Set `USDC_RECEIVING_WALLET_ADDRESS` for x402 payments
3. For Filecoin storage: set `AGENT_PRIVATE_KEY`, `ERC8004_AGENT_ID`, `DATA_LISTING_REGISTRY_ADDRESS`
4. Use `FOC_DRY_RUN=true` for local testing (mock CIDs, no on-chain writes)

## Logo

Add `public/logo.png` for the OpenBrand agent card image.
