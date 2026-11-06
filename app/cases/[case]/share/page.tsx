'use client';
import { logger } from '@/lib/logger';
import CasePageTemplate from '@/components/cases/CasePageTemplate';
import { StackedList, StackedListItem, StatusBadge } from '@/components/lists/StackedList';
import { useAuth } from '@/hooks/useAuth';
import { getDocumentAccessRoleLabel } from '@/lib/sharePointAccess';
import { UserAccount } from '@/lib/types';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export default function SharePage({
  params,
}: {
  params: Promise<{ case: string }>;
}) {
  const [caseId, setCaseId] = useState<string | null>(null);
  useEffect(() => {
    params.then((p) => setCaseId(p.case));
  }, [params]);
  const { fetchWithAuth, getProfile } = useAuth();
  const [data, setData] = useState<UserAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [currentUserOid, setCurrentUserOid] = useState<string>('');
  const getProfileRef = useRef(getProfile);

  useEffect(() => {
    getProfileRef.current = getProfile;
  }, [getProfile]);

  useEffect(() => {
    if (!caseId) {
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const profile = await getProfileRef.current();
        const oid = profile?.id || '';
        setCurrentUserOid(oid);

        logger.info('Fetching shared users data...');
        const res = await fetchWithAuth(`/api/accounts/cases/${caseId}/users`, {
          method: 'GET',
          cache: 'no-store',
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        setData(json);
        setIsOwner(
          json.some(
            (entry: UserAccount) =>
              !entry.casesAccounts?.[0]?.isGuest && entry.oids.includes(oid),
          ),
        );
      } catch (e: unknown) {
        const error = e as Error;
        if (error.name !== 'AbortError')
          setError(error.message ?? 'Request failed');
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      ac.abort();
    };
  }, [caseId, fetchWithAuth]);

  return (
    <CasePageTemplate
      title="Case Sharing"
      isLoading={loading}
      params={params}
      actionSection={
        isOwner && (
          <div className="flex justify-end pr-8 md:pr-0">
            <Link
              href={`/cases/${caseId}/share/add`}
              className="btn btn-primary btn-lg border-1 rounded-md px-4 py-2 md:font-semibold bg-blue-600 text-white hover:bg-blue-700  md:text-base text-sm">
              Add User
            </Link>
          </div>
        )
      }>
      <div className="mt-4">
        {error && <p className="text-red-500">Error: {error}</p>}
        {data && (
          <StackedList isEmpty={data.length === 0} emptyMessage="No users have access to this case.">
            {data.map((entry, index) => {
              const access = entry.casesAccounts?.[0];
              const isGuest = Boolean(access?.isGuest);
              const isOwnersOwnRow = !isGuest && !!currentUserOid && entry.oids.includes(currentUserOid);
              const name = entry.emailAddresses.join(', ') || 'Unknown user';
              return (
                <StackedListItem
                  key={entry.id ?? entry.oids[0] ?? entry.emailAddresses[0] ?? index}
                  title={name}
                  badge={<StatusBadge tone={isGuest ? 'blue' : 'green'}>{isGuest ? 'Guest' : 'Owner'}</StatusBadge>}
                  metadata={[
                    `Documents: ${isGuest ? getDocumentAccessRoleLabel(access?.documentAccessRole, access?.canAccessDocuments) : 'Administrator'}`,
                    `QA: ${!isGuest || access?.canUseQA ? 'Yes' : 'No'}`,
                    `Declarations: ${!isGuest || access?.canGenerateDeclaration ? 'Yes' : 'No'}`,
                    access?.requestDate ? `Requested ${new Date(access.requestDate).toLocaleDateString('en-US')}` : 'Request date unavailable',
                  ]}
                  menuLabel={`Options for ${name}`}
                  menuActions={isOwner && !isOwnersOwnRow ? [{ label: 'Edit access', href: `./share/${entry.oids}/edit` }] : []}
                />
              );
            })}
          </StackedList>
        )}
      </div>
    </CasePageTemplate>
  );
}
