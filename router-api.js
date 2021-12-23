const apiRouter = require('express').Router()
const userController = require('./controllers/userController')
const postController = require('./controllers/postController')
const followController = require('./controllers/followController')

// cors
const cors = require('cors')

apiRouter.use(cors())

apiRouter.post('/login', userController.apiLogin)

apiRouter.post('/create-post', userController.apiIsLoggedIn, postController.apiCreate)

apiRouter.get('/postsByAuthor/:username', userController.apiGetPostByUsername)

apiRouter.delete('/post/:id', userController.apiIsLoggedIn, postController.apiDelete)

module.exports = apiRouter
