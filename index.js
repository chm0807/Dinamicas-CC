// index.js
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// Token para verificación de Meta
const VERIFY_TOKEN = 'botpress_dinamicas';

// Tu token de acceso de WhatsApp Business desde variable de entorno
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

// ------------------
// Endpoint para verificación de webhook
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

// ------------------
// Endpoint para recibir mensajes
// ------------------
app.post('/webhook', async (req, res) => {
  const body = req.body;
  console.log('Mensaje recibido:', JSON.stringify(body, null, 2));

  if (body.object === "whatsapp_business_account") {
    const changes = body.entry[0].changes[0].value;

    if (changes.messages && changes.messages.length > 0) {
      const from = changes.messages[0].from;
      const text = changes.messages[0].text?.body || '';
      const phone_number_id = changes.metadata.phone_number_id;

      const reply = `Hola! Recibí tu mensaje: "${text}"`;

      try {
        await axios.post(`https://graph.facebook.com/v17.0/${phone_number_id}/messages`, {
          messaging_product: "whatsapp",
          to: from,
          text: { body: reply }
        }, {
          headers: {
            'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('Mensaje enviado a', from);
      } catch (error) {
        console.error('Error enviando mensaje:', error.response ? error.response.data : error.message);
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
