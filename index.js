const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Token de verificación
const VERIFY_TOKEN = 'botpress_dinamicas';

// Endpoint GET para la verificación de Meta
app.get('/webhook', (req, res) => {
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (token === VERIFY_TOKEN) {
    console.log('Webhook verificado por Meta');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Endpoint POST para recibir mensajes
app.post('/webhook', (req, res) => {
  const body = req.body;
  console.log('Mensaje recibido:', JSON.stringify(body, null, 2));

  // Respuesta automática
  res.status(200).send({ reply: 'Hola, soy tu bot en GitHub 😄' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot corriendo en puerto ${PORT}`));
