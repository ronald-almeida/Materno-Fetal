const form = document.getElementById('checkoutForm');
const generateBtn = document.getElementById('generatePix');
const copyBtn = document.getElementById('copyPix');
const feedback = document.getElementById('pixFeedback');
const qrPlaceholder = document.getElementById('qrPlaceholder');
const qrCode = document.getElementById('qrCode');
const modal = document.getElementById('modal');
const modalQr = document.getElementById('modalQr');
const modalCopy = document.getElementById('modalCopy');
const modalFeedback = document.getElementById('modalFeedback');
const closeModal = document.getElementById('closeModal');
let pixCode = '';

const digits = (value = '') => String(value).replace(/\D/g, '');
const money = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

async function renderQr(target, value, size = 220) {
  target.innerHTML = '';
  if (!window.QRCode) throw new Error('Biblioteca de QR Code não carregada.');
  await QRCode.toCanvas(value, { width: size, margin: 1, errorCorrectionLevel: 'M' }).then(canvas => target.appendChild(canvas));
}

async function generatePix() {
  try {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Gerando código...';
    showFeedback('');
    const customer = getCustomer();

    const response = await fetch('/api/create-pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || 'Não foi possível gerar o Pix.');
    if (!data.copypaste) throw new Error('A PayShark não retornou o código Pix.');

    pixCode = data.copypaste;
    copyBtn.disabled = false;
    qrPlaceholder.style.display = 'none';
    qrCode.style.display = 'block';
    await renderQr(qrCode, pixCode, 138);
    await renderQr(modalQr, pixCode, 220);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    showFeedback(`Pix gerado: ${money((data.amount || 69970) / 100)}.`);
  } catch (error) {
    showFeedback(error.message || 'Erro ao gerar Pix.', true);
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<span class="qr-mini">▦</span> Gerar código QR';
  }
}

async function copyPixCode(targetFeedback = feedback) {
  if (!pixCode) return;
  try {
    await navigator.clipboard.writeText(pixCode);
    targetFeedback.textContent = 'Código Pix copiado.';
    targetFeedback.style.color = '#008f3d';
  } catch {
    targetFeedback.textContent = 'Não foi possível copiar automaticamente. Selecione e copie o código Pix.';
    targetFeedback.style.color = '#b42318';
  }
}

generateBtn.addEventListener('click', generatePix);
copyBtn.addEventListener('click', () => copyPixCode());
modalCopy.addEventListener('click', () => copyPixCode(modalFeedback));
closeModal.addEventListener('click', () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); });
modal.querySelector('.modal-backdrop').addEventListener('click', () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); });
form.addEventListener('submit', event => event.preventDefault());
