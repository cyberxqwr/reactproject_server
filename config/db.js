require('dotenv').config();

const mysql = require('mysql2/promise');

console.log('Creating database pool with user:', process.env.DB_USER);
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true, 
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
    queueLimit: 0 
});

pool.getConnection()
    .then(connection => {
        console.log('Database connected successfully using connection pool!');
        connection.release();
    })
    .catch(error => {
        console.error('!!! Database Connection Failed:', error);
    });

module.exports = pool;
