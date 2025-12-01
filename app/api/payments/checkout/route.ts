import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerClient } from '@/lib/supabase-server';

// 크레딧 패키지 정의 (Kling AI 스타일)
const CREDIT_PACKAGES = {
  starter: { credits: 100, price: 1900, bonus: 0, name: '100 크레딧' },
  basic: { credits: 500, price: 8900, bonus: 50, name: '550 크레딧' },
  standard: { credits: 1000, price: 16900, bonus: 150, name: '1,150 크레딧' },
  pro: { credits: 3000, price: 45900, bonus: 600, name: '3,600 크레딧' },
  premium: { credits: 6000, price: 85900, bonus: 1500, name: '7,500 크레딧' },
};

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { package_id } = await request.json();

    if (!package_id || !CREDIT_PACKAGES[package_id as keyof typeof CREDIT_PACKAGES]) {
      return NextResponse.json({ error: 'Invalid package' }, { status: 400 });
    }

    const pkg = CREDIT_PACKAGES[package_id as keyof typeof CREDIT_PACKAGES];
    const totalCredits = pkg.credits + pkg.bonus;

    // Stripe 고객 찾기 또는 생성
    let customerId: string;
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      // metadata 업데이트
      await stripe.customers.update(customerId, {
        metadata: { user_id: user.id },
      });
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
    }

    // Checkout 세션 생성
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'krw',
            product_data: {
              name: pkg.name,
              description: pkg.bonus > 0
                ? `${pkg.credits} + 보너스 ${pkg.bonus} 크레딧`
                : `${pkg.credits} 크레딧`,
            },
            unit_amount: pkg.price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/shop?success=true&credits=${totalCredits}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/shop?canceled=true`,
      metadata: {
        user_id: user.id,
        token_amount: totalCredits.toString(), // 보너스 포함 총 크레딧
        package_id: package_id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}

// 크레딧 패키지 목록 조회
export async function GET() {
  const packages = Object.entries(CREDIT_PACKAGES).map(([id, pkg]) => ({
    id,
    credits: pkg.credits,
    bonus: pkg.bonus,
    totalCredits: pkg.credits + pkg.bonus,
    price: pkg.price,
    name: pkg.name,
    pricePerCredit: Math.round(pkg.price / (pkg.credits + pkg.bonus)),
  }));

  return NextResponse.json({ packages });
}
