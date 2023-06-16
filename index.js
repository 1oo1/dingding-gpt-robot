import express from 'express'
import bodyParser from 'body-parser'
import handler from './handler.js'

const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.post('/conversations', (req, res) => {
  handler(req)
  res.send('')
});

// other path reject
app.get('*', (req, res) => {
  res.status(404).send('Not Found')
})

// 127.0.0.1:8080
app.listen(8080, () => {
  console.log('App listening on port 8080!')
});
