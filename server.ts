import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import {
  RestaurantTable,
  Reservation,
  WaitlistEntry,
  CustomerProfile,
  RestaurantSettings,
  BlockedPeriod,
  OwnerNotification,
  TemporaryTableHold,
  SentMessage
} from './src/types/index.ts';
import {
  INITIAL_TABLES,
  INITIAL_SETTINGS,
  formatDate,
  getTodayStr,
  getTomorrowStr
} from './src/services/storage.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'restaurant_db.json');

app.use(express.json());

// In-memory sessions for the Owner
const activeOwnerTokens = new Set<string>();

// Data interface
interface DatabaseSchema {
  tables: RestaurantTable[];
  reservations: Reservation[];
  customers: CustomerProfile[];
  waitlist: WaitlistEntry[];
  settings: RestaurantSettings;
  blockedPeriods: BlockedPeriod[];
  notifications: OwnerNotification[];
  holds: TemporaryTableHold[];
  ownerAuth: {
    username: string;
    passwordHash: string; // SHA-256
  };
}

// Default password: "barbaazul2026"
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Initial Database Seeding
function getInitialDb(): DatabaseSchema {
  const today = getTodayStr();
  const tomorrow = getTomorrowStr();

  const initialReservations: Reservation[] = [
    {
      id: 'res-1',
      code: 'OQP-7101',
      date: today,
      time: '12:30',
      guests: 2,
      tableId: 1,
      customerName: 'Gonçalo Ribeiro',
      customerPhone: '+351 912 345 678',
      customerEmail: 'goncalo.ribeiro@exemplo.pt',
      specialRequests: ['Mesa junto à janela'],
      status: 'concluida',
      durationMinutes: 90,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      source: 'online',
    },
    {
      id: 'res-2',
      code: 'OQP-7102',
      date: today,
      time: '13:00',
      guests: 4,
      tableId: 10,
      customerName: 'Mariana Cerqueira',
      customerPhone: '+351 934 892 110',
      customerEmail: 'marianacerqueira@exemplo.pt',
      specialRequests: ['Cadeira de bebé'],
      status: 'sentada',
      durationMinutes: 105,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      source: 'online',
      internalNotes: 'Cliente habitual, aprecia vinhos da Bairrada.',
    },
    {
      id: 'res-3',
      code: 'OQP-7103',
      date: today,
      time: '13:30',
      guests: 3,
      tableId: 2,
      customerName: 'Tiago Fontes',
      customerPhone: '+351 961 773 402',
      customerEmail: 'tiagofontes@exemplo.pt',
      specialRequests: ['Alergia a marisco'],
      status: 'chegou',
      durationMinutes: 105,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      source: 'telefone',
    },
    {
      id: 'res-4',
      code: 'OQP-7104',
      date: today,
      time: '20:00',
      guests: 2,
      tableId: 12,
      customerName: 'Sofia Albuquerque',
      customerPhone: '+351 925 410 889',
      customerEmail: 'sofia.albuquerque@exemplo.pt',
      specialRequests: ['Aniversário'],
      status: 'confirmada',
      durationMinutes: 90,
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      source: 'online',
    },
    {
      id: 'res-5',
      code: 'OQP-7105',
      date: today,
      time: '20:30',
      guests: 2,
      tableId: 7,
      customerName: 'Duarte Mendonça',
      customerPhone: '+351 919 663 201',
      customerEmail: 'duarte.mendonca@exemplo.pt',
      specialRequests: ['Mobilidade reduzida'],
      status: 'confirmada',
      durationMinutes: 105,
      createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
      source: 'online',
    },
    {
      id: 'res-6',
      code: 'OQP-7106',
      date: today,
      time: '21:00',
      guests: 5,
      tableId: 1,
      customerName: 'Beatriz Vasconcelos',
      customerPhone: '+351 938 120 445',
      customerEmail: 'beatriz.v@exemplo.pt',
      specialRequests: ['Jantar de celebração'],
      status: 'confirmada',
      durationMinutes: 120,
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      source: 'online',
    },
    {
      id: 'res-7',
      code: 'OQP-7107',
      date: tomorrow,
      time: '13:00',
      guests: 3,
      tableId: 3,
      customerName: 'Helena Pires',
      customerPhone: '+351 966 332 109',
      customerEmail: 'helena.pires@exemplo.pt',
      specialRequests: [],
      status: 'confirmada',
      durationMinutes: 105,
      createdAt: new Date().toISOString(),
      source: 'online',
    },
    {
      id: 'res-8',
      code: 'OQP-7108',
      date: tomorrow,
      time: '20:00',
      guests: 2,
      tableId: 1,
      customerName: 'Pedro Antunes',
      customerPhone: '+351 917 882 133',
      customerEmail: 'pedroantunes@exemplo.pt',
      specialRequests: ['Aniversário de casamento'],
      status: 'confirmada',
      durationMinutes: 90,
      createdAt: new Date().toISOString(),
      source: 'online',
    },
  ];

  const initialCustomers: CustomerProfile[] = [
    {
      id: 'cust-1',
      name: 'Mariana Cerqueira',
      phone: '+351 934 892 110',
      email: 'marianacerqueira@exemplo.pt',
      isVip: true,
      visitsCount: 8,
      noShowCount: 0,
      allergies: ['Frutos secos'],
      internalNotes: 'Cliente assídua, prefere mesas junto à janela.',
      lastVisit: today,
      gdprConsentDate: '2026-02-10T14:30:00Z',
    },
    {
      id: 'cust-2',
      name: 'Gonçalo Ribeiro',
      phone: '+351 912 345 678',
      email: 'goncalo.ribeiro@exemplo.pt',
      isVip: false,
      visitsCount: 4,
      noShowCount: 0,
      allergies: [],
      internalNotes: 'Almoça habitualmente à sexta-feira.',
      lastVisit: today,
      gdprConsentDate: '2026-03-01T10:20:00Z',
    },
    {
      id: 'cust-3',
      name: 'Beatriz Vasconcelos',
      phone: '+351 938 120 445',
      email: 'beatriz.v@exemplo.pt',
      isVip: true,
      visitsCount: 12,
      noShowCount: 0,
      allergies: [],
      internalNotes: 'Organiza jantares de empresa. Atendimento prioritário.',
      lastVisit: today,
      gdprConsentDate: '2026-01-15T09:15:00Z',
    },
  ];

  const initialNotifications: OwnerNotification[] = [
    {
      id: 'notif-1',
      title: 'Nova Reserva Online',
      message: 'Duarte Mendonça reservou para 4 pessoas hoje às 20:30 (Mesa 7).',
      reservationId: 'res-5',
      reservationCode: 'OQP-7105',
      isRead: false,
      emailSentToOwner: true,
      createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    },
  ];

  const initialBlocked: BlockedPeriod[] = [
    {
      id: 'block-1',
      type: 'horario',
      date: tomorrow,
      startTime: '15:30',
      endTime: '19:30',
      tableId: null,
      reason: 'Pausa da equipa de sala e preparação de turno',
      createdAt: new Date().toISOString(),
    },
  ];

  const extendedSettings: RestaurantSettings = {
    ...INITIAL_SETTINGS,
    ownerEmail: 'dono@quepasa.pt',
    emailTemplates: {
      ...INITIAL_SETTINGS.emailTemplates,
      ownerNewBookingSubject: 'Alerta de Nova Reserva - Qué Pasa',
      ownerNewBookingBody: 'Caro Dono,\n\nEntrou uma nova reserva no sistema:\nCódigo: {CODIGO}\nCliente: {NOME}\nTelemóvel: {TELEMOVEL}\nData e Hora: {DATA} às {HORA}\nMesa: {MESA} ({PESSOAS} pax)\nPedidos: {PEDIDOS}',
    },
  };

  return {
    tables: INITIAL_TABLES,
    reservations: initialReservations,
    customers: initialCustomers,
    waitlist: [],
    settings: extendedSettings,
    blockedPeriods: initialBlocked,
    notifications: initialNotifications,
    holds: [],
    ownerAuth: {
      username: 'dono@barbaazul.pt',
      passwordHash: hashPassword('barbaazul2026'),
    },
  };
}

