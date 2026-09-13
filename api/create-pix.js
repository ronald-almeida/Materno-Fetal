const API_BASE = 'https://api.gatewaypayshark.com.br';
const PRODUCT = {
  name: 'Formação Avançada em Medicina Materno-Fetal - Dra. Renata Lopes',
  description: 'Formação Avançada em Medicina Materno-Fetal',
  amount: 697,
  currency: 'BRL'
};

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTaxId(value) {
  return clean(value).replace(/\D/g, '');
}

function normalizePhone(value) {
  const digits = clean(value).replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits.slice(2);
  return digits;
}

function makeExternalRef() {
  return `materno-fetal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const name = clean(body.name);
    const email = clean(body.email).toLowerCase();
    const taxId = normalizeTaxId(body.taxId);
    const phone = normalizePhone(body.phone);

    if (!name || !email || !taxId || !phone) {
      return res.status(400).json({ error: 'Preencha nome, email, CPF/CNPJ e celular.' });
    }

    if (!process.env.PAYSHARK_API_KEY) {
      return res.status(500).json({ error: 'PAYSHARK_API_KEY não configurada.' });
    }

    const externalRef = makeExternalRef();
    const payload = {
      amount: PRODUCT.amount,
      currency: PRODUCT.currency,
      method: 'PIX',
      description: PRODUCT.description,
      externalRef,
      payer: {
        name,
        taxId,
        email,
        phone
      },
      items: [{
        quantity: 1,
        name: PRODUCT.name,
        price: PRODUCT.amount,
        type: 'DIGITAL'
      }]
    };

    const gateway = await fetch(`${API_BASE}/v1/payment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSHARK_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await gateway.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

    if (!gateway.ok) {
      return res.status(gateway.status).json({
        error: data?.message || data?.error || 'Não foi possível gerar o PIX.',
        details: data?.details || data?.errors || undefined
      });
    }

    const copypaste = data?.data?.copypaste || data?.copypaste || data?.data?.copyPaste || data?.copyPaste;

    return res.status(200).json({
      id: data?.id || data?.data?.id,
      amount: PRODUCT.amount,
      status: data?.status || data?.data?.status || 'PENDING',
      copypaste
    });
  } catch (error) {
    console.error('create-pix error:', error);
    return res.status(500).json({ error: 'Erro interno ao gerar o PIX.' });
  }
}
