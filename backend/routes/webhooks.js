import { Router } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import supabase from '../db.js';

const router = Router();

function validateWebhookSignature(req) {
  const secret = process.env.SYNCPAY_WEBHOOK_SECRET;
  const signature = req.get('x-syncpay-signature');
  const match = /^t=(\d+),v1=([a-f\d]{64})$/.exec(signature || '');
  if (!secret || !match || !Buffer.isBuffer(req.rawBody)) return false;

  const timestamp = Number(match[1]);
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const expected = createHmac('sha256', secret)
    .update(`${match[1]}.`)
    .update(req.rawBody)
    .digest();
  const received = Buffer.from(match[2], 'hex');

  return received.length === expected.length && timingSafeEqual(received, expected);
}

// POST /api/webhooks/syncpay
router.post('/syncpay', async (req, res) => {
  if (!validateWebhookSignature(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = req.body;
  const event = req.get('x-syncpay-event') ?? payload.event ?? payload.type;

  await supabase.from('webhook_logs').insert({ event, payload: JSON.stringify(payload) });

  const transaction = payload.transaction ?? payload.data ?? payload;
  const transactionId = transaction.reference_id ?? transaction.transaction_id ?? transaction.identifier ?? transaction.id;
  if (!transactionId) return res.sendStatus(200);

  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('syncpay_transaction_id', transactionId)
    .single();

  if (!order) return res.sendStatus(200);

  const statusMap = {
    completed: 'completed',
    approved: 'completed',
    paid: 'completed',
    pending: 'pending',
    failed: 'failed',
    declined: 'failed',
    refused: 'failed',
    expired: 'failed',
    canceled: 'failed',
    cancelled: 'failed',
    refunded: 'refunded',
    chargeback: 'refunded',
  };
  const legacyStatusMap = {
    'credit_card.updated': mapCardStatus,
    'credit_card.created': () => 'pending',
    'pix.paid': () => 'completed',
    'pix.expired': () => 'failed',
    'pix.created': () => 'pending',
  };

  const paymentStatus = event === 'transaction.created'
    ? 'pending'
    : event === 'transaction.updated'
      ? statusMap[transaction.status]
      : legacyStatusMap[event]?.(payload);
  if (!paymentStatus) return res.sendStatus(200);

  await supabase.from('orders').update({ payment_status: paymentStatus }).eq('id', order.id);

  return res.sendStatus(200);
});

function mapCardStatus(payload) {
  const status = payload.data?.status ?? payload.status;
  return { completed: 'completed', approved: 'completed', failed: 'failed', declined: 'failed', refunded: 'refunded' }[status] ?? 'pending';
}

export default router;
