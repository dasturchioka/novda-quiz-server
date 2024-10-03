const { PrismaClient } = require('@prisma/client')
const { createToken } = require('../services/jwt.service')
const { createOneId } = require('../utils/oneid.util')
const express = require('express')
const path = require('path')
const multer = require('multer')
const fs = require('fs').promises
const sharp = require('sharp')
const TEACHER_JWT_SIGNATURE = process.env.TEACHER_JWT_SIGNATURE

const prisma = new PrismaClient()

const storage = multer.memoryStorage()

const upload = multer({ storage })

const processImageAndSave = async (req, res, next) => {
	try {
		if (req.file) {
			const file = req.file
			const fileSizeInBytes = file.size
			const fileSizeInKB = fileSizeInBytes / 1024

			const finalDir = path.join(__dirname, '../../src/public/question-imgs/')

			// Generate a unique filename with the original extension
			const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
			const fileExtension = path.extname(file.originalname) // Get the original file extension (e.g., .jpg, .png)
			const fileName = file.fieldname + '-' + uniqueSuffix + fileExtension
			const finalDestination = path.join(finalDir, fileName) // Final destination path with the generated filename

			// Ensure the final destination directory exists
			await fs.mkdir(finalDir, { recursive: true })

			// Process the image buffer in memory
			if (fileSizeInKB > 100) {
				await sharp(file.buffer) // Use the file buffer instead of file.path
					.resize({ width: 800 }) // Resize to a max width of 800px
					.webp({ quality: 90 }) // Convert to WebP format with 90% quality
					.toFile(finalDestination) // Save directly to the final destination
			} else {
				// If file size is small, save the original buffer without resizing
				await fs.writeFile(finalDestination, file.buffer)
			}

			// Attach the generated filename and path to the req object so it can be used later
			req.savedImage = {
				fileName,
				filePath: `/question-imgs/${fileName}`,
			}
		}

		return next() // Move to the next middleware (addQuestionsToPackage)
	} catch (error) {
		console.error(error)
		return res.status(500).json({ status: 'error', error })
	}
}

const processImageAndUpdate = async (req, res, next) => {
	try {
		if (req.file) {
			const question = await prisma.question.findUnique({ where: { id: req.body.id } })

			const existingImagePath = question.img

			const file = req.file
			const fileSizeInBytes = file.size
			const fileSizeInKB = fileSizeInBytes / 1024

			const finalDir = path.join(__dirname, '../../src/public/question-imgs/')

			// Generate a unique filename with the original extension
			const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
			const fileExtension = path.extname(file.originalname) // Get the original file extension (e.g., .jpg, .png)
			const fileName = file.fieldname + '-' + uniqueSuffix + fileExtension
			const finalDestination = path.join(finalDir, fileName) // Final destination path with the generated filename

			// Ensure the final destination directory exists
			await fs.mkdir(finalDir, { recursive: true })

			// Delete the old image if it exists
			if (existingImagePath) {
				const oldImagePath = path.join(__dirname, '../../src/public', existingImagePath)
				try {
					await fs.unlink(oldImagePath) // Delete the existing image file
					console.log(`Deleted old image: ${existingImagePath}`)
				} catch (err) {
					console.warn(`Failed to delete old image: ${existingImagePath}`, err)
				}
			}

			// Process the new image buffer in memory
			if (fileSizeInKB > 100) {
				await sharp(file.buffer) // Use the file buffer instead of file.path
					.resize({ width: 800 }) // Resize to a max width of 800px
					.webp({ quality: 90 }) // Convert to WebP format with 90% quality
					.toFile(finalDestination) // Save directly to the final destination
			} else {
				// If file size is small, save the original buffer without resizing
				await fs.writeFile(finalDestination, file.buffer)
			}

			// Attach the generated filename and path to the req object so it can be used later
			req.savedImage = {
				fileName,
				filePath: `/question-imgs/${fileName}`,
			}
		}

		return next() // Move to the next middleware (e.g., update the database with the new image path)
	} catch (error) {
		console.error(error)
		return res.status(500).json({ status: 'error', error })
	}
}

