const { google } = require('googleapis');
const credentials = require('./service-account.json');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'Hoja1';

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function checkBoleta(numero) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:C`,
  });

  const rows = res.data.values;
  if (!rows || rows.length === 0) return null;

  for (let i = 0; i < rows.length; i++) {
    const [num, estado] = rows[i];
    if (num === numero.toString()) {
      return { index: i, estado };
    }
  }
  return null;
}

async function marcarVendida(index, cliente) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!B${index + 1}:C${index + 1}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['vendido', cliente]],
    },
  });
}

module.exports = { checkBoleta, marcarVendida };
