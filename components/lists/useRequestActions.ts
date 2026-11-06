'use client';

import { useAuth } from '@/hooks/useAuth';
import type { RequestData } from '@/lib/types';
import { useState } from 'react';

export function useRequestActions(caseId: string | null, onChanged: (request: RequestData, action: 'delete' | 'resubmit') => void | Promise<void>) {
  const { fetchWithAuth } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RequestData | null>(null);

  function requestDelete(request: RequestData) {
    if (!busyId) setPendingDelete(request);
  }

  function cancelDelete() {
    setPendingDelete(null);
  }

  function confirmDelete() {
    const request = pendingDelete;
    setPendingDelete(null);
    if (request) void runAction(request, 'delete');
  }

  async function runAction(request: RequestData, action: 'delete' | 'resubmit') {
    if (!caseId || busyId) return;
    setBusyId(request.id);
    setActionMessage(null);
    setActionError(null);
    try {
      const response = action === 'delete'
        ? await fetchWithAuth(`/api/accounts/cases/${encodeURIComponent(caseId)}/requests/${encodeURIComponent(request.id)}`, { method: 'DELETE' })
        : await fetchWithAuth(`/api/accounts/cases/${encodeURIComponent(caseId)}/${request.type === 'declaration' ? 'declarations' : request.type === 'argument-builder' ? 'argument-builder' : 'timeline'}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: crypto.randomUUID(), requestText: request.input }),
          });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `Unable to ${action} this request.`);
      }
      await onChanged(request, action);
      setActionMessage(action === 'delete' ? 'Request deleted.' : 'Request resubmitted. You will be notified when it is ready.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : `Unable to ${action} this request.`);
    } finally {
      setBusyId(null);
    }
  }

  return { busyId, actionMessage, actionError, pendingDelete, requestDelete, cancelDelete, confirmDelete, runAction };
}
