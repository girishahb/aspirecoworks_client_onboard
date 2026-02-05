import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link to="/" className="text-primary hover:text-accent">
          ← Back to Home
        </Link>
      </div>
      <h1 className="mb-6 text-3xl font-bold">Privacy Policy</h1>
      <div className="prose prose-sm max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold">1. Introduction</h2>
          <p>
            Aspire Coworks ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy
            explains how we collect, use, disclose, and safeguard your information when you use our client
            onboarding platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. Information We Collect</h2>
          <h3 className="text-lg font-medium">2.1 Company Information</h3>
          <ul className="list-disc pl-6">
            <li>Company name and registration details</li>
            <li>Tax identification number</li>
            <li>Contact information (email, phone, address)</li>
          </ul>

          <h3 className="mt-4 text-lg font-medium">2.2 KYC Documents</h3>
          <p>
            We collect Know Your Customer (KYC) documents including but not limited to:
          </p>
          <ul className="list-disc pl-6">
            <li>Contracts and agreements</li>
            <li>Business licenses and certificates</li>
            <li>Identification documents</li>
            <li>Financial statements</li>
          </ul>

          <h3 className="mt-4 text-lg font-medium">2.3 Payment Information</h3>
          <p>
            Payment processing is handled by third-party payment gateways. We do not store credit card
            details on our servers.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. How We Use Your Information</h2>
          <p>We use collected information to:</p>
          <ul className="list-disc pl-6">
            <li>Process and manage your onboarding</li>
            <li>Verify your identity and business credentials</li>
            <li>Comply with legal and regulatory requirements</li>
            <li>Communicate with you about your account</li>
            <li>Provide customer support</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. Data Protection</h2>
          <p>
            We implement industry-standard security measures to protect your data:
          </p>
          <ul className="list-disc pl-6">
            <li>Encryption in transit (HTTPS/TLS)</li>
            <li>Secure file storage with access controls</li>
            <li>Regular security audits</li>
            <li>Access controls and authentication</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5. Document Retention</h2>
          <p>
            KYC documents and related records are retained for a minimum period of 7 years as required by
            applicable Indian laws and regulations. After this period, documents may be securely deleted
            unless required for ongoing legal or regulatory compliance.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. Data Sharing</h2>
          <p>
            We do not sell your personal information. We may share information with:
          </p>
          <ul className="list-disc pl-6">
            <li>Service providers (payment processors, email services) under strict confidentiality</li>
            <li>Legal authorities when required by law</li>
            <li>Regulatory bodies for compliance purposes</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6">
            <li>Access your personal data</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data (subject to legal retention requirements)</li>
            <li>Object to processing of your data</li>
            <li>Data portability</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">8. Cookies and Tracking</h2>
          <p>
            We use essential cookies for authentication and session management. We do not use tracking
            cookies or third-party analytics without your consent.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">9. Data Localization</h2>
          <p>
            Your data is stored and processed in India, in compliance with applicable data localization
            requirements under Indian law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of significant changes
            via email or through our platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">11. Contact Us</h2>
          <p>
            For questions about this Privacy Policy or to exercise your rights, please contact us at:
          </p>
          <p>
            <strong>Email:</strong> privacy@aspirecoworks.com<br />
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
