import { getAccessToken } from './googleAuth.ts';
import { Reservation } from '../types/index.ts';

export interface SendGmailOptions {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  accessToken?: string;
}

/**
 * Encodes string to Base64URL (RFC 4648 § 5)
 */
function base64UrlEncode(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Builds standard RFC 2822 MIME message
 */
function buildRfc2822Message({
  to,
  subject,
  bodyText,
  bodyHtml,
}: {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const cleanSubject = subject.replace(/[\r\n]/g, '');

  const headers = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(cleanSubject)))}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
  ];

  const textPart = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(unescape(encodeURIComponent(bodyText))),
    '',
  ];

  const htmlContent =
    bodyHtml ||
    `<!DOCTYPE html><html><body><div style="font-family:sans-serif;line-height:1.6;">${bodyText.replace(
      /\n/g,
      '<br/>'
    )}</div></body></html>`;

  const htmlPart = [
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(unescape(encodeURIComponent(htmlContent))),
    '',
    `--${boundary}--`,
  ];

  return [...headers, ...textPart, ...htmlPart].join('\r\n');
}

/**
 * Sends an email message directly via Gmail API
 */
export async function sendGmailMessage(options: SendGmailOptions): Promise<{ id: string; threadId: string }> {
  const token = options.accessToken || (await getAccessToken());
  if (!token) {
    throw new Error('Conta Google / Gmail não conectada. Inicie sessão com o Google primeiro.');
  }

  const rawMime = buildRfc2822Message({
    to: options.to,
    subject: options.subject,
    bodyText: options.bodyText,
    bodyHtml: options.bodyHtml,
  });

  const encoded = base64UrlEncode(rawMime);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    const message = errorJson.error?.message || `Erro Gmail API (${res.status})`;
    throw new Error(message);
  }

  return res.json();
}

/**
 * Generates styled HTML email for Qué Pasa reservation notice
 */
export function generateReservationHtmlEmail(reservation: Reservation): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Confirmação de Reserva · Qué Pasa</title>
</head>
<body style="margin:0;padding:0;background-color:#071526;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
  <div style="max-width:600px;margin:24px auto;background:#0c1e33;border-radius:24px;border:1px solid #1e3a5f;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
    
    <!-- Header with Qué Pasa / Barba Azul styling -->
    <div style="background:linear-gradient(135deg, #071526 0%, #152e4d 100%);padding:36px 24px;text-align:center;border-bottom:1px solid #1e3a5f;">
      <span style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#f59e0b;font-weight:700;">Barba Azul Apresenta</span>
      <h1 style="margin:8px 0 4px 0;font-size:36px;letter-spacing:3px;color:#f8fafc;font-weight:800;">QUÉ PASA</h1>
      <p style="margin:0;font-size:13px;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;">Nikkei · Japanese + Peruvian · Aveiro</p>
    </div>

    <!-- Content -->
    <div style="padding:32px 28px;">
      <div style="text-align:center;margin-bottom:28px;">
        <span style="display:inline-block;background:#10b981;color:#ffffff;font-size:12px;font-weight:700;padding:6px 16px;border-radius:20px;text-transform:uppercase;letter-spacing:1px;">
          Reserva Confirmada Oficialmente
        </span>
        <h2 style="margin:16px 0 6px 0;font-size:22px;color:#ffffff;">Olá, ${reservation.customerName}!</h2>
        <p style="margin:0;color:#94a3b8;font-size:14px;">A sua mesa junto aos canais de Aveiro está reservada e pronta para o acolher.</p>
      </div>

      <!-- Reservation Code Card -->
      <div style="background:#071526;border:2px dashed #f59e0b;border-radius:18px;padding:20px;text-align:center;margin-bottom:28px;">
        <span style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;display:block;">Código da Reserva</span>
        <span style="font-size:32px;font-family:monospace;font-weight:800;color:#f59e0b;letter-spacing:3px;display:block;margin-top:4px;">${reservation.code}</span>
        <span style="font-size:11px;color:#64748b;display:block;margin-top:4px;">Apresente este código à chegada</span>
      </div>

      <!-- Details Grid -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid #1e3a5f;border-radius:16px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:8px 0;color:#94a3b8;">📅 Data:</td>
            <td style="padding:8px 0;text-align:right;font-weight:700;color:#ffffff;">${reservation.date}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#94a3b8;">⏰ Horário:</td>
            <td style="padding:8px 0;text-align:right;font-weight:700;color:#ffffff;">${reservation.time}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#94a3b8;">👥 Grupo:</td>
            <td style="padding:8px 0;text-align:right;font-weight:700;color:#ffffff;">${reservation.guests} pessoas</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#94a3b8;">🪑 Mesa Atribuída:</td>
            <td style="padding:8px 0;text-align:right;font-weight:700;color:#f59e0b;">Mesa ${reservation.tableId}</td>
          </tr>
          ${reservation.specialRequests && reservation.specialRequests.length > 0 ? `
          <tr>
            <td style="padding:8px 0;color:#94a3b8;">✨ Pedidos Especiais:</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;color:#ffffff;">${reservation.specialRequests.join(' · ')}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <!-- Location Info -->
      <div style="background:#152e4d;border-radius:16px;padding:18px;margin-bottom:24px;text-align:center;font-size:13px;color:#cbd5e1;">
        <p style="margin:0 0 6px 0;font-weight:700;color:#ffffff;">📍 Morada & Tolerância de Chegada</p>
        <p style="margin:0;color:#94a3b8;font-size:12px;">Guardamos a sua mesa durante <strong>20 minutos</strong> a partir da hora marcada. Caso se atrase, contacte <strong>234 424 208</strong>.</p>
      </div>

      <!-- Contact assistance -->
      <div style="text-align:center;font-size:12px;color:#64748b;padding-top:12px;border-top:1px solid #1e3a5f;">
        <p style="margin:0;">Para qualquer questão ou alteração, contacte-nos pelo telefone <strong>234 424 208</strong>.</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#071526;padding:18px;text-align:center;font-size:11px;color:#64748b;border-top:1px solid #1e3a5f;">
      Aviso enviado oficialmente através da API do Gmail · Qué Pasa Aveiro
    </div>

  </div>
</body>
</html>
`;
}
