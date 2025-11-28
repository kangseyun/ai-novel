import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { priceId, mode, planName } = body;

    // Base configuration
    const successUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/novel/shop?success=true`;
    const cancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/novel/shop?canceled=true`;

    let sessionConfig: any = {
      payment_method_types: ['card'],
      mode: mode, // 'payment' or 'subscription'
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        planName,
      },
    };

    if (mode === 'subscription') {
      // For subscriptions, we MUST use a Price ID from Stripe Dashboard
      if (!priceId || priceId.includes('PLACEHOLDER')) {
        return NextResponse.json(
          { error: 'Subscription prices must be configured in Stripe Dashboard and .env.local' },
          { status: 400 }
        );
      }
      sessionConfig.line_items = [
        {
          price: priceId,
          quantity: 1,
        },
      ];
    } else {
      // For one-time payments (Gem Pack), we can use inline price data for simplicity
      // Or use a priceId if provided
      if (priceId) {
         sessionConfig.line_items = [{ price: priceId, quantity: 1 }];
      } else {
        // Fallback to inline pricing for "Gem Pack" if no ID provided
        sessionConfig.line_items = [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: '500 Gems (Starter Pack)',
                description: 'Unlock premium story choices',
              },
              unit_amount: 499, // $4.99
            },
            quantity: 1,
          },
        ];
      }
    }

    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