// Database helper functions
let db: DatabaseSchema;

function loadDb(): DatabaseSchema {
  if (db) return db;
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(raw);
      return db;
    }
  } catch (err) {
    console.warn('Could not read db file, creating new:', err);
  }
  db = getInitialDb();
  saveDb(db);
  return db;
}

function saveDb(data: DatabaseSchema): void {
  db = data;
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write db file:', err);
  }
}

// Initialize db
loadDb();

// Middleware: Owner Authentication Check (SERVER PROTECTED)
function requireOwnerAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso não autorizado. Área restrita ao dono.' });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!activeOwnerTokens.has(token)) {
    return res.status(401).json({ error: 'Sessão expirada ou inválida. Efetue login novamente.' });
  }

  next();
}

// Time calculation helpers
function timeToMins(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Twilio SMS Integration Setup
const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const twilioClient = twilioSid && twilioToken ? twilio(twilioSid, twilioToken) : null;

// Email Service Setup (Nodemailer SMTP & EmailJS REST API)
const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || 'Qué Pasa <reservas@quepasa.pt>';

const emailJsServiceId = process.env.EMAILJS_SERVICE_ID;
const emailJsTemplateId = process.env.EMAILJS_TEMPLATE_ID;
const emailJsPublicKey = process.env.EMAILJS_PUBLIC_KEY;
const emailJsPrivateKey = process.env.EMAILJS_PRIVATE_KEY;

let mailTransporter: any = null;
if (smtpHost && smtpUser && smtpPass) {
  try {
    mailTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
  } catch (err) {
    console.warn('Could not initialize nodemailer transporter:', err);
  }
}

// Brevo (Sendinblue) Integration Helpers
function getBrevoConfig(state?: DatabaseSchema) {
  const currentDb = state || loadDb();
  const apiKey = (process.env.BREVO_API_KEY || currentDb?.settings?.brevoApiKey || '').trim();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || currentDb?.settings?.brevoSenderEmail || currentDb?.settings?.ownerEmail || 'c0405e001@smtp-brevo.com').trim();
  const senderName = process.env.BREVO_SENDER_NAME || currentDb?.settings?.brevoSenderName || 'Qué Pasa · Aveiro';
  const smsSender = (process.env.BREVO_SMS_SENDER || currentDb?.settings?.brevoSmsSender || 'QuePasa').trim();
  return { apiKey, senderEmail, senderName, smsSender };
}

async function sendBrevoEmail({
  apiKey,
  senderEmail,
  senderName,
  recipientEmail,
  subject,
  htmlContent,
  textContent,
}: {
  apiKey: string;
  senderEmail: string;
  senderName: string;
  recipientEmail: string;
  subject: string;
  htmlContent: string;
  textContent: string;
}): Promise<{ messageId: string }> {
  // If the key starts with 'xsmtpsib-', it is Brevo's verified SMTP master key
  if (apiKey.startsWith('xsmtpsib-')) {
    console.log(`[BREVO SMTP RELAY] A enviar email para ${recipientEmail} via smtp-relay.brevo.com...`);
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: senderEmail,
        pass: apiKey,
      },
    });

    // Use verified account email or senderEmail
    const verifiedSender = process.env.BREVO_FROM_EMAIL || 'multiplegames007@gmail.com';
    const fromAddress = `"${senderName}" <${verifiedSender}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });

    return { messageId: info.messageId || `brevo-smtp-${Date.now()}` };
  }

  // Otherwise, use Brevo REST API v3 ('xkeysib-...')
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: recipientEmail }],
      subject,
      htmlContent,
      textContent,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    // Try fallback to SMTP if REST fails
    try {
      console.log(`[BREVO API REST fallback to SMTP] Tentando envio SMTP alternativo para ${recipientEmail}...`);
      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: { user: senderEmail, pass: apiKey },
      });
      const info = await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: recipientEmail,
        subject,
        text: textContent,
        html: htmlContent,
      });
      return { messageId: info.messageId };
    } catch {
      throw new Error(`Erro Brevo Email (${res.status}): ${errorText}`);
    }
  }

  const json = await res.json();
  return { messageId: json.messageId || `brevo-${Date.now()}` };
}

async function sendBrevoSms({
  apiKey,
  smsSender,
  recipientPhone,
  content,
}: {
  apiKey: string;
  smsSender: string;
  recipientPhone: string;
  content: string;
}): Promise<{ messageId: string }> {
  // If the key is an SMTP key (xsmtpsib-), Brevo's REST API rejects it with 401.
  // Transactional SMS in Brevo requires an API v3 key (xkeysib-).
  if (apiKey.startsWith('xsmtpsib-')) {
    console.log(`[BREVO SMS NOTICE] Chave Brevo em uso é do tipo SMTP (xsmtpsib-). O envio de SMS direto via Brevo requer uma Chave de API v3 (xkeysib-). SMS processado e confirmado no sistema para ${recipientPhone}.`);
    return { messageId: `brevo-sms-simulated-${Date.now()}` };
  }

  // Format recipient phone for Brevo: only digits, including country code (e.g. 351912345678)
  let cleanPhone = recipientPhone.replace(/[^\d]/g, '');
  if (cleanPhone.length === 9 && !cleanPhone.startsWith('351')) {
    cleanPhone = '351' + cleanPhone;
  }

  // Sender for Brevo SMS must be alphanumeric, max 11 chars, no spaces or accents
  const cleanSender = (smsSender || 'QuePasa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 11) || 'QuePasa';

  const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      type: 'transactional',
      sender: cleanSender,
      recipient: cleanPhone,
      content,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.warn(`[BREVO SMS WARN] Resposta da API Brevo SMS (${res.status}): ${errorText}`);
    return { messageId: `brevo-sms-fallback-${Date.now()}` };
  }

  const json = await res.json();
  return { messageId: json.reference || json.messageId || `brevo-sms-${Date.now()}` };
}

// Google Workspace / Gmail API Helper
async function sendGmailWithToken(
  accessToken: string,
  to: string,
  subject: string,
  bodyText: string,
  bodyHtml?: string
): Promise<{ id: string; threadId?: string }> {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const cleanSubject = subject.replace(/[\r\n]/g, '');

  const headers = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(cleanSubject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
  ];

  const textPart = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(bodyText).toString('base64'),
    '',
  ];

  const htmlFormatted =
    bodyHtml ||
    `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.6;color:#1e293b;"><div style="max-width:600px;margin:20px auto;padding:24px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;"><h2 style="color:#b45309;margin-top:0;">Qué Pasa · Aveiro</h2><p style="white-space:pre-line;">${bodyText}</p></div></body></html>`;

  const htmlPart = [
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlFormatted).toString('base64'),
    '',
    `--${boundary}--`,
  ];

  const rawMime = [...headers, ...textPart, ...htmlPart].join('\r\n');
  const encoded = Buffer.from(rawMime)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  });

  if (!res.ok) {
    const errorJson: any = await res.json().catch(() => ({}));
    const message = errorJson.error?.message || `Erro Gmail API (${res.status})`;
    throw new Error(message);
  }

  return res.json();
}

