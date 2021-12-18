const Post = require('../models/Post')

exports.createPostForm = (req, res) => {
  res.render('create-post')
}

exports.createPost = (req, res) => {
  let post = new Post(req.body, req.session.user._id)

  post
    .create()
    .then(newId => {
      req.flash('success', 'New post successfully created')
      req.session.save(() => res.redirect(`/post/${newId}`))
    })
    .catch(errors => {
      errors.forEach(error => req.flash('errors', error))
      req.session.save(() => res.redirect('/create-post'))
    })
}

// before rendering the post template we need to look up into the database and it's going to be an asynchronous operation
exports.viewSinglePost = async (req, res) => {
  try {
    let post = await Post.findSinglePostById(req.params.id, req.visitorId)
    res.render('single-post-screen', { post: post })
  } catch (e) {
    res.render('404')
  }
}

exports.viewEditScreen = async (req, res) => {
  try {
    let post = await Post.findSinglePostById(req.params.id, req.visitorId)

    if (post.isVisitorOwner) {
      res.render('edit-post', { post: post })
    } else {
      req.flash('errors', 'You do not have permission to perform that action')
      req.session.save(() => res.redirect('/'))
    }
  } catch {
    res.render('404')
  }
}

exports.edit = (req, res) => {
  let post = new Post(req.body, req.visitorId, req.params.id)

  post
    .update()
    .then(status => {
      // the post was successfully updated in the database
      // or user did have permission, but there were validation errors, else case
      if ((status = 'success')) {
        // post was updated in db
        req.flash('success', 'Post successfully updated')

        // manually save session data
        req.session.save(() => {
          res.redirect(`/post/${req.params.id}/edit`)
        })
      } else {
        post.errors.forEach(error => {
          req.flash('errors', error)
        })

        // manually save session data
        req.session.save(() => {
          res.redirect(`/post/${req.params.id}/edit`)
        })
      }
    })
    .catch(() => {
      // a post with the requested id doesn't exist
      // or if the current visitor is not the owner of the requested post
      req.flash('errors', "You don't have permission to perform that action")

      // manually save session data
      req.session.save(() => {
        res.redirect('/')
      })
    })
}

exports.delete = (req, res) => {
  Post.delete(req.params.id, req.visitorId)
    .then(() => {
      req.flash('success', 'Post successfully deleted')

      req.session.save(() => res.redirect(`/profile/${req.session.user.username}`))
    })
    .catch(() => {
      req.flash('errors', 'You do not have permission to perform that action')

      req.session.save(() => res.redirect('/'))
    })
}
