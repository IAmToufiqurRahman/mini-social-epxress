const usersCollection = require('../db').db().collection('users')
const validator = require('validator')
const bcrypt = require('bcryptjs')
const md5 = require('md5')

let User = function (data, getAvatar) {
  this.data = data // we're taking the data that just got passed in via the parameter and storing it within a property(on the right hand side)

  this.errors = []
  if (getAvatar === undefined) getAvatar = false
  if (getAvatar) this.getAvatar()
}

User.prototype.cleanUp = function () {
  if (typeof this.data.username !== 'string') {
    this.data.username = ''
  }
  if (typeof this.data.email !== 'string') {
    this.data.email = ''
  }
  if (typeof this.data.password !== 'string') {
    this.data.password = ''
  }

  // get rid of/ overriding any properties other than username, email, password
  this.data = {
    username: this.data.username.trim().toLowerCase(),
    email: this.data.email.trim().toLowerCase(),
    password: this.data.password
  }
}

User.prototype.validate = function () {
  return new Promise(async (resolve, reject) => {
    if (this.data.username === '') this.errors.push('You must provide a username')

    if (this.data.username !== '' && !validator.isAlphanumeric(this.data.username)) this.errors.push('Username can only contain letter and numbers')

    if (this.data.username.length > 0 && this.data.username.length < 3) this.errors.push('Username must be at least 3 characters long')

    if (this.data.username.length > 30) this.errors.push("Username mustn't exceed 30 characters")

    if (!validator.isEmail(this.data.email)) this.errors.push('You must provide a valid email address.')

    if (this.data.password === '') this.errors.push('You must provide a password')

    if (this.data.password.length > 0 && this.data.password.length < 7) this.errors.push('Password must be at least 7 characters long')

    if (this.data.password.length > 100) this.errors.push("Password mustn't exceed 100 characters")

    // only if username is valid then check to see it it is already taken
    if (this.data.username.length > 2 && this.data.username.length < 31 && validator.isAlphanumeric(this.data.username)) {
      let usernameExists = await usersCollection.findOne({ username: this.data.username })

      if (usernameExists) {
        this.errors.push('That username is already taken')
      }
    }

    // only if email is valid then check to see it it is already taken
    if (validator.isEmail(this.data.email)) {
      let emailExists = await usersCollection.findOne({ email: this.data.email })

      if (emailExists) {
        this.errors.push('That email is already taken')
      }
    }
    resolve() // this signifies that this async operation has completed
  })
}

// // Callback approach
// User.prototype.login = function (callback) {
//   this.cleanUp()

//   usersCollection.findOne({ username: this.data.username }, (err, attemptedUser) => {
//     if (attemptedUser && attemptedUser.password === this.data.password) {
//       // callback approach
//       callback('Congo!!!')
//     } else {
//       // callback approach
//       callback('Invalid something')
//     }
//   })
// }

// Promise approach
User.prototype.login = function () {
  return new Promise((resolve, reject) => {
    // resolve means completed
    this.cleanUp()

    usersCollection
      .findOne({ username: this.data.username })
      .then(attemptedUser => {
        // executes if mongodb finds a match
        if (attemptedUser && bcrypt.compareSync(this.data.password, attemptedUser.password)) {
          this.data = attemptedUser // while login user do not give email to give getAvatar() the email we override the data with the attemptedUser coming from the database

          this.getAvatar()
          resolve('Congrats!!!')
        } else {
          reject('Invalid Username/ Password!')
        }
      })
      .catch(() => {
        reject('Please try again!')
      })
  })
}

User.prototype.register = function () {
  return new Promise(async (resolve, reject) => {
    // validate user data
    this.cleanUp()
    await this.validate()

    // save data into database
    if (!this.errors.length) {
      // hash user password
      let salt = bcrypt.genSaltSync(10)
      this.data.password = bcrypt.hashSync(this.data.password, salt)

      await usersCollection.insertOne(this.data)
      this.getAvatar()
      resolve()
    } else {
      reject(this.errors)
    }
  })
}

User.prototype.getAvatar = function () {
  this.avatar = `https://gravatar.com/avatar/${md5(this.data.email)}?s=128`
}

// user model for profile
User.findByUsername = function (username) {
  // this username will be passed fromt the controller
  return new Promise((resolve, reject) => {
    // cleaning up
    if (typeof username !== 'string') {
      reject()
      return
    }

    usersCollection
      .findOne({ username: username })
      .then(userDoc => {
        if (userDoc) {
          userDoc = new User(userDoc, true) // this is going to get the found raw data from the database and create a new user document and this true property will get the avatar based on the email
          userDoc = {
            _id: userDoc.data._id,
            username: userDoc.data.username,
            avatar: userDoc.avatar // these are the only three properties that will get passed back into the controller.
          }

          resolve(userDoc)
        } else {
          reject()
        }
      })
      .catch(() => {
        reject()
      })
  })
}

// method for client side validation, respond with either true/ false
User.doesEmailExist = function (email) {
  return new Promise(async function (resolve, reject) {
    if (typeof email != 'string') {
      resolve(false)
      return
    }

    let user = await usersCollection.findOne({ email: email })

    if (user) {
      resolve(true)
    } else {
      resolve(false)
    }
  })
}

module.exports = User
