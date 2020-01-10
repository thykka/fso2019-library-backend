const { ApolloServer, UserInputError, gql } = require('apollo-server');
const uuid = require('uuid/v1');
const mongoose = require('mongoose');
const Book = require('./models/book');
const Author = require('./models/author');

mongoose.set('useFindAndModify', false);

const MONGODB_URI = getMongoDbUri();

mongoose.connect(MONGODB_URI, { useNewUrlParser: true })
  .then(() => console.log('Mongo Connected!'))
  .catch(e => 'Mongo not connected; ' + e.message);


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
    findBook(author: String, title: String, genre: String): [Book!]
  }

  type Mutation {
    addBook(
      title: String!
      author: String!
      published: Int
      genres: [String!]
    ) : Book

    editAuthor(
      name: String!
      setBornTo: Int
    ) : Author
  }
`

const resolveBookCount = () => Book.collection.countDocuments();
const resolveAuthorCount = () => Author.collection.countDocuments();

const resolveAllBooks = () => Book.find({}).populate('author');

const resolveFindBook = (root, { author, genre } = {}) => Book.findOne({ author, genre });

const resolveAllAuthors = () => Author.find({});

const mutateAddBook = async (root, args) => {
  let author = await Author.findOne({ name: args.author });
  if(!author) {
    author = await new Author({ name: args.author }).save();
  }
  const book = new Book({ ...args, author: author.id });
  return book.save();
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
    bookCount: resolveBookCount,
    authorCount: resolveAuthorCount,
    allBooks: resolveAllBooks,
    allAuthors: resolveAllAuthors,
    findBook: resolveFindBook
  },
  Mutation: {
    addBook: mutateAddBook,
    editAuthor: mutateEditAuthor
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
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
