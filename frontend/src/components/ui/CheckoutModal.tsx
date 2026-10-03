import { useState } from 'react';
import { X, Copy, Check, Loader2, CreditCard, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { createOrder, type OrderResponse } from '@/lib/api';
import type { Category } from '@/data/constants';

interface Package {
  id: number;
  amount: string;
  price: string;
}

interface CheckoutModalProps {
  platform: string;
  category: Category;
  pkg: Package;
  onClose: () => void;
}

type Step = 'form' | 'success';
type PaymentMethod = 'pix' | 'credit_card';

function maskCpf(value: string) {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskCard(value: string) {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})/g, '$1 ').trim();
}

export default function CheckoutModal({ platform, category, pkg, onClose }: CheckoutModalProps) {
  const [step, setStep] = useState<Step>('form');
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<OrderResponse | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [target] = useState(() => {
    const el = document.querySelector<HTMLInputElement>(`[data-pkg="${pkg.id}"]`);
    return el?.value ?? '';
  });
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardMonth, setCardMonth] = useState('');
  const [cardYear, setCardYear] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await createOrder({
        platform,
        category,
        package_id: pkg.id,
        target: target || name,
        payment_method: method,
        customer: { name, email, cpf: cpf.replace(/\D/g, ''), phone: phone.replace(/\D/g, '') },
        ...(method === 'credit_card' && {
          device: {
            user_agent: window.navigator.userAgent,
            page_url: window.location.href,
            metadata: {},
          },
        }),
        ...(method === 'credit_card' && {
          card: {
            number: cardNumber.replace(/\s/g, ''),
            holder_name: cardName,
            expiry_month: cardMonth,
            expiry_year: cardYear,
            cvv: cardCvv,
          },
        }),
      });
      setResult(data);
      setStep('success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  }

  function copyPix() {
    if (!result?.pix_code) return;
    navigator.clipboard.writeText(result.pix_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const categoryLabel: Record<Category, string> = {
    followers_mundial: 'seguidores',
    followers_br: 'seguidores',
    likes_mundial: 'curtidas',
    views_reels: 'visualizações',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{platform}</p>
            <h2 className="font-display font-bold text-lg">
              {pkg.amount} {categoryLabel[category]}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl font-display font-bold text-primary">{pkg.price}</span>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Método de pagamento */}
            <div className="flex bg-secondary rounded-xl p-1 gap-1">
              {(['pix', 'credit_card'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                    method === m ? 'bg-background shadow text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {m === 'pix' ? <QrCode size={15} /> : <CreditCard size={15} />}
                  {m === 'pix' ? 'PIX' : 'Cartão'}
                </button>
              ))}
            </div>

            {/* Dados do cliente */}
            <div className="space-y-3">
              <input
                required
                type="text"
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/60"
              />
              <input
                required
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/60"
              />
              <input
                required
                type="tel"
                placeholder="Telefone com DDD"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                autoComplete="tel-national"
                className="w-full bg-secondary border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/60"
              />
              <input
                required
                type="text"
                placeholder="CPF (000.000.000-00)"
                value={cpf}
                onChange={(e) => setCpf(maskCpf(e.target.value))}
                className="w-full bg-secondary border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Campos do cartão */}
            {method === 'credit_card' && (
              <div className="space-y-3 pt-1">
                <input
                  required
                  type="text"
                  placeholder="Número do cartão"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(maskCard(e.target.value))}
                  className="w-full bg-secondary border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/60"
                />
                <input
                  required
                  type="text"
                  placeholder="Nome no cartão"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value.toUpperCase())}
                  className="w-full bg-secondary border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/60"
                />
                <div className="flex gap-3">
                  <input
                    required
                    type="text"
                    placeholder="MM"
                    maxLength={2}
                    value={cardMonth}
                    onChange={(e) => setCardMonth(e.target.value.replace(/\D/g, ''))}
                    className="w-16 bg-secondary border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/60"
                  />
                  <input
                    required
                    type="text"
                    placeholder="AAAA"
                    maxLength={4}
                    value={cardYear}
                    onChange={(e) => setCardYear(e.target.value.replace(/\D/g, ''))}
                    className="w-24 bg-secondary border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/60"
                  />
                  <input
                    required
                    type="text"
                    placeholder="CVV"
                    maxLength={4}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 bg-secondary border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(139,92,246,0.35)]"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? 'Processando...' : `Pagar ${pkg.price}`}
            </button>

            <p className="text-xs text-muted-foreground text-center">
              Pagamento seguro · Início em 0–5 minutos
            </p>
          </form>
        )}

        {step === 'success' && result && (
          <div className="p-5 space-y-5 text-center">
            {result.payment_method === 'pix' ? (
              <>
                <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
                  <QrCode size={28} className="text-accent" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg">PIX gerado!</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Escaneie o QR Code ou copie o código abaixo. O pedido inicia após a confirmação do pagamento.
                  </p>
                </div>
                {result.pix_code && (
                  <div className="mx-auto w-fit rounded-xl bg-white p-3">
                    <QRCodeSVG
                      value={result.pix_code}
                      size={192}
                      level="M"
                      includeMargin
                      aria-label="QR Code para pagamento PIX"
                    />
                  </div>
                )}
                <div className="bg-secondary rounded-xl p-3 text-left">
                  <p className="text-xs text-muted-foreground mb-2">Código PIX copia e cola</p>
                  <p className="text-xs break-all font-mono text-foreground/80 leading-relaxed">
                    {result.pix_code}
                  </p>
                </div>
                <button
                  onClick={copyPix}
                  className="w-full h-11 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? 'Copiado!' : 'Copiar código PIX'}
                </button>
              </>
            ) : (
              <>
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <CreditCard size={28} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg">Pedido recebido!</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Seu pagamento está sendo processado. O pedido inicia automaticamente após a confirmação.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">Pedido #{result.order_id}</p>
              </>
            )}
            <button
              onClick={onClose}
              className="w-full h-10 border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
