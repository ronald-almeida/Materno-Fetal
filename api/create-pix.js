const API_BASE = 'https://api.gatewaypayshark.com.br';
const PRODUCT = {
  name: 'Formação Avançada em Medicina Materno-Fetal - Dra. Renata Lopes',
  description: 'Formação Avançada em Medicina Materno-Fetal',
  amount: 69970,
  currency: 'BRL'
};

const digits = value => String(value || '').replace(/\D/g, '');
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const apiKey = process.env.PAYSHARK_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'PAYSHARK_API_KEY não configurada na Vercel.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const taxId = digits(body.taxId);
    let phone = digits(body.phone);
    if (phone.startsWith('55') && (phone.length === 12 || phone.length === 13)) phone = phone.slice(2);

    if (!name || name.length < 3) return res.status(400).json({ error: 'Nome completo inválido.' });
    if (!validEmail(email)) return res.status(400).json({ error: 'Email inválido.' });
    if (![11, 14].includes(taxId.length)) return res.status(400).json({ error: 'CPF/CNPJ inválido.' });
    if (phone.length < 10 || phone.length > 11) return res.status(400).json({ error: 'Celular inválido.' });

    const externalRef = `materno-fetal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const payload = {
      amount: PRODUCT.amount,
      currency: PRODUCT.currency,
      method: 'PIX',
      description: PRODUCT.description,
      externalRef,
      payer: { name, taxId, email, phone },
      items: [{ name: PRODUCT.name, quantity: 1, unitPrice: PRODUCT.amount }]
    };

    const gateway = await fetch(`${API_BASE}/v1/payment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await gateway.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!gateway.ok) {
      console.error('Gateway error:', gateway.status, data);
      return res.status(gateway.status).json({ error: data?.message || data?.error || 'Erro ao gerar pagamento.', details: data });
    }

    const copypaste = data?.data?.copypaste || data?.copypaste;
    if (!copypaste) return res.status(502).json({ error: 'Gateway respondeu sem código Pix.', details: data });

    return res.status(200).json({
      id: data.id,
      amount: PRODUCT.amount,
      status: data.status || data.data?.status || 'PENDING',
      copypaste
    });
  } catch (error) {
    console.error('create-pix error:', error);
    return res.status(500).json({ error: 'Erro interno ao gerar o Pix.' });
  }
}
