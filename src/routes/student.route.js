const express = require('express')
const { register, login, getClassrooms, getClassroom, leaveClassroom, enterClassroom } = require('../controllers/student.controller')
const router = express.Router()

// auth
router.post('/register', register)
router.post('/login', login)
// router.get("/check")

// classrooms
router.get('/get-classrooms/:oneId', getClassrooms)
router.get('/get-classroom/:oneId', getClassroom)
router.put('/leave-classroom/:oneId', leaveClassroom)
router.put('/enter-classroom/:oneId', enterClassroom)
module.exports = router