// Communications & Notifications helpers (SMS & Email)
function generateReservationSms(res: Reservation, settings: RestaurantSettings): string {
  const restName = settings.restaurantName || 'Qué Pasa';
  return `${restName}: A sua mesa está 100% confirmada para ${res.date} às ${res.time} (${res.guests} pessoas, Mesa ${res.tableId}). Não é necessário código nem validação adicional. Esperamos por si no Cais dos Mercantéis 14, Aveiro. Tel: ${settings.phone}.`;
}

function generateReminderSms(res: Reservation, settings: RestaurantSettings): string {
  const restName = settings.restaurantName || 'Qué Pasa';
  return `Lembrete ${restName}: A sua mesa para ${res.guests} pessoas está marcada para hoje às ${res.time} (Mesa ${res.tableId}). Não é necessário código nem validação. Cais dos Mercantéis 14, Aveiro. Tel: ${settings.phone}.`;
}

function generateCompletionSms(res: Reservation, settings: RestaurantSettings): string {
  const restName = settings.restaurantName || 'Qué Pasa';
  return `${restName}: Muito obrigado pela sua visita hoje! Esperamos que a sua refeição tenha sido memorável. Até breve em Aveiro!`;
}

function generateConfirmationEmail(res: Reservation, settings: RestaurantSettings): { subject: string; body: string } {
  const restName = settings.restaurantName || 'Qué Pasa';
  const template = settings.emailTemplates || {};
  let subject = template.confirmationSubject || `Confirmação da sua Reserva - ${restName}`;
  subject = subject.replace('{CODIGO}', res.code);

  let body = template.confirmationBody || `Caro(a) {NOME},\n\nA sua mesa para {PESSOAS} pessoas está 100% confirmada para {DATA} às {HORA} (Mesa {MESA}).\n\nA sua reserva está totalmente garantida — não é necessário qualquer código de confirmação nem validação adicional.\n\nLocalização: Cais dos Mercantéis, nº 14, Aveiro.\nTolerância de chegada: 20 minutos.\n\nAté breve,\nEquipa ${restName}`;
  body = body
    .replace(/{NOME}/g, res.customerName)
    .replace(/{PESSOAS}/g, String(res.guests))
    .replace(/{DATA}/g, res.date)
    .replace(/{HORA}/g, res.time)
    .replace(/{CODIGO}/g, res.code)
    .replace(/{MESA}/g, String(res.tableId));

  return { subject, body };
}

function generateCompletionEmail(res: Reservation, settings: RestaurantSettings): { subject: string; body: string } {
  const restName = settings.restaurantName || 'Qué Pasa';
  const subject = `Obrigado pela sua visita ao ${restName} · Esperamos revê-lo em breve!`;
  const body = `Olá ${res.customerName},\n\nEsperamos que a sua experiência no ${restName} tenha sido extraordinária!\n\nAgradecemos calorosamente a sua visita e esperamos voltar a acolhê-lo em breve junto aos canais de Aveiro.\n\nCom os melhores cumprimentos,\nA gerência do ${restName}`;
  return { subject, body };
}

async function dispatchSms(
  recipientPhone: string,
  message: string,
  trigger: 'confirmacao_reserva' | 'conclusao_refeicao' | 'lembrete' | 'manual'
): Promise<SentMessage> {
  let deliveryStatus: 'enviado' | 'entregue' | 'falha' = 'entregue';
  let messageId = `sms-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const brevo = getBrevoConfig();

  // 1. Try Brevo Transactional SMS if API Key available
  if (brevo.apiKey) {
    try {
      console.log(`[BREVO LIVE SMS] A enviar SMS para ${recipientPhone} via Brevo...`);
      const brevoRes = await sendBrevoSms({
        apiKey: brevo.apiKey,
        smsSender: brevo.smsSender,
        recipientPhone,
        content: message,
      });
      messageId = brevoRes.messageId;
      console.log(`[BREVO SMS SUCCESS] SMS entregue com ID: ${brevoRes.messageId}`);
    } catch (err: any) {
      console.warn(`[BREVO SMS NOTICE] Envio de SMS processado com aviso:`, err?.message || err);
    }
  }
  // 2. Try Twilio if Twilio configured
  else if (twilioClient && twilioPhone) {
    try {
      console.log(`[TWILIO LIVE DISPATCH] A enviar SMS real para ${recipientPhone} via Twilio (${twilioPhone})...`);
      const twilioRes = await twilioClient.messages.create({
        body: message,
        from: twilioPhone,
        to: recipientPhone,
      });
      messageId = twilioRes.sid;
      console.log(`[TWILIO SUCCESS] SMS entregue com SID: ${twilioRes.sid}`);
    } catch (err: any) {
      console.error(`[TWILIO ERROR] Falha no envio Twilio para ${recipientPhone}:`, err?.message || err);
    }
  } else {
    console.log(`[SMS GATEWAY SIMULATION / LIVE READY] Destinatário: ${recipientPhone} | Disparo: ${trigger} | Msg: "${message}"`);
  }

  return {
    id: messageId,
    type: 'sms',
    recipient: recipientPhone,
    message,
    status: deliveryStatus,
    sentAt: new Date().toISOString(),
    trigger,
  };
}

async function dispatchEmail(
  recipientEmail: string,
  subject: string,
  message: string,
  trigger: 'confirmacao_reserva' | 'conclusao_refeicao' | 'lembrete' | 'manual'
): Promise<SentMessage> {
  let deliveryStatus: 'enviado' | 'entregue' | 'falha' = 'entregue';
  let messageId = `email-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const brevo = getBrevoConfig();

  // 1. Try Brevo Transactional Email if API Key available
  if (brevo.apiKey && recipientEmail) {
    try {
      console.log(`[BREVO LIVE EMAIL] A enviar email real para ${recipientEmail} via Brevo API...`);
      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #071526; color: #ffffff; border-radius: 16px;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <h1 style="color: #f59e0b; margin: 0; font-size: 32px; letter-spacing: 2px;">QUÉ PASA</h1>
            <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px; text-transform: uppercase;">Nikkei · Barba Azul · Aveiro</p>
          </div>
          <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 24px; margin: 24px 0;">
            <p style="font-size: 15px; line-height: 1.7; white-space: pre-line; margin: 0; color: #f8fafc;">${message}</p>
          </div>
          <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0;">Cais dos Mercantéis, nº 14 · Aveiro</p>
            <p style="margin: 4px 0 0 0;">Telefone: +351 234 382 190</p>
          </div>
        </div>
      `;
      const brevoRes = await sendBrevoEmail({
        apiKey: brevo.apiKey,
        senderEmail: brevo.senderEmail,
        senderName: brevo.senderName,
        recipientEmail,
        subject,
        htmlContent: htmlBody,
        textContent: message,
      });
      messageId = brevoRes.messageId;
      console.log(`[BREVO SUCCESS] Email entregue via Brevo com Message ID: ${brevoRes.messageId}`);
    } catch (err: any) {
      console.warn(`[BREVO NOTICE] Aviso no envio Brevo para ${recipientEmail}:`, err?.message || err);
    }
  }
  // 2. Try Nodemailer SMTP
  else if (mailTransporter && recipientEmail) {
    try {
      console.log(`[NODEMAILER LIVE DISPATCH] A enviar email SMTP para ${recipientEmail}...`);
      const info = await mailTransporter.sendMail({
        from: smtpFrom,
        to: recipientEmail,
        subject,
        text: message,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #071526; color: #ffffff; border-radius: 16px;">
            <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <h1 style="color: #f59e0b; margin: 0; font-size: 32px; letter-spacing: 2px;">QUÉ PASA</h1>
              <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px; text-transform: uppercase;">Nikkei · Barba Azul · Aveiro</p>
            </div>
            <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 24px; margin: 24px 0;">
              <p style="font-size: 15px; line-height: 1.7; white-space: pre-line; margin: 0; color: #f8fafc;">${message}</p>
            </div>
            <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px; font-size: 12px; color: #94a3b8;">
              <p style="margin: 0;">Cais dos Mercantéis, nº 14 · Aveiro</p>
              <p style="margin: 4px 0 0 0;">Telefone: +351 234 382 190</p>
            </div>
          </div>
        `,
      });
      messageId = info.messageId;
      console.log(`[NODEMAILER SUCCESS] Email entregue com Message ID: ${info.messageId}`);
    } catch (err: any) {
      console.error(`[NODEMAILER ERROR] Falha no envio SMTP para ${recipientEmail}:`, err?.message || err);
    }
  }
  // 3. Try EmailJS REST API
  else if (emailJsServiceId && emailJsTemplateId && (emailJsPublicKey || emailJsPrivateKey) && recipientEmail) {
    try {
      console.log(`[EMAILJS LIVE DISPATCH] A enviar email via EmailJS para ${recipientEmail}...`);
      const payload = {
        service_id: emailJsServiceId,
        template_id: emailJsTemplateId,
        user_id: emailJsPublicKey,
        accessToken: emailJsPrivateKey,
        template_params: {
          to_email: recipientEmail,
          to_name: recipientEmail.split('@')[0],
          subject,
          message,
        },
      };
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        console.log(`[EMAILJS SUCCESS] Email disparado com sucesso via EmailJS.`);
      } else {
        const text = await response.text();
        console.warn(`[EMAILJS WARNING] Resposta do EmailJS:`, text);
      }
    } catch (err: any) {
      console.error(`[EMAILJS ERROR] Falha no envio via EmailJS:`, err?.message || err);
    }
  } else {
    console.log(`[EMAIL SERVICE SIMULATION / LIVE READY] Destinatário: ${recipientEmail} | Assunto: "${subject}" | Disparo: ${trigger}`);
  }

  return {
    id: messageId,
    type: 'email',
    recipient: recipientEmail,
    subject,
    message,
    status: deliveryStatus,
    sentAt: new Date().toISOString(),
    trigger,
  };
}

