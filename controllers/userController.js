const User = require('../models/User')
const Post = require('../models/Post')

exports.login = (req, res) => {
  let user = new User(req.body)

  // // callback approach
  // user.login(result => {
  //   res.send(result)
  // })

  user
    .login()
    .then(result => {
      // our req object now has this session object that is unique for per browser visitor
      req.session.user = { avatar: user.avatar, username: user.data.username, _id: user.data._id }

      // session data is going to be updated here in the abode line, so this is an asynchronous event, we need to manually save it and use callback method to sync with the update in the database.
      req.session.save(() => res.redirect('/'))
    })
    .catch(error => {
      //req.session.flash.errors = [error]
      req.flash('errors', error)

      // above line of code is going to modify session data in database so it's going to be an asynchronous event, we wanna be sure to not perform the redirect until that database action has actually completed so manually save the session and inside that as a callback redirect to home
      req.session.save(() => res.redirect('/'))
    })
}

exports.logout = (req, res) => {
  // this destroy method is going to deal with our database, this is asynchronous event, so we should use promise or async/ await but this session package function do not return promises, so we're gonna use callback approach
  req.session.destroy(() => {
    res.redirect('/')
  })
}

exports.register = (req, res) => {
  let user = new User(req.body)
  console.log(req.body)

  user
    .register() // This register comes from User model which is an asynchronour function
    .then(() => {
      req.session.user = { username: user.data.username, avatar: user.avatar, _id: user.data._id }
      req.session.save(() => res.redirect('/'))
    })
    .catch(regErrors => {
      regErrors.forEach(error => {
        req.flash('regErrors', error)
      })
      // manuallay save session first
      req.session.save(() => res.redirect('/'))
    })
}

exports.home = (req, res) => {
  if (req.session.user) {
    res.render('home-dashboard')
  } else {
    res.render('home-guest', { regErrors: req.flash('regErrors') })
  }
}

// isLogged middleware

exports.isLoggedIn = (req, res, next) => {
  if (req.session.user) {
    next()
  } else {
    req.flash('errors', 'You must be logged in')
    // manually save session data to be sure it actually completes
    req.session.save(() => {
      res.redirect('/')
    })
  }
}

exports.ifUserExists = (req, res, next) => {
  User.findByUsername(req.params.username)
    .then(userDocument => {
      req.profileUser = userDocument // storing the userDocument if the promise resolves so that the next function can access it, creating a new property on request object.
      next()
    })
    .catch(() => {
      res.render('404')
    })
}

exports.profilePostsScreen = (req, res) => {
  // ask our Post model for posts by a certain author id
  Post.findByAuthorId(req.profileUser._id) // this function definitely need to talk to our database so it's an async event.
    .then(posts => {
      // this function will resolve with an array of posts
      res.render('profile', {
        posts: posts,
        profileUsername: req.profileUser.username,
        profileAvatar: req.profileUser.avatar
      })
    })
    .catch(() => res.render('404'))
}
