#!/usr/bin/env node
/**
 * Test brand-agent paid endpoint with @x402/fetch.
 * Usage: PRIVATE_KEY=0x... node test-paid.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { x402Client, wrapFetchWithPayment } = require('@x402/fetch');
const { ExactEvmScheme, toClientEvmSigner } = require('@x402/evm');
const { privateKeyToAccount } = require('viem/accounts');
const { createWalletClient, http, publicActions } = require('viem');
const { baseSepolia } = require('viem/chains');

const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.X402_WALLET_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error('Set PRIVATE_KEY or X402_WALLET_PRIVATE_KEY');
  process.exit(1);
}

const BRAND_AGENT = 'https://brand-agent-six.vercel.app';

const account = privateKeyToAccount(PRIVATE_KEY);
console.log('Paying from:', account.address);

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
}).extend(publicActions);

const rawSigner = {
  address: account.address,
  signTypedData: walletClient.signTypedData.bind(walletClient),
  readContract: walletClient.readContract.bind(walletClient),
  signTransaction: walletClient.signTransaction.bind(walletClient),
  getTransactionCount: walletClient.getTransactionCount.bind(walletClient),
  estimateFeesPerGas: walletClient.estimateFeesPerGas.bind(walletClient),
};
const signer = toClientEvmSigner(rawSigner);
const scheme = new ExactEvmScheme(signer);

const x402c = new x402Client();
x402c.register('eip155:84532', scheme);

const fetchWithPayment = wrapFetchWithPayment(fetch, x402c);

async function main() {
  console.log('\n=== Brand extraction (paid) ===');
  const res = await fetchWithPayment(`${BRAND_AGENT}/api/brand-extraction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://stripe.com',
      userId: account.address,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Failed:', res.status, body.slice(0, 500));
    process.exit(1);
  }

  const json = await res.json();
  console.log('✓ Success:', json.runId);
  console.log('  Brand:', json.data?.brand_name);
  console.log('  Logos:', json.data?.logos?.length ?? 0);
  console.log('  Colors:', json.data?.colors?.length ?? 0);
  if (json.reportHtml) {
    const fs = await import('fs');
    const path = await import('path');
    const out = path.join(process.cwd(), 'stripe-brand-report.html');
    fs.writeFileSync(out, json.reportHtml);
    console.log('  Report saved:', out);
  }
}

main().catch(console.error);
