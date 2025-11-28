'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';

function ReturnContent() {
  const [status, setStatus] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      return;
    }

    fetch(`/api/checkout/session?session_id=${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        setStatus(data.status);
        setCustomerEmail(data.customer_email);
      })
      .catch((err) => {
        console.error('Error fetching session:', err);
        setStatus('error');
      });
  }, [sessionId]);

  if (status === 'open') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <p>Redirecting...</p>
      </div>
    );
  }

  if (status === 'complete') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-300">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Payment Successful!</h1>
        <p className="text-white/60 mb-8 max-w-md">
          Thank you for your purchase. Your gems have been added to your account.
          {customerEmail && <span className="block mt-2 text-sm">Receipt sent to {customerEmail}</span>}
        </p>
        <Link
          href="/novel/shop"
          className="bg-white text-black font-bold py-3 px-8 rounded-full hover:bg-white/90 transition"
        >
          Return to Shop
        </Link>
      </div>
    );
  }

  if (status === 'error') {
     return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-white/60 mb-8">
          We couldn't verify your payment. Please contact support if you believe this is an error.
        </p>
        <Link
          href="/novel/shop"
          className="bg-white/10 text-white font-bold py-3 px-8 rounded-full hover:bg-white/20 transition"
        >
          Back to Shop
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white">
      <Loader2 className="w-8 h-8 animate-spin text-white/50" />
    </div>
  );
}

export default function ReturnPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    }>
      <ReturnContent />
    </Suspense>
  );
}
