# Stripe 결제 연동 가이드 (Stripe Payment Setup)

보안을 위해 **절대** API Key를 코드에 직접 적지 마세요. 아래 단계를 따라 설정해주세요.

## 1. 환경 변수 설정 (.env.local)

프로젝트 루트에 `.env.local` 파일을 생성하고 아래 내용을 붙여넣으세요.
(이미 `.env`에 있다면 `.env.local`로 옮기는 것이 안전합니다.)

```env
# Stripe API Keys (Live Mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... (사용자가 제공한 키)
STRIPE_SECRET_KEY=sk_live_... (사용자가 제공한 키)

# Base URL (배포 시 해당 도메인으로 변경 필요, 예: https://your-domain.com)
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Stripe Price IDs (구독 상품용)
# 아래 ID들은 Stripe 대시보드에서 상품을 생성한 후 가져와야 합니다.
NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY=price_...
```

## 2. Stripe 대시보드 설정 (구독 상품 만들기)

"일회용 결제(Starter Pack)"는 코드에서 직접 가격을 처리하므로 설정이 필요 없지만, **월간/연간 구독**은 Stripe 대시보드에 상품이 존재해야 합니다.

1. [Stripe Dashboard](https://dashboard.stripe.com/products) 접속
2. **Product 추가 (Add Product)** 클릭
   - **Name**: "Monthly Pro"
   - **Pricing Model**: Standard pricing
   - **Price**: $14.99
   - **Billing period**: Monthly
   - 저장 후, 생성된 **API ID (예: price_1Pwd...)**를 복사하여 `.env.local`의 `NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY`에 붙여넣으세요.
3. **Product 추가 (Add Product)** 클릭 (연간권)
   - **Name**: "Yearly VIP"
   - **Price**: $119.99
   - **Billing period**: Yearly
   - 저장 후, **API ID**를 `NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY`에 붙여넣으세요.

## 3. Webhook 설정 (선택 사항, 결제 후 처리)

현재 구현은 결제 성공 시 `success=true` 페이지로 리다이렉트만 합니다. 실제 DB에 보석(Gem)을 지급하려면 Webhook 설정이 필요합니다.

1. [Stripe Webhooks](https://dashboard.stripe.com/webhooks)에서 "Add endpoint" 클릭
2. Endpoint URL: `https://your-domain.com/api/stripe/webhook`
3. Events to send: `checkout.session.completed`, `invoice.payment_succeeded`

