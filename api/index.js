require('dotenv').config()
const express = require('express')
const app = express()
const PORT = process.env.PORT || 3000
const cors = require('cors')
const path = require('path')

app.use(cors({ origin: '*' }))
app.use(express.json())
app.use(express.static(__dirname + path.join('/public')))

app.get('/', (req, res) => {
	res.send('Hello World!')
})

app.use('/api/v1/teacher', require('./routes/teacher.route'))

app.listen(PORT, () => {
	console.log(`Server started on port ${PORT}`)
})
