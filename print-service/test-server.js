// Quick test to verify server can start
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.text());

app.get('/test', (req, res) => {
    res.json({ status: 'ok', message: 'Server is working!' });
});

app.listen(3002, () => {
    console.log('Test server running on http://localhost:3002');
    console.log('Test endpoint: http://localhost:3002/test');
});

