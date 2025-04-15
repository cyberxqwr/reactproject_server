// Importuojame reikalingus modulius
const bcrypt = require('bcryptjs');             // Slaptažodžių hash'inimui ir palyginimui
const jwt = require('jsonwebtoken');            // JWT kūrimui
const { AuthenticationError, UserInputError } = require('apollo-server-express'); // Apollo klaidų tipai

// Importuojame DB prisijungimų telkinį (pool)
const pool = require('../config/db'); // Koreguokite kelią pagal savo struktūrą

// Pagrindinis resolverių objektas (struktūra turi atitikti typeDefs)
const resolvers = {
  // --- Query Resolveriai ---
  Query: {
    // Resolveris 'items' užklausai
    items: async () => {
      try {
        console.log("Fetching items from DB...");
        const [rows] = await pool.execute('SELECT * FROM items ORDER BY createdAt DESC'); // TODO: Pakeiskite lentelės pavadinimą į savo
        console.log("Items fetched:", rows.length);
        return rows;
      } catch (error) {
        console.error('Error fetching items:', error);
        throw new Error('Nepavyko gauti įrašų iš duomenų bazės.'); // Bendra klaida GraphQL klientui
      }
    },

    // Resolveris 'item' užklausai (gauna 'id' per antrą argumentą 'args')
    item: async (_, { id }) => {
      try {
        console.log(`Workspaceing item with id: ${id}`);
        const [rows] = await pool.execute('SELECT * FROM items WHERE id = ?', [id]); // TODO: Pakeiskite lentelės pavadinimą
        if (rows.length > 0) {
          console.log("Item found:", rows[0]);
          return rows[0];
        }
        console.log("Item not found.");
        return null; // Įrašas nerastas
      } catch (error) {
        console.error(`Error fetching item ${id}:`, error);
        throw new Error('Nepavyko gauti įrašo iš duomenų bazės.');
      }
    },

    // Resolveris 'currentUser' užklausai (gauna 'context' per trečią argumentą)
    currentUser: async (_, __, context) => {
      // 'context.user' yra objektas, kurį pridėjome server.js konfigūracijoje iš JWT
      console.log("currentUser context.user:", context.user);
      if (!context.user) {
        // Jei context.user nėra, vartotojas neprisijungęs arba tokenas blogas
        return null;
      }
      // TODO: Galima papildomai patikrinti DB, ar vartotojas su context.user.id vis dar egzistuoja
      // Grąžiname vartotojo duomenis iš konteksto
      return {
          id: context.user.id, // Svarbu: įsitikinkite, kad jūsų JWT payload yra 'id'
          email: context.user.email, // Svarbu: įsitikinkite, kad jūsų JWT payload yra 'email'
          name: context.user.name,
          surname: context.user.surname
          // Pridėkite kitus laukus, jei reikia ir jei jie yra JWT payload'e
      };
    }
  },

  // --- Mutation Resolveriai ---
  Mutation: {
    // Resolveris 'register' mutacijai
    register: async (_, { email, password, name, surname }) => {
      try {
        // TODO: Patikrinti, ar vartotojas su tokiu el. paštu jau egzistuoja DB
        // const [existingUser] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        // if (existingUser.length > 0) {
        //   throw new UserInputError('Vartotojas su tokiu el. paštu jau egzistuoja.');
        // }

        // Hash'uojame slaptažodį (saugumui!)
        const hashedPassword = await bcrypt.hash(password, 12); // 12 - salt rounds

        // Įrašome naują vartotoją į DB
        const [result] = await pool.execute(
          'INSERT INTO users (email, password, name, surname) VALUES (?, ?, ?, ?)', // TODO: Pakeiskite lentelės pavadinimą ir stulpelius
          [email, hashedPassword, name || "", surname || ""]
        );

        const userId = result.insertId;
        if (!userId) {
            throw new Error('Nepavyko įterpti vartotojo į DB.');
        }

        // Sukuriame JWT tokeną
        const token = jwt.sign(
          { userId: userId, email: email }, // Payload - kokią info užkoduoti į tokeną
          process.env.JWT_SECRET,         // Paslaptis iš .env failo
          { expiresIn: '1h' }             // Tokeno galiojimo laikas (pvz., 1 valanda)
        );

        console.log(`User registered: ${email}, ID: ${userId}`);
        // Grąžiname tokeną ir vartotojo info (atitinka AuthPayload tipą schemoje)
        return {
          token,
          user: { id: userId, email: email }
        };
      } catch (error) {
        console.error('Registration error:', error);
        // Perduodame klaidą toliau, kad Apollo Server ją apdorotų
        throw error; // Arba grąžiname specifiškesnę klaidą
      }
    },

    // Resolveris 'login' mutacijai
    login: async (_, { email, password }) => {
       try {
        // Ieškome vartotojo pagal el. paštą
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]); // TODO: Pakeiskite lentelės pavadinimą

        if (users.length === 0) {
          console.log(`Login attempt failed: User ${email} not found.`);
          throw new AuthenticationError('Neteisingas el. paštas arba slaptažodis.');
        }

        const user = users[0];

        // Lyginame pateiktą slaptažodį su DB esančiu hash'u
        const isValidPassword = await bcrypt.compare(password, user.password); // user.password - stulpelis su hashu DB

        if (!isValidPassword) {
          console.log(`Login attempt failed: Invalid password for user ${email}.`);
          throw new AuthenticationError('Neteisingas el. paštas arba slaptažodis.');
        }

        // Slaptažodis teisingas - kuriame JWT
        const token = jwt.sign(
          { userId: user.id, email: user.email }, // Payload
          process.env.JWT_SECRET,                // Paslaptis
          { expiresIn: '1h' }                    // Galiojimo laikas
        );

        console.log(`User logged in: ${email}, ID: ${user.id}`);
        // Grąžiname tokeną ir vartotojo info
        return {
          token,
          user: { id: user.id, email: user.email }
        };
       } catch (error) {
           console.error('Login error:', error);
           // Jei tai ne AuthenticationError, perduodam bendrą klaidą
           if (!(error instanceof AuthenticationError)) {
               throw new Error('Prisijungimo klaida.');
           }
           throw error; // Perduodam AuthenticationError toliau
       }
    },

    // --- CRUD Mutacijos (Reikalinga Autentifikacija) ---

    // Resolveris 'createItem' mutacijai
    createItem: async (_, { name, description }, context) => {
      // 1. Patikriname autentifikaciją (ar context.user egzistuoja?)
      if (!context.user) {
        throw new AuthenticationError('Veiksmas leidžiamas tik prisijungusiems vartotojams.');
      }

      // 2. Vykdome DB logiką
      try {
        console.log(`User ${context.user.userId} creating item: ${name}`);
        // TODO: Jei 'items' lentelė turi 'user_id' stulpelį, naudokite context.user.userId
        const [result] = await pool.execute(
            'INSERT INTO items (name, description /*, user_id */) VALUES (?, ? /*, ? */)', // TODO: Pakeiskite lentelę/stulpelius
            [name, description || null /*, context.user.userId */]
        );

        const newItemId = result.insertId;
        console.log(`Item created with ID: ${newItemId}`);

        // 3. Grąžiname naujai sukurtą objektą (atitinka Item tipą schemoje)
        return { id: newItemId, name, description /*, userId: context.user.userId */ };

      } catch (error) {
        console.error('Error creating item:', error);
        throw new Error('Nepavyko sukurti įrašo.');
      }
    },

    // Resolveris 'updateItem' mutacijai
    updateItem: async (_, { id, name, description }, context) => {
        if (!context.user) {
            throw new AuthenticationError('Veiksmas leidžiamas tik prisijungusiems vartotojams.');
        }
        try {
            console.log(`User ${context.user.userId} updating item ID: ${id}`);
            // TODO: Patikrinti, ar vartotojas turi teisę redaguoti BŪTENT šį įrašą (jei yra user_id)
            // TODO: Sukonstruoti UPDATE užklausą dinamiškai, kad atnaujintų tik pateiktus laukus (name, description)

            // Paprastas pavyzdys, atnaujinantis abu laukus:
            const [result] = await pool.execute(
                'UPDATE items SET name = ?, description = ? WHERE id = ? /* AND user_id = ? */', // TODO: Pakeiskite lentelę/stulpelius
                [name, description || null, id /*, context.user.userId */]
            );

            if (result.affectedRows === 0) {
                console.log(`Item ID ${id} not found or not owned by user ${context.user.userId}.`);
                return null; // Arba mesti klaidą 'NotFound'
            }

             console.log(`Item ID ${id} updated.`);
             // Grąžiname atnaujinto įrašo duomenis (galima pakartotinai užklausti DB arba tiesiog grąžinti pateiktus duomenis)
             return { id, name, description /*, userId: context.user.userId */ };

        } catch (error) {
             console.error(`Error updating item ${id}:`, error);
             throw new Error('Nepavyko atnaujinti įrašo.');
        }
    },

    // Resolveris 'deleteItem' mutacijai
    deleteItem: async (_, { id }, context) => {
        if (!context.user) {
            throw new AuthenticationError('Veiksmas leidžiamas tik prisijungusiems vartotojams.');
        }
         try {
             console.log(`User ${context.user.userId} deleting item ID: ${id}`);
             // TODO: Patikrinti, ar vartotojas turi teisę trinti BŪTENT šį įrašą (jei yra user_id)
             const [result] = await pool.execute(
                 'DELETE FROM items WHERE id = ? /* AND user_id = ? */', // TODO: Pakeiskite lentelę/stulpelius
                 [id /*, context.user.userId */]
             );

             if (result.affectedRows === 0) {
                 console.log(`Item ID ${id} not found or not owned by user ${context.user.userId} for deletion.`);
                 return false; // Nepavyko ištrinti (nerado arba neturėjo teisių)
             }

             console.log(`Item ID ${id} deleted.`);
             return true; // Sėkmingai ištrinta

         } catch (error) {
             console.error(`Error deleting item ${id}:`, error);
             throw new Error('Nepavyko ištrinti įrašo.');
         }
    },
  },

  // --- Kiti Resolveriai (jei reikia, pvz., ryšiams tarp tipų) ---
  // Pvz., jei Item tipas turėtų 'user' lauką:
  // Item: {
  //   user: async (parentItem) => {
  //     // 'parentItem' yra objektas Item, kuriam ieškome vartotojo
  //     const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [parentItem.userId]);
  //     return rows[0] || null;
  //   }
  // }
};

// Eksportuojame resolverių objektą
module.exports = resolvers;

