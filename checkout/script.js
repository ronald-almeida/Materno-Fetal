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

function ensurePixModal() {
  let modal = document.getElementById('pixModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'pixModal';
  modal.className = 'pix-modal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="pix-modal-backdrop" data-close-pix></div>
    <div class="pix-modal-card" role="dialog" aria-modal="true" aria-labelledby="pixModalTitle">
      <button type="button" class="pix-modal-close" data-close-pix aria-label="Fechar">×</button>
      <h3 id="pixModalTitle">Pague com Pix</h3>
      <p class="pix-modal-subtitle">Escaneie o QR Code ou copie o código Pix abaixo.</p>
      <div id="pixModalQr" class="pix-modal-qr"></div>
      <label class="pix-code-label" for="pixCodeField">Código Pix copia e cola</label>
      <textarea id="pixCodeField" class="pix-code-field" readonly></textarea>
      <button type="button" id="pixModalCopy" class="pix-modal-copy">Copiar código Pix</button>
      <div id="pixModalFeedback" class="pix-modal-feedback"></div>
    </div>`;

  document.body.appendChild(modal);
  modal.querySelectorAll('[data-close-pix]').forEach(el => el.addEventListener('click', closePixModal));
  modal.querySelector('#pixModalCopy').addEventListener('click', () => copyPixCode(modal.querySelector('#pixModalFeedback')));
  return modal;
}

function openPixModal() {
  const modal = ensurePixModal();
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('pix-modal-open');
}

function closePixModal() {
  const modal = document.getElementById('pixModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('pix-modal-open');
}

function loadQrLibrary() {
  return new Promise((resolve, reject) => {
    if (typeof window.QRCode === 'function') return resolve();

    const existing = document.getElementById('qrcodejs-fallback');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Não foi possível carregar o gerador de QR Code.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'qrcodejs-fallback';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não foi possível carregar o gerador de QR Code.'));
    document.head.appendChild(script);
  });
}

async function renderQr(target, value, size = 220) {
  await loadQrLibrary();
  target.innerHTML = '';

  if (typeof window.QRCode !== 'function') {
    throw new Error('Gerador de QR Code indisponível.');
  }

  new window.QRCode(target, {
    text: value,
    width: size,
    height: size,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: window.QRCode.CorrectLevel.M
  });
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

    const modal = ensurePixModal();
    const modalQr = modal.querySelector('#pixModalQr');
    const pixField = modal.querySelector('#pixCodeField');
    const modalFeedback = modal.querySelector('#pixModalFeedback');

    pixField.value = pixCode;
    modalFeedback.textContent = '';

    await renderQr(modalQr, pixCode, 220);

    qrPlaceholder.style.display = 'none';
    qrCode.style.display = 'none';
    copyBtn.disabled = false;
    showFeedback('Código Pix gerado com sucesso.');
    openPixModal();
  } catch (error) {
    showFeedback(error.message || 'Erro ao gerar o Pix.', true);
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = originalHtml;
  }
}

async function copyPixCode(targetFeedback = feedback) {
  if (!pixCode) return;
  try {
    await navigator.clipboard.writeText(pixCode);
    targetFeedback.textContent = 'Código Pix copiado.';
    targetFeedback.style.color = '#008f3d';
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = pixCode;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    targetFeedback.textContent = copied ? 'Código Pix copiado.' : 'Não foi possível copiar automaticamente.';
    targetFeedback.style.color = copied ? '#008f3d' : '#b42318';
  }
}

generateBtn.addEventListener('click', generatePix);
copyBtn.addEventListener('click', () => copyPixCode());
form.addEventListener('submit', (event) => event.preventDefault());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closePixModal();
});
