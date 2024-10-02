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
	getQuestionPackages,
	getSinglePackage,
	processImageAndSave,
} = require('../controllers/teacher.controller')

router.post('/register', register)
router.post('/login', login)
router.get('/check/:id', check)
router.post('/create-classroom', createClassroom)
router.post('/create-question-package', createQuestionPackage)
router.get('/get-all-packages', getQuestionPackages)
router.get('/get-single-package/:oneId', getSinglePackage)
router.post(
	'/add-question/:packageOneId',
	upload.single('img'),
	processImageAndSave,
	addQuestionsToPackage
)
router.put('/edit-question', upload.single('img'), processImageAndSave, editQuestion)
router.delete('/delete-question', deleteQuestion)
router.post('/start-exam', startExam)
router.post('/finish-exam', finishExam)
router.post('/remove-student', removeStudentFromClassroom)

module.exports = router
