
require('dotenv').config();

const express = require('express');
const { ApolloServer } = require('apollo-server-express'); // Pagrindinis Apollo serveris integracijai su Express
const cors = require('cors');                           // Leidžia užklausas iš kito domeno (jūsų frontend)
const jwt = require('jsonwebtoken');                    // JWT validavimui
const multer = require('multer');
const path = require('path');
const fs = require('fs');



const typeDefs = require('./graphql/typeDefs'); // Įsitikinkite, kad kelias teisingas
const resolvers = require('./graphql/resolvers'); // Įsitikinkite, kad kelias teisingas

// 4. Nustatome serverio portą (iš .env arba numatytąjį)
const PORT = process.env.PORT || 3001;

// 5. Pagalbinė funkcija vartotojo duomenims iš JWT gauti
const getUserFromToken = (token) => {
    if (token) {
        try {

            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            console.error('Invalid or expired token:', err.message);
            return null;
        }
    }

    return null;
};

async function startApolloServer() {

    const app = express();

    app.use(cors());

    const blogUploadsDir = path.join(__dirname, 'uploads', 'blogs');

    if (!fs.existsSync(blogUploadsDir)) fs.mkdirSync(blogUploadsDir, { recursive: true });

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, blogUploadsDir)
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));

        }
    });

    const upload = multer({ storage: storage });

    app.post('/api/upload/blog-image', upload.single('blogImage'), (req, res) => {

        if (!req.file) {
            return res.status(400).json({ error: 'Failas neikeltas' });

        }

        const filePath = `/uploads/blogs/${req.file.filename}`;
        console.log("Failas ikeltas", filePath);
        res.json({ filePath: filePath });
    });

    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

    const server = new ApolloServer({
        typeDefs,
        resolvers,
        context: ({ req }) => {

            const authHeader = req.headers.authorization || '';

            const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

            const user = getUserFromToken(token);

            return { user };
        },

        debug: true,
        formatError: (err) => {
            console.error("--- GraphQL Error Formatter ---");
            console.error(JSON.stringify(err, null, 2));
            console.error("--- End GraphQL Error ---");
            return err;
        },

        introspection: process.env.NODE_ENV !== 'production',

    });


    await server.start();

    server.applyMiddleware({
        app,
        path: '/graphql'
    });


    app.listen(PORT, () => {

        console.log(`Backend serveris http://localhost:${PORT}`);
        console.log(`GraphQL API http://localhost:${PORT}${server.graphqlPath}`);

    });
}

startApolloServer().catch(error => {
    console.error("Klaida paleidžiant Apollo serverį:", error);
});

