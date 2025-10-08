require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { google } = require('googleapis');

const app = express();
app.use(bodyParser.json());

// ------------------
// Configuración de tokens
// ------------------
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'botpress_dinamicas';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'Boletas';

// ------------------
// Estado temporal de usuarios
// ------------------
const userState = {};

// ------------------
// Google Sheets
// ------------------
const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function verificarNumero(numero) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:C`,
  });

  const rows = res.data.values;
  for (let row of rows) {
    if (parseInt(row[0]) === numero) {
      return row[1].toLowerCase() === 'disponible';
    }
  }
  return false;
}

async function marcarVendida(numero, cliente) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:C`,
  });

  const rows = res.data.values;
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (parseInt(rows[i][0]) === numero) {
      rowIndex = i + 1; // Sheets empieza en 1
      break;
    }
  }

  if (rowIndex !== -1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!B${rowIndex}:C${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['vendido', cliente]] },
    });
  }
}

// ------------------
// Función para enviar mensaje simple
// ------------------
async function enviarMensaje(phone_number_id, to, text) {
  try {
    await axios.post(`https://graph.facebook.com/v17.0/${phone_number_id}/messages`, {
      messaging_product: 'whatsapp',
      to,
      text: { body: text }
    }, {
      headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error enviando mensaje:', error.response ? error.response.data : error.message);
  }
}

// ------------------
// Función para enviar lista interactiva
// ------------------
async function sendInteractiveList(phone_number_id, to) {
  const data = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: '🎟️ Boleta Tres de Oros♣️' },
      body: {
        text: `🎉 ¡Hola! Qué alegría verte por aquí 😍
Nuestra boleta única Tres de Oros♣️ te da la oportunidad de ganar:
🏍️ 2 motos Boxer CT 125 modelo 2026
🚙 1 camioneta Subaru Forester
💰 5 millones representados en oro
🎄 Gran parranda navideña el 20 de diciembre
💸 Valor de la boleta: $60.000

Selecciona la boleta a continuación y asegura tu oportunidad de ganar estos increíbles premios ✨`
      },
      footer: { text: 'Dinamicas CC' },
      action: {
        button: 'Adquirir boleta',
        sections: [{ title: 'Boleta', rows: [{ id: 'tres_de_oros', title: 'Tres de Oros♣️ - $60.000' }] }]
      }
    }
  };

  try {
    await axios.post(`https://graph.facebook.com/v17.0/${phone_number_id}/messages`, data, {
      headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' }
    });
    console.log('Lista interactiva enviada a', to);
  } catch (error) {
    console.error('Error enviando lista:', error.response ? error.response.data : error.message);
  }
}

// ------------------
// Endpoints webhook
// ------------------
app.get('/webhook', (req, res) => {
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (token === VERIFY_TOKEN) {
    console.log('Webhook verificado por Meta');
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;
  const from = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
  const text = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body?.toLowerCase();
  const phone_number_id = body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

  if (!from || !text) return res.sendStatus(200);

  console.log('Mensaje recibido:', JSON.stringify(body, null, 2));

  // Paso 1: Usuario dice hola → enviar lista interactiva
  if (text.includes('hola') || text.includes('boletas')) {
    await sendInteractiveList(phone_number_id, from);
    userState[from] = { esperandoBoleta: true };
  }
  // Paso 2: Usuario selecciona boleta
  else if (userState[from]?.esperandoBoleta) {
    if (text.includes('tres de oros') || text.includes('tres_de_oros')) {
      await enviarMensaje(phone_number_id, from, `🎟️ ¡Excelente elección! 🎟️
Ahora, ¿qué número deseas? Te diremos si está disponible en nuestra lista. ✨`);
      userState[from] = { esperandoNumero: true };
    }
  }
  // Paso 3: Usuario ingresa número
  else if (userState[from]?.esperandoNumero) {
    const numeroDeseado = parseInt(text);
    if (isNaN(numeroDeseado)) {
      await enviarMensaje(phone_number_id, from, 'Por favor ingresa un número válido.');
    } else {
      const disponible = await verificarNumero(numeroDeseado);
      if (disponible) {
        await marcarVendida(numeroDeseado, from);
        await enviarMensaje(phone_number_id, from, `🎟️ ¡Perfecto! Tu número ${numeroDeseado} está disponible.
Realiza la transferencia de $60.000 a una de estas cuentas:

Bancolombia (Ahorros): 123456789 - Dinamicas CC
Davivienda (Corriente): 987654321 - Dinamicas CC

¡Muchísima suerte! 🍀`);
        delete userState[from];
      } else {
        await enviarMensaje(phone_number_id, from, `Lo sentimos 😅, el número ${numeroDeseado} ya no está disponible. Por favor elige otro número.`);
      }
    }
  }

  res.sendStatus(200);
});

// ------------------
// Iniciar servidor
// ------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Bot corriendo en puerto ${PORT}`));
