import 'dotenv/config';

const BASE_URL = process.env.SYNCPAY_BASE_URL || 'https://api.syncpayments.com.br';

let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const res = await fetch(`${BASE_URL}/api/partner/v1/auth-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SYNCPAY_CLIENT_ID,
      client_secret: process.env.SYNCPAY_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SyncPay auth failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // Token dura 1h; renova com 2 minutos de margem
  tokenExpiresAt = Date.now() + 58 * 60 * 1000;
  return cachedToken;
}

async function request(method, path, body) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(`SyncPay ${method} ${path} failed: ${res.status}`), {
      status: res.status,
      data,
    });
  }
  return data;
}

export async function createPixCharge({ amountCents, customer, description }) {
  return request('POST', '/api/partner/v1/cash-in', {
    amount: Number((amountCents / 100).toFixed(2)),
    description,
    client: {
      name: customer.name,
      email: customer.email,
      cpf: customer.cpf.replace(/\D/g, ''),
      phone: customer.phone.replace(/\D/g, ''),
    },
  });
}

export async function tokenizeCard({ number, holderName, expiryMonth, expiryYear, cvv }) {
  return request('POST', '/api/partner/v1/card-tokens', {
    card: {
      number,
      holder_name: holderName,
      expiry_month: expiryMonth,
      expiry_year: expiryYear,
      cvv,
    },
  });
}

export async function createCardCharge({ externalId, amountCents, cardToken, customer, description, device }) {
  return request('POST', '/api/partner/v1/credit-card', {
    amount: Number((amountCents / 100).toFixed(2)),
    description,
    card: { token: cardToken },
    client: {
      name: customer.name,
      email: customer.email,
      phone: `55${customer.phone.replace(/\D/g, '')}`,
      document: {
        type: 'cpf',
        number: customer.cpf.replace(/\D/g, ''),
      },
    },
    device,
  });
}

export async function getTransaction(transactionId) {
  return request('GET', `/api/partner/v1/transaction/${transactionId}`);
}

export async function refundTransaction(referenceId, reason, reasonDetails) {
  return request('POST', `/api/partner/v1/transaction/${referenceId}/refund`, {
    reason,
    reason_details: reasonDetails,
  });
}

export async function registerWebhook(url, events) {
  return request('POST', '/api/partner/v1/webhooks', { url, events });
}
