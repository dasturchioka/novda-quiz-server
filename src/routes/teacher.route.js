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
	processImageAndUpdate,
	deleteImageOfQuestion,
	deleteExistingImage,
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
router.put('/edit-question', upload.single('img'), processImageAndUpdate, editQuestion)
router.delete('/delete-question/:id', deleteQuestion)
router.delete('/delete-image-of-question/:id', deleteExistingImage, deleteImageOfQuestion)
router.post('/start-exam', startExam)
router.post('/finish-exam', finishExam)
router.post('/remove-student', removeStudentFromClassroom)

module.exports = router
