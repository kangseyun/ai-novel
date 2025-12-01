'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPage() {
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
            <h1 className="text-lg font-medium text-white">Privacy Policy</h1>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-6 text-white/80 text-sm leading-relaxed space-y-6">
          <div>
            <p className="text-white/40 text-xs mb-2">Last Updated: {lastUpdated}</p>
            <p className="text-white/40 text-xs">Effective Date: {effectiveDate}</p>
          </div>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">Introduction</h2>
            <p>
              Luminovel.ai ("we", "us", "our") respects your privacy and is committed to
              protecting your personal data. This Privacy Policy explains how we collect, use,
              disclose, and safeguard your information when you use our mobile application
              ("the App").
            </p>
            <p className="mt-2">
              Please read this Privacy Policy carefully. By using the App, you agree to the
              collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">1. Information We Collect</h2>

            <h3 className="text-white/90 font-medium mt-4 mb-2">1.1 Information You Provide</h3>
            <ul className="list-disc list-inside space-y-1 text-white/70">
              <li><strong className="text-white/80">Account Information:</strong> Email address, username, profile picture</li>
              <li><strong className="text-white/80">Profile Preferences:</strong> Personality type, interests, communication preferences</li>
              <li><strong className="text-white/80">Payment Information:</strong> Processed securely through third-party payment processors (Stripe, Apple Pay, Google Pay)</li>
              <li><strong className="text-white/80">User Content:</strong> In-app posts, messages, and interactions</li>
              <li><strong className="text-white/80">Communications:</strong> Customer support inquiries and feedback</li>
            </ul>

            <h3 className="text-white/90 font-medium mt-4 mb-2">1.2 Automatically Collected Information</h3>
            <ul className="list-disc list-inside space-y-1 text-white/70">
              <li><strong className="text-white/80">Device Information:</strong> Device type, operating system, unique device identifiers</li>
              <li><strong className="text-white/80">Usage Data:</strong> Features used, time spent in app, interaction patterns</li>
              <li><strong className="text-white/80">Log Data:</strong> IP address, browser type, access times, crash reports</li>
              <li><strong className="text-white/80">Analytics:</strong> Aggregated usage statistics via Mixpanel</li>
            </ul>

            <h3 className="text-white/90 font-medium mt-4 mb-2">1.3 Information from Third Parties</h3>
            <ul className="list-disc list-inside space-y-1 text-white/70">
              <li>Authentication providers (Google, Apple) if you choose to sign in with them</li>
              <li>Payment processors for transaction verification</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">2. How We Use Your Information</h2>
            <p>We use the collected information to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/70">
              <li>Provide, maintain, and improve the App</li>
              <li>Personalize your experience and content recommendations</li>
              <li>Process transactions and manage subscriptions</li>
              <li>Send service-related notifications and updates</li>
              <li>Respond to customer support requests</li>
              <li>Analyze usage patterns to improve our services</li>
              <li>Detect and prevent fraud or unauthorized access</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">3. AI and Data Processing</h2>
            <p>
              Our App uses artificial intelligence to generate interactive content. When you
              interact with AI features:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/70">
              <li>Your inputs are processed by third-party AI providers (OpenRouter/Google)</li>
              <li>Conversation data may be used to generate contextual responses</li>
              <li>We do not use your personal data to train AI models</li>
              <li>AI-generated content is not stored permanently unless you save it</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">4. Information Sharing and Disclosure</h2>
            <p>We may share your information with:</p>

            <h3 className="text-white/90 font-medium mt-4 mb-2">4.1 Service Providers</h3>
            <ul className="list-disc list-inside space-y-1 text-white/70">
              <li><strong className="text-white/80">Supabase:</strong> Database and authentication services</li>
              <li><strong className="text-white/80">Stripe:</strong> Payment processing</li>
              <li><strong className="text-white/80">OpenRouter/Google:</strong> AI content generation</li>
              <li><strong className="text-white/80">ElevenLabs:</strong> Text-to-speech services</li>
              <li><strong className="text-white/80">Mixpanel:</strong> Analytics</li>
              <li><strong className="text-white/80">Vercel:</strong> Hosting services</li>
            </ul>

            <h3 className="text-white/90 font-medium mt-4 mb-2">4.2 Legal Requirements</h3>
            <p className="text-white/70">
              We may disclose your information if required by law, court order, or government
              request, or to protect our rights, property, or safety.
            </p>

            <h3 className="text-white/90 font-medium mt-4 mb-2">4.3 Business Transfers</h3>
            <p className="text-white/70">
              In the event of a merger, acquisition, or sale of assets, your information may
              be transferred as part of that transaction.
            </p>

            <p className="mt-4 font-medium text-white">
              We do NOT sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">5. Data Retention</h2>
            <p>
              We retain your personal data only for as long as necessary to fulfill the purposes
              outlined in this Privacy Policy:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/70">
              <li><strong className="text-white/80">Account Data:</strong> Until account deletion</li>
              <li><strong className="text-white/80">Transaction Records:</strong> 7 years (for legal/tax purposes)</li>
              <li><strong className="text-white/80">Analytics Data:</strong> 2 years</li>
              <li><strong className="text-white/80">Support Communications:</strong> 3 years</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">6. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your
              personal data, including:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/70">
              <li>Encryption of data in transit (TLS/SSL) and at rest</li>
              <li>Secure authentication mechanisms</li>
              <li>Regular security assessments and updates</li>
              <li>Access controls and employee training</li>
            </ul>
            <p className="mt-2">
              However, no method of transmission over the Internet is 100% secure. While we
              strive to protect your data, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">7. Your Rights and Choices</h2>

            <h3 className="text-white/90 font-medium mt-4 mb-2">7.1 All Users</h3>
            <ul className="list-disc list-inside space-y-1 text-white/70">
              <li><strong className="text-white/80">Access:</strong> Request a copy of your personal data</li>
              <li><strong className="text-white/80">Correction:</strong> Update or correct inaccurate data</li>
              <li><strong className="text-white/80">Deletion:</strong> Request deletion of your account and data</li>
              <li><strong className="text-white/80">Opt-out:</strong> Unsubscribe from marketing communications</li>
              <li><strong className="text-white/80">Data Portability:</strong> Request your data in a portable format</li>
            </ul>

            <h3 className="text-white/90 font-medium mt-4 mb-2">7.2 Managing Preferences</h3>
            <ul className="list-disc list-inside space-y-1 text-white/70">
              <li>Push Notifications: Manage through device settings</li>
              <li>Email Communications: Unsubscribe link in emails</li>
              <li>Account Deletion: Through app settings or contact support</li>
            </ul>
          </section>

          <section className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <h2 className="text-white font-semibold text-base mb-3">8. California Privacy Rights (CCPA)</h2>
            <p>
              If you are a California resident, you have additional rights under the California
              Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc list-inside mt-3 space-y-2 text-white/70">
              <li>
                <strong className="text-white/80">Right to Know:</strong> You can request information about the
                categories and specific pieces of personal information we have collected about you.
              </li>
              <li>
                <strong className="text-white/80">Right to Delete:</strong> You can request deletion of your
                personal information, subject to certain exceptions.
              </li>
              <li>
                <strong className="text-white/80">Right to Opt-Out:</strong> You can opt-out of the "sale" of
                personal information. Note: We do not sell personal information.
              </li>
              <li>
                <strong className="text-white/80">Right to Non-Discrimination:</strong> We will not discriminate
                against you for exercising your CCPA rights.
              </li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact us at: <span className="text-purple-300">privacy@luminafiction.com</span>
            </p>
            <p className="mt-2 text-white/60 text-xs">
              We will respond to verified requests within 45 days.
            </p>
          </section>

          <section className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <h2 className="text-white font-semibold text-base mb-3">9. Nevada Privacy Rights</h2>
            <p>
              Nevada residents may opt out of the sale of their personal information. As stated
              above, we do not sell personal information. However, you may submit a request
              to privacy@luminafiction.com.
            </p>
          </section>

          <section className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <h2 className="text-white font-semibold text-base mb-3">10. Children's Privacy (COPPA)</h2>
            <p>
              <strong className="text-amber-300">Important:</strong> Our App is not intended for children under 13 years of age.
            </p>
            <p className="mt-2">
              We do not knowingly collect personal information from children under 13. If you
              are a parent or guardian and believe your child has provided us with personal
              information, please contact us immediately at privacy@luminafiction.com.
            </p>
            <p className="mt-2">
              If we discover that we have collected personal information from a child under 13,
              we will delete such information from our servers promptly.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">11. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your
              country of residence, including the United States. These countries may have
              different data protection laws.
            </p>
            <p className="mt-2">
              When we transfer data internationally, we ensure appropriate safeguards are in
              place, including standard contractual clauses approved by relevant authorities.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">12. Third-Party Links and Services</h2>
            <p>
              The App may contain links to third-party websites or services. We are not
              responsible for the privacy practices of these third parties. We encourage you
              to read their privacy policies before providing any personal information.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">13. Do Not Track Signals</h2>
            <p>
              Some browsers transmit "Do Not Track" (DNT) signals. Currently, we do not respond
              to DNT signals as there is no industry standard for how to handle such requests.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">14. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any
              material changes by:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/70">
              <li>Posting the new Privacy Policy on this page</li>
              <li>Updating the "Last Updated" date</li>
              <li>Sending you an email notification (for significant changes)</li>
              <li>Displaying an in-app notification</li>
            </ul>
            <p className="mt-2">
              Your continued use of the App after such modifications constitutes your acceptance
              of the updated Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">15. Contact Us</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy
              or our data practices, please contact us:
            </p>
            <div className="mt-3 p-4 bg-white/5 rounded-lg space-y-2">
              <p className="text-white/80">
                <strong className="text-white">Email:</strong> privacy@luminafiction.com
              </p>
              <p className="text-white/80">
                <strong className="text-white">Data Protection Officer:</strong> dpo@luminafiction.com
              </p>
              <p className="text-white/80">
                <strong className="text-white">Address:</strong>
              </p>
              <p className="text-white/60 pl-4">
                Luminovel.ai Inc.<br />
                Attn: Privacy Team<br />
                Delaware, United States
              </p>
            </div>
          </section>

          <section className="p-4 bg-white/5 rounded-xl">
            <h2 className="text-white font-semibold text-base mb-3">Summary of Key Points</h2>
            <ul className="space-y-2 text-white/70">
              <li>✓ We collect data to provide and improve our services</li>
              <li>✓ We do NOT sell your personal information</li>
              <li>✓ We use industry-standard security measures</li>
              <li>✓ You have rights to access, correct, and delete your data</li>
              <li>✓ We comply with CCPA, COPPA, and other applicable laws</li>
              <li>✓ Children under 13 are not permitted to use the App</li>
            </ul>
          </section>

          <div className="pt-8 pb-4 text-center">
            <p className="text-xs text-white/30">© 2025 Luminovel.ai. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
