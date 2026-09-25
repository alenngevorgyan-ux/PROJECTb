/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GmailThreadMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  snippet: string;
  internalDate: string;
}

export class GmailClient {
  private static decodeBase64Url(data: string): string {
    if (!data) return '';
    try {
      const sanitized = data.replace(/-/g, '+').replace(/_/g, '/');
      return Buffer.from(sanitized, 'base64').toString('utf8');
    } catch {
      return '';
    }
  }

  private static extractBodyFromPayload(payload: any): string {
    if (!payload) return '';

    // Direct body data
    if (payload.body && payload.body.data) {
      return this.decodeBase64Url(payload.body.data);
    }

    // Multipart body
    if (payload.parts && Array.isArray(payload.parts)) {
      // First look for text/plain
      const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
      if (textPart && textPart.body && textPart.body.data) {
        return this.decodeBase64Url(textPart.body.data);
      }

      // Then look for text/html
      const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
      if (htmlPart && htmlPart.body && htmlPart.body.data) {
        // Strip basic html tags
        const decoded = this.decodeBase64Url(htmlPart.body.data);
        return decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }

      // Recurse child parts
      for (const part of payload.parts) {
        const nested = this.extractBodyFromPayload(part);
        if (nested) return nested;
      }
    }

    return '';
  }

  /**
   * Retrieves the authenticated user's profile and email address.
   */
  public static async getProfile(accessToken: string): Promise<{ emailAddress: string }> {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gmail API getProfile failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    return {
      emailAddress: data.emailAddress || '',
    };
  }

  /**
   * Sends an outbound email via the official Gmail API messages.send.
   */
  public static async sendEmail(params: {
    accessToken: string;
    to: string;
    subject: string;
    body: string;
    threadId?: string;
  }): Promise<{ messageId: string; threadId: string }> {
    const { accessToken, to, subject, body, threadId } = params;

    // RFC 2822 format
    const lines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      body,
    ];

    const rawEmail = lines.join('\r\n');
    const base64UrlEncoded = Buffer.from(rawEmail)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const requestBody: { raw: string; threadId?: string } = {
      raw: base64UrlEncoded,
    };
    if (threadId) {
      requestBody.threadId = threadId;
    }

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gmail API messages.send failed (${res.status}): ${errorText}`);
    }

    const result = await res.json();
    return {
      messageId: result.id,
      threadId: result.threadId || result.id,
    };
  }

  /**
   * Retrieves all messages in a Gmail thread.
   */
  public static async getThread(params: {
    accessToken: string;
    threadId: string;
  }): Promise<{ id: string; messages: GmailThreadMessage[] }> {
    const { accessToken, threadId } = params;

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gmail API threads.get failed (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    const rawMessages: any[] = data.messages || [];

    const messages: GmailThreadMessage[] = rawMessages.map((msg) => {
      const headers: { name: string; value: string }[] = msg.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const bodyText = this.extractBodyFromPayload(msg.payload) || msg.snippet || '';

      return {
        id: msg.id,
        threadId: msg.threadId || data.id,
        from: getHeader('From'),
        to: getHeader('To'),
        subject: getHeader('Subject'),
        date: getHeader('Date'),
        body: bodyText,
        snippet: msg.snippet || '',
        internalDate: msg.internalDate || '',
      };
    });

    return {
      id: data.id,
      messages,
    };
  }
}
