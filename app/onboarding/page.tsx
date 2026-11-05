'use client';
import FrontPage from '@/components/FrontPage';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const tenantId = process.env.NEXT_PUBLIC_AAD_TENANT_ID || '';
  const clientId = process.env.NEXT_PUBLIC_AAD_CLIENT_ID || '';
  const redirectUri = process.env.NEXT_PUBLIC_AAD_REDIRECT_URI;

  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=openid profile email&prompt=create`;

  if (isAuthenticated) {
    router.push('/');
  }

  return (
    <FrontPage
      title="Let&rsquo;s Get Started"
      description="Welcome to Pro Bono Law. Please review the following Terms & Conditions before proceeding.">
      <div className="mx-auto text-sm leading-relaxed md:col-span-2 md:pt-16">
        <header className="mb-8 border-b pb-4">
          <h2 className="text-2xl md:text-3xl font-semibold">
            Terms &amp; Conditions
          </h2>
          <p className="mt-2">
            <span className="font-semibold">Effective Date:</span> 12/01/2025
          </p>
        </header>

        <p className="mb-4">
          These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your access
          to and use of the Pro Bono Law platform (the &ldquo;Service&rdquo;).
          The Service is operated by{' '}
          <span className="font-semibold">[Pro Bono Law, Inc.]</span>{' '}
          (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
          &ldquo;our&rdquo;).
        </p>

        <p className="mb-4">
          By creating an account, clicking &ldquo;I agree,&rdquo; or accessing
          or using the Service, you agree to be bound by these Terms. If you are
          using the Service on behalf of a law firm, company, or other
          organization, you represent that you are authorized to accept these
          Terms on its behalf and that &ldquo;you&rdquo; refers to that
          organization.
        </p>

        <p className="mb-6">
          If you do not agree to these Terms, do not create an account or use
          the Service.
        </p>

        {/* 1. Eligibility */}
        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">1. Eligibility</h2>
          <p className="mb-2">
            <span className="font-semibold">1.1 Intended Users.</span> The
            Service is designed for licensed attorneys, law firms, and legal
            professionals (including staff working under attorney supervision).
            It is not intended for use by individual consumers seeking legal
            advice for their own matters.
          </p>
          <p className="mb-2">
            <span className="font-semibold">1.2 Age &amp; Capacity.</span> You
            must be at least 18 years old and have the legal capacity to enter
            into a binding contract in your jurisdiction.
          </p>
          <p>
            <span className="font-semibold">
              1.3 Compliance with Law &amp; Ethics.
            </span>{' '}
            You are solely responsible for ensuring that your use of the Service
            complies with applicable laws and regulations and applicable rules
            of professional conduct, bar rules, and ethical obligations
            (including, without limitation, duties of competence,
            confidentiality, supervision, client communication, and conflicts of
            interest).
          </p>
        </section>

        {/* 2. Description of the Service */}
        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">
            2. Description of the Service
          </h2>
          <p className="mb-2">
            <span className="font-semibold">
              2.1 AI-Powered Paralegal Platform.
            </span>{' '}
            The Service is an AI-powered paralegal tool that allows you to:
          </p>
          <ul className="mb-2 list-disc pl-6">
            <li>
              Upload, store, and organize legal documents and client materials;
              and
            </li>
            <li>
              Run AI-powered queries, summaries, and other automated analyses
              against those materials.
            </li>
          </ul>
          <p className="mb-2">
            <span className="font-semibold">
              2.2 No Legal Advice from the Service.
            </span>{' '}
            The Service provides automated processing of information you supply.
            Any outputs (including drafts, summaries, answers, or suggestions)
            are computer-generated and are intended solely to assist you as a
            legal professional.
          </p>
          <p className="mb-2">
            The Service does <span className="font-semibold">not</span>:
          </p>
          <ul className="mb-2 list-disc pl-6">
            <li>Provide legal advice to you or your clients;</li>
            <li>
              Create an attorney–client relationship between your clients and
              us; or
            </li>
            <li>
              Replace your professional judgment, research, or legal analysis.
            </li>
          </ul>
          <p>
            You are solely responsible for reviewing, validating, and modifying
            any output before relying on it or using it in connection with a
            client matter, court filing, or other legal work.
          </p>
        </section>

        {/* 3. Account Registration & Security */}
        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">
            3. Account Registration &amp; Security
          </h2>
          <p className="mb-2">
            <span className="font-semibold">3.1 Account Information.</span> To
            use the Service, you must create an account and provide accurate,
            current, and complete information. You agree to update your
            information as necessary to keep it accurate and complete.
          </p>
          <p className="mb-2">
            <span className="font-semibold">3.2 Credentials &amp; Access.</span>{' '}
            You are responsible for maintaining the confidentiality of your
            login credentials and for all activities that occur under your
            account. You agree to notify us promptly of any unauthorized access
            or suspected security breach involving your account.
          </p>
          <p>
            <span className="font-semibold">3.3 Organization Accounts.</span> If
            your account is associated with a law firm or organization, the
            organization may control and administer your access and may obtain
            data associated with your use of the Service.
          </p>
        </section>

        {/* 4. Your Content & Client Data */}
        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">
            4. Your Content &amp; Client Data
          </h2>
          <p className="mb-2">
            <span className="font-semibold">4.1 Your Content.</span> &quot;Your
            Content&quot; means documents, text, files, data, and other
            materials that you or your organization upload to or otherwise
            submit through the Service, including any content relating to your
            clients and matters.
          </p>
          <p className="mb-2">
            <span className="font-semibold">4.2 Ownership.</span> As between you
            and us, you (or your clients) retain all ownership rights in Your
            Content. We do not claim ownership of Your Content.
          </p>
          <p className="mb-2">
            <span className="font-semibold">
              4.3 License to Provide the Service.
            </span>{' '}
            You grant us a non-exclusive, worldwide, royalty-free license to
            host, store, process, and display Your Content solely to provide,
            maintain, secure, and improve the Service and as otherwise described
            in these Terms and our Privacy Policy.
          </p>
          <p className="mb-2">
            <span className="font-semibold">
              4.4 Authorization &amp; Consents.
            </span>{' '}
            You represent and warrant that:
          </p>
          <ul className="mb-2 list-disc pl-6">
            <li>
              You have all necessary rights, consents, and authorizations to
              upload or otherwise make available Your Content to the Service;
            </li>
            <li>
              Your use of the Service with respect to Your Content does not
              violate any law, court order, protective order, confidentiality
              agreement, or professional obligation; and
            </li>
            <li>
              Where required, you have obtained appropriate client consent for
              the use of client information with AI tools and third-party
              service providers.
            </li>
          </ul>
          <p className="mb-2">
            <span className="font-semibold">
              4.5 Sensitive / Regulated Data.
            </span>{' '}
            You are responsible for determining whether the Service is
            appropriate for storing or processing any sensitive or regulated
            data (including, for example, data subject to HIPAA, GDPR,
            CCPA/CPRA, or similar laws). Unless we have entered into a separate
            written agreement with you (e.g., a Business Associate Agreement),
            you agree not to use the Service in a manner that would cause us to
            be deemed your regulated processor or business associate under such
            laws.
          </p>
        </section>

        {/* 5. Confidentiality & Security */}
        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">
            5. Confidentiality &amp; Security
          </h2>
          <p className="mb-2">
            <span className="font-semibold">5.1 Our Obligations.</span> We will
            implement reasonable and appropriate technical and organizational
            measures designed to protect Your Content against unauthorized or
            unlawful access, use, or disclosure.
          </p>
          <p className="mb-2">
            <span className="font-semibold">5.2 No Absolute Security.</span> You
            acknowledge that no method of transmission or storage is perfectly
            secure, and we cannot guarantee that unauthorized third parties will
            never be able to defeat our security measures.
          </p>
          <p>
            <span className="font-semibold">5.3 Your Obligations.</span> You are
            responsible for configuring and managing your account, access
            controls, and internal policies; limiting access to Your Content to
            authorized personnel; and complying with all confidentiality
            obligations owed to your clients and third parties.
          </p>
        </section>

        {/* 6. Use of AI & Output */}
        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">
            6. Use of AI &amp; Output
          </h2>
          <p className="mb-2">
            <span className="font-semibold">6.1 AI Providers.</span> We may use
            third-party AI models and infrastructure providers to process Your
            Content and generate outputs. Our use of such providers will be
            consistent with these Terms and our Privacy Policy.
          </p>
          <p className="mb-2">
            <span className="font-semibold">6.2 No Guarantee of Accuracy.</span>{' '}
            AI outputs may be incomplete, incorrect, or misleading. You
            understand and agree that:
          </p>
          <ul className="mb-2 list-disc pl-6">
            <li>
              Outputs should not be relied upon as factually or legally correct
              without independent review;
            </li>
            <li>
              You remain solely responsible for verifying citations,
              authorities, calculations, and factual statements; and
            </li>
            <li>
              You will not present any output as final legal advice without
              appropriate professional review.
            </li>
          </ul>
          <p>
            <span className="font-semibold">6.3 Responsibility for Use.</span>{' '}
            You are solely responsible for how you use AI outputs in your
            practice and any consequences arising from reliance on those
            outputs.
          </p>
        </section>

        {/* 7. Acceptable Use */}
        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">7. Acceptable Use</h2>
          <p className="mb-2">You agree not to use the Service to:</p>
          <ol className="list-decimal space-y-1 pl-6">
            <li>
              Upload, store, or transmit content that is unlawful, defamatory,
              infringing, harassing, threatening, or otherwise objectionable;
            </li>
            <li>
              Violate any court order, confidentiality obligation, protective
              order, or privilege;
            </li>
            <li>
              Reverse engineer, decompile, or attempt to extract source code
              from the Service or underlying models, except to the extent such
              restrictions are prohibited by law;
            </li>
            <li>
              Interfere with or disrupt the integrity or performance of the
              Service;
            </li>
            <li>
              Attempt unauthorized access to any accounts, systems, or networks;
            </li>
            <li>
              Send spam, phishing, or other unsolicited or deceptive
              communications; or
            </li>
            <li>
              Train or develop competing AI models using the Service or any
              outputs, except as expressly permitted by us in writing.
            </li>
          </ol>
          <p className="mt-2">
            We may suspend or terminate your access to the Service immediately
            if we believe you have violated this Section 7.
          </p>
        </section>

        {/* 8. Third-Party Services */}
        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">
            8. Third-Party Services
          </h2>
          <p>
            The Service may integrate with or rely on third-party services,
            platforms, or AI providers. Your use of such third-party services
            may be subject to additional terms and privacy policies of those
            third parties. We are not responsible for third-party services and
            do not control their content, accuracy, or availability.
          </p>
        </section>

        {/* 9. Fees & Payment */}
        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">
            9. Fees &amp; Payment (If Applicable)
          </h2>
          <p className="mb-2">
            <span className="font-semibold">9.1 Subscription Plans.</span>{' '}
            Access to certain features may require payment of subscription fees
            or usage-based fees, as described at the time you sign up or in your
            order form.
          </p>
          <p className="mb-2">
            <span className="font-semibold">9.2 Billing.</span> You authorize us
            (or our payment processor) to charge all applicable fees to your
            chosen payment method on the schedule described in your plan.
          </p>
          <p>
            <span className="font-semibold">9.3 No Refunds.</span> Unless
            otherwise stated in an order form or required by law, fees are
            non-refundable.
          </p>
        </section>

        {/* 10. Term & Termination */}
        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">
            10. Term &amp; Termination
          </h2>
          <p className="mb-2">
            <span className="font-semibold">10.1 Term.</span> These Terms apply
            from the time you first create an account or use the Service and
            continue until terminated.
          </p>
          <p className="mb-2">
            <span className="font-semibold">10.2 Your Termination.</span> You
            may stop using the Service at any time. You may request account
            closure by contacting your service administrator.
          </p>
          <p className="mb-2">
            <span className="font-semibold">
              10.3 Our Termination/Suspension.
            </span>{' '}
            We may suspend or terminate your access to the Service immediately,
            with or without notice, if:
          </p>
          <ul className="mb-2 list-disc pl-6">
            <li>You breach these Terms;</li>
            <li>
              We are required to do so by law or by a court or governmental
              order; or
            </li>
            <li>
              We decide, in our sole discretion, to discontinue the Service (in
              which case we will make reasonable efforts to provide advance
              notice).
            </li>
          </ul>
          <p className="mb-2">
            <span className="font-semibold">10.4 Effect of Termination.</span>{' '}
            Upon termination:
          </p>
          <ul className="list-disc pl-6">
            <li>Your right to access and use the Service will cease;</li>
            <li>
              We may delete or anonymize Your Content after a reasonable
              retention period, subject to legal obligations; and
            </li>
            <li>
              Sections that by their nature should survive (including, without
              limitation, ownership, disclaimers, limitations of liability,
              indemnification, and governing law) will survive.
            </li>
          </ul>
          <p className="mt-2">
            We recommend that you export or maintain your own copies of Your
            Content outside of the Service.
          </p>
        </section>

        {/* 11. Disclaimers */}
        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">11. Disclaimers</h2>
          <p className="mb-2">
            <span className="font-semibold">11.1 No Legal Advice.</span> The
            Service and all AI outputs are provided for informational and
            workflow-assistance purposes only. They do not constitute legal
            advice, do not create an attorney–client relationship between us and
            any user or client, and should not be relied upon as a substitute
            for legal advice from a qualified attorney.
          </p>
          <p className="mb-2">
            <span className="font-semibold">
              11.2 Service &quot;As Is&quot;.
            </span>{' '}
            The Service is provided on an &quot;AS IS&quot; and &quot;AS
            AVAILABLE&quot; basis, without warranties of any kind, whether
            express, implied, or statutory, including but not limited to any
            warranties of merchantability, fitness for a particular purpose,
            non-infringement, accuracy, or reliability.
          </p>
          <p>
            <span className="font-semibold">11.3 Availability.</span> We do not
            warrant that the Service will be uninterrupted, secure, or
            error-free, or that data loss will not occur.
          </p>
        </section>

        {/* 12. Limitation of Liability */}
        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">
            12. Limitation of Liability
          </h2>
          <p className="mb-2">
            To the maximum extent permitted by law, we will not be liable for
            any indirect, incidental, consequential, special, exemplary, or
            punitive damages, or for any loss of profits, revenue, data, or
            goodwill, arising out of or in connection with your use of or
            inability to use the Service, even if we have been advised of the
            possibility of such damages.
          </p>
          <p>
            Our total aggregate liability to you for all claims arising out of
            or relating to the Service or these Terms will not exceed the
            greater of: (a) the amount you paid us for the Service in the three
            (3) months preceding the event giving rise to the claim; or (b) US
            $100. Some jurisdictions do not allow certain limitations of
            liability, so parts of this Section may not apply to you.
          </p>
        </section>

        {/* 13. Indemnification */}
        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">13. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless{' '}
            <span className="font-semibold">[Pro Bono Law, Inc.]</span>, its
            officers, directors, employees, contractors, and agents from and
            against any claims, liabilities, damages, losses, and expenses
            (including reasonable attorneys’ fees) arising out of or in any way
            connected with your use of the Service; your violation of these
            Terms; your violation of any law or third-party right; or our
            processing of Your Content in accordance with these Terms.
          </p>
        </section>

        {/* 14. Changes */}
        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">
            14. Changes to the Service and the Terms
          </h2>
          <p className="mb-2">
            <span className="font-semibold">14.1 Service Changes.</span> We may
            modify or discontinue all or part of the Service at any time.
          </p>
          <p className="mb-2">
            <span className="font-semibold">14.2 Updates to Terms.</span> We may
            update these Terms from time to time. When we do, we will revise the
            &quot;Effective Date&quot; above and, where required by law, notify
            you by email or via the Service. Your continued use of the Service
            after changes become effective constitutes your acceptance of the
            updated Terms.
          </p>
          <p>
            If you do not agree to the updated Terms, you must stop using the
            Service and close your account.
          </p>
        </section>

        {/* 15. Governing Law & Dispute Resolution */}
        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">
            15. Governing Law &amp; Dispute Resolution
          </h2>
          <p className="mb-2">
            <span className="font-semibold">15.1 Governing Law.</span> These
            Terms will be governed by and construed in accordance with the laws
            of the State of <span className="font-semibold">[State]</span>,
            without regard to its conflict of laws principles.
          </p>
          <p>
            <span className="font-semibold">15.2 Venue.</span> Any dispute
            arising out of or relating to these Terms or the Service will be
            brought exclusively in the state or federal courts located in{' '}
            <span className="font-semibold">[County, State]</span>, and you
            consent to the personal jurisdiction of such courts. [Optional:
            Replace with arbitration / mediation clause if you prefer.]
          </p>
        </section>

        {/* 16. Miscellaneous */}
        <section className="mb-10">
          <h2 className="mb-2 text-xl font-semibold">16. Miscellaneous</h2>
          <p className="mb-2">
            <span className="font-semibold">16.1 Entire Agreement.</span> These
            Terms, together with any applicable order forms and our Privacy
            Policy, constitute the entire agreement between you and us regarding
            the Service.
          </p>
          <p className="mb-2">
            <span className="font-semibold">16.2 Severability.</span> If any
            provision of these Terms is held to be invalid or unenforceable, the
            remaining provisions will remain in full force and effect.
          </p>
          <p className="mb-2">
            <span className="font-semibold">16.3 No Waiver.</span> Our failure
            to enforce any right or provision under these Terms will not be
            deemed a waiver of such right or provision.
          </p>
          <p className="mb-2">
            <span className="font-semibold">16.4 Assignment.</span> You may not
            assign or transfer these Terms, by operation of law or otherwise,
            without our prior written consent. We may freely assign or transfer
            these Terms.
          </p>
          <p className="mb-2">
            <span className="font-semibold">16.5 Notices.</span> We may provide
            notices to you via email. You may provide notices to us through
            the notice channel designated by your service provider.
          </p>
        </section>
        <div className="mx-auto max-w-4xl px-4 py-10 text-sm leading-relaxed">
          <p className="mb-8">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
          <div className="flex relative gap-4">
            <div className="flex flex-none">
              <a
                href={authUrl}
                className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-500 dark:shadow-none dark:hover:bg-blue-600 dark:focus-visible:outline-blue-500">
                Sign Up
              </a>
            </div>
            <div className="flex flex-none">
              <Link
                href="/"
                className="rounded-md bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-xs hover:bg-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 dark:bg-gray-700 dark:shadow-none dark:hover:bg-gray-500 dark:focus-visible:outline-gray-200 dark:text-gray-200">
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </div>
    </FrontPage>
  );
}
