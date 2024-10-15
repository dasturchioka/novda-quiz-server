const { PrismaClient } = require('@prisma/client')
const { createToken } = require('../services/jwt.service')
const { createOneId } = require('../utils/oneid.util')
const path = require('path')
const fs = require('fs').promises
const TEACHER_JWT_SIGNATURE = process.env.TEACHER_JWT_SIGNATURE

const prisma = new PrismaClient()

async function register(req, res) {
	try {
		const { fullname, password, oneId } = req.body

		if (!fullname) {
			return res.json({ status: 'bad', msg: 'Ism familiyani kiritishingiz kerak' })
		}

		if (!oneId) {
			return res.json({ status: 'bad', msg: 'OneId (login) kiritishingiz kerak' })
		}

		if (!password) {
			return res.json({ status: 'bad', msg: 'Parolni kiritishingiz kerak' })
		}

		if (password.length < 8) {
			return res.json({ status: 'bad', msg: 'Parol kamida 8 ta belgidan tashkil topishi kerak' })
		}

		const existTeacher = await prisma.teacher.findUnique({ where: { oneId } })

		if (existTeacher) {
			return res.json({
				status: 'bad',
				msg: "Bunday oneId ga ega o'qituvchi mavjud, agar bu siz bo'lsangiz, iltimos, login qismiga o'tib tizimga kiring",
			})
		}

		const newTeacher = await prisma.teacher.create({
			data: { oneId, fullname, password },
		})

		const newToken = await createToken(newTeacher, TEACHER_JWT_SIGNATURE)

		return res.json({
			token: newToken,
			teacher: newTeacher,
			status: 'ok',
			msg: "Tizimdan ro'yxatdan o'tildi",
		})
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function login(req, res) {
	try {
		const { password, oneId } = req.body

		const existTeacher = await prisma.teacher.findUnique({
			where: { oneId },
		})

		if (!existTeacher) {
			return res.json({ status: 'bad', msg: 'Bunday oneId tizimda mavjud emas' })
		}

		if (existTeacher.password !== password) {
			return res.json({ status: 'bad', msg: "Parol noto'g'ri" })
		}

		const newToken = await createToken(existTeacher, TEACHER_JWT_SIGNATURE)

		return res.json({
			token: newToken,
			teacher: existTeacher,
			status: 'ok',
			msg: 'Tizimga kirildi',
		})
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function check(req, res) {
	try {
		const existTeacher = await prisma.teacher.findUnique({ where: { oneId: req.params.id } })

		if (!existTeacher) {
			return res.json({ status: 'bad', msg: "Kirishga ruxsat yo'q" })
		}

		const newToken = await createToken({ ...existTeacher }, TEACHER_JWT_SIGNATURE)

		return res.json({ status: 'ok', token: newToken, teacher: existTeacher })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function getProfile(req, res) {
	try {
		const { oneId } = req.params

		const existTeacher = await prisma.teacher.findUnique({ where: { oneId } })

		if (!existTeacher) {
			return res.json({ status: 'bad', msg: "O'qituvchi akkaunti topilmadi" })
		}

		return res.json({ status: 'ok', teacher: existTeacher })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function createClassroom(req, res) {
	try {
		const { name, teacherOneId } = req.body

		const newOneId = await createOneId('classroom')
		const newClassroom = await prisma.classrom.create({
			data: { name, oneId: newOneId, teacher: { connect: { oneId: teacherOneId } } },
		})

		return res.json({
			status: 'ok',
			classroom: { ...newClassroom, studentsCount: 0 },
			msg: 'Yangi guruh yaratildi',
		})
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function removeStudentFromClassroom(req, res) {
	try {
		const { studentOneId, classroomOneId } = req.body

		const updatedClassroom = await prisma.classrom.update({
			where: { oneId: classroomOneId },
			data: {
				students: {
					disconnect: { oneId: studentOneId },
				},
			},
		})

		return res.json({
			status: 'ok',
			msg: 'Talaba guruhdan chiqarildi',
			classroom: updatedClassroom,
		})
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function editClassroom(req, res) {
	try {
		const { classroomOneId } = req.params
		const { name } = req.body

		const classroom = await prisma.classrom.findUnique({ where: { oneId: classroomOneId } })

		if (!classroom) {
			return res.json({ status: 'bad', msg: 'Sinfxona topilmadi' })
		}

		const updatedClassroom = await prisma.classrom.update({
			where: { oneId: classroomOneId },
			data: { name },
		})

		return res.json({
			status: 'ok',
			msg: "Sinfxona ma'lumoti yangilandi",
			classroom: updatedClassroom,
		})
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function getAllClassrooms(req, res) {
	try {
		const { teacherOneId } = req.query

		const classrooms = await prisma.classrom.findMany({
			where: { teacher: { oneId: teacherOneId } },
			include: { students: true },
		})

		if (!classrooms) {
			return res.json({ status: 'bad', msg: 'Sizda hali sinfxonalar mavjud emas' })
		}

		let newClassrooms = classrooms.map(async c => {
			return {
				...c,
				studentsCount: c.students.length,
				students: req.query.students === '1' ? c.students : null,
			}
		})

		const result = await Promise.all(newClassrooms)

		return res.json({ status: 'ok', classrooms: result })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function deleteClassroom(req, res) {
	try {
		const { classroomOneId, teacherOneId } = req.params

		const existClassroom = await prisma.classrom.count({
			where: { oneId: classroomOneId, teacher: { oneId: teacherOneId } },
		})

		if (!existClassroom) {
			return res.json({
				status: 'bad',
				msg: "Bunday sinfxona topilmadi yoki siz o'zingizga tegishli bo'lmagan sinfni o'chira olmaysiz",
			})
		}

		await prisma.student.update({
			where: { classrooms: { some: { oneId: classroomOneId } } },
			data: { classrooms: { disconnect: { oneId: classroomOneId } } },
		})
		await prisma.teacher.update({
			where: { classrooms: { some: { oneId: classroomOneId } } },
			data: { classrooms: { disconnect: { oneId: classroomOneId } } },
		})
		await prisma.exam.update({
			where: { classroom: { oneId: classroomOneId } },
			data: { active: false },
		})

		await prisma.classrom.delete({ where: { oneId: classroomOneId } })

		return res.json({status: "ok", msg: "Sinfxona o'chirildi"})
	} catch (error) {
		console.log(error);
		return res.status(500).json(error)
	}
}

async function getSingleClassroom(req, res) {
	try {
		const { classroomOneId, students } = req.query

		const classroom = await prisma.classrom.findUnique({
			where: { oneId: classroomOneId },
			include: {
				teacher: true,
				Exam: {
					include: {
						students: true,
						scores: { include: { student: true } },
						packageOfExam: { include: { questions: true } },
					},
				},
			},
		})

		if (!classroom) {
			return res.json({ status: 'bad', msg: 'Sinfxona topilmadi' })
		}

		let studentsWithClasses

		if (students === '1') {
			studentsWithClasses = await prisma.student.findMany({
				where: { classrooms: { some: { oneId: classroomOneId } } },
				include: { classrooms: true, scores: true },
			})
		}

		const newClassroom = {
			name: classroom.name,
			oneId: classroom.oneId,
			teacher: classroom.teacher.fullname,
			students: classroom.students,
			exams: classroom.Exam
				? classroom.Exam.map(e => {
						return {
							oneId: e.oneId,
							name: e.name,
							packageOfExam: {
								oneId: e.packageOfExam.oneId,
								name: e.packageOfExam.name,
								questionsCount: e.packageOfExam.questions.length,
							},
							studentsCount: e.students.length,
							active: e.active,
							studentsCount: e.students.length,
							scores: e.scores.length ? e.scores : null,
						}
				  })
				: null,
		}

		return res.json({ status: 'ok', classroom: newClassroom, students: studentsWithClasses })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function createQuestionPackage(req, res) {
	try {
		const { name, teacherOneId } = req.body

		const newOneId = await createOneId('package')

		const newQuestionPackage = await prisma.package.create({
			data: { oneId: newOneId, name, teacher: { connect: { oneId: teacherOneId } } },
		})

		return res.json({
			status: 'ok',
			msg: 'Paket yaratildi',
			package: { ...newQuestionPackage, questionCount: 0 },
		})
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function getQuestionPackages(req, res) {
	try {
		try {
			const { questions, teacherOneId } = req.query

			const questionPackages = await prisma.package.findMany({
				where: { teacher: { oneId: teacherOneId } },
				include: { questions: +questions ? true : false },
			})

			if (!questionPackages.length) {
				return res.json({ status: 'bad', msg: 'Sizda hali paketlar mavjud emas' })
			}

			let newQuestionPackages = questionPackages.map(async q => {
				const countQuestions = await prisma.question.count({ where: { packageId: q.id } })
				return { ...q, questionCount: countQuestions }
			})

			const result = await Promise.all(newQuestionPackages)

			return res.json({ status: 'ok', packages: result })
		} catch (error) {
			console.log(error)
			return res.status(500).json(error)
		}
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function getSinglePackage(req, res) {
	try {
		const { oneId } = req.params

		const singlePackage = await prisma.package.findUnique({
			where: { oneId },
			include: { questions: { orderBy: { createdAt: 'asc' } }, teacher: true },
		})

		if (!singlePackage) {
			return res.json({ status: 'bad', msg: 'Paket topilmadi' })
		}

		return res.json({ singlePackage, status: 'ok', questions: singlePackage.questions })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function editPackage(req, res) {
	try {
		const { name } = req.body
		const { packageOneId } = req.params

		const existPackage = await prisma.package.count({ where: { oneId: packageOneId } })

		if (!existPackage) {
			return res.json({ status: 'bad', msg: 'Savol paketi topilmadi!' })
		}

		const updatedPackage = await prisma.package.update({
			where: { oneId: packageOneId },
			data: { name },
		})

		return res.json({ status: 'ok', msg: 'Paket yangilandi', package: updatedPackage })
	} catch (error) {
		console.error(error)
		return res.status(500).json(error)
	}
}

async function deletePackage(req, res) {
	try {
		const { packageOneId } = req.params

		const questions = await prisma.question.findMany({
			where: { package: { oneId: packageOneId } },
		})

		questions.forEach(async q => {
			if (q.img) {
				const existingImagePath = q.img

				if (existingImagePath) {
					const fullPath = path.join(__dirname, '../../src/public', existingImagePath) // Construct full path

					try {
						// Check if the file exists before trying to delete it
						await fs.access(fullPath) // Check if file is accessible (exists)
						await fs.unlink(fullPath) // Delete the file
					} catch (err) {
						// If the file does not exist or cannot be deleted, log a warning
						console.warn(`Failed to delete image: ${existingImagePath}`, err)
					}
				}
			}
		})

		await prisma.question.deleteMany({
			where: { package: { oneId: packageOneId } },
		})

		await prisma.package.delete({
			where: { oneId: packageOneId },
			include: { questions: true, teacher: false },
		})

		return res.json({ status: 'ok', msg: "Paket muvaffaqqiyatli o'chirildi" })
	} catch (error) {
		console.error(error)
		return res.status(500).json(error)
	}
}

async function addQuestionsToPackage(req, res) {
	try {
		const question = req.body
		const { packageOneId } = req.params

		if (req.file) {
			let imgPath = ''
			if (req.savedImage) {
				// Use the image path saved in the req object by the processImageAndSave middleware
				imgPath = req.savedImage.filePath
			}
			// Get the relative path for DB

			// Save question to the database with the image path
			const newQuestion = await prisma.question.create({
				data: {
					answer: question.answer,
					questionText: question.questionText,
					optionA: question.optionA,
					optionB: question.optionB,
					optionC: question.optionC,
					optionD: question.optionD,
					img: imgPath,
					package: { connect: { oneId: packageOneId } },
				},
			})

			return res.json({ status: 'ok', msg: "Savol qo'shildi", question: newQuestion, packageOneId })
		}

		// Handle case with no image
		const newQuestion = await prisma.question.create({
			data: {
				answer: question.answer,
				questionText: question.questionText,
				optionA: question.optionA,
				optionB: question.optionB,
				optionC: question.optionC,
				optionD: question.optionD,
				img: '',
				package: { connect: { oneId: packageOneId } },
			},
		})

		return res.json({ status: 'ok', msg: "Savol qo'shildi", question: newQuestion, packageOneId })
	} catch (error) {
		console.error(error)
		return res.status(500).json(error)
	}
}

async function editQuestion(req, res) {
	try {
		const file = req.file
		const question = req.body

		if (file) {
			let imgPath = ''
			if (req.savedImage) {
				// Use the image path saved in the req object by the processImageAndSave middleware
				imgPath = req.savedImage.filePath
			}

			const editedQuestion = await prisma.question.update({
				where: { id: question.id },
				data: { ...question, img: imgPath },
				include: { package: true },
			})

			return res.json({ status: 'ok', msg: 'Savol yangilandi', question: editedQuestion })
		}

		const editedQuestion = await prisma.question.update({
			where: { id: question.id },
			data: question,
			include: { package: true },
		})

		return res.json({ msg: 'Savol yangilandi', status: 'ok', question: editedQuestion })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function deleteQuestion(req, res) {
	try {
		const { id } = req.params

		const deletedQuestion = await prisma.question.delete({
			where: { id: id },
			include: { package: false },
		})

		if (deletedQuestion.img) {
			await fs.unlink(path.join(__dirname, `../../src/public/${deletedQuestion.img}`))
		}

		return res.json({ msg: "Savol o'chirildi" })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function deleteImageOfQuestion(req, res) {
	try {
		const updatedQuestion = await prisma.question.update({
			where: { id: req.params.id },
			data: { img: '' },
		})

		return res.json({ status: 'ok', msg: "Savol rasmi o'chirildi", question: updatedQuestion })
	} catch (error) {
		console.error(error)
		return res.status(500).json({ status: 'error', error })
	}
}

async function getDataPreExam(req, res) {
	try {
		const { teacherOneId } = req.params

		const packages = await prisma.package.findMany({ where: { teacher: { oneId: teacherOneId } } })
		const classrooms = await prisma.classrom.findMany({
			where: { teacher: { oneId: teacherOneId } },
		})

		const newPackages = packages.map(p => {
			return { name: p.name, oneId: p.oneId }
		})
		const newClassrooms = classrooms.map(c => {
			return { name: c.name, oneId: c.oneId }
		})

		return res.json({
			packages: newPackages,
			classrooms: newClassrooms,
			status: 'ok',
		})
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function startExam(req, res) {
	try {
		const { name, teacherOneId, classroomOneId, packageOneId } = req.body

		const newOneId = await createOneId('exam')

		const newExam = await prisma.exam.create({
			data: {
				oneId: newOneId,
				name,
				teacher: { connect: { oneId: teacherOneId } }, // Connect the exam to a teacher
				classroom: { connect: { oneId: classroomOneId } }, // Connect the exam to a classroom
				packageOfExam: { connect: { oneId: packageOneId } }, // Connect the exam to a package
				active: true,
			},
			include: {
				teacher: true,
				classroom: { include: { students: true } },
				packageOfExam: { include: { questions: true } },
				students: true,
			},
		})

		const modifiedExam = {
			oneId: newExam.oneId,
			name: newExam.name,
			packageOfExam: {
				oneId: newExam.packageOfExam.oneId,
				name: newExam.packageOfExam.name,
				questionsCount: newExam.packageOfExam.questions.length,
			},
			studentsCount: newExam.students.length,
			active: newExam.active,
			studentsCount: newExam.students.length,
			scores:
				newExam.scores && newExam.scores.length
					? newExam.scores.map(s => {
							return {
								student: { oneId: s.student.oneId, fullname: s.student.fullname },
								score: `${s.correctAnswers}/${s.questionsNumber}`,
							}
					  })
					: null,
		}

		return res.json({ status: 'ok', msg: 'Imtihon boshlandi', exam: modifiedExam })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function finishExam(req, res) {
	try {
		const { examOneId, teacherOneId } = req.body

		const updatedExam = await prisma.exam.update({
			where: { oneId: examOneId, teacher: { oneId: teacherOneId } },
			data: { active: false },
			include: {
				students: true,
				scores: { include: { student: true } },
				packageOfExam: { include: { questions: true } },
			},
		})

		const newExam = {
			oneId: updatedExam.oneId,
			name: updatedExam.name,
			packageOfExam: {
				oneId: updatedExam.packageOfExam.oneId,
				name: updatedExam.packageOfExam.name,
				questionsCount: updatedExam.packageOfExam.questions.length,
			},
			studentsCount: updatedExam.students.length,
			active: updatedExam.active,
			studentsCount: updatedExam.students.length,
			scores: updatedExam.scores.length ? updatedExam.scores : null,
		}

		return res.json({ status: 'ok', msg: 'Imtihon yakunlandi', exam: newExam })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function deleteExam(req, res) {
	try {
		const { examOneId } = req.params

		await prisma.score.deleteMany({ where: { exam: { oneId: examOneId } } })
		await prisma.exam.delete({ where: { oneId: examOneId } })

		return res.json({ msg: "Imtihon ma'lumotlari o'chirildi", status: 'ok' })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function getExams(req, res) {
	try {
		const { teacherOneId } = req.params
		const { all } = req.query

		let exams

		if (all === 'true') {
			exams = await prisma.exam.findMany({
				where: { teacher: { oneId: teacherOneId } },
				include: { classroom: true, students: { include: { scores: true } }, packageOfExam: true },
			})
		} else {
			const allExams = await prisma.exam.findMany({
				where: { teacher: { oneId: teacherOneId } },
				include: { classroom: true, students: { include: { scores: true } }, packageOfExam: true },
			})

			const newExamsFormat = allExams.map(e => {
				return {
					name: e.name,
					studentsCount: e.classroom.students ? e.classroom.students.length : 0,
					classroom: e.classroom.name,
					package: e.packageOfExam.name,
					active: e.active,
					oneId: e.oneId,
					id: e.id,
				}
			})

			console.log(newExamsFormat[0])

			exams = newExamsFormat
		}

		if (!exams) {
			return res.json({ status: 'bad', msg: 'Hali imtihonlar mavjud emas' })
		}

		return res.json({ status: 'ok', exams })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function getActiveExams(req, res) {
	try {
		const { teacherOneId } = req.params

		const exams = await prisma.exam.findMany({
			where: { teacher: { oneId: teacherOneId }, active: true },
			include: { classroom: { include: { students: true } } },
		})

		if (!exams) {
			return res.json({ status: 'bad', msg: 'Hali imtihonlar mavjud emas' })
		}

		return res.json({ status: 'ok', exams })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

module.exports = {
	register,
	login,
	createClassroom,
	removeStudentFromClassroom,
	createQuestionPackage,
	addQuestionsToPackage,
	finishExam,
	startExam,
	deleteQuestion,
	editQuestion,
	check,
	getQuestionPackages,
	getSinglePackage,
	deleteImageOfQuestion,
	getAllClassrooms,
	getSingleClassroom,
	editClassroom,
	editPackage,
	deletePackage,
	getExams,
	getActiveExams,
	getDataPreExam,
	deleteExam,
	getProfile,
	deleteClassroom,
}
