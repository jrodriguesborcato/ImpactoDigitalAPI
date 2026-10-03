import { Router } from 'express';
import { randomUUID } from 'crypto';
import supabase from '../db.js';
import { createPixCharge, tokenizeCard, createCardCharge } from '../syncpay.js';

const router = Router();

const PACKAGES = {
  followers_mundial: [
    { id: 1,  amount: 100,   price_cents: 500 },
    { id: 2,  amount: 250,   price_cents: 800 },
    { id: 3,  amount: 375,   price_cents: 1200 },
    { id: 4,  amount: 500,   price_cents: 1500 },
    { id: 5,  amount: 600,   price_cents: 1700 },
    { id: 6,  amount: 700,   price_cents: 1900 },
    { id: 7,  amount: 800,   price_cents: 2100 },
    { id: 8,  amount: 900,   price_cents: 2300 },
    { id: 9,  amount: 1000,  price_cents: 2500 },
    { id: 10, amount: 1500,  price_cents: 3500 },
    { id: 11, amount: 2000,  price_cents: 4500 },
    { id: 12, amount: 2500,  price_cents: 5500 },
    { id: 13, amount: 3000,  price_cents: 6500 },
    { id: 14, amount: 3500,  price_cents: 7500 },
    { id: 15, amount: 4000,  price_cents: 8500 },
    { id: 16, amount: 4500,  price_cents: 9500 },
    { id: 17, amount: 5000,  price_cents: 10000 },
    { id: 18, amount: 7000,  price_cents: 12000 },
    { id: 19, amount: 10000, price_cents: 13500 },
  ],
  followers_br: [
    { id: 20, amount: 100,  price_cents: 1200 },
    { id: 21, amount: 250,  price_cents: 3000 },
    { id: 22, amount: 375,  price_cents: 4500 },
    { id: 23, amount: 500,  price_cents: 6000 },
    { id: 24, amount: 600,  price_cents: 6500 },
    { id: 25, amount: 700,  price_cents: 7000 },
    { id: 26, amount: 800,  price_cents: 7500 },
    { id: 27, amount: 900,  price_cents: 8000 },
    { id: 28, amount: 1000, price_cents: 8500 },
    { id: 29, amount: 1500, price_cents: 12000 },
    { id: 30, amount: 2000, price_cents: 15000 },
    { id: 31, amount: 2500, price_cents: 18000 },
    { id: 32, amount: 3000, price_cents: 21000 },
    { id: 33, amount: 3500, price_cents: 24000 },
    { id: 34, amount: 4000, price_cents: 27000 },
    { id: 35, amount: 5000, price_cents: 30000 },
  ],
  likes_mundial: [
    { id: 40, amount: 100,  price_cents: 400 },
    { id: 41, amount: 250,  price_cents: 500 },
    { id: 42, amount: 500,  price_cents: 800 },
    { id: 43, amount: 1000, price_cents: 1000 },
    { id: 44, amount: 2000, price_cents: 1500 },
    { id: 45, amount: 3000, price_cents: 2200 },
    { id: 46, amount: 5000,  price_cents: 3000 },
    { id: 47, amount: 10000, price_cents: 5000 },
  ],
  views_reels: [
    { id: 50, amount: 1000,    price_cents: 500 },
    { id: 51, amount: 2000,    price_cents: 600 },
    { id: 52, amount: 3000,    price_cents: 700 },
    { id: 53, amount: 4000,    price_cents: 800 },
    { id: 54, amount: 5000,    price_cents: 1000 },
    { id: 55, amount: 10000,   price_cents: 1400 },
    { id: 56, amount: 20000,   price_cents: 2800 },
    { id: 57, amount: 50000,   price_cents: 4000 },
    { id: 58, amount: 100000,  price_cents: 5500 },
    { id: 59, amount: 500000,  price_cents: 8000 },
    { id: 60, amount: 1000000, price_cents: 10000 },
  ],
};

