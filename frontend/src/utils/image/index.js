// Shrinks a photo in the browser before upload, so big camera photos
// don't make posts slow or fail. Returns a JPEG data URL.
export const compressImage = (file, maxSize = 1600, quality = 0.82) =>
	new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error("Could not read that image"));
		reader.onload = () => {
			const image = new Image();
			image.onerror = () => reject(new Error("That file is not a valid image"));
			image.onload = () => {
				const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
				const canvas = document.createElement("canvas");
				canvas.width = Math.round(image.width * scale);
				canvas.height = Math.round(image.height * scale);
				const ctx = canvas.getContext("2d");
				ctx.fillStyle = "#ffffff"; // so transparent PNGs don't turn black
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
				resolve(canvas.toDataURL("image/jpeg", quality));
			};
			image.src = reader.result;
		};
		reader.readAsDataURL(file);
	});
