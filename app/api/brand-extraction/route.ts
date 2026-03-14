import { NextResponse } from 'next/server';
import { extractBrandAssets } from 'openbrand';
import { z } from 'zod';
import { COST_CONFIG } from '@/lib/config';
import {
  createPaymentRequirements,
  verifyPayment,
  settlePayment,
  create402Response,
  encodePaymentRequired,
} from '@/lib/payment-verification';
import { storeBrandResult } from '@/lib/foc-storage';
import { generateBrandReportHtml } from '@/lib/report-html';

export const maxDuration = 60;

const InputSchema = z.object({
  url: z.string().min(5).max(500).url(),
  userId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    // Internal A2A bypass — skip x402 payment if called by another agent
    const internalKey = request.headers.get('X-Internal-Agent-Key');
    const isInternalCall =
      internalKey &&
      process.env.INTERNAL_AGENT_KEY &&
      internalKey === process.env.INTERNAL_AGENT_KEY;

    if (!isInternalCall) {
      const paymentHeaderV2 = request.headers.get('PAYMENT-SIGNATURE');
      const paymentHeaderV1 = request.headers.get('X-PAYMENT');
      const paymentHeader = paymentHeaderV2 || paymentHeaderV1;

      const requestUrl = `${new URL(request.url).origin}${new URL(request.url).pathname}`;

      const paymentRequirements = createPaymentRequirements(
        `$${COST_CONFIG.brandExtraction}`,
        'base-sepolia',
        requestUrl,
        'Brand asset extraction from URL'
      );

      const verificationResult = await verifyPayment(
        paymentHeader,
        paymentRequirements
      );

      if (!verificationResult.isValid) {
        return NextResponse.json(
          create402Response(
            paymentRequirements,
            verificationResult.error,
            verificationResult.payer
          ),
          {
            status: 402,
            headers: {
              'PAYMENT-REQUIRED': encodePaymentRequired(paymentRequirements),
            },
          }
        );
      }

      // Settle payment asynchronously
      const capturedPaymentHeader = paymentHeader!;
      settlePayment(capturedPaymentHeader, paymentRequirements).then((result) => {
        if (result.success) {
          console.log('[API] ✓ Payment settled:', result.txHash);
        } else {
          console.error('[API] ✗ Payment settlement failed:', result.error);
        }
      });
    } else {
      console.log('[API] Internal A2A call — skipping x402 payment');
    }

    // Content-Type validation
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 415 }
      );
    }

    const body = await request.json();
    const parsed = InputSchema.safeParse(body);

    if (!parsed.success) {
      const msg =
        parsed.error.issues
          ?.map((e) => `${(e as { path?: (string | number)[] }).path?.join('.') ?? 'input'}: ${(e as { message?: string }).message ?? 'invalid'}`)
          .join('; ') ?? 'Validation failed';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { url, userId } = parsed.data;

    // Sanitize URL
    const sanitizedUrl = url.replace(/<[^>]*>/g, '').trim();
    if (!sanitizedUrl) {
      return NextResponse.json(
        { error: 'Invalid input after sanitization' },
        { status: 400 }
      );
    }

    // Ensure URL has protocol
    const finalUrl = sanitizedUrl.startsWith('http')
      ? sanitizedUrl
      : `https://${sanitizedUrl}`;

    const runId = `brand_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // Extract brand assets
    const rawBrandData = await extractBrandAssets(finalUrl);
    const brandData = rawBrandData ?? {
      brand_name: 'Unknown',
      logos: [],
      colors: [],
      backdrop_images: [],
    };

    // Store on Filecoin Onchain Cloud
    const agentId = parseInt(process.env.ERC8004_AGENT_ID ?? '0', 10);
    const dryRun = process.env.FOC_DRY_RUN === 'true';

    const stored = await storeBrandResult(
      runId,
      finalUrl,
      brandData,
      agentId,
      dryRun
    );

    const reportHtml = generateBrandReportHtml(
      brandData,
      finalUrl,
      runId,
      new Date().toISOString()
    );

    return NextResponse.json({
      success: true,
      runId,
      cid: stored.cid,
      listingId: stored.listingId,
      data: brandData,
      reportHtml,
    });
  } catch (error) {
    console.error('[API] Brand extraction error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Brand extraction failed',
      },
      { status: 500 }
    );
  }
}
