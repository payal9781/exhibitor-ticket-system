require('dotenv').config();
const http = require('http');
const connectDB = require('./config/database');
const app = require('./app');

connectDB();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));