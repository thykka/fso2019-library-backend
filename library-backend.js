const { ApolloServer, UserInputError, gql } = require('apollo-server');
// const uuid = require('uuid/v1');
const mongoose = require('mongoose');
const Book = require('./models/book');
const Author = require('./models/author');

mongoose.set('useFindAndModify', false);

const MONGODB_URI = getMongoDbUri();

mongoose.connect(MONGODB_URI, { useNewUrlParser: true })

const typeDefs = gql`
  type Author {
    name: String!
    bookCount: Int!
    born: Int
    id: ID!
  }

  type Book {
    title: String!
    published: Int
    author: Author!
    id: ID!
    genres: [String!]
  }

  type Query {
    hello: String!
    bookCount: Int!
    authorCount: Int!
    allBooks: [Book!]
    allAuthors: [Author!]!
    findBooks(
      author: String,
      title: String,
      genre: String
    ): [Book!]
  }

  type Mutation {
    addBook(
      title: String!
      authorName: String!
      published: Int
      genres: [String!]
    ): Book

    editAuthor(
      name: String!
      setBornTo: Int
    ): Author
  }
`

const resolveBookCount = () => Book.collection.countDocuments();
const resolveAuthorCount = () => Author.collection.countDocuments();

const resolveAllBooks = () => Book.find({}).populate('author');

const resolveFindBooks = async (root, { title, author, genre } = {}) => {
  const foundBooks = await Book.find({ title, author: {name:author}, genre });
  return foundBooks;
};

const resolveAllAuthors = () => Author.find({});

const resolveAuthorBookCount = async (root) => {
  const authorBooks = await Book.find({ author: root });
  return authorBooks.length;
};

const mutateAddBook = async (root, args) => {
  const { authorName, title, published, genres } = args;
  let author = await Author.findOne({ name: authorName });
  if(!author && authorName) {
    author = new Author({ name: authorName });
    try {
      await author.save();
    } catch(e) {
      throw new UserInputError(e.message, { invalidArgs: args });
    }
    console.log('New author!');
  }
  console.log(`Using author: ${ JSON.stringify(author, null, 2) }`);
  const book = new Book({
    title,
    author: author.id,
    published,
    genres
  });
  try {
    await book.save()
  } catch(e) {
    throw new UserInputError(e.message, { invalidArgs: args });
  }
  console.log(`New book: ${ JSON.stringify({ book: Book.populate(book, { path: 'author' }) }, null, 2) }`);
  return Book.populate(book, 'author');
}

const mutateEditAuthor = async (root, args) => {
  const { name, setBornTo } = args;
  let author = null;
  if (name) {
    author = await Author.findOne({ name });
  }
  if (author && setBornTo) {
    author.born = setBornTo;
  } else {
    return null;
  }
  return author.save();
}

const resolvers = {
  Query: {
    hello: () => 'hello',
    bookCount: resolveBookCount,
    authorCount: resolveAuthorCount,
    allBooks: resolveAllBooks,
    allAuthors: resolveAllAuthors,
    findBooks: resolveFindBooks
  },
  Author: {
    bookCount: resolveAuthorBookCount
  },
  Mutation: {
    addBook: mutateAddBook,
    editAuthor: mutateEditAuthor
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  connectToDevTools: true
})

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`)
})


function getMongoDbUri() {
  let dbUser = process.argv[2];
  let dbPass = process.argv[3];

  console.log(process.argv.length);

  if(process.argv.length <= 2) {
    console.log('Attempting login with environment credentials');
    dbUser = process.env.DB_USER;
    dbPass = process.env.DB_PASS;
    console.log(dbUser);
  } else {
    dbUser = process.argv[2];
    dbPass = process.argv[3];
  }

  if(!dbUser || !dbPass) {
    console.log('Missing login credentials. Add <dbUser> <dbPass> as arguments.');
    process.exit(1);
  }

  return `mongodb+srv://${
    dbUser
  }:${
    dbPass
  }@thykka-fso2k19-cswvc.mongodb.net/books?retryWrites=true&w=majority`;
}