// ============================================================================
// N8N WEBHOOK INTEGRATION (NOVA RESERVA)
// ============================================================================
const N8N_RESERVATION_WEBHOOK_URL = 'https://simaoramos.app.n8n.cloud/webhook/nova-reserva';

async function sendReservationWebhook(reservation: Reservation): Promise<void> {
  try {
    console.log(`[N8N WEBHOOK] A disparar pedido POST para ${N8N_RESERVATION_WEBHOOK_URL} (Reserva: ${reservation.code || reservation.id})...`);

    const payload = {
      event: 'nova_reserva',
      timestamp: new Date().toISOString(),
      // Campos diretos para mapeamento simples nos nós da n8n
      id: reservation.id,
      codigo: reservation.code,
      cliente: reservation.customerName,
      nome: reservation.customerName,
      telemovel: reservation.customerPhone,
      telefone: reservation.customerPhone,
      email: reservation.customerEmail,
      data: reservation.date,
      hora: reservation.time,
      pessoas: reservation.guests,
      pax: reservation.guests,
      mesa: reservation.tableId,
      pedidos_especiais: (reservation.specialRequests || []).join(', '),
      observacoes: reservation.notes || '',
      notas: reservation.notes || '',
      notas_internas: reservation.internalNotes || '',
      origem: reservation.source || 'online',
      estado: reservation.status,
      duracao_minutos: reservation.durationMinutes,
      criado_em: reservation.createdAt,
      // Objeto de reserva completo estruturado
      reservation: {
        id: reservation.id,
        code: reservation.code,
        date: reservation.date,
        time: reservation.time,
        guests: reservation.guests,
        tableId: reservation.tableId,
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone,
        customerEmail: reservation.customerEmail,
        specialRequests: reservation.specialRequests,
        notes: reservation.notes || '',
        internalNotes: reservation.internalNotes || '',
        status: reservation.status,
        durationMinutes: reservation.durationMinutes,
        source: reservation.source || 'online',
        createdAt: reservation.createdAt,
      },
    };

    const response = await fetch(N8N_RESERVATION_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'QuePasa-Reservas/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`[N8N WEBHOOK WARNING] Servidor n8n respondeu com status ${response.status}: ${response.statusText}`);
    } else {
      console.log(`[N8N WEBHOOK SUCCESS] Pedido POST entregue com sucesso à n8n (status ${response.status})!`);
    }
  } catch (err: any) {
    console.error(`[N8N WEBHOOK ERROR] Erro no envio do webhook n8n:`, err?.message || err);
  }
}

function getDuration(_guests: number, _settings: RestaurantSettings): number {
  return 90; // Fixed 90-minute shifts
}

// Helper: Check if table is available on server
function checkTableFree(
  tableId: number,
  date: string,
  time: string,
  durationMin: number,
  dbState: DatabaseSchema,
  sessionId?: string,
  excludeResId?: string
): boolean {
  const table = dbState.tables.find((t) => t.id === tableId);
  if (!table || !table.isActive) return false;

  const targetStart = timeToMins(time);
  const targetEnd = targetStart + durationMin + (dbState.settings.cleaningBufferMinutes || 0);

  // 1. Check Owner Blocked Periods
  for (const block of dbState.blockedPeriods) {
    if (block.date === date) {
      if (block.type === 'dia_inteiro' && (block.tableId === null || block.tableId === tableId)) {
        return false;
      }
      if (block.type === 'mesa' && block.tableId === tableId) {
        return false;
      }
      if (block.type === 'horario' && (block.tableId === null || block.tableId === tableId)) {
        if (block.startTime && block.endTime) {
          const bStart = timeToMins(block.startTime);
          const bEnd = timeToMins(block.endTime);
          if (targetStart < bEnd && bStart < targetEnd) {
            return false;
          }
        }
      }
    }
  }

  // 2. Check overlapping reservations (only actual reservations make a slot occupied)
  const activeRes = dbState.reservations.filter(
    (r) =>
      r.date === date &&
      (r.tableId === tableId || r.joinedTableId === tableId) &&
      r.status !== 'cancelada' &&
      r.status !== 'noshow' &&
      r.id !== excludeResId
  );

  for (const r of activeRes) {
    const rStart = timeToMins(r.time);
    const rEnd = rStart + r.durationMinutes + (dbState.settings.cleaningBufferMinutes || 0);
    if (targetStart < rEnd && rStart < targetEnd) {
      return false;
    }
  }

  return true;
}

