import LegalDocumentPage from '@/components/LegalDocumentPage';
import { LEGAL_DOCUMENTS, getLegalDocument, type LegalDocumentId } from '@/lib/legalDocuments';
import { notFound } from 'next/navigation';

const routeToDocument: Record<string, LegalDocumentId> = {
  terms: 'terms', baa: 'baa', dpa: 'dpa', aup: 'aup', 'end-client-terms': 'end-client-terms',
};

export default async function Page({ params }: { params: Promise<{ legalDocument: string }> }) {
  const { legalDocument } = await params;
  const id = routeToDocument[legalDocument];
  if (!id) notFound();
  return <LegalDocumentPage document={await getLegalDocument(id)} />;
}

export function generateMetadata({ params }: { params: Promise<{ legalDocument: string }> }) {
  return params.then(({ legalDocument }) => {
    const id = routeToDocument[legalDocument];
    return id ? { title: LEGAL_DOCUMENTS[id].title } : {};
  });
}
