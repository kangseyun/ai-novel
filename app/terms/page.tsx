'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TermsPage() {
  const router = useRouter();
  const lastUpdated = 'November 28, 2025';
  const effectiveDate = 'November 28, 2025';

  return (
    <div className="min-h-screen bg-black flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-black">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => router.back()} className="p-1">
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-lg font-medium text-white">Terms of Service</h1>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-6 text-white/80 text-sm leading-relaxed space-y-6">
          <div>
            <p className="text-white/40 text-xs mb-2">Last Updated: {lastUpdated}</p>
            <p className="text-white/40 text-xs">Effective Date: {effectiveDate}</p>
          </div>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Lumina Fiction ("the App", "Service", "we", "us", or "our"),
              you agree to be bound by these Terms of Service ("Terms"). If you do not agree to
              these Terms, please do not use the App.
            </p>
            <p className="mt-2">
              We reserve the right to modify these Terms at any time. We will notify you of any
              changes by posting the new Terms on this page and updating the "Last Updated" date.
              Your continued use of the App after such modifications constitutes your acceptance
              of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">2. Eligibility</h2>
            <p>
              <strong className="text-white">Age Requirement:</strong> You must be at least 17 years old to use this App.
              The App contains mature themes, fictional romantic content, and simulated social
              media interactions that are not suitable for children.
            </p>
            <p className="mt-2">
              <strong className="text-white">Parental Advisory:</strong> This App is not intended for users under 17.
              In compliance with the Children's Online Privacy Protection Act (COPPA), we do not
              knowingly collect personal information from children under 13. If we discover that
              a child under 13 has provided us with personal information, we will delete such
              information immediately.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">3. Description of Service</h2>
            <p>
              Lumina Fiction is an interactive fiction application that provides:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/70">
              <li>AI-generated interactive storytelling experiences</li>
              <li>Simulated character interactions and relationships</li>
              <li>Virtual social media simulation features</li>
              <li>In-app purchases for premium content and virtual currency</li>
            </ul>
            <p className="mt-2">
              All characters, stories, and interactions within the App are entirely fictional.
              Any resemblance to real persons, living or dead, or actual events is purely coincidental.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">4. Account Registration</h2>
            <p>
              To access certain features, you may need to create an account. You agree to:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/70">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">5. In-App Purchases and Subscriptions</h2>
            <p>
              <strong className="text-white">Virtual Currency:</strong> The App offers virtual currency ("Gems")
              that can be purchased with real money. Gems have no real-world value and cannot be
              exchanged for cash or other real-world goods.
            </p>
            <p className="mt-2">
              <strong className="text-white">Subscriptions:</strong> Premium subscriptions are billed on a recurring
              basis (monthly or annually) until cancelled. You may cancel your subscription at
              any time through your device's app store settings.
            </p>
            <p className="mt-2">
              <strong className="text-white">Refunds:</strong> All purchases are final and non-refundable, except
              as required by applicable law. Refund requests must be made through the respective
              app store (Apple App Store or Google Play Store).
            </p>
            <p className="mt-2">
              <strong className="text-white">Price Changes:</strong> We reserve the right to change prices for
              subscriptions or in-app purchases at any time. Price changes will not affect
              existing subscription periods.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">6. User Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/70">
              <li>Use the App for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any portion of the App</li>
              <li>Interfere with or disrupt the App's servers or networks</li>
              <li>Reverse engineer, decompile, or disassemble the App</li>
              <li>Use automated systems or bots to access the App</li>
              <li>Share, sell, or transfer your account to others</li>
              <li>Exploit bugs or vulnerabilities in the App</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">7. Intellectual Property</h2>
            <p>
              All content in the App, including but not limited to text, graphics, logos,
              characters, storylines, audio, and software, is the exclusive property of
              Lumina Fiction or its licensors and is protected by copyright, trademark,
              and other intellectual property laws.
            </p>
            <p className="mt-2">
              You may not copy, modify, distribute, sell, or lease any part of the App or
              its content without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">8. AI-Generated Content</h2>
            <p>
              The App utilizes artificial intelligence to generate dialogue and story content.
              While we strive to ensure quality and appropriateness:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/70">
              <li>AI-generated content may occasionally produce unexpected results</li>
              <li>We are not responsible for any AI-generated content that may be offensive</li>
              <li>Users should report any inappropriate content for review</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">9. Disclaimer of Warranties</h2>
            <p className="uppercase text-white/60">
              THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="mt-2">
              We do not warrant that the App will be uninterrupted, error-free, or free of
              viruses or other harmful components.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">10. Limitation of Liability</h2>
            <p className="uppercase text-white/60">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, LUMINA FICTION SHALL NOT BE LIABLE FOR
              ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING
              BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN
              CONNECTION WITH YOUR USE OF THE APP.
            </p>
            <p className="mt-2">
              Our total liability for any claims arising from or related to the App shall not
              exceed the amount you paid to us in the twelve (12) months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">11. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Lumina Fiction and its officers,
              directors, employees, and agents from any claims, damages, losses, or expenses
              (including reasonable attorneys' fees) arising from your use of the App or
              violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">12. Termination</h2>
            <p>
              We may terminate or suspend your account and access to the App immediately,
              without prior notice, for any reason, including breach of these Terms. Upon
              termination, your right to use the App will cease immediately.
            </p>
            <p className="mt-2">
              You may delete your account at any time through the App settings. Account
              deletion will result in the permanent loss of all purchased content, virtual
              currency, and progress.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">13. Governing Law and Dispute Resolution</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of
              the State of Delaware, United States, without regard to its conflict of law provisions.
            </p>
            <p className="mt-2">
              <strong className="text-white">Arbitration:</strong> Any dispute arising from these Terms or your use
              of the App shall be resolved through binding arbitration in accordance with the
              rules of the American Arbitration Association. The arbitration shall take place
              in Delaware, and the arbitrator's decision shall be final and binding.
            </p>
            <p className="mt-2">
              <strong className="text-white">Class Action Waiver:</strong> You agree that any dispute resolution
              proceedings will be conducted only on an individual basis and not in a class,
              consolidated, or representative action.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">14. California Residents</h2>
            <p>
              If you are a California resident, you may have additional rights under the
              California Consumer Privacy Act (CCPA). Please see our Privacy Policy for
              more information about your rights.
            </p>
            <p className="mt-2">
              Under California Civil Code Section 1789.3, California users are entitled to
              the following consumer rights notice: The App is provided by Lumina Fiction.
              For inquiries, contact us at: support@luminafiction.com
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">15. Severability</h2>
            <p>
              If any provision of these Terms is found to be unenforceable, the remaining
              provisions will continue in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">16. Entire Agreement</h2>
            <p>
              These Terms, together with our Privacy Policy, constitute the entire agreement
              between you and Lumina Fiction regarding your use of the App.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">17. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at:
            </p>
            <div className="mt-2 p-3 bg-white/5 rounded-lg">
              <p className="text-white/60">Email: support@luminafiction.com</p>
              <p className="text-white/60 mt-1">Address: Lumina Fiction Inc.</p>
              <p className="text-white/60">Delaware, United States</p>
            </div>
          </section>

          <div className="pt-8 pb-4 text-center">
            <p className="text-xs text-white/30">© 2025 Lumina Fiction. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