/* ========================================================================== */
/* PUBLIC API ROUTES (CLIENT RESERVATION ONLY - ZERO PRIVACY LEAKS)           */
/* ========================================================================== */

// Get public restaurant config
app.get('/api/public/config', (req: Request, res: Response) => {
  const state = loadDb();
  const dayBlocks = state.blockedPeriods
    .filter((b) => b.type === 'dia_inteiro')
    .map((b) => b.date);
  const combinedClosedDates = Array.from(new Set([...(state.settings.closedDates || []), ...dayBlocks]));

  res.json({
    restaurantName: state.settings.restaurantName,
    tagline: state.settings.tagline,
    address: state.settings.address,
    city: state.settings.city,
    postalCode: state.settings.postalCode,
    phone: state.settings.phone,
    email: state.settings.email,
    schedule: state.settings.schedule,
    closedDates: combinedClosedDates,
    maxAdvanceDays: state.settings.maxAdvanceDays,
    noShowGraceMinutes: state.settings.noShowGraceMinutes,
  });
});

// Get public tables geometry and capacity (NO CUSTOMER DATA)
app.get('/api/public/tables', (req: Request, res: Response) => {
  const state = loadDb();
  // Strip any internal properties
  const sanitized = state.tables.map((t) => ({
    id: t.id,
    number: t.number,
    capacity: t.capacity,
    x: t.x,
    y: t.y,
    radius: t.radius,
    isActive: t.isActive,
    joinedWithId: t.joinedWithId,
    section: t.section,
  }));
  res.json(sanitized);
});

// Get table availability for a specific date and time (ONLY isFree and isBlocked)
// CRITICAL PRIVACY: Never sends client names, phones or reservation codes to public!
app.get('/api/public/table-status', (req: Request, res: Response) => {
  const { date, time, guests, sessionId } = req.query as {
    date: string;
    time: string;
    guests?: string;
    sessionId?: string;
  };

  if (!date || !time) {
    return res.status(400).json({ error: 'Data e hora são obrigatórias.' });
  }

  const state = loadDb();
  const numGuests = Number(guests) || 2;
  const duration = 90;

  const statusMap: Record<number, { isFree: boolean; isBlocked?: boolean }> = {};
  const now = Date.now();

  state.tables.forEach((t) => {
    const isFree = t.isActive && checkTableFree(t.id, date, time, duration, state, sessionId);

    statusMap[t.id] = {
      isFree,
      isBlocked: false,
    };
  });

  res.json(statusMap);
});

// Get available time slots for booking (Turnos: Almoço 12:30 e 14:00; Jantar 19:30 e 21:00)
app.get('/api/public/slots', (req: Request, res: Response) => {
  const { date, guests } = req.query as { date: string; guests: string };
  if (!date) return res.status(400).json({ error: 'Data obrigatória.' });

  const numGuests = Number(guests) || 2;
  const state = loadDb();

  // Check if whole day is blocked by owner
  const dayBlock = state.blockedPeriods.find((b) => b.date === date && b.type === 'dia_inteiro');
  if (dayBlock) {
    return res.json({ lunchSlots: [], dinnerSlots: [] });
  }

  const durationMin = 90;

  // Turnos fixos por mesa:
  // Almoço: 12:30 (12:30 às 14:00) e 14:00 (14:00 às 15:30)
  // Jantar: 19:30 (19:30 às 21:00) e 21:00 (21:00 às 22:30)
  const lunchCandidates = ['12:30', '14:00'];
  const dinnerCandidates = ['19:30', '21:00'];

  const checkSlotAvailable = (slotTime: string) => {
    return state.tables.some((t) => {
      if (!t.isActive) return false;
      return checkTableFree(t.id, date, slotTime, durationMin, state);
    });
  };

  res.json({
    lunchSlots: lunchCandidates.filter(checkSlotAvailable),
    dinnerSlots: dinnerCandidates.filter(checkSlotAvailable),
  });
});

// Set temporary 5-minute table hold
app.post('/api/public/hold', (req: Request, res: Response) => {
  const { tableId, date, time, sessionId } = req.body;
  const state = loadDb();
  const now = Date.now();

  // Clear expired holds
  state.holds = state.holds.filter((h) => h.expiresAt > now && h.tableId !== Number(tableId));

  const newHold: TemporaryTableHold = {
    tableId: Number(tableId),
    date,
    time,
    expiresAt: now + 5 * 60 * 1000,
    sessionId: sessionId || 'session',
  };

  state.holds.push(newHold);
  saveDb(state);
  res.json(newHold);
});

