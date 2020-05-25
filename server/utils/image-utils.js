const Image = require('../models/image-model');
const imageTypes = ['image/jpeg', 'image/png', 'image/gif'];

let cloudinary = require('cloudinary').v2;

cloudinary.config({
	cloud_name: process.env.CLDNAME,
	api_key: process.env.CLDKEY,
	api_secret: process.env.CLDS
});


let uploadImage = (blob, fileName, imageType, channelName, type) => {
	let imagePromise = new Promise((resolve, reject) => {

		if(imageTypes.includes(imageType)) {

			Image.findOne({name: fileName, channel: channelName}).then((existingImage) => {
				if(existingImage) {
					console.log('\nimage already exists');
					//Image already exists in the DB
					resolve(existingImage);
				} else {
					//New image
					console.log('\nnew image');
					cloudinary.uploader.upload(blob, (error, result) => {
						if(error) {
							console.log(error);
							reject({
								error: error
							});
						} else {
							console.log('\nimage uploaded successfully')
							new Image({
								name: fileName,
								channel: channelName,
								cloudID: result.public_id,
								url: result.secure_url,
								type: type || 'achievement'
							}).save().then((newImage) => {
								console.log('new image in DB');
								resolve(newImage);
							});		

						}
					});
				}
			});
		} else {
			reject({
				error: "Image type isn't allowed"
			});
		}

	});

	return imagePromise;	
}

let destroyImage = (imageID) => {

	return new Promise((resolve, reject) => {
		cloudinary.uploader.destroy(imageID, function(result) { 
			resolve(result);
		});	
	});
	
}

module.exports = {
	uploadImage,
	destroyImage
}