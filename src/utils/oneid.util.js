/**
 * @param {"teacher" | "classroom" | "student" | "package" | "exam"} type
 */
const createOneId = async type => {
	let randonInt = Math.floor(Math.random() * 9999999)

	if (type === 'teacher') {
		return `TE${randonInt}`
	}

	if (type === 'classroom') {
		return `CL${randonInt}`
	}

	if (type === 'student') {
		return `ST${randonInt}`
	}

	if (type === 'package') {
		return `PK${randonInt}`
	}

	if (type === 'exam') {
		return `EX${randonInt}`
	}
}

module.exports = { createOneId }
