const User = require('../models/User')
const Post = require('../models/Post')
const Follow = require('../models/Follow')

exports.sharedProfileData = async (req, res, next) => {
  let isVisitorsProfile = false // this property is for determinig if the visitor is viewing his/her own profile

  let isFollowing = false // this property is for determining if the current visitor is following the current profile

  if (req.session.user) {
    isVisitorsProfile = req.profileUser._id.equals(req.session.user._id) // mongodb ObjectID has a method named equals which returns true or false
    isFollowing = await Follow.isVisitorFollowing(req.profileUser._id, req.visitorId)

    req.isVisitorsProfile = isVisitorsProfile // => true or false
    req.isFollowing = isFollowing

    // retrieve post, follower, and following counts, in order to work these three functions need to know which profile user we're looking for
    let postCountPromise = Post.countPostsByAuthor(req.profileUser._id)
    let followerCountPromise = Follow.countFollowersById(req.profileUser._id)
    let followingCountPromise = Follow.countFollowingById(req.profileUser._id)

    let [postCount, followerCount, followingCount] = await Promise.all([postCountPromise, followerCountPromise, followingCountPromise])

    // add values on the request objectL
    req.postCount = postCount
    req.followerCount = followerCount
    req.followingCount = followingCount

    next() // going to userController.profilePostsScreen
  }
}

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

exports.home = async (req, res) => {
  if (req.session.user) {
    // fetch feed of posts for current user
    let posts = await Post.getFeed(req.session.user._id)

    res.render('home-dashboard', { posts: posts })
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
        currentPage: 'posts',
        counts: { postCount: req.postCount, followerCount: req.followerCount, followingCount: req.followingCount },
        posts: posts,
        profileUsername: req.profileUser.username,
        profileAvatar: req.profileUser.avatar,
        isFollowing: req.isFollowing,
        isVisitorsProfile: req.isVisitorsProfile
      })
    })
    .catch(() => res.render('404'))
}

exports.profileFollowersScreen = async (req, res) => {
  try {
    let followers = await Follow.getFollowerById(req.profileUser._id)

    res.render('profile-followers', {
      currentPage: 'followers',
      counts: { postCount: req.postCount, followerCount: req.followerCount, followingCount: req.followingCount },
      followers: followers,
      profileUsername: req.profileUser.username,
      profileAvatar: req.profileUser.avatar,
      isFollowing: req.isFollowing,
      isVisitorsProfile: req.isVisitorsProfile
    })
  } catch {
    res.render('404')
  }
}

exports.profileFollowingScreen = async (req, res) => {
  try {
    let following = await Follow.getFollowingById(req.profileUser._id)

    res.render('profile-following', {
      currentPage: 'following',
      counts: { postCount: req.postCount, followerCount: req.followerCount, followingCount: req.followingCount },
      following: following,
      profileUsername: req.profileUser.username,
      profileAvatar: req.profileUser.avatar,
      isFollowing: req.isFollowing,
      isVisitorsProfile: req.isVisitorsProfile
    })
  } catch {
    res.render('404')
  }
}
