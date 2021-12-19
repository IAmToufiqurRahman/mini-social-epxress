const { ObjectId } = require('mongodb')

const usersCollection = require('../db').db().collection('users')
const followsCollection = require('../db').db().collection('follows')
const ObjectID = require('mongodb').ObjectID
const User = require('./User')

let Follow = function (followedUsername, authorId) {
  // authorId -->> current user id
  this.followedUsername = followedUsername
  this.authorId = authorId
  this.errors = []
}

Follow.prototype.cleanUp = function () {
  if (typeof this.followedUsername !== 'string') this.followedUsername = ''
}

Follow.prototype.validate = async function (action) {
  // followedUsername must exist in the database
  let followedAccount = await usersCollection.findOne({ username: this.followedUsername })

  if (followedAccount) {
    // store the id of the matching document, because user can change the username someday!
    this.followedId = followedAccount._id
  } else {
    this.errors.push(`You can't follow a user that doesn't exist`)
  }

  let doesFollowAlreadyExist = await followsCollection.findOne({ followedId: this.followedId, authorId: new ObjectID(this.authorId) })

  if (action == 'create') {
    if (doesFollowAlreadyExist) this.errors.push('You are already following this user')
  }

  if (action == 'delete') {
    if (!doesFollowAlreadyExist) this.errors.push('You cannot unfollow someone you donot follow already!')
  }

  // should not be able to follow yourself
  if (this.followedId.equals(this.authorId)) {
    this.errors.push('You cannot follow yourself')
  }
}

Follow.prototype.create = function () {
  return new Promise(async (resolve, reject) => {
    this.cleanUp()
    await this.validate('create')
    if (!this.errors.length) {
      await followsCollection.insertOne({ followedId: this.followedId, authorId: new ObjectID(this.authorId) })
      resolve()
    } else {
      reject(this.errors)
    }
  })
}

Follow.prototype.delete = function () {
  return new Promise(async (resolve, reject) => {
    this.cleanUp()
    await this.validate('delete')
    if (!this.errors.length) {
      await followsCollection.deleteOne({ followedId: this.followedId, authorId: new ObjectID(this.authorId) })
      resolve()
    } else {
      reject(this.errors)
    }
  })
}

Follow.isVisitorFollowing = async function (followedId, visitorId) {
  let followDoc = await followsCollection.findOne({ followedId: followedId, authorId: new ObjectID(visitorId) })

  return followDoc ? true : false
}

Follow.getFollowerById = function (id) {
  return new Promise(async (resolve, reject) => {
    try {
      let followers = await followsCollection
        .aggregate([
          { $match: { followedId: id } },
          { $lookup: { from: 'users', localField: 'authorId', foreignField: '_id', as: 'userDoc' } },
          {
            $project: {
              username: { $arrayElemAt: ['$userDoc.username', 0] },
              email: { $arrayElemAt: ['$userDoc.email', 0] }
            }
          }
        ])
        .toArray() // aggregate returns something that is understandable to mongodb but not to us, we turn it into array, each operation is represented as an object, the first operation is matching the id passed to the method in the follows document, the second operation is about looking up the foreignField _id into the users collection using the localField authorId and giving it the name userDoc. Now the follows collections has a virtual document named userDoc. It is an array of object. we want to display the username and avatar in the html. here $arrayElemAt returns the element at the specified array index

      // modify the array the previous operation returns, to extract the avatar img
      followers = followers.map(follower => {
        // create a user
        let user = new User(follower, true)
        return { username: follower.username, avatar: user.avatar }
      })

      resolve(followers)
    } catch (error) {
      reject()
    }
  })
}

Follow.getFollowingById = function (id) {
  return new Promise(async (resolve, reject) => {
    try {
      let following = await followsCollection
        .aggregate([
          { $match: { authorId: id } },
          { $lookup: { from: 'users', localField: 'followedId', foreignField: '_id', as: 'userDoc' } },
          {
            $project: {
              username: { $arrayElemAt: ['$userDoc.username', 0] },
              email: { $arrayElemAt: ['$userDoc.email', 0] }
            }
          }
        ])
        .toArray()

      // modify the array the previous operation returns, to extract the avatar img
      following = following.map(follow => {
        // create a user
        let user = new User(follow, true)
        return { username: follow.username, avatar: user.avatar }
      })

      resolve(following)
    } catch (error) {
      reject()
    }
  })
}

Follow.countFollowersById = function (id) {
  return new Promise(async (resolve, reject) => {
    let followerCount = await followsCollection.countDocuments({ followedId: id })

    resolve(followerCount)
  })
}

Follow.countFollowingById = function (id) {
  return new Promise(async (resolve, reject) => {
    let count = await followsCollection.countDocuments({ authorId: id })

    resolve(count)
  })
}

module.exports = Follow
