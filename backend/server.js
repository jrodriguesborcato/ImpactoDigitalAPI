import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import ordersRouter from './routes/orders.js';
import webhooksRouter from './routes/webhooks.js';

const app = express();
const frontendOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || frontendOrigins.length === 0 || frontendOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origem não autorizada pelo CORS.'));
  },
  methods: ['GET', 'POST'],
}));

app.use(express.json({
  verify(req, _res, buffer) {
    req.rawBody = Buffer.from(buffer);
  },
}));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/orders', ordersRouter);
app.use('/api/webhooks', webhooksRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// Exporta para Vercel (serverless) e também inicia localmente
if (process.env.NODE_ENV !== 'production' || process.env.LOCAL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Backend rodando em http://localhost:${PORT}`));
}

export default app;
