const { PrismaClient } = require('@prisma/client')
const { createToken } = require('../services/jwt.service')
const { createOneId } = require('../utils/oneid.util')
const STUDENT_JWT_SIGNATURE = process.env.STUDENT_JWT_SIGNATURE

const prisma = new PrismaClient()

// auth
async function register(req, res) {
	try {
		const { fullname, password, classroomOneId } = req.body

		if (!fullname) {
			return res.json({ status: 'bad', msg: 'Ism familiyani kiritishingiz kerak' })
		}

		if (!password) {
			return res.json({ status: 'bad', msg: 'Parolni kiritishingiz kerak' })
		}

		if (password.length < 8) {
			return res.json({ status: 'bad', msg: 'Parol kamida 8 ta belgidan tashkil topishi kerak' })
		}

		const newOneId = await createOneId('student')

		if (classroomOneId) {
			const existClassroom = await prisma.classrom.count({ where: { oneId: classroomOneId } })

			if (!existClassroom) {
				return res.json({ status: 'bad', msg: 'Bunday oneIdga ega sinfxona mavjud emas' })
			}

			const newStudent = await prisma.student.create({
				data: {
					oneId: newOneId,
					fullname,
					password,
					classrooms: { connect: { oneId: classroomOneId } },
				},
			})

			const newToken = await createToken(newStudent, STUDENT_JWT_SIGNATURE)

			return res.json({
				token: newToken,
				student: newStudent,
				status: 'ok',
				msg: "Tizimdan ro'yxatdan o'tildi",
			})
		}

		const newStudent = await prisma.student.create({
			data: { oneId: newOneId, fullname, password },
		})

		const newToken = await createToken(newStudent, STUDENT_JWT_SIGNATURE)

		return res.json({
			token: newToken,
			student: newStudent,
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

		const existStudent = await prisma.student.findUnique({
			where: { oneId },
		})

		if (!existStudent) {
			return res.json({ status: 'bad', msg: 'Bunday oneId tizimda mavjud emas' })
		}

		if (existStudent.password !== password) {
			return res.json({ status: 'bad', msg: "Parol noto'g'ri" })
		}

		const newToken = await createToken(existStudent, STUDENT_JWT_SIGNATURE)

		return res.json({
			token: newToken,
			student: existStudent,
			status: 'ok',
			msg: 'Tizimga kirildi',
		})
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

// classrooms
async function getClassrooms(req, res) {
	try {
		const { oneId } = req.params

		const classrooms = await prisma.classrom.findMany({
			where: { students: { some: { oneId } } },
			include: { students: true, teacher: true },
		})

		if (!classrooms) {
			return res.json({ status: 'bad', msg: 'Siz hali hech qaysi sinfga biriktirilmagansiz' })
		}

		const newClassrooms = classrooms.map(c => {
			return {
				name: c.name,
				oneId: c.oneId,
				studentsCount: c.students.length,
				teacher: c.teacher.fullname,
			}
		})

		return res.json({ status: 'ok', classrooms: newClassrooms })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}
async function getClassroom(req, res) {
	try {
		const { oneId } = req.params
		const { classroomOneId } = req.query

		const classroom = await prisma.classrom.findUnique({
			where: { oneId: classroomOneId, students: { some: { oneId } } },
			include: {
				teacher: true,
				students: true,
				Exam: { include: { packageOfExam: true, students: true } },
			},
		})

		if (!classroom) {
			return res.json({ status: 'bad', msg: 'Siz hali hech qaysi sinfga biriktirilmagansiz' })
		}

		const newClassroom = {
			name: classroom.name,
			oneId: classroom.oneId,
			teacher: classroom.teacher.fullname,
			students: classroom.students.map(s => {
				return { fullname: s.fullname, oneId: s.oneId }
			}),
			exams: classroom.Exam
				? classroom.Exam.map(e => {
						return {
							name: e.name,
							packageOfExam: e.packageOfExam.name,
							studentsCount: e.students.length,
							active: e.active,
						}
				  })
				: null,
		}

		return res.json({ status: 'ok', classroom: newClassroom })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}
async function leaveClassroom(req, res) {
	try {
		const { oneId } = req.params
		const { classroomOneId } = req.query
		const student = await prisma.student.count({ where: { oneId } })
		const classroom = await prisma.classrom.count({ where: { oneId: classroomOneId } })

		if (!student) {
			return res.json({ status: 'bad', msg: 'Talaba topilmadi' })
		}

		if (!classroom) {
			return res.json({ status: 'bad', msg: 'Sinfxona topilmadi' })
		}

		await prisma.classrom.update({
			where: { oneId: classroomOneId },
			data: { students: { disconnect: { oneId } } },
		})

		return res.json({ status: 'ok', msg: 'Siz sinfxonadan chiqib ketdingiz' })
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}
async function enterClassroom(req, res) {
	try {
		const { oneId } = req.params
		const { classroomOneId } = req.query
		const student = await prisma.student.count({ where: { oneId } })
		const classroom = await prisma.classrom.count({ where: { oneId: classroomOneId } })

		if (!student) {
			return res.json({ status: 'bad', msg: 'Talaba topilmadi' })
		}

		if (!classroom) {
			return res.json({ status: 'bad', msg: 'Sinfxona topilmadi' })
		}

		const updatedClassroom = await prisma.classrom.update({
			where: { oneId: classroomOneId },
			data: { students: { connect: { oneId } } },
		})

		return res.json({
			status: 'ok',
			msg: "Siz sinfxonaga qo'shildingiz",
			classroom: updatedClassroom,
		})
	} catch (error) {
		console.log(error)
		return res.status(500).json(error)
	}
}

module.exports = { login, register, getClassrooms, getClassroom, leaveClassroom, enterClassroom }
