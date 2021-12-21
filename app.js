const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')(session)
const flash = require('connect-flash')
const markdown = require('marked')
const sanitizeHTML = require('sanitize-html')

const app = express()

let sessionOptions = session({
  secret: 'javascript should be the first love',
  store: new MongoStore({ client: require('./db') }),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 3, httpOnly: true }
})

// app.use is the method by which Express adds middleware
app.use(sessionOptions)
app.use(flash())

// this function is going to run for every request
app.use((req, res, next) => {
  // make markdown function available for ejs template
  res.locals.userMarkdown = content => sanitizeHTML(markdown(content), { allowedTags: ['p', 'br', 'ul', 'li', 'strong', 'bold', 'i', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'], allowedAttributes: {} })

  // make all error and success flash messages available for all templates
  res.locals.errors = req.flash('errors')
  res.locals.success = req.flash('success')

  // make current user id available on the req object
  if (req.session.user) req.visitorId = req.session.user._id
  else req.visitorId = 0

  res.locals.user = req.session.user // this object will be available within our ejs template

  next()
})

const router = require('./router')

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.use(express.static('public'))
app.set('views', 'views') // express is going to look for the folder defined as second argument for view

app.set('view engine', 'ejs')

// app.get('/', (req, res) => res.render('home-guest'))
app.use('/', router)

// we created a server that is going to use our express app as its handler,
const server = require('http').createServer(app)

// add-in socket functionality to this server
const io = require('socket.io')(server)

// integration of express session package with socket io package
io.use((socket, next) => {
  sessionOptions(socket.request, socket.request.res, next)
})

// browser sent along an object of data to this connection type
io.on('connection', socket => {
  // only if you're logged in
  if (socket.request.session.user) {
    // whenever a user logs in, we're storing basic things in session data.
    let user = socket.request.session.user

    socket.emit('welcome', { username: user.username, avatar: user.avatar })

    socket.on('chatMessageFromBrowser', data => {
      socket.broadcast.emit('chatMessageFromServer', { message: sanitizeHTML(data.message, { allowedTags: [], allowedAttributes: {} }), username: user.username, avatar: user.avatar })
    })
  }
})

module.exports = server
