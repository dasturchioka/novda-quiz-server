const sharp = require('sharp')
const path = require('path')
const fs = require('fs').promises
const { PrismaClient } = require('@prisma/client')
const multer = require("multer")

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

module.exports = { deleteExistingImage, processImageAndSave, processImageAndUpdate, upload }
