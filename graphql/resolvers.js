const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AuthenticationError, UserInputError } = require('apollo-server-express');

const pool = require('../config/db');

const resolvers = {

  Query: {

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

      console.log("Data being returned by Query.blogsUser resolver (checking imagepath):", JSON.stringify(formattedRows.slice(0, 2), null, 2));

      return formattedRows;
    },



    currentUser: async (_, __, context) => {
      
      console.log("currentUser context.user:", context.user);
      if (!context.user || context.user.userId === undefined || context.user.userId === null) {
    
        return null;
      }

      const userToReturn = {
        id: context.user.userId,
        email: context.user.email,
        name: context.user.name || null,
        surname: context.user.surname || null
      };

      return userToReturn;
    },

    blogId: async (_, { id }) => {

      const [rows] = await pool.execute('SELECT * FROM blogs WHERE id = ?', [id]);

      const rawBlogData = rows[0];
        console.log("Raw DB data for blog:", JSON.stringify(rawBlogData, null, 2));

        
        const formattedBlog = { ...rawBlogData };
        if (formattedBlog.createdon && typeof formattedBlog.createdon.toISOString === 'function') {
            formattedBlog.createdon = formattedBlog.createdon.toISOString();
        } else if (formattedBlog.createdon) {
            formattedBlog.createdon = String(formattedBlog.createdon);
        } else {
            formattedBlog.createdon = null;
        }

        console.log("Formatted data being returned by resolver:", JSON.stringify(formattedBlog, null, 2));

        return formattedBlog;
    },

  },

  Mutation: {
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


        return {
          token,
          user: { id: userId, email: email, name: name, surname: surname }
        };
      } catch (error) {

        throw error;
      }
    },

    login: async (_, { email, password }) => {
      try {
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]); // TODO: Pakeiskite lentelės pavadinimą

        if (users.length === 0) {
          console.log(`Login attempt failed: User ${email} not found.`);
          throw new AuthenticationError('Neteisingas el. paštas arba slaptažodis.');
        }

        const user = users[0];

        const isValidPassword = await bcrypt.compare(password, user.password); // user.password - stulpelis su hashu DB

        if (!isValidPassword) {
          throw new AuthenticationError('Neteisingas el. paštas arba slaptažodis.');
        }

        const token = jwt.sign(
          { userId: user.id, email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        );

        console.log(`User logged in: ${email}, ID: ${user.id}`);
        return {
          token,
          user: { id: user.id, email: user.email }
        };
      } catch (error) {
        console.error('Login error:', error);
        if (!(error instanceof AuthenticationError)) {
          throw new Error('Prisijungimo klaida.');
        }
        throw error;
      }
    },


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

    updateBlog: async (_, { id, name, desc, imagepath }, context) => {

      if (!context.user) {
        throw new AuthenticationError('Veiksmas leidžiamas tik prisijungusiems vartotojams.');
      }

      const [result] = await pool.execute(
        'UPDATE blogs SET name = ?, `desc` = ?, imagepath = ? WHERE id = ?', [name, desc, imagepath, id]
      );

      return { id, name, desc, imagepath };
    },

    deleteBlog: async (_, { id }, context) => {

      if (!context.user) {
        throw new AuthenticationError('Veiksmas leidžiamas tik prisijungusiems vartotojams.');
      }

      let result;

      const [rows] = await pool.execute('SELECT id, createdby FROM blogs WHERE id = ?', [id]);

      if (rows[0].createdby === context.user.userId) {

        [result] = await pool.execute('DELETE FROM blogs WHERE id = ?', [id]);

      } else throw new AuthenticationError('Veiksmas leidžiamas tik blogo autoriui.');

      if (result.affectedRows === 0) {
        return false;
      } else return true;
    }
  },



  Blog: {
    imageUrl: (parent) => {
      if (parent.imagepath) {

        const constructedUrl = `http://localhost:3001${parent.imagepath}`;
        console.log("constructed url", constructedUrl);
        return constructedUrl;

      }
      return null;
    }
  }

};

module.exports = resolvers;

