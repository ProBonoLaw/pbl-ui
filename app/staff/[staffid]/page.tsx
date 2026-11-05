'use client';

import FrontPage from '@/components/FrontPage';
import Image from 'next/image';
import { StaffModel, parseStaffModel } from '@/lib/types';
import { useEffect, useState } from 'react';

export default function StaffPage({
  params,
}: Readonly<{
  params: Promise<{ staffid: string }>;
}>) {
  const [staffData, setStaffData] = useState<StaffModel | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    (async () => {
      const { staffid } = await params;
      setStaffId(staffid);
      setPhotoFailed(false);
    })();
  }, [params]);

  useEffect(() => {
    if (!staffId) return;

    (async () => {
      const urlencodedStaffId = encodeURIComponent(staffId);
      const res = await fetch(`/api/staff/${urlencodedStaffId}`, {
        method: 'GET',
      });
      if (!res.ok) {
        setError('Failed to load staff member details.');
        return;
      }
      const data = await res.json();
      setStaffData(parseStaffModel(data));
    })();
  }, [staffId]);

  const photoUrl = staffId
    ? `/api/staff/${encodeURIComponent(staffId)}/photo`
    : null;

  let content;
  if (error) {
    content = <div>{error}</div>;
  } else if (staffData) {
    content = (
      <div>
        <div className="flex flex-col items-center mb-6">
          {!photoFailed && photoUrl ? (
            <Image
              src={photoUrl}
              alt={`${staffData.displayName}'s profile photo`}
              width={240}
              height={240}
              className="w-60 h-60 rounded-full object-cover mb-4"
              // if the API 404s, Image will error; flip to fallback UI
              onError={() => setPhotoFailed(true)}
              // optional: avoids blurred placeholder warnings
              priority
            />
          ) : (
            <div className="w-60 h-60 rounded-full bg-gray-300 mb-4 flex items-center justify-center">
              <span className="text-gray-500">No Photo</span>
            </div>
          )}
        </div>

        <p>
          <strong>Focus:</strong> {staffData.focus}
        </p>
        <p>
          <strong>Highlight:</strong> {staffData.highlight}
        </p>
        <p>
          <strong>Experience:</strong> {staffData.experience}
        </p>
      </div>
    );
  } else {
    content = <div>Loading...</div>;
  }

  return (
    <FrontPage
      title={staffData ? staffData.displayName : 'Staff Member Profile'}
      description={
        staffData ? staffData.role : 'Loading staff member details...'
      }>
      {content}
    </FrontPage>
  );
}
