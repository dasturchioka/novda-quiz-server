const { PrismaClient } = require('@prisma/client')
const { createToken } = require('../services/jwt.service')
const { createOneId } = require('../utils/oneid.util')
const express = require('express')
const path = require('path')
const multer = require('multer')
const fs = require('fs-extra')
const tmp = require('tmp')
const sharp = require('sharp')
const TEACHER_JWT_SIGNATURE = process.env.TEACHER_JWT_SIGNATURE

const prisma = new PrismaClient()

const tempDir = path.join(__dirname, '../../src/public/temp/')

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, tempDir) // Save the original image temporarily
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
		cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
	},
})

const upload = multer({ storage })

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
 * @param {express.Request} req
 * @param {express.Response} res
 */
async function addQuestionsToPackage(req, res) {
	try {
		const { question, packageOneId } = req.body

		const fileSizeInBytes = req.file.size
		const fileSizeInKB = fileSizeInBytes / 1024

		const tempFile = tmp.fileSync({ postfix: '.png' })

		const finalDir = path.join(__dirname, '../../src/public/question-imgs/')
		const finalDestination = path.join(finalDir, req.file.filename)

		if (fileSizeInKB > 100) {
			await sharp(req.file.path).resize({ width: 800 }).webp({ quality: 90 }).toFile(tempFile.name)
		} else {
			await fs.copyFile(req.file.path, tempFile.name)
		}

		await fs.copyFile(tempFile.name, finalDestination)

		await fs.unlink(req.file.path)

		await fs.unlink(tempFile.name)

		// Get the relative path to be saved in the database
		const imgPath = `/question-imgs/${req.file.filename}`

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

		return res.json({ status: 'ok', msg: "Savol qo'shildi", question: newQuestion })
	} catch (error) {
		console.log(error)
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

		if (file) {
			const { question } = req.body
			const existQuestion = await prisma.question.findUnique({ where: { id: question.id } })

			await fs.unlink(path.join(__dirname, `../../src/public/${existQuestion.img}`))

			const fileSizeInBytes = req.file.size
			const fileSizeInKB = fileSizeInBytes / 1024

			const tempFile = tmp.fileSync({ postfix: '.png' })

			const finalDir = path.join(__dirname, '../../src/public/question-imgs/')
			const finalDestination = path.join(finalDir, req.file.filename)

			if (fileSizeInKB > 100) {
				await sharp(req.file.path)
					.resize({ width: 800 })
					.webp({ quality: 90 })
					.toFile(tempFile.name)
			} else {
				await fs.copyFile(req.file.path, tempFile.name)
			}

			await fs.copyFile(tempFile.name, finalDestination)

			await fs.unlink(req.file.path)

			await fs.unlink(tempFile.name)

			// Get the relative path to be saved in the database
			const imgPath = `/question-imgs/${req.file.filename}`

			const editedQuestion = await prisma.question.update({
				where: { id: question.id },
				data: { ...question, img: imgPath },
			})

			return res.json({ status: 'ok', msg: 'Savol yangilandi', question: editedQuestion })
		}

		const editedQuestion = await prisma.question.update({
			where: { id: question.id },
			data: question,
		})

		return res.json({ msg: 'Savol yangilandi', status: 'ok', question: editedQuestion })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

async function deleteQuestion(req, res) {
	try {
		const { oneId } = req.body

		const deletedQuestion = await prisma.question.delete({
			where: { id: oneId },
			include: { package: false },
		})

		await fs.unlink(path.join(__dirname, `../../src/public/${deletedQuestion.img}`))

		return res.json({ msg: "Savol o'chirildi" })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
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
}