async function register(req, res) {
	try {
		const { fullname, password } = req.body

		if (!fullname) {
			return res.json({ status: 'bad', msg: 'Ism familiyani kiritishingiz kerak' })
		}

		if (!password) {
			return res.json({ status: 'bad', msg: 'Parolni kiritishingiz kerak' })
		}

		if (password.length < 8) {
			return res.json({ status: 'bad', msg: 'Parol kamida 8 ta belgidan tashkil topishi kerak' })
		}

		const newOneId = await createOneId('teacher')

		const newTeacher = await prisma.teacher.create({
			data: { oneId: newOneId, fullname, password },
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

async function createClassroom(req, res) {
	try {
		const { name, teacherOneId } = req.body

		const newOneId = await createOneId('classroom')
		const newClassroom = await prisma.classrom.create({
			data: { name, newOneId, teacher: { connect: { oneId: teacherOneId } } },
		})

		return res.json({ status: 'ok', classroom: newClassroom, msg: 'Yangi guruh yaratildi' })
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

async function createQuestionPackage(req, res) {
	try {
		const { name, teacherOneId } = req.body

		const newOneId = await createOneId('package')

		const newQuestionPackage = await prisma.package.create({
			data: { oneId: newOneId, name, teacher: { connect: { oneId: teacherOneId } } },
			include: { questions: true },
		})

		return res.json({ status: 'ok', msg: 'Paket yaratildi', package: newQuestionPackage })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

/**
 *
 * @param {express.Request} req
 * @param {express.Response} res
 * @returns
 */
async function getQuestionPackages(req, res) {
	try {
		try {
			const { teacherOneId } = req.body
			const { questions } = req.query

			const questionPackages = await prisma.package.findMany({
				where: { teacher: { oneId: teacherOneId } },
				include: { questions: +questions ? true : false },
			})

			if (!questionPackages) {
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
		const { questions } = req.query

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

/**
 * @param {express.Request} req
 * @param {express.Response} res
 */

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

/**
 *
 * @param {express.Request} req
 * @param {express.Response} res
 */
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

		await fs.unlink(path.join(__dirname, `../../src/public/${deletedQuestion.img}`))

		return res.json({ msg: "Savol o'chirildi" })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

const deleteExistingImage = async (req, res, next) => {
	try {
		const question = await prisma.question.findUnique({ where: { id: req.params.id } })

		const existingImagePath = question.img

		if (existingImagePath) {
			const fullPath = path.join(__dirname, '../../src/public', existingImagePath) // Construct full path

			try {
				// Check if the file exists before trying to delete it
				await fs.access(fullPath) // Check if file is accessible (exists)
				await fs.unlink(fullPath) // Delete the file
				console.log(`Deleted image: ${existingImagePath}`)
			} catch (err) {
				// If the file does not exist or cannot be deleted, log a warning
				console.warn(`Failed to delete image: ${existingImagePath}`, err)
			}
		}

		// Proceed to the next middleware after attempting to delete the image
		return next()
	} catch (error) {
		console.error(`Error while deleting image: ${error}`)
		return res.status(500).json({ status: 'error', error })
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

async function startExam(req, res) {
	try {
		const { name } = req.body

		const newOneId = await createOneId('exam')

		const newExam = await prisma.exam.create({
			data: {
				oneId: newOneId,
				name,
				teacher: { connect: { id: teacherId } }, // Connect the exam to a teacher
				classroom: { connect: { id: classromId } }, // Connect the exam to a classroom
				packageOfExam: { connect: { id: packageId } }, // Connect the exam to a package
				active: true,
			},
		})

		return res.json({ status: 'ok', msg: 'Imtihon boshlandi', exam: newExam })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function finishExam(req, res) {
	try {
		const { examOneId } = req.body

		const updatedExam = await prisma.exam.update({
			where: { oneId: examOneId },
			data: { active: false },
		})

		return res.json({ status: 'ok', msg: 'Imtihon yakunlandi', exam: updatedExam })
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
	upload,
	check,
	processImageAndSave,
	getQuestionPackages,
	getSinglePackage,
	processImageAndUpdate,
	deleteImageOfQuestion,
	deleteExistingImage,
}
