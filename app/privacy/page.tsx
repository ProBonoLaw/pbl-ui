import { getPrivacyPolicyDocument } from '@/lib/privacyPolicyDocuments';
import PrivacyContent from '@/components/PrivacyContent';

export const metadata = { title: 'Privacy and Security', description: 'Review ProBono Law privacy policies and independent SOC 2 Type 2 security attestation materials.' };

export default async function PrivacyPage() {
  return <PrivacyContent document={await getPrivacyPolicyDocument()} />;
}
