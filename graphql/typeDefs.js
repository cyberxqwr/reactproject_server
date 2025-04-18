const { gql } = require('apollo-server-express');

const typeDefs = gql`

  type User {
    id: ID!
    email: String!
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

    blogId(id: ID!): Blog

    # Gauti vieną įrašą pagal ID
    item(id: ID!): Item

    # Gauti informaciją apie šiuo metu prisijungusį vartotoją
    currentUser: User
  }

  type Mutation {

    register(email: String!, password: String!, name: String!, surname: String!): AuthPayload!

    login(email: String!, password: String!): AuthPayload!

    createItem(name: String!, description: String): Item!
    updateItem(id: ID!, name: String, description: String): Item
    deleteItem(id: ID!): Boolean
    createBlog(name: String!, desc: String!, imagepath: String): Blog!
    updateBlog (id: ID!, name: String!, desc: String!, imagepath: String!): Blog!
    deleteBlog(id: ID!): Boolean
  }
`;

module.exports = typeDefs;
