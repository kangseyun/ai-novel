import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerClient } from '@/lib/supabase-server';

// 크레딧 패키지 정의 (1크레딧 ≈ $0.035 ≈ 50원)
const CREDIT_PACKAGES = {
  welcome: { credits: 100, price: 99, bonus: 50, name: 'Welcome Pack (150 Credits)' }, // $0.99 (1회 한정 파격가)
  basic: { credits: 280, price: 999, bonus: 30, name: '310 Credits' },   // $9.99
  standard: { credits: 600, price: 1999, bonus: 80, name: '680 Credits' }, // $19.99
  pro: { credits: 1600, price: 4999, bonus: 300, name: '1,900 Credits' }, // $49.99
  premium: { credits: 3500, price: 9999, bonus: 1000, name: '4,500 Credits' }, // $99.99
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
            currency: 'usd',
            product_data: {
              name: pkg.name,
              description: pkg.bonus > 0
                ? `${pkg.credits} + Bonus ${pkg.bonus} Credits`
                : `${pkg.credits} Credits`,
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