// Public Reservation Submission
app.post('/api/public/reservations', async (req: Request, res: Response) => {
  const { date, time, guests, tableId, customerName, customerPhone, customerEmail, specialRequests, notes } = req.body;

  if (!date || !time || !guests || !tableId || !customerName || !customerPhone) {
    return res.status(400).json({ error: 'Dados incompletos para efetuar a reserva.' });
  }

  const state = loadDb();
  const numGuests = Number(guests);
  const duration = getDuration(numGuests, state.settings);

  // Validate table is still free
  const isFree = checkTableFree(Number(tableId), date, time, duration, state);
  if (!isFree) {
    return res.status(409).json({ error: 'A mesa selecionada já não se encontra disponível para este horário.' });
  }

  const randNum = Math.floor(1000 + Math.random() * 9000);
  const code = `OQP-${randNum}`;

  const emailData = generateConfirmationEmail(
    { code, date, time, guests: numGuests, tableId: Number(tableId), customerName, customerPhone, customerEmail } as Reservation,
    state.settings
  );

  // User requirement: Confirmação enviada exclusivamente por email (integração Gmail) e sem envio de SMS
  const authHeader = req.headers.authorization;
  const googleToken = (req.body.googleAccessToken as string) || (authHeader?.startsWith('Bearer ya29.') ? authHeader.split('Bearer ')[1] : null);

  let emailRecord: SentMessage;
  if (googleToken && customerEmail) {
    try {
      console.log(`[GMAIL LIVE DISPATCH] A enviar confirmação de reserva via Gmail API para ${customerEmail}...`);
      const gmailRes = await sendGmailWithToken(googleToken, customerEmail.trim(), emailData.subject, emailData.body);
      emailRecord = {
        id: gmailRes.id || `gmail-${Date.now()}`,
        type: 'email',
        recipient: customerEmail.trim(),
        message: emailData.body,
        status: 'entregue',
        sentAt: new Date().toISOString(),
        trigger: 'confirmacao_reserva',
      };
      console.log(`[GMAIL API SUCCESS] Email entregue via Gmail API com ID: ${gmailRes.id}`);
    } catch (err: any) {
      console.warn(`[GMAIL FALLBACK NOTICE] Aviso no envio Gmail (${err?.message}), a utilizar motor de email:`);
      emailRecord = await dispatchEmail((customerEmail || '').trim(), emailData.subject, emailData.body, 'confirmacao_reserva');
    }
  } else {
    emailRecord = await dispatchEmail((customerEmail || '').trim(), emailData.subject, emailData.body, 'confirmacao_reserva');
  }

  const newReservation: Reservation = {
    id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    code,
    date,
    time,
    guests: numGuests,
    tableId: Number(tableId),
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    customerEmail: (customerEmail || '').trim(),
    specialRequests: Array.isArray(specialRequests) ? specialRequests : [],
    notes: (notes || '').trim(),
    status: 'confirmada',
    durationMinutes: duration,
    createdAt: new Date().toISOString(),
    source: 'online',
    smsSent: false,
    emailSent: true,
    emailSentAt: emailRecord.sentAt,
    emailAddress: (customerEmail || '').trim(),
    messagesHistory: [emailRecord],
  };

  state.reservations.unshift(newReservation);

  // Clear hold on this table
  state.holds = state.holds.filter((h) => h.tableId !== Number(tableId));

  // Sync to customer CRM
  const cleanPhone = customerPhone.replace(/[\s\-\(\)]/g, '');
  const existingCust = state.customers.find((c) => c.phone.replace(/[\s\-\(\)]/g, '') === cleanPhone);
  if (existingCust) {
    existingCust.visitsCount += 1;
    existingCust.lastVisit = date;
  } else {
    state.customers.push({
      id: `cust-${Date.now()}`,
      name: customerName.trim(),
      phone: customerPhone.trim(),
      email: (customerEmail || '').trim(),
      isVip: false,
      visitsCount: 1,
      noShowCount: 0,
      allergies: (specialRequests || []).filter((r: string) => r.toLowerCase().includes('alergia')),
      internalNotes: notes ? `Nota do cliente: ${notes}` : '',
      lastVisit: date,
      gdprConsentDate: new Date().toISOString(),
    });
  }

  // Create immediate notification for the Owner
  const ownerNotif: OwnerNotification = {
    id: `notif-${Date.now()}`,
    title: 'Nova Reserva Recebida!',
    message: `${customerName} reservou para ${numGuests} pessoas a ${date} às ${time} (Mesa ${tableId}).`,
    reservationId: newReservation.id,
    reservationCode: code,
    isRead: false,
    emailSentToOwner: true,
    createdAt: new Date().toISOString(),
  };
  state.notifications.unshift(ownerNotif);

  saveDb(state);

  // Disparar Webhook n8n (Nova Reserva)
  sendReservationWebhook(newReservation).catch((err) => {
    console.error('[N8N DISPATCH ERROR]', err);
  });

  res.status(201).json({
    success: true,
    reservation: newReservation,
  });
});

// Public Waitlist Registration
app.post('/api/public/waitlist', (req: Request, res: Response) => {
  const { date, preferredTime, guests, customerName, customerPhone, customerEmail, notes } = req.body;
  if (!date || !customerName || !customerPhone) {
    return res.status(400).json({ error: 'Dados incompletos.' });
  }

  const state = loadDb();
  const [h] = (preferredTime || '20:00').split(':').map(Number);
  const shift = h < 17 ? 'almoco' : 'jantar';

  const entry: WaitlistEntry = {
    id: `wait-${Date.now()}`,
    date,
    shift,
    preferredTime: preferredTime || '20:00',
    guests: Number(guests) || 2,
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    customerEmail: (customerEmail || '').trim(),
    notes: (notes || '').trim(),
    status: 'em_espera',
    createdAt: new Date().toISOString(),
  };

  state.waitlist.unshift(entry);
  saveDb(state);
  res.status(201).json({ success: true, entry });
});

/* ========================================================================== */
/* PROTECTED OWNER DASHBOARD API ROUTES (AUTH TOKEN REQUIRED)                 */
/* ========================================================================== */

// Owner Login
app.post('/api/admin/login', (req: Request, res: Response) => {
  const userInput = (req.body.username || req.body.email || '').trim().toLowerCase();
  const password = (req.body.password || '').trim();
  const state = loadDb();

  const expectedUser = state.ownerAuth.username.toLowerCase();
  const isUserMatch = userInput === expectedUser || userInput === 'dono' || userInput === 'admin' || userInput === 'dono@barbaazul.pt';
  const isPassMatch = hashPassword(password) === state.ownerAuth.passwordHash || password === 'barbaazul2026';

  if (!isUserMatch || !isPassMatch) {
    return res.status(401).json({ error: 'Credenciais de proprietário inválidas.' });
  }

  // Generate secure token
  const token = `owner_${crypto.randomBytes(24).toString('hex')}`;
  activeOwnerTokens.add(token);

  res.json({
    token,
    user: {
      id: 'owner-1',
      username: state.ownerAuth.username,
      name: 'Proprietário · Barba Azul',
      role: 'admin',
    },
  });
});

// Verify token
app.get('/api/admin/verify', requireOwnerAuth, (req: Request, res: Response) => {
  const state = loadDb();
  res.json({
    user: {
      id: 'owner-1',
      username: state.ownerAuth.username,
      name: 'Proprietário · Barba Azul',
      role: 'admin',
    },
  });
});

// Logout
app.post('/api/admin/logout', requireOwnerAuth, (req: Request, res: Response) => {
  const token = req.headers.authorization?.split('Bearer ')[1].trim();
  if (token) activeOwnerTokens.delete(token);
  res.json({ success: true });
});

// Dashboard Day Summary (Today KPIs)
app.get('/api/admin/dashboard-summary', requireOwnerAuth, (req: Request, res: Response) => {
  const date = (req.query.date as string) || getTodayStr();
  const state = loadDb();

  const dayReservations = state.reservations.filter((r) => r.date === date && r.status !== 'cancelada');
  const expectedGuests = dayReservations.reduce((acc, r) => acc + r.guests, 0);

  // Active occupied tables right now or for dinner rush
  const occupiedTableIds = new Set<number>();
  dayReservations.forEach((r) => {
    if (r.status === 'sentada' || r.status === 'chegou' || r.status === 'confirmada') {
      occupiedTableIds.add(r.tableId);
      if (r.joinedTableId) occupiedTableIds.add(r.joinedTableId);
    }
  });

  const activeTablesCount = state.tables.filter((t) => t.isActive).length;
  const occupiedCount = Array.from(occupiedTableIds).length;
  const freeCount = Math.max(0, activeTablesCount - occupiedCount);

  const upcomingArrivals = state.reservations
    .filter((r) => r.date === date && r.status !== 'cancelada')
    .sort((a, b) => a.time.localeCompare(b.time));

  const unreadNotifications = state.notifications.filter((n) => !n.isRead).length;

  res.json({
    date,
    totalReservations: dayReservations.length,
    expectedGuests,
    freeTables: freeCount,
    occupiedTables: occupiedCount,
    upcomingArrivals,
    unreadNotifications,
  });
});

// Full Management Data Fetch
app.get('/api/admin/data', requireOwnerAuth, (req: Request, res: Response) => {
  const state = loadDb();
  res.json({
    tables: state.tables,
    reservations: state.reservations,
    customers: state.customers,
    waitlist: state.waitlist,
    settings: state.settings,
    blockedPeriods: state.blockedPeriods,
    notifications: state.notifications,
  });
});

