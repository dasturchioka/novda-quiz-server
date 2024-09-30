const express = require('express')
const router = express.Router()
const {
	addQuestionsToPackage,
	createClassroom,
	createQuestionPackage,
	deleteQuestion,
	editQuestion,
	finishExam,
	login,
	register,
	removeStudentFromClassroom,
	startExam,
	upload,
	check,
} = require('../controllers/teacher.controller')

router.post('/register', register)
router.post('/login', login)
router.get('/check/:id', check)
router.post('/create-classroom', createClassroom)
router.post('/create-question-package', createQuestionPackage)
router.post('/add-question', upload.single('img'), addQuestionsToPackage)
router.put('/edit-question', upload.single('img'), editQuestion)
router.delete('/delete-question', deleteQuestion)
router.post('/start-exam', startExam)
router.post('/finish-exam', finishExam)
router.post('/remove-student', removeStudentFromClassroom)

module.exports = router
