/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Case } from '../domain/case/types';

export class ApiClient {
  private static getHeaders(accessToken?: string): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return headers;
  }

  public static async getActiveCase(accessToken: string): Promise<Case> {
    const res = await fetch('/api/cases/active', { headers: this.getHeaders(accessToken) });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch active case');
    }
    return data.case;
  }

  public static async getAllCases(accessToken: string): Promise<Case[]> {
    const res = await fetch('/api/cases', { headers: this.getHeaders(accessToken) });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch cases');
    }
    return data.cases;
  }

  public static async createSupplierCase(
    params: {
      poNumber?: string;
      contactEmail?: string;
      contactName?: string;
      objective?: string;
    },
    accessToken: string
  ): Promise<Case> {
    const res = await fetch('/api/cases/create', {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to create case');
    }
    return data.case;
  }

  public static async prepareDraft(
    caseId: string,
    draft: { recipient?: string; subject?: string; body?: string } | undefined,
    accessToken: string
  ): Promise<Case> {
    const res = await fetch(`/api/cases/${caseId}/draft`, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify(draft || {}),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to prepare draft');
    }
    return data.case;
  }

  public static async approveAndSend(
    caseId: string,
    params: {
      recipient: string;
      subject: string;
      body: string;
    },
    accessToken: string
  ): Promise<Case> {
    const res = await fetch(`/api/cases/${caseId}/send`, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to send email via Gmail');
    }
    return data.case;
  }

  public static async syncReplies(
    caseId: string,
    accessToken: string
  ): Promise<{ case: Case; newRepliesCount: number }> {
    const res = await fetch(`/api/cases/${caseId}/sync`, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to sync replies from Gmail');
    }
    return {
      case: data.case,
      newRepliesCount: data.newRepliesCount || 0,
    };
  }

  public static async resolveCase(
    caseId: string,
    params: {
      acceptedCredit?: number;
      notes?: string;
      securityReviewAcknowledged?: boolean;
    },
    accessToken: string
  ): Promise<Case> {
    const res = await fetch(`/api/cases/${caseId}/resolve`, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to resolve case');
    }
    return data.case;
  }

  public static async resetCases(accessToken: string): Promise<Case> {
    const res = await fetch('/api/cases/reset', {
      method: 'POST',
      headers: this.getHeaders(accessToken),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to reset cases');
    }
    return data.case;
  }

  public static async getGmailStatus(): Promise<{
    configured: boolean;
    clientId: string;
    scopes: string[];
  }> {
    const res = await fetch('/api/gmail/status');
    const data = await res.json();
    return data;
  }

  public static async getGmailProfile(accessToken: string): Promise<{ email: string }> {
    const res = await fetch('/api/gmail/profile', {
      headers: this.getHeaders(accessToken),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to verify Gmail account');
    }
    return { email: data.email };
  }
}