function validateOrderBody(body) {
  const { platform, category, package_id, target, payment_method, customer } = body;
  if (!platform || !['instagram', 'kwai'].includes(platform)) return 'Plataforma inválida.';
  if (!category || !['followers_mundial', 'followers_br', 'likes_mundial', 'views_reels'].includes(category)) return 'Categoria inválida.';
  if (!PACKAGES[category].find((p) => p.id === Number(package_id))) return 'Pacote não encontrado.';
  if (!target || target.trim().length < 2) return 'Usuário/link obrigatório.';
  if (!payment_method || !['pix', 'credit_card'].includes(payment_method)) return 'Método de pagamento inválido.';
  if (!customer?.name || !customer?.email || !customer?.cpf || !customer?.phone) return 'Dados do cliente obrigatórios (name, email, cpf, phone).';
  if (!/^\d{10,11}$/.test(customer.phone.replace(/\D/g, ''))) return 'Telefone inválido.';
  return null;
}

// POST /api/orders
router.post('/', async (req, res) => {
  const error = validateOrderBody(req.body);
  if (error) return res.status(400).json({ error });

  const { platform, category, package_id, target, payment_method, customer, card } = req.body;
  const pkg = PACKAGES[category].find((p) => p.id === Number(package_id));
  const externalId = randomUUID();
  const description = `${pkg.amount} ${category} - ${platform}`;

  const { data: order, error: insertError } = await supabase
    .from('orders')
    .insert({
      external_id: externalId,
      platform,
      category,
      package_id: pkg.id,
      amount: pkg.amount,
      price_cents: pkg.price_cents,
      target: target.trim(),
      payment_method,
      payment_status: 'pending',
      customer_name: customer.name,
      customer_email: customer.email,
      customer_cpf: customer.cpf.replace(/\D/g, ''),
    })
    .select()
    .single();

  if (insertError) {
    console.error('Supabase insert error:', insertError);
    return res.status(500).json({ error: 'Erro ao criar pedido.' });
  }

  try {
    if (payment_method === 'pix') {
      const pixData = await createPixCharge({
        amountCents: pkg.price_cents,
        customer,
        description,
      });
      const transactionId = pixData.identifier ?? pixData.transaction_id ?? pixData.id;

      await supabase
        .from('orders')
        .update({
          syncpay_transaction_id: transactionId,
          syncpay_pix_code: pixData.pix_code ?? pixData.qr_code,
          syncpay_pix_expiration: pixData.expiration,
        })
        .eq('id', order.id);

      return res.status(201).json({
        order_id: order.id,
        external_id: externalId,
        payment_method: 'pix',
        pix_code: pixData.pix_code ?? pixData.qr_code,
        pix_expiration: pixData.expiration,
        amount: pkg.price_cents,
      });
    }

    if (payment_method === 'credit_card') {
      if (!card?.number || !card?.holder_name || !card?.expiry_month || !card?.expiry_year || !card?.cvv) {
        return res.status(400).json({ error: 'Dados do cartão incompletos.' });
      }

      const tokenData = await tokenizeCard({
        number: card.number.replace(/\s/g, ''),
        holderName: card.holder_name,
        expiryMonth: card.expiry_month,
        expiryYear: card.expiry_year,
        cvv: card.cvv,
      });
      const cardToken = tokenData.data?.token ?? tokenData.token;
      if (!cardToken) throw new Error('SyncPay não retornou o token do cartão.');

      const chargeData = await createCardCharge({
        externalId,
        amountCents: pkg.price_cents,
        cardToken,
        customer,
        description,
        device: {
          ip: req.ip,
          user_agent: req.body.device?.user_agent || req.get('user-agent'),
          page_url: req.body.device?.page_url || process.env.FRONTEND_URL,
          metadata: req.body.device?.metadata || {},
        },
      });
      const transactionId = chargeData.data?.transaction_id ?? chargeData.transaction_id ?? chargeData.id;

      await supabase
        .from('orders')
        .update({ syncpay_transaction_id: transactionId })
        .eq('id', order.id);

      return res.status(201).json({
        order_id: order.id,
        external_id: externalId,
        payment_method: 'credit_card',
        payment_status: 'pending',
        transaction_id: transactionId,
        amount: pkg.price_cents,
      });
    }
  } catch (err) {
    await supabase.from('orders').update({ payment_status: 'failed' }).eq('id', order.id);
    console.error('SyncPay error:', err);
    return res.status(502).json({ error: 'Falha ao processar pagamento.', detail: err.message });
  }
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select()
    .or(`id.eq.${req.params.id},external_id.eq.${req.params.id}`)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Pedido não encontrado.' });
  res.json(data);
});

export default router;
