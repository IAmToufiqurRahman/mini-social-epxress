const postsCollection = require('../db').db().collection('posts')
const followsCollection = require('../db').db().collection('follows')

const ObjectID = require('mongodb').ObjectID // mongodb has a special way of treating id values

const User = require('./User')
const sanitizeHTML = require('sanitize-html')

let Post = function (data, userid, requestedPostId) {
  // data & userid received from controller, below retaining these values
  this.data = data
  this.userid = userid
  this.errors = []
  this.requestedPostId = requestedPostId
}

Post.prototype.cleanUp = function () {
  if (typeof this.data.title !== 'string') this.data.title = ''
  if (typeof this.data.body !== 'string') this.data.body = ''

  // get rid of any input other than title and body
  this.data = {
    title: sanitizeHTML(this.data.title.trim(), { allowedTags: [], allowedAttributes: {} }),
    body: sanitizeHTML(this.data.body.trim(), { allowedTags: [], allowedAttributes: {} }),
    createdDate: new Date(),
    author: ObjectID(this.userid)
  }
}

Post.prototype.validate = function () {
  if (this.data.title === '') this.errors.push('You must provide a title')
  if (this.data.body === '') this.errors.push('You must provide post content')
}

Post.prototype.create = function () {
  return new Promise((resolve, reject) => {
    this.cleanUp()
    this.validate()

    if (!this.errors.length) {
      // save post into database
      postsCollection
        .insertOne(this.data)
        .then(info => {
          resolve(info.ops[0]._id)
        })
        .catch(() => {
          this.errors.push('Please try again later')
          reject(this.errors)
        })
    } else {
      reject(this.errors)
    }
  })
}

Post.prototype.update = function () {
  return new Promise(async (resolve, reject) => {
    try {
      let post = await Post.findSinglePostById(this.requestedPostId, this.userid)

      if (post.isVisitorOwner) {
        // update the database
        let status = await this.actuallyUpdate()

        resolve(status)
      } else {
        reject()
      }
    } catch {
      reject()
    }
  })
}

Post.prototype.actuallyUpdate = function () {
  return new Promise(async (resolve, reject) => {
    this.cleanUp()
    this.validate()

    if (!this.errors.length) {
      await postsCollection.findOneAndUpdate({ _id: new ObjectID(this.requestedPostId) }, { $set: { title: this.data.title, body: this.data.body } })

      resolve('success')
    } else {
      resolve('failure')
    }
  })
}

// the third parameter is for search method
Post.reusablePostQuery = function (uniqueOperations, visitorId, finalOperation = []) {
  return new Promise(async (resolve, reject) => {
    let aggreOperations = uniqueOperations
      .concat([
        { $lookup: { from: 'users', localField: 'author', foreignField: '_id', as: 'authorDocument' } },
        {
          $project: {
            title: 1,
            body: 1,
            createdDate: 1,
            authorId: '$author', // pull in the author id of the current post
            author: { $arrayElemAt: ['$authorDocument', 0] }
          }
        }
      ])
      .concat(finalOperation)

    let posts = await postsCollection.aggregate(aggreOperations).toArray()

    // clean up author property to get rid of unnecessary properties from post object
    posts = posts.map(post => {
      post.isVisitorOwner = post.authorId.equals(visitorId)
      // no need of authorId after confirming is visitor of the post actually owns that post, this check has already done in the previous line
      post.authorId = undefined

      post.author = {
        username: post.author.username,
        avatar: new User(post.author, true).avatar
      }

      return post
    })

    resolve(posts)
  })
}

Post.findSinglePostById = function (id, visitorId) {
  return new Promise(async (resolve, reject) => {
    if (typeof id !== 'string' || !ObjectID.isValid(id)) {
      reject()
      return
    }

    let posts = await Post.reusablePostQuery([{ $match: { _id: new ObjectID(id) } }], visitorId)

    if (posts.length) {
      console.log(posts[0])

      resolve(posts[0])
    } else {
      reject()
    }
  })
}

Post.findByAuthorId = function (authorId) {
  return Post.reusablePostQuery([{ $match: { author: authorId } }, { $sort: { createdDate: -1 } }])
}

Post.delete = function (postIdToDelete, currentUserId) {
  return new Promise(async (resolve, reject) => {
    try {
      let post = await Post.findSinglePostById(postIdToDelete, currentUserId)

      if (post.isVisitorOwner) {
        await postsCollection.deleteOne({ _id: new ObjectID(postIdToDelete) })

        resolve()
      } else {
        reject()
      }
    } catch {
      reject()
    }
  })
}

// $sort needs to come after $project if the thing you're sorting by is text score
Post.search = function (searchTerm) {
  return new Promise(async (resolve, reject) => {
    if (typeof searchTerm === 'string') {
      let posts = await Post.reusablePostQuery([{ $match: { $text: { $search: searchTerm } } }], undefined, [{ $sort: { score: { $meta: 'textScore' } } }])
      resolve(posts)
    } else {
      reject()
    }
  })
}

Post.countPostsByAuthor = function (id) {
  return new Promise(async (resolve, reject) => {
    let postCount = await postsCollection.countDocuments({ author: id })

    resolve(postCount)
  })
}

// id that we pass to this method is just a string of text, so convert it into a mongodb ObjectId of object type
Post.getFeed = async function (id) {
  // 1. create an array of the user ids that the current user follows
  let followedUsers = await followsCollection.find({ authorId: new ObjectID(id) }).toArray()

  // adjust this array of documents to not be an array of objects with multiple properties but instead just an array of various user ids
  followedUsers = followedUsers.map(followDoc => followDoc.followedId)

  // 2. look for posts where the author is in the above array of followed users
  return Post.reusablePostQuery([
    // this is saying find any post document where the author value is a value that is in our array of followedUsers
    { $match: { author: { $in: followedUsers } } },
    { $sort: { createdDate: -1 } } // -1 determines newest values are up at the top
  ])
}

module.exports = Post
