// Importuojame gql žymę iš apollo-server-express
const { gql } = require('apollo-server-express');

// Apibrėžiame GraphQL schemą
const typeDefs = gql`

  type User {
    id: ID!          # Unikalus vartotojo ID (dažniausiai iš DB)
    email: String!   # Vartotojo el. paštas
    name: String
    surname: String
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Item {
    id: ID!
    name: String!
    description: String

  }

  type Blog {
    id: ID!
    name: String!
    desc: String!
    createdby: ID
    imagepath: String
    createdon: String
    imageUrl: String
  }


  type Query {
    
    items: [Item!]!

    blogs: [Blog!]!

    blogsUser: [Blog!]!

    # Gauti vieną įrašą pagal ID
    item(id: ID!): Item

    # Gauti informaciją apie šiuo metu prisijungusį vartotoją
    currentUser: User
  }

  type Mutation {

    register(email: String!, password: String!, name: String!, surname: String!): AuthPayload!

    login(email: String!, password: String!): AuthPayload!

    createItem(name: String!, description: String): Item!
    updateItem(id: ID!, name: String, description: String): Item # Grąžina atnaujintą įrašą arba null
    deleteItem(id: ID!): Boolean # Grąžina true, jei pavyko, false/null kitu atveju
    createBlog(name: String!, desc: String!, imagepath: String): Blog!
  }
`;

module.exports = typeDefs;
