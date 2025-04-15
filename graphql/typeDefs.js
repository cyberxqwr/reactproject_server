// Importuojame gql žymę iš apollo-server-express
const { gql } = require('apollo-server-express');

// Apibrėžiame GraphQL schemą
const typeDefs = gql`
  # --- Objekto Tipai ---

  # Apibrėžia vartotojo duomenis (NIEKADA negrąžinkite slaptažodžio ar jo hasho!)
  type User {
    id: ID!          # Unikalus vartotojo ID (dažniausiai iš DB)
    email: String!   # Vartotojo el. paštas
    name: String
    surname: String
    # createdAt: String # Galima pridėti sukūrimo datą, jei reikia
  }

  # Apibrėžia duomenis, grąžinamus po sėkmingos registracijos/prisijungimo
  type AuthPayload {
    token: String!   # JWT (JSON Web Token)
    user: User!      # Prisijungusio vartotojo informacija
  }

  # Apibrėžia pagrindinio CRUD objekto struktūrą (pavadinkite pagal savo projektą, pvz., Post, Task, Product)
  type Item {
    id: ID!
    name: String!
    description: String
    # userId: ID! # Jei įrašai priklauso vartotojams, pridėkite ryšį
    # createdAt: String
    # updatedAt: String
  }

  # --- Įvesties Tipai (Mutacijoms) ---
  # Galima naudoti input tipus sudėtingesniems argumentams, bet kol kas nenaudosime

  # --- Užklausų Tipas (Duomenų Skaitymui) ---
  type Query {
    # Gauti visus įrašus (galima pridėti filtravimą/puslapiavimą vėliau)
    items: [Item!]!

    # Gauti vieną įrašą pagal ID
    item(id: ID!): Item

    # Gauti informaciją apie šiuo metu prisijungusį vartotoją
    currentUser: User
  }

  # --- Mutacijų Tipas (Duomenų Keitimui) ---
  type Mutation {
    # Vartotojo registracija
    register(email: String!, password: String!, name: String, surname: String): AuthPayload!

    # Vartotojo prisijungimas
    login(email: String!, password: String!): AuthPayload!

    # CRUD operacijos Item tipui (šios mutacijos turėtų būti apsaugotos - tik prisijungusiems vartotojams)
    createItem(name: String!, description: String): Item!
    updateItem(id: ID!, name: String, description: String): Item # Grąžina atnaujintą įrašą arba null
    deleteItem(id: ID!): Boolean # Grąžina true, jei pavyko, false/null kitu atveju
  }
`;

// Eksportuojame schemos apibrėžimą
module.exports = typeDefs;
