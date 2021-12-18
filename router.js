const express = require('express')
const router = express.Router()
const userController = require('./controllers/userController')
const postController = require('./controllers/postController')

// user related routes
router.get('/', userController.home)
router.post('/register', userController.register)
router.post('/login', userController.login)
router.post('/logout', userController.logout)

// profile related routes
router.get('/profile/:username', userController.ifUserExists, userController.profilePostsScreen)

// post related routes
router.get('/create-post', userController.isLoggedIn, postController.createPostForm)
router.post('/create-post', userController.isLoggedIn, postController.createPost)
router.get('/post/:id', postController.viewSinglePost)
router.get('/post/:id/edit', userController.isLoggedIn, postController.viewEditScreen)
router.post('/post/:id/edit', userController.isLoggedIn, postController.edit)
router.post('/post/:id/delete', userController.isLoggedIn, postController.delete)

module.exports = router
