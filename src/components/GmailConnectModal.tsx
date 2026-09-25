/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useWorld } from '../context/WorldContext';
import { Mail, CheckCircle2, ShieldCheck, X, AlertTriangle, Key, ExternalLink } from 'lucide-react';
import { ApiClient } from '../services/apiClient';

export const GmailConnectModal: React.FC = () => {
  const {
    showGmailConnectModal,
    setShowGmailConnectModal,
    gmailAuth,
    connectGmail,
    disconnectGmail,
    setSupplierMode,
  } = useWorld();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>('');
  const [manualToken, setManualToken] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState(false);

  useEffect(() => {
    if (showGmailConnectModal) {
      setError(null);
      ApiClient.getGmailStatus()
        .then((data) => {
          if (data.clientId) {
            setClientId(data.clientId);
          }
        })
        .catch(() => {});
    }
  }, [showGmailConnectModal]);

  if (!showGmailConnectModal) return null;

  const handleOAuthConnect = () => {
    setError(null);
    setLoading(true);

    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      setError('Google Identity Services script is loading. Please check internet connection or enter token manually.');
      setLoading(false);
      return;
    }

    if (!clientId) {
      setError('Google OAuth Client ID is not configured.');
      setLoading(false);
      return;
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope:
          'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email',
        callback: async (response: any) => {
          if (response.error) {
            setError(`OAuth authorization error: ${response.error}`);
            setLoading(false);
            return;
          }

          if (response.access_token) {
            try {
              const profile = await ApiClient.getGmailProfile(response.access_token);
              connectGmail(response.access_token, profile.email);
              setSupplierMode('REAL');
              setLoading(false);
              setShowGmailConnectModal(false);
            } catch (err: any) {
              setError(`Connected, but failed to fetch profile: ${err.message}`);
              setLoading(false);
            }
          }
        },
      });

      client.requestAccessToken();
    } catch (err: any) {
      setError(`Failed to initiate Google OAuth: ${err.message}`);
      setLoading(false);
    }
  };

  const handleManualTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;

    setError(null);
    setLoading(true);
    try {
      const profile = await ApiClient.getGmailProfile(manualToken.trim());
      connectGmail(manualToken.trim(), profile.email);
      setSupplierMode('REAL');
      setLoading(false);
      setShowGmailConnectModal(false);
    } catch (err: any) {
      setError(`Token verification failed: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                Connect Google Workspace
              </div>
              <div className="text-xs text-slate-400">Real Gmail Rail for Maya Supplier Workflows</div>
            </div>
          </div>
          <button
            onClick={() => setShowGmailConnectModal(false)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-slate-300">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-lg text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {gmailAuth.isConnected ? (
            <div className="p-4 bg-emerald-950/30 border border-emerald-800/50 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Connected Account</span>
              </div>
              <div className="text-sm font-mono text-white bg-slate-950/80 p-2.5 rounded border border-emerald-900/50">
                {gmailAuth.email}
              </div>
              <div className="text-[11px] text-slate-400">
                Active Scopes: <span className="font-mono text-slate-300">gmail.send, gmail.readonly</span>
              </div>
              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={() => {
                    disconnectGmail();
                    setSupplierMode('DEMO');
                  }}
                  className="px-3 py-1.5 bg-rose-900/50 hover:bg-rose-800 text-rose-200 border border-rose-700/60 rounded text-xs transition-colors"
                >
                  Disconnect Gmail
                </button>
                <button
                  onClick={() => setShowGmailConnectModal(false)}
                  className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3.5 bg-slate-950/60 rounded-lg border border-slate-800 space-y-2 leading-relaxed">
                <p>
                  To transition from the simulated vision demo to <strong>Real Supplier Mode</strong>, connect your Google Workspace / Gmail account.
                </p>
                <div className="flex items-start gap-2 pt-1 text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Human Approval Guaranteed:</strong> AI never sends outbound emails autonomously. Every outbound email requires explicit founder review and approval.
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={handleOAuthConnect}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 text-white rounded-lg font-semibold text-xs transition-all shadow-md active:scale-95"
                >
                  <Mail className="w-4 h-4" />
                  <span>{loading ? 'Connecting Google Account...' : 'Sign in with Google'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowManualInput(!showManualInput)}
                  className="w-full text-center text-[11px] text-slate-500 hover:text-slate-300 underline pt-1"
                >
                  {showManualInput ? 'Hide manual token input' : 'Enter existing OAuth Bearer Token manually'}
                </button>
              </div>

              {showManualInput && (
                <form onSubmit={handleManualTokenSubmit} className="pt-2 space-y-2 border-t border-slate-800">
                  <label className="block text-[11px] text-slate-400">
                    Google OAuth Access Token (Bearer):
                  </label>
                  <input
                    type="password"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="ya29.a0AfH6SM..."
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-600 px-3 py-2 rounded-lg font-mono focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="submit"
                    disabled={loading || !manualToken.trim()}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
                  >
                    Verify & Connect Token
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
