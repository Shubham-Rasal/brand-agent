// x402 v2 Payment Verification for Next.js API Routes
// Uses CDP facilitator via @coinbase/x402 v2

import { HTTPFacilitatorClient } from '@x402/core/server';
import { facilitator } from '@coinbase/x402';
import type { PaymentPayload, PaymentRequired, SettleResponse } from '@x402/core/types';
import {
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
  decodePaymentSignatureHeader,
} from '@x402/core/http';

const x402Version = 2;

const facilitatorClient = new HTTPFacilitatorClient(facilitator);

const USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

export function createPaymentRequirements(
  price: string,
  network: 'base' | 'base-sepolia' | 'eip155:8453' | 'eip155:84532',
  resourceUrl: string,
  description: string
): PaymentRequired {
  const caip2Network =
    network === 'base'
      ? 'eip155:8453'
      : network === 'base-sepolia'
        ? 'eip155:84532'
        : network;

  const payTo = process.env.USDC_RECEIVING_WALLET_ADDRESS as `0x${string}`;
  if (!payTo) {
    throw new Error('USDC_RECEIVING_WALLET_ADDRESS not configured');
  }

  const priceNum = parseFloat(price.replace('$', ''));
  const usdcAmount = Math.floor(priceNum * 1_000_000).toString();

  const usdcAsset =
    caip2Network === 'eip155:8453' ? USDC_BASE_MAINNET : USDC_BASE_SEPOLIA;

  return {
    x402Version,
    error: 'Payment required',
    resource: {
      url: resourceUrl,
      description,
      mimeType: 'application/json',
    },
    accepts: [
      {
        scheme: 'exact',
        network: caip2Network,
        asset: usdcAsset,
        amount: usdcAmount,
        payTo,
        maxTimeoutSeconds: 300,
        extra: {
          name: 'USD Coin',
          version: '2',
        },
      },
    ],
  };
}

export async function verifyPayment(
  paymentSignatureHeader: string | null,
  paymentRequirements: PaymentRequired
): Promise<{
  isValid: boolean;
  payer?: string;
  error?: string;
}> {
  if (!paymentSignatureHeader) {
    return { isValid: false, error: 'No payment signature provided' };
  }

  try {
    const paymentPayload: PaymentPayload = decodePaymentSignatureHeader(
      paymentSignatureHeader
    );
    const paymentReqs = paymentRequirements.accepts[0];
    const result = await facilitatorClient.verify(paymentPayload, paymentReqs);

    if (result.isValid) {
      return { isValid: true, payer: result.payer };
    }
    return {
      isValid: false,
      error: result.invalidReason || 'Payment verification failed',
    };
  } catch (error) {
    console.error(
      '[x402] Payment verification error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

export async function settlePayment(
  paymentSignatureHeader: string,
  paymentRequirements: PaymentRequired
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  try {
    const paymentPayload: PaymentPayload = decodePaymentSignatureHeader(
      paymentSignatureHeader
    );
    const paymentReqs = paymentRequirements.accepts[0];
    const result = await facilitatorClient.settle(paymentPayload, paymentReqs);

    if (result.success) {
      return { success: true, txHash: result.transaction };
    }
    return {
      success: false,
      error: result.errorReason || 'Settlement failed',
    };
  } catch (error) {
    console.error(
      '[x402] Payment settlement error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Settlement failed',
    };
  }
}

export function create402Response(
  paymentRequirements: PaymentRequired,
  _error?: string,
  _payer?: string
) {
  return paymentRequirements;
}

export function createPaymentResponseHeader(
  txHash: string,
  network: string,
  payer?: string
): string {
  const response: SettleResponse = {
    success: true,
    transaction: txHash,
    network: network as `${string}:${string}`,
    payer,
  };
  return encodePaymentResponseHeader(response);
}

export function encodePaymentRequired(
  paymentRequirements: PaymentRequired
): string {
  return encodePaymentRequiredHeader(paymentRequirements);
}
