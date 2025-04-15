require('dotenv').config();

const mysql = require('mysql2/promise');

console.log('Creating database pool with user:', process.env.DB_USER); // Debugging line
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost', // Naudojame reikšmę iš .env arba numatytąją
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true, // Ar laukti, kol bus laisva jungtis, jei visos užimtos
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'), // Maksimalus jungčių skaičius telkinyje
    queueLimit: 0 // Eilės limitas užklausoms, kai visos jungtys užimtos (0 = neribota)
});

// --- Neprivaloma: Patikrinti prisijungimą iškart sukūrus telkinį ---
// Tai naudinga, kad iškart matytumėte, ar prisijungimo duomenys .env faile yra teisingi.
pool.getConnection()
    .then(connection => {
        console.log('Database connected successfully using connection pool!');
        // Svarbu: atlaisvinkite jungtį iškart po patikrinimo
        connection.release();
    })
    .catch(error => {
        console.error('!!! Database Connection Failed:', error);
        // Čia galite pridėti logiką, kuri sustabdytų aplikaciją, jei DB nepasiekiama,
        // pvz., process.exit(1);
    });
// --- Patikrinimo pabaiga ---


// 4. Eksportuojame sukurtą telkinį, kad jį būtų galima naudoti kituose moduliuose
module.exports = pool;
