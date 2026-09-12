export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  return res.status(501).json({ error: 'Integração de pagamento pendente de configuração.' });
}
