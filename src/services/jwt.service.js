const jwt = require('jsonwebtoken')

async function createToken(payload, keyword, options) {
	try {
		const token = jwt.sign(payload, keyword, { ...options })

		if (!token) {
			throw new Error("Couldn't create the token")
		}

		return token
	} catch (error) {
		console.log(error.message)
	}
}

async function verifyToken(token, keyword) {
	try {
		const verifiedToken = jwt.verify(token, keyword)

		return verifiedToken
	} catch (error) {
		console.log(error)
		if (error.message === 'invalid signature') {
			return null
		}
	}
}

module.exports = { createToken, verifyToken }
