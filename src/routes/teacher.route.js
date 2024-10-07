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
	check,
	getQuestionPackages,
	getSinglePackage,
	deleteImageOfQuestion,
	getAllClassrooms,
	getSingleClassroom,
	editPackage,
	deletePackage,
	editClassroom,
	getExams,
	getDataPreExam,
} = require('../controllers/teacher.controller')
const {
	upload,
	deleteExistingImage,
	processImageAndSave,
	processImageAndUpdate,
} = require('../services/file.service')

// auth
router.post('/register', register)
router.post('/login', login)
router.get('/check/:id', check)

// classrooms
router.post('/create-classroom', createClassroom)
router.post('/remove-student', removeStudentFromClassroom)
router.get('/get-classrooms', getAllClassrooms)
router.put('/edit-classroom/:classroomOneId', editClassroom)
router.get('/get-single-classroom', getSingleClassroom)

// packages and questions
router.post('/create-question-package', createQuestionPackage)
router.put('/edit-package/:packageOneId', editPackage)
router.get('/get-all-packages', getQuestionPackages)
router.get('/get-single-package/:oneId', getSinglePackage)
router.delete('/delete-package/:packageOneId', deletePackage)
router.post(
	'/add-question/:packageOneId',
	upload.single('img'),
	processImageAndSave,
	addQuestionsToPackage
)
router.put('/edit-question', upload.single('img'), processImageAndUpdate, editQuestion)
router.delete('/delete-question/:id', deleteQuestion)
router.delete('/delete-image-of-question/:id', deleteExistingImage, deleteImageOfQuestion)

// exams
router.get('/get-data-pre-exam/:teacherOneId', getDataPreExam)
router.post('/start-exam', startExam)
router.put('/finish-exam', finishExam)
router.get('/get-exams/:teacherOneId', getExams)

module.exports = router
