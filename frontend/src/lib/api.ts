const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface OrderPayload {
  platform: string;
  category: string;
  package_id: number;
  target: string;
  payment_method: 'pix' | 'credit_card';
  customer: { name: string; email: string; cpf: string; phone: string };
  device?: { user_agent: string; page_url: string; metadata: Record<string, unknown> };
  card?: {
    number: string;
    holder_name: string;
    expiry_month: string;
    expiry_year: string;
    cvv: string;
  };
}

export interface OrderResponse {
  order_id: number;
  external_id: string;
  payment_method: 'pix' | 'credit_card';
  pix_code?: string;
  pix_expiration?: string;
  transaction_id?: string;
  payment_status?: string;
  amount: number;
}

export async function createOrder(payload: OrderPayload): Promise<OrderResponse> {
  const res = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao criar pedido.');
  return data;
}
