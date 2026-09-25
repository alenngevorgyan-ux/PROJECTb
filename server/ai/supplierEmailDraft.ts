/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { serverConfig } from '../config';

export async function generateSupplierDraft(params: {
  poNumber?: string;
  objective?: string;
  counterpartyName?: string;
  contactName?: string;
  contactEmail: string;
  context?: string;
}): Promise<{ subject: string; body: string }> {
  const po = params.poNumber || '511';
  const vendor = params.counterpartyName || 'Acme Manufacturing';
  const contact = params.contactName || 'Fabrication Support';

  const defaultDraft = {
    subject: `Inquiry: PO #${po} Customs Hold & Confirmed Delivery ETA`,
    body: `Hi ${contact},

We noticed from freight dispatch tracking that our chassis order (PO #${po}) is currently on hold at customs transit.

Could you please confirm the current status, the reason for the customs inspection delay, and your revised guaranteed delivery ETA to our assembly facility?

If there is any documentation or clearance authorization required from our procurement side, please let us know immediately so we can expedite release.

Best regards,
Maya
AI Procurement Lead · My Company`,
  };

  if (!serverConfig.geminiApiKey) {
    return defaultDraft;
  }

  try {
    const ai = new GoogleGenAI({});
    const prompt = `You are Maya, an AI Procurement Lead for a modern hardware company.
Your job is to draft a concise, professional, polite supplier email inquiring about an order delay.

Details:
- Purchase Order: PO #${po}
- Counterparty: ${vendor}
- Supplier Contact: ${contact} (${params.contactEmail})
- Objective: ${params.objective || 'Check reason for customs delay and obtain confirmed delivery ETA.'}
- Context: ${params.context || 'Chassis shipment held at regional customs.'}

Rules:
1. Do not hallucinate missing facts or invent numbers.
2. Ask for the reason for delay and a confirmed delivery ETA.
3. Keep the tone professional, firm, yet collaborative.
4. Return ONLY a valid JSON object with the format:
{
  "subject": "...",
  "body": "..."
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text?.trim() || '';
    if (rawText) {
      const parsed = JSON.parse(rawText);
      if (parsed.subject && parsed.body) {
        return {
          subject: parsed.subject,
          body: parsed.body,
        };
      }
    }
    return defaultDraft;
  } catch (err) {
    console.error('Error generating email draft with Gemini, using fallback draft:', err);
    return defaultDraft;
  }
}
