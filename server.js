// 1. Užkrauname aplinkos kintamuosius iš .env failo
require('dotenv').config();

// 2. Importuojame reikalingus modulius
const express = require('express');
const { ApolloServer } = require('apollo-server-express'); // Pagrindinis Apollo serveris integracijai su Express
const cors = require('cors');                           // Leidžia užklausas iš kito domeno (jūsų frontend)
const jwt = require('jsonwebtoken');                    // JWT validavimui

// 3. Importuojame savo GraphQL schemą ir resolverius
const typeDefs = require('./graphql/typeDefs'); // Įsitikinkite, kad kelias teisingas
const resolvers = require('./graphql/resolvers'); // Įsitikinkite, kad kelias teisingas

// 4. Nustatome serverio portą (iš .env arba numatytąjį)
const PORT = process.env.PORT || 3001;

// 5. Pagalbinė funkcija vartotojo duomenims iš JWT gauti
const getUserFromToken = (token) => {
    if (token) {
        try {
            // Patikriname (verify) tokeną naudodami paslaptį iš .env failo
            // Jei tokenas validus ir nepasibaigęs, grąžins iššifruotus duomenis (payload)
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            // Klaida reiškia, kad tokenas nebegalioja arba yra neteisingas
            console.error('Invalid or expired token:', err.message);
            return null;
        }
    }
    // Jei tokeno nėra, vartotojas neautentifikuotas
    return null;
};


// 6. Asinchroninė funkcija serveriui paleisti (reikalinga dėl await server.start())
async function startApolloServer() {
    // 7. Sukuriame Express aplikaciją
    const app = express();

    // 8. Įjungiame CORS visiems maršrutams
    // Gamybinėje aplinkoje reikėtų konfigūruoti detaliau, nurodant tik leistinus domenus
    app.use(cors());

    // 9. Sukuriame ApolloServer instanciją
    const server = new ApolloServer({
        typeDefs,  // Mūsų GraphQL schema
        resolvers, // Mūsų GraphQL resolveriai
        // Context funkcija - jos rezultatas bus prieinamas KIEKVIENAME resolver'yje
        // per trečiąjį argumentą (paprastai vadinamą 'context')
        context: ({ req }) => {
            // Gauname 'authorization' antraštę iš įeinančios HTTP užklausos
            const authHeader = req.headers.authorization || '';
            // Išimame patį tokeną (tikimės formato 'Bearer <token>')
            // Jei antraštė prasideda 'Bearer ', paimame dalį po tarpo
            const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

            // Gauname vartotojo duomenis iš tokeno (arba null, jei tokeno nėra/neteisingas)
            const user = getUserFromToken(token);

            // Grąžiname objektą, kuris taps 'context'.
            // Dabar resolveriuose galėsime pasiekti prisijungusį vartotoją per 'context.user'
            // Čia taip pat galima pridėti DB pool ar kitus dalykus, jei reikia juos pasiekti tiesiogiai resolveriuose
            return { user /*, dbPool: pool */ }; // 'user' bus null, jei neprisijungęs/tokenas blogas
        },
        // Galima įjungti introspekciją ir playground'ą development aplinkoje
        introspection: process.env.NODE_ENV !== 'production',
        // playground: process.env.NODE_ENV !== 'production', // Senesnė versija, dabar Apollo Studio rekomenduojama
    });

    // 10. BŪTINA: Paleidžiame Apollo serverį prieš integruojant su Express
    await server.start();

    // 11. Integruojame Apollo Server kaip middleware į Express aplikaciją
    // Visos užklausos į '/graphql' kelią bus nukreiptos į Apollo Server
    server.applyMiddleware({
         app,               // Express aplikacija
         path: '/graphql'   // Kelias (endpoint), kuriuo veiks GraphQL API
    });

    // 12. Paleidžiame Express serverį klausytis nurodytu portu
    app.listen(PORT, () => {
        console.log(`--------------------------------------------------------------------`);
        console.log(`🚀 Backend serveris pasiruošęs adresu http://localhost:${PORT}`);
        console.log(`🚀 GraphQL API veikia adresu http://localhost:${PORT}${server.graphqlPath}`);
        console.log(`--------------------------------------------------------------------`);
    });
}

// 13. Iškviečiame asinchroninę funkciją serveriui paleisti
startApolloServer().catch(error => {
    console.error("Klaida paleidžiant Apollo serverį:", error);
});

