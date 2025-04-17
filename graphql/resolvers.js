const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AuthenticationError, UserInputError } = require('apollo-server-express');

const pool = require('../config/db');

const resolvers = {

  Query: {
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

    blogs: async () => {

      const [rows] = await pool.execute('SELECT * FROM blogs ORDER BY createdon DESC');

      const formattedRows = rows.map(blog => {

        const formattedBlog = { ...blog };


        if (formattedBlog.createdon && typeof formattedBlog.createdon.toISOString === 'function') {

          formattedBlog.createdon = formattedBlog.createdon.toISOString();
        } else if (formattedBlog.createdon) {

          formattedBlog.createdon = String(formattedBlog.createdon);
        } else {

          formattedBlog.createdon = null;
        }

        return formattedBlog;
      });

      return formattedRows;
    },

    blogsUser: async (_, __, context) => {

      if (!context.user) {
        throw new AuthenticationError('Veiksmas leidžiamas tik prisijungusiems vartotojams.');
      }

        const [rows] = await pool.execute('SELECT * FROM blogs WHERE createdby = ? ORDER BY createdon DESC', [context.user.userId]);

        const formattedRows = rows.map(blog => {

          const formattedBlog = { ...blog };
  
  
          if (formattedBlog.createdon && typeof formattedBlog.createdon.toISOString === 'function') {
  
            formattedBlog.createdon = formattedBlog.createdon.toISOString();
          } else if (formattedBlog.createdon) {
  
            formattedBlog.createdon = String(formattedBlog.createdon);
          } else {
  
            formattedBlog.createdon = null;
          }
  
          return formattedBlog;
        });
  
        console.log("Data being returned by Query.blogs resolver (checking imagepath):", JSON.stringify(formattedRows.slice(0, 2), null, 2));
        
        return formattedRows;
    },

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

    
    currentUser: async (_, __, context) => {
      // 'context.user' yra objektas, kurį pridėjome server.js konfigūracijoje iš JWT
      console.log("currentUser context.user:", context.user);
      if (!context.user || context.user.userId === undefined || context.user.userId === null) {
        console.log("currentUser resolver: No valid user in context. Returning null.");
        return null;
      }
      // TODO: Galima papildomai patikrinti DB, ar vartotojas su context.user.id vis dar egzistuoja
      // Grąžiname vartotojo duomenis iš konteksto
      console.log(`currentUser resolver: Returning user data for ID: ${context.user.userId}`);
      const userToReturn = {
        // PAKEISTA ČIA: Naudojame context.user.userId
        id: context.user.userId,
        email: context.user.email,
        // PAKEISTA ČIA: Naudojame || null, kad grąžintų null, jei JWT nėra vardo/pavardės
        name: context.user.name || null,
        surname: context.user.surname || null
      };

      return userToReturn;
    }
  },

  // --- Mutation Resolveriai ---
  Mutation: {
    // Resolveris 'register' mutacijai
    register: async (_, { email, password, name, surname }) => {
      try {

        const hashedPassword = await bcrypt.hash(password, 12); // 12 - salt rounds

        const [result] = await pool.execute(
          'INSERT INTO users (email, password, name, surname) VALUES (?, ?, ?, ?)',
          [email, hashedPassword, name || "", surname || ""]
        );

        const userId = result.insertId;
        if (!userId) {
          throw new Error('Nepavyko įterpti vartotojo į DB.');
        }

        const token = jwt.sign(
          { userId: userId, email: email },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        );

        console.log(`User registered: ${email}, ID: ${userId}`);
        
        return {
          token,
          user: { id: userId, email: email, name: name, surname: surname }
        };
      } catch (error) {
        console.error('Registration error:', error);
        
        throw error;
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


    createBlog: async (_, { name, desc, imagepath }, context) => {

      console.log("Using v2");

      if (!context.user) {
        throw new AuthenticationError('Veiksmas leidžiamas tik prisijungusiems vartotojams.');
      }

      const createdDate = new Date();
      const userId = context.user.userId;

      try {

        const [result] = await pool.execute(
          'INSERT INTO blogs (name, `desc`, createdby, imagepath, createdon) VALUES (?, ?, ?, ?, ?)',
          [name, desc, userId, imagepath, createdDate]
        )



        const newBlogId = result.insertId;
        console.log("id: ", newBlogId);

        console.log(`DB Insert successful. New Blog ID: ${newBlogId}`);

        if (!newBlogId) {
          throw new Error('Nepavyko gauti naujo įrašo ID iš DB po INSERT.');
        }

        return { id: newBlogId, name, desc, createdby: userId, imagepath, createdon: createdDate }
      } catch (error) {
        console.error("Error: ", error);
      }

    },

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

  Blog: {
    imageUrl: (parent) => {
      if (parent.imagepath) {

          const constructedUrl = `http://localhost:3001${parent.imagepath}`;
          return constructedUrl;
        
      }
      return null;
    }
  }

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

