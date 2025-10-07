const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// Variables de entorno
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'botpress_dinamicas';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

// ------------------
// Función para enviar lista interactiva
// ------------------
async function sendInteractiveList(phone_number_id, to) {
  const data = {
    messaging_product: "whatsapp",
    to: to,
    type: "interactive",
    interactive: {
      type: "list",
      header: {
        type: "text",
        text: "🎟️ Opciones de boletas"
      },
      body: {
        text: "Selecciona una opción:"
      },
      footer: {
        text: "Dinamicas CC"
      },
      action: {
        button: "Ver opciones",
        sections: [
          {
            title: "Boletas",
            rows: [
              { id: "vip", title: "Boleta VIP" },
              { id: "general", title: "Boleta General" }
            ]
          },
          {
            title: "Información",
            rows: [
              { id: "fechas", title: "Fechas de eventos" },
              { id: "otros", title: "Otros servicios" }
            ]
          }
        ]
      }
    }
  };

  try {
    await axios.post(`https://graph.facebook.com/v17.0/${phone_number_id}/messages`, data, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Lista interactiva enviada a', to);
  } catch (error) {
    console.error('Error enviando lista:', error.response ? error.response.data : error.message);
  }
}

// ------------------
// Endpoint GET para verificación de webhook
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
// Endpoint POST para recibir mensajes
// ------------------
app.post('/webhook', async (req, res) => {
  const body = req.body;
  console.log('Mensaje recibido:', JSON.stringify(body, null, 2));

  if (body.object === "whatsapp_business_account") {
    const changes = body.entry[0].changes[0].value;

    if (changes.messages && changes.messages.length > 0) {
      const from = changes.messages[0].from;
      const text = changes.messages[0].text?.body.toLowerCase() || '';
      const phone_number_id = changes.metadata.phone_number_id;

      // Detectar palabras clave para mostrar lista
      if (text.includes('hola') && text.includes('boletas')) {
        await sendInteractiveList(phone_number_id, from);
      } else {
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
  }

  res.sendStatus(200);
});

// ------------------
// Iniciar servidor
// ------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Bot corriendo en puerto ${PORT}`));