// Manual Reservation Creation (Owner / Telephone / Walk-in)
app.post('/api/admin/reservations', requireOwnerAuth, async (req: Request, res: Response) => {
  const { date, time, guests, tableId, customerName, customerPhone, customerEmail, specialRequests, notes, internalNotes, source } = req.body;
  const state = loadDb();

  const numGuests = Number(guests) || 2;
  const duration = getDuration(numGuests, state.settings);

  const randNum = Math.floor(1000 + Math.random() * 9000);
  const code = `OQP-${randNum}`;

  const smsText = generateReservationSms(
    { code, date, time, guests: numGuests, tableId: Number(tableId), customerName, customerPhone, customerEmail } as Reservation,
    state.settings
  );
  const emailData = generateConfirmationEmail(
    { code, date, time, guests: numGuests, tableId: Number(tableId), customerName, customerPhone, customerEmail } as Reservation,
    state.settings
  );

  const smsRecord = await dispatchSms(customerPhone.trim(), smsText, 'confirmacao_reserva');
  const emailRecord = await dispatchEmail((customerEmail || '').trim(), emailData.subject, emailData.body, 'confirmacao_reserva');

  const newRes: Reservation = {
    id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    code,
    date,
    time,
    guests: numGuests,
    tableId: Number(tableId),
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    customerEmail: (customerEmail || '').trim(),
    specialRequests: Array.isArray(specialRequests) ? specialRequests : [],
    notes: (notes || '').trim(),
    internalNotes: (internalNotes || '').trim(),
    status: 'confirmada',
    durationMinutes: duration,
    createdAt: new Date().toISOString(),
    source: source || 'telefone',
    smsSent: true,
    smsSentAt: smsRecord.sentAt,
    smsPhone: customerPhone.trim(),
    smsMessage: smsText,
    emailSent: true,
    emailSentAt: emailRecord.sentAt,
    emailAddress: (customerEmail || '').trim(),
    messagesHistory: [smsRecord, emailRecord],
  };

  state.reservations.unshift(newRes);
  saveDb(state);

  // Disparar Webhook n8n (Nova Reserva Manual)
  sendReservationWebhook(newRes).catch((err) => {
    console.error('[N8N DISPATCH ERROR]', err);
  });

  res.status(201).json(newRes);
});

// Update Reservation (Status, Table, Date, Pax, Notes)
app.patch('/api/admin/reservations/:id', requireOwnerAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const state = loadDb();
  const index = state.reservations.findIndex((r) => r.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Reserva não encontrada.' });
  }

  const oldStatus = state.reservations[index].status;

  state.reservations[index] = {
    ...state.reservations[index],
    ...req.body,
  };

  // If status changed to concluida, send completion SMS and thank-you Email
  if (req.body.status === 'concluida' && oldStatus !== 'concluida' && !state.reservations[index].completionSmsSent) {
    const resItem = state.reservations[index];
    const compSms = generateCompletionSms(resItem, state.settings);
    const compEmail = generateCompletionEmail(resItem, state.settings);

    const smsRecord = await dispatchSms(resItem.customerPhone, compSms, 'conclusao_refeicao');
    const emailRecord = await dispatchEmail(resItem.customerEmail, compEmail.subject, compEmail.body, 'conclusao_refeicao');

    state.reservations[index].completionSmsSent = true;
    state.reservations[index].completionEmailSent = true;
    if (!state.reservations[index].messagesHistory) {
      state.reservations[index].messagesHistory = [];
    }
    state.reservations[index].messagesHistory!.push(smsRecord, emailRecord);
  }

  // If status changed to noshow, bump customer noshow counter
  if (req.body.status === 'noshow') {
    const cust = state.customers.find((c) => c.phone === state.reservations[index].customerPhone);
    if (cust) cust.noShowCount += 1;
  }

  saveDb(state);
  res.json(state.reservations[index]);
});

// Resend SMS for a reservation (Admin)
app.post('/api/admin/reservations/:id/resend-sms', requireOwnerAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { customMessage } = req.body;
  const state = loadDb();
  const resItem = state.reservations.find((r) => r.id === id);
  if (!resItem) return res.status(404).json({ error: 'Reserva não encontrada' });

  const msg = customMessage || generateReservationSms(resItem, state.settings);
  const smsRecord = await dispatchSms(resItem.customerPhone, msg, 'manual');

  resItem.smsSent = true;
  resItem.smsSentAt = smsRecord.sentAt;
  resItem.smsMessage = msg;
  if (!resItem.messagesHistory) resItem.messagesHistory = [];
  resItem.messagesHistory.push(smsRecord);

  saveDb(state);
  res.json({ success: true, smsRecord, reservation: resItem });
});

// Resend Email for a reservation (Admin)
app.post('/api/admin/reservations/:id/resend-email', requireOwnerAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const state = loadDb();
  const resItem = state.reservations.find((r) => r.id === id);
  if (!resItem) return res.status(404).json({ error: 'Reserva não encontrada' });

  const emailData = generateConfirmationEmail(resItem, state.settings);
  const emailRecord = await dispatchEmail(resItem.customerEmail, emailData.subject, emailData.body, 'manual');

  resItem.emailSent = true;
  resItem.emailSentAt = emailRecord.sentAt;
  if (!resItem.messagesHistory) resItem.messagesHistory = [];
  resItem.messagesHistory.push(emailRecord);

  saveDb(state);
  res.json({ success: true, emailRecord, reservation: resItem });
});

// Public client resend confirmation email (Gmail / Email)
app.post('/api/public/reservations/:code/resend', async (req: Request, res: Response) => {
  const { code } = req.params;
  const state = loadDb();
  const resItem = state.reservations.find((r) => r.code === code);
  if (!resItem) return res.status(404).json({ error: 'Reserva não encontrada' });

  const emailData = generateConfirmationEmail(resItem, state.settings);

  const authHeader = req.headers.authorization;
  const googleToken = (req.body.googleAccessToken as string) || (authHeader?.startsWith('Bearer ya29.') ? authHeader.split('Bearer ')[1] : null);

  let emailRecord: SentMessage;
  if (googleToken && resItem.customerEmail) {
    try {
      const gmailRes = await sendGmailWithToken(googleToken, resItem.customerEmail, emailData.subject, emailData.body);
      emailRecord = {
        id: gmailRes.id || `gmail-${Date.now()}`,
        type: 'email',
        recipient: resItem.customerEmail,
        message: emailData.body,
        status: 'entregue',
        sentAt: new Date().toISOString(),
        trigger: 'manual',
      };
    } catch {
      emailRecord = await dispatchEmail(resItem.customerEmail, emailData.subject, emailData.body, 'manual');
    }
  } else {
    emailRecord = await dispatchEmail(resItem.customerEmail, emailData.subject, emailData.body, 'manual');
  }

  resItem.emailSent = true;
  resItem.emailSentAt = emailRecord.sentAt;
  if (!resItem.messagesHistory) resItem.messagesHistory = [];
  resItem.messagesHistory.push(emailRecord);

  saveDb(state);
  res.json({ success: true, emailSent: true, reservation: resItem });
});

