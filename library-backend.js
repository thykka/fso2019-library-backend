const { ApolloServer, UserInputError, gql } = require('apollo-server');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Book = require('./models/book');
const Author = require('./models/author');
const User = require('./models/user');

mongoose.set('useFindAndModify', false);

const COMMON_PASSWORD = '1ns3cur3';
const JWT_SECRET = 'PIENLENTOKONESUIHKUTURBIINIVARAMOOTTORIAPUMEKAANIKKOKOKELAS';
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

  type User {
    username: String!
    favoriteGenre: String
    id: ID!
  }

  type Token {
    value: String!
  }

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks: [Book!]
    allAuthors(
      author: String
    ): [Author!]!
    findBooks(
      author: String,
      title: String,
      genre: String
    ): [Book!]
    me: User
  }

  type Mutation {
    addBook(
      title: String!
      authorName: String!
      published: Int
      genres: [String!]
      token: String!
    ): Book

    editAuthor(
      name: String!
      setBornTo: Int
      token: String!
    ): Author

    createUser(
      username: String!
      favoriteGenre: String
    ): User

    login(
      username: String!
      password: String!
    ): Token
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
  const { authorName, title, published, genres, token } = args;
  if(!token || !jwt.verify(token, JWT_SECRET)) {
    throw new UserInputError('Missing or invalid token', { invalidArgs: args });
  }
  if(!title) {
    throw new UserInputError('Missing `title`', { invalidArgs: args });
  }
  if(!authorName) {
    throw new UserInputError('Missing `authorName`', { invalidArgs: args });
  }
  if(published > new Date().getFullYear()) {
    throw new UserInputError('Cannot add book that hasn\'t been published yet', { invalidArgs: args })
  }
  // Find the author, or create if doesn't exist
  let author = await Author.findOne({ name: authorName });
  if(!author) {
    author = new Author({ name: authorName });
    try {
      await author.save();
    } catch(e) {
      throw new UserInputError(e.message, { invalidArgs: args });
    }
  }
  // create and save the book
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
  return Book.populate(book, 'author');
}

const mutateEditAuthor = async (root, args) => {
  const { name, setBornTo, token } = args;
  if(!token || !jwt.verify(token, JWT_SECRET)) {
    throw new UserInputError('Missing or invalid token', { invalidArgs: args });
  }
  if(!name) {
    throw new UserInputError('Missing `name`', { invalidArgs: args });
  }
  if(!setBornTo) {
    throw new UserInputError('Missing `setBornTo`', { invalidArgs: args });
  }
  if(setBornTo > new Date().getFullYear()) {
    throw new UserInputError('Author is born in the future!?', { invalidArgs: args })
  }
  const author = await Author.findOne({ name });

  if (!author) {
    // this should probably be the GraphQL-equivalent of a 404...
    throw new UserInputError('No such author');
  }

  author.born = setBornTo;

  try {
    return author.save();
  } catch(e) {
    throw new UserInputError(e.message, { invalidArgs: args })
  }
}

const mutateCreateUser = (root, args) => {
  const user = new User({ username: args.username })

  return user.save()
    .catch(error => {
      throw new UserInputError(error.message, {
        invalidArgs: args,
      })
    })
};
const mutateLogin = async (root, args) => {
  const user = await User.findOne({ username: args.username })

  console.log(user, args.password);

  if ( !user || args.password !== COMMON_PASSWORD ) {
    throw new UserInputError("wrong credentials")
  }

  const userForToken = {
    username: user.username,
    id: user._id,
  }

  return { value: jwt.sign(userForToken, JWT_SECRET) }
};

const resolvers = {
  Query: {
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
    editAuthor: mutateEditAuthor,
    createUser: mutateCreateUser,
    login: mutateLogin,
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
