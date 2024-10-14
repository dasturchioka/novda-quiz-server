const express = require('express')
const {
	register,
	login,
	getClassrooms,
	getClassroom,
	leaveClassroom,
	enterClassroom,
	getProfile,
	check,
	enterExam,
	checkStatus,
	submitExam,
} = require('../controllers/student.controller')
const router = express.Router()

// auth
router.post('/register', register)
router.post('/login', login)
router.get('/check/:oneId', check)

// profile
router.get('/get-profile/:oneId', getProfile)

// classrooms
router.get('/get-classrooms/:oneId', getClassrooms)
router.get('/get-classroom/:oneId', getClassroom)
router.put('/leave-classroom/:oneId', leaveClassroom)
router.put('/enter-classroom/:oneId', enterClassroom)

// exams
router.put('/enter-exam/:examOneId', enterExam)
router.get('/status-exam/:examOneId/:studentOneId', checkStatus)
router.put('/submit-exam/:examOneId/:studentOneId', submitExam)

module.exports = router
