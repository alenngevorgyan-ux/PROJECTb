/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useWorld } from '../context/WorldContext';
import { Mail, Send, Sparkles, AlertTriangle, ShieldCheck, X, CheckCircle2 } from 'lucide-react';
import { ApiClient } from '../services/apiClient';

export const SupplierDraftModal: React.FC = () => {
  const {
    showSupplierDraftModal,
    setShowSupplierDraftModal,
    activeCase,
    refreshActiveCase,
    gmailAuth,
    setShowGmailConnectModal,
    addRealityEvent,
    setCharacters,
    animateAgentWalk,
  } = useWorld();

  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeCase && showSupplierDraftModal) {
      setError(null);
      const draft = activeCase.draft;
      const initialRecipient =
        draft?.recipient && !draft.recipient.endsWith('.internal')
          ? draft.recipient
          : '';
      setRecipient(initialRecipient);
      setSubject(draft?.subject || `PO #${activeCase.poNumber || '511'} — Confirmed ETA required`);
      setBody(
        draft?.body ||
          `Hi Kurt,\n\nWe noticed shipment for PO #${activeCase.poNumber || '511'} is currently on hold. Could you please provide the reason for delay and your confirmed ETA for delivery to our assembly facility?\n\nThank you,\nMaya · AI Procurement Lead`
      );
    }
  }, [activeCase, showSupplierDraftModal]);

  if (!showSupplierDraftModal || !activeCase) return null;

  const isDemoAddress = recipient.toLowerCase().endsWith('.internal');
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);

  const handleRegenerateDraft = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const updatedCase = await ApiClient.prepareDraft(activeCase.id, {
        recipient,
        subject,
      });
      if (updatedCase.draft) {
        setSubject(updatedCase.draft.subject);
        setBody(updatedCase.draft.body);
      }
      refreshActiveCase();
    } catch (err: any) {
      setError(`Failed to regenerate draft with Gemini: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApproveAndSend = async () => {
    setError(null);

    if (!gmailAuth.isConnected || !gmailAuth.accessToken) {
      setError('Gmail is not connected. Connect your Google account first.');
      setShowGmailConnectModal(true);
      return;
    }

    if (!recipient.trim()) {
      setError('Recipient email address is required.');
      return;
    }

    if (isDemoAddress || !isValidEmail) {
      setError('Contact Safety: Real Mode requires a valid external supplier email. Do not send to demo internal dummy addresses.');
      return;
    }

    setIsSending(true);

    try {
      const updatedCase = await ApiClient.approveAndSend(
        activeCase.id,
        {
          recipient: recipient.trim(),
          subject: subject.trim(),
          body: body.trim(),
          approvedBy: 'Alex Founder',
        },
        gmailAuth.accessToken
      );

      // Add REAL RealityEvent
      addRealityEvent({
        agentId: 'maya',
        agentName: 'Maya',
        worldAction: `REAL GMAIL OUTBOUND: Maya sent PO #${activeCase.poNumber || '511'} inquiry to ${recipient.trim()}`,
        businessEvent: `Dispatched official supplier inquiry through Google Workspace Gmail API (Message ID: ${updatedCase.externalMessageId || 'sent'})`,
        category: 'SUPPLY',
        isReal: true,
      });

      refreshActiveCase();
      setShowSupplierDraftModal(false);

      // Visual world reaction: Maya walks to external communication station and waits
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === 'maya'
            ? {
                ...c,
                status: 'EN ROUTE',
                statusText: 'Dispatched real Gmail message. Walking to external rail...',
              }
            : c
        )
      );

      const waypoints = [
        { x: 3, y: 7 },
        { x: 3, y: 6 },
        { x: 3, y: 5 },
        { x: 4, y: 5 },
        { x: 5, y: 5 },
      ];

      animateAgentWalk('maya', waypoints, () => {
        setCharacters((prev) =>
          prev.map((c) =>
            c.id === 'maya'
              ? {
                  ...c,
                  status: 'WAITING FOR APPROVAL',
                  statusText: 'WAITING ON ACME (Real Gmail Rail)',
                }
              : c
          )
        );
      });
    } catch (err: any) {
      setError(`Failed to send email via Gmail: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>Supplier Message Draft</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                  REAL MODE
                </span>
              </div>
              <div className="text-xs text-slate-400">
                PO #{activeCase.poNumber || '511'} · Acme Manufacturing · Prepared by Maya
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowSupplierDraftModal(false)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-lg text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Contact Safety Warning */}
          <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg text-amber-200/90 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-amber-300">Contact Safety Protection:</div>
              <div className="text-[11px] leading-relaxed">
                You are about to send a real email from your connected Gmail address. Please provide the exact supplier recipient address below. Sending to test dummy domains is prohibited.
              </div>
            </div>
          </div>

          {/* Form fields */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-lg border border-slate-800">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                To (Exact Supplier Recipient):
              </label>
              <input
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="e.g. your-other-email@domain.com (for e2e test)"
                className="w-full bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 px-3 py-2 rounded-lg font-mono focus:outline-none focus:border-emerald-500"
              />
              {recipient && isDemoAddress && (
                <div className="text-[10px] text-rose-400 mt-1">
                  ⚠️ Cannot send to `.internal` demo addresses. Please enter a real recipient email.
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Subject:
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-xs text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-300">
                  Email Body:
                </label>
                <button
                  type="button"
                  onClick={handleRegenerateDraft}
                  disabled={isGenerating}
                  className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isGenerating ? 'Regenerating...' : 'Regenerate with Gemini'}</span>
                </button>
              </div>
              <textarea
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 px-3 py-2 rounded-lg font-sans leading-relaxed focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              Connected Gmail:{' '}
              <strong className="text-white font-mono">
                {gmailAuth.email || 'Not connected'}
              </strong>
            </span>
            {!gmailAuth.isConnected && (
              <button
                type="button"
                onClick={() => setShowGmailConnectModal(true)}
                className="text-red-400 hover:text-red-300 underline font-medium"
              >
                Connect Gmail
              </button>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowSupplierDraftModal(false)}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-xs font-medium transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition-colors"
            >
              {isEditing ? 'Editing Mode' : 'Edit'}
            </button>

            <button
              type="button"
              onClick={handleApproveAndSend}
              disabled={isSending || isGenerating || !isValidEmail || isDemoAddress}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-semibold transition-all shadow-md active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Sending via Gmail...' : 'Approve & Send'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
