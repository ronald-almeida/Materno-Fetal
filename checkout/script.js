const form = document.getElementById('checkoutForm');
const generateBtn = document.getElementById('generatePix');
const copyBtn = document.getElementById('copyPix');
const feedback = document.getElementById('pixFeedback');
const qrPlaceholder = document.getElementById('qrPlaceholder');
const qrCode = document.getElementById('qrCode');
let pixCode = '';

const digits = (value = '') => String(value).replace(/\D/g, '');

function showFeedback(message, error = false) {
  feedback.textContent = message;
  feedback.style.color = error ? '#b42318' : '#333';
}

function getCustomer() {
  const email = document.getElementById('email').value.trim();
  const emailConfirm = document.getElementById('emailConfirm').value.trim();
  const name = document.getElementById('name').value.trim();
  const taxId = digits(document.getElementById('taxId').value);
  const phone = digits(document.getElementById('phone').value);

  if (!email || !emailConfirm || !name || !taxId || !phone) throw new Error('Preencha todos os dados pessoais.');
  if (email.toLowerCase() !== emailConfirm.toLowerCase()) throw new Error('Os emails informados não coincidem.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Digite um email válido.');
  if (taxId.length !== 11 && taxId.length !== 14) throw new Error('Digite um CPF ou CNPJ válido.');
  if (phone.length < 10 || phone.length > 11) throw new Error('Digite um celular válido.');

  return { email, name, taxId, phone };
}

async function renderQr(value) {
  qrCode.innerHTML = '';
  if (!window.QRCode || typeof window.QRCode.toCanvas !== 'function') {
    throw new Error('Gerador de QR Code não carregou. Atualize a página e tente novamente.');
  }

  const canvas = await window.QRCode.toCanvas(value, {
    width: 220,
    margin: 1,
    errorCorrectionLevel: 'M'
  });

  qrCode.appendChild(canvas);
  qrPlaceholder.style.display = 'none';
  qrCode.style.display = 'block';
}

async function generatePix() {
  const originalHtml = generateBtn.innerHTML;
  try {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Gerando código...';
    copyBtn.disabled = true;
    showFeedback('');

    const customer = getCustomer();
    const response = await fetch('/api/create-pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const details = Array.isArray(data.details) ? data.details.join(', ') : '';
      throw new Error(data.error || data.message || details || 'Não foi possível gerar o Pix.');
    }

    pixCode = data.copypaste || '';
    if (!pixCode) throw new Error('O gateway não retornou o código Pix.');

    await renderQr(pixCode);
    copyBtn.disabled = false;
    showFeedback('Código Pix gerado com sucesso.');
  } catch (error) {
    showFeedback(error.message || 'Erro ao gerar o Pix.', true);
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = originalHtml;
  }
}

async function copyPixCode() {
  if (!pixCode) return;
  try {
    await navigator.clipboard.writeText(pixCode);
    showFeedback('Código Pix copiado.');
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = pixCode;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    showFeedback(copied ? 'Código Pix copiado.' : 'Não foi possível copiar automaticamente.', !copied);
  }
}

generateBtn.addEventListener('click', generatePix);
copyBtn.addEventListener('click', copyPixCode);
form.addEventListener('submit', (event) => event.preventDefault());