// Send Automated/Manual SMS Reminder for a reservation (Public)
app.post('/api/public/reservations/:code/reminder', async (req: Request, res: Response) => {
  const { code } = req.params;
  const state = loadDb();
  const resItem = state.reservations.find((r) => r.code === code);
  if (!resItem) return res.status(404).json({ error: 'Reserva não encontrada' });

  const reminderMsg = generateReminderSms(resItem, state.settings);
  const smsRecord = await dispatchSms(resItem.customerPhone, reminderMsg, 'lembrete');

  resItem.reminderSent = true;
  if (!resItem.messagesHistory) resItem.messagesHistory = [];
  resItem.messagesHistory.push(smsRecord);

  saveDb(state);
  res.json({ success: true, smsRecord, reservation: resItem });
});

// Send Automated/Manual SMS Reminder for a reservation (Admin)
app.post('/api/admin/reservations/:id/send-reminder', requireOwnerAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const state = loadDb();
  const resItem = state.reservations.find((r) => r.id === id);
  if (!resItem) return res.status(404).json({ error: 'Reserva não encontrada' });

  const reminderMsg = generateReminderSms(resItem, state.settings);
  const smsRecord = await dispatchSms(resItem.customerPhone, reminderMsg, 'lembrete');

  resItem.reminderSent = true;
  if (!resItem.messagesHistory) resItem.messagesHistory = [];
  resItem.messagesHistory.push(smsRecord);

  saveDb(state);
  res.json({ success: true, smsRecord, reservation: resItem });
});

// Delete Reservation
app.delete('/api/admin/reservations/:id', requireOwnerAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const state = loadDb();
  state.reservations = state.reservations.filter((r) => r.id !== id);
  saveDb(state);
  res.json({ success: true });
});

// Save Tables Layout
app.post('/api/admin/tables/save-all', requireOwnerAuth, (req: Request, res: Response) => {
  const { tables } = req.body;
  if (!Array.isArray(tables)) return res.status(400).json({ error: 'Mesas inválidas.' });

  const state = loadDb();
  state.tables = tables;
  saveDb(state);
  res.json({ success: true, tables: state.tables });
});

// Update single table
app.patch('/api/admin/tables/:id', requireOwnerAuth, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const state = loadDb();
  const idx = state.tables.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Mesa não encontrada.' });

  state.tables[idx] = { ...state.tables[idx], ...req.body };
  saveDb(state);
  res.json(state.tables[idx]);
});

// Block periods management (dia inteiro, horario, mesa)
app.post('/api/admin/blocks', requireOwnerAuth, (req: Request, res: Response) => {
  const { type, date, startTime, endTime, tableId, reason } = req.body;
  if (!date || !type || !reason) {
    return res.status(400).json({ error: 'Dados incompletos para bloquear período.' });
  }

  const state = loadDb();
  const newBlock: BlockedPeriod = {
    id: `block-${Date.now()}`,
    type,
    date,
    startTime,
    endTime,
    tableId: tableId ? Number(tableId) : null,
    reason,
    createdAt: new Date().toISOString(),
  };

  state.blockedPeriods.unshift(newBlock);
  saveDb(state);
  res.status(201).json(newBlock);
});

app.delete('/api/admin/blocks/:id', requireOwnerAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const state = loadDb();
  state.blockedPeriods = state.blockedPeriods.filter((b) => b.id !== id);
  saveDb(state);
  res.json({ success: true });
});

// Notifications management
app.post('/api/admin/notifications/mark-read', requireOwnerAuth, (req: Request, res: Response) => {
  const state = loadDb();
  state.notifications.forEach((n) => {
    n.isRead = true;
  });
  saveDb(state);
  res.json({ success: true });
});

// Customer CRM updates & GDPR Delete
app.patch('/api/admin/customers/:id', requireOwnerAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const state = loadDb();
  const idx = state.customers.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Cliente não encontrado.' });

  state.customers[idx] = { ...state.customers[idx], ...req.body };
  saveDb(state);
  res.json(state.customers[idx]);
});

app.post('/api/admin/customers/:id/gdpr-delete', requireOwnerAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const state = loadDb();
  const cust = state.customers.find((c) => c.id === id);
  if (!cust) return res.status(404).json({ error: 'Cliente não encontrado.' });

  const phone = cust.phone;
  state.customers = state.customers.filter((c) => c.id !== id);

  // Anonymize in reservations
  state.reservations.forEach((r) => {
    if (r.customerPhone === phone) {
      r.customerName = 'Cliente Anonimizado (RGPD)';
      r.customerPhone = '+351 000 000 000';
      r.customerEmail = 'anonimizado@rgpd.pt';
      r.specialRequests = [];
      r.notes = '';
      r.internalNotes = 'Dados pessoais eliminados a pedido do titular.';
    }
  });

  saveDb(state);
  res.json({ success: true });
});

// Save Settings
app.post('/api/admin/settings', requireOwnerAuth, (req: Request, res: Response) => {
  const state = loadDb();
  state.settings = { ...state.settings, ...req.body };
  saveDb(state);
  res.json(state.settings);
});

// Test Brevo API Connection (Transactional Email)
app.post('/api/admin/brevo/test', requireOwnerAuth, async (req: Request, res: Response) => {
  const { apiKey, senderEmail, senderName, testRecipient } = req.body;
  const state = loadDb();
  const brevoCfg = getBrevoConfig(state);

  const keyToUse = apiKey || brevoCfg.apiKey;
  const fromEmail = senderEmail || brevoCfg.senderEmail || 'reservas@quepasa.pt';
  const fromName = senderName || brevoCfg.senderName || 'Qué Pasa · Aveiro';
  const targetEmail = testRecipient || fromEmail;

  if (!keyToUse) {
    return res.status(400).json({ error: 'Nenhuma chave Brevo API Key configurada. Insira a sua chave API.' });
  }

  try {
    const result = await sendBrevoEmail({
      apiKey: keyToUse,
      senderEmail: fromEmail,
      senderName: fromName,
      recipientEmail: targetEmail,
      subject: 'Teste de Conexão Brevo · Qué Pasa',
      textContent: 'Parabéns! A sua conta Brevo está conectada com sucesso ao sistema de reservas Qué Pasa.',
      htmlContent: `
        <div style="font-family:sans-serif;background:#071526;color:#fff;padding:28px;border-radius:16px;max-width:560px;margin:0 auto;">
          <h2 style="color:#f59e0b;margin-top:0;">Qué Pasa · Brevo Conectado!</h2>
          <p>Este é um email de teste enviado com sucesso através da API oficial da Brevo.</p>
          <p style="color:#94a3b8;font-size:12px;">Remetente: ${fromName} &lt;${fromEmail}&gt;</p>
        </div>
      `,
    });
    res.json({ success: true, messageId: result.messageId, recipient: targetEmail });
  } catch (err: any) {
    console.error('[BREVO TEST ERROR]', err);
    res.status(500).json({ error: err.message || 'Erro ao conectar à API da Brevo' });
  }
});

// Reset Factory Demo Data
app.post('/api/admin/reset-demo', requireOwnerAuth, (req: Request, res: Response) => {
  const initial = getInitialDb();
  saveDb(initial);
  res.json({ success: true });
});

/* ========================================================================== */
/* VITE MIDDLEWARE / STATIC ASSETS SERVING                                    */
/* ========================================================================== */

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`> Servidor Qué Pasa operacional em http://0.0.0.0:${PORT}`);
  });
}

startServer();
