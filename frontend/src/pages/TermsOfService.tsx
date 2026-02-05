import { Link } from 'react-router-dom';

export default function TermsOfService() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link to="/" className="text-primary hover:text-accent">
          ← Back to Home
        </Link>
      </div>
      <h1 className="mb-6 text-3xl font-bold">Terms of Service</h1>
      <div className="prose prose-sm max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
          <p>
            By accessing and using the Aspire Coworks client onboarding platform ("Platform"), you agree to
            be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not
            use the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. Use of the Platform</h2>
          <h3 className="text-lg font-medium">2.1 Eligibility</h3>
          <p>You must:</p>
          <ul className="list-disc pl-6">
            <li>Be a legal entity or authorized representative</li>
            <li>Provide accurate and complete information</li>
            <li>Maintain the security of your account credentials</li>
          </ul>

          <h3 className="mt-4 text-lg font-medium">2.2 Prohibited Activities</h3>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6">
            <li>Upload false, misleading, or fraudulent documents</li>
            <li>Attempt to gain unauthorized access to the Platform</li>
            <li>Interfere with or disrupt the Platform's operation</li>
            <li>Use the Platform for any illegal purpose</li>
            <li>Share your account credentials with others</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. Onboarding Process</h2>
          <h3 className="text-lg font-medium">3.1 Document Submission</h3>
          <p>
            You are responsible for submitting accurate, complete, and valid documents. We reserve the right
            to reject documents that do not meet our requirements or appear fraudulent.
          </p>

          <h3 className="mt-4 text-lg font-medium">3.2 Review Process</h3>
          <p>
            Document review is conducted by our team. Review times may vary. We are not liable for delays
            in the review process.
          </p>

          <h3 className="mt-4 text-lg font-medium">3.3 Account Activation</h3>
          <p>
            Account activation is subject to successful completion of all onboarding requirements, including
            payment confirmation, KYC verification, and agreement execution.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. Payment Terms</h2>
          <p>
            Payment processing is handled by third-party payment gateways. All payments are non-refundable
            unless otherwise stated. You are responsible for any fees charged by payment processors.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5. Intellectual Property</h2>
          <p>
            The Platform and its content are protected by intellectual property laws. You may not copy,
            modify, or distribute any content without our written permission.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. Data and Privacy</h2>
          <p>
            Your use of the Platform is also governed by our Privacy Policy. By using the Platform, you
            consent to the collection and use of your information as described in the Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Aspire Coworks shall not be liable for any indirect,
            incidental, special, or consequential damages arising from your use of the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">8. Indemnification</h2>
          <p>
            You agree to indemnify and hold Aspire Coworks harmless from any claims, damages, or expenses
            arising from your use of the Platform or violation of these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">9. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your access to the Platform at any time for
            violation of these Terms or for any other reason we deem necessary.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">10. Governing Law</h2>
          <p>
            These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive
            jurisdiction of courts in [Your City], India.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">11. Changes to Terms</h2>
          <p>
            We may modify these Terms at any time. Continued use of the Platform after changes constitutes
            acceptance of the modified Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">12. Contact Information</h2>
          <p>
            For questions about these Terms, please contact us at:
          </p>
          <p>
            <strong>Email:</strong> legal@aspirecoworks.com<br />
            <strong>Address:</strong> [Your Company Address]
          </p>
        </section>

        <section className="mt-8 border-t pt-4 text-sm text-muted">
          <p>
            <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}
          </p>
        </section>
      </div>
    </div>
  );
}
