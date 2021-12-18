const mongodb = require('mongodb')
const dotenv = require('dotenv')
dotenv.config()

mongodb.connect(process.env.CONNECTIONSTRING, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
  module.exports = client // this will return the database object that we can perform CRUD operations

  const app = require('./app')
  app.listen(process.env.PORT)
})
