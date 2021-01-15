class PreLoadedImage {
	constructor(src) {
		this.img = new Image;
		this.ratio = 1;
		var self = this;
		this.img.onload = function() {
			self.ratio = self.img.width / self.img.height;
		};
		this.img.src = src;
	}
}

class Label {
	constructor(position, text, size, align, font, color) {
		this.position = position;
		this.text = text;
		this.data = "";
		this.size = size;
		this.font = font ? font : LABEL_FONT;
		this.align = align ? align : "center";
		this.visible = true;
		this.opacity = 1;
		this.color = color;
	}

	msg() {
		return this.text + this.data;
	}

	enable() {}
	disable() {}
	show() {}

	dims() {
		ctx.font = (this.size * r) + "px " + this.font;
		var metrics = ctx.measureText(this.msg())
		return {
			width: metrics.width,
			height: metrics.actualBoundingBoxAscent,
		}
	}

	draw(absolute = false) {
		if (!this.visible) { return; }
		if (this.opacity < 1) {
			ctx.save();
			ctx.globalAlpha = this.opacity;
		}

		var color = this.color ? this.color : WHITE;
		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.font = (this.size * r) + "px " + this.font;
	
		ctx.textBaseline = "center";
		ctx.textAlign = this.align;
		if (absolute) {
			ctx.fillText(this.msg(), this.position.x, this.position.y);
		} else {
			ctx.fillText(this.msg(), canvas.width * this.position.x, canvas.height * this.position.y);
		}
		if (this.opacity < 1) {
			ctx.restore();
		}
	}
}

class Button {
	constructor(position, text, size, callback, uncallback, sticky, holdable, align, border, margin, font) {
		this.position = position;
		this.text = text;
		this.size = size;
		this.font = font ? font : LABEL_FONT;
		this.align = align ? align : "center";
		this.callback = callback;
		this.uncallback = uncallback;
		this.down = false;
		this.enabled = false;
		this.visible = true;
		this.focus = false;
		this.clicked = false;
		this.undoEnabled = true;
		this.margin = margin || 20;
		this.border = border === undefined ? true : border;
		this.holdable = holdable;
		this.holdTicks = 0;
		this.sticky = sticky;
	}

	checkHold() {
		if (!this.holdable || !this.enabled || !this.down) {
			return;
		}
		if (isOnButton(this)) {
			this.holdTicks += 1;
			if (this.holdTicks === 15) {
				this.click();
				this.holdTicks = 0;
			} 
		}
	}

	toggle() {
		if (!this.enabled) {
			return;
		}
		if (this.clicked) {
			this.unclick();
		} else {
			this.click();
		}
	}

	click() {
		if (!this.enabled) {
			return;
		}
		if (!this.clicked) {
			if (this.uncallback || this.sticky) {
				this.clicked = true;
			}
			this.callback();
		}
	}

	unclick() {
		if (!this.enabled) {
			return;
		}
		if (this.clicked && this.uncallback && this.undoEnabled) {
			this.clicked = false;
			this.uncallback();
		}
	}

	enable(preserveClick) {
		this.visible = true;
		this.enabled = true;
		if (!preserveClick) {
			this.clicked = false;
		}
		this.undoEnabled = true;
	}

	disable() {
		this.visible = false;
		this.enabled = false;
	}

	show() {
		this.visible = true;
	}

	disableUndo() {
		this.undoEnabled = false;
	}

	dims() {
		ctx.font = (this.size * r) + "px " + this.font;
		var metrics = ctx.measureText(this.text)
		return {
			width: metrics.width,
			height: metrics.actualBoundingBoxAscent,
		}
	}

	buttonDims() {
		var dims = this.dims();
		var margin = this.margin * r;
	
		// Top left corner.
		var minX = canvas.width * this.position.x - margin * 0.5;
		if (this.align === "center") {
			minX -= dims.width / 2;
		} else if (this.align === "right") {
			minX -= dims.width;
		}
		var minY = canvas.height * this.position.y - dims.height - margin * 0.5;
		var maxX = minX + dims.width + margin;
		var maxY = minY + dims.height + margin;
		
		return {
			left: minX,
			right: maxX,
			top: minY,
			bot: maxY,
			width: dims.width + margin,
			height: dims.height + margin,
		}
	}

	draw(absolute = false) {
		if (!this.visible) { return; }

		if (this.focus || this.clicked) {
			ctx.strokeStyle = RED;
			ctx.fillStyle = RED;
		} else if (this.enabled) {
			ctx.strokeStyle = WHITE;
			ctx.fillStyle = WHITE;
		} else {
			ctx.strokeStyle = "grey";
			ctx.fillStyle = "grey";
		}
		ctx.font = (this.size * r) + "px " + this.font;
	
		var buttonDims = this.buttonDims();
		ctx.lineWidth = this.border * r;
		ctx.lineJoin = "round";
		if (this.border) {
			ctx.strokeRect(buttonDims.left, buttonDims.top, buttonDims.width, buttonDims.height);
		}

		ctx.textBaseline = "center";
		ctx.textAlign = this.align;
		if (absolute) {
			ctx.fillText(this.msg(), this.position.x, this.position.y);
		} else {
			ctx.fillText(this.text, canvas.width * this.position.x, canvas.height * this.position.y);
		}
	}
}

class ImageLabel {
	constructor(position, width, height, img, center, absolute) {
		this.position = position;
		this.width = width;
		this.height = height;
		this.center = center;
		this.absolute = absolute;
		// Load image
		this.img = img;
	}

	show() {}
	disable() {}

	pos() {
		var pos = {x: this.position.x, y: this.position.y};
		if (!this.absolute) {
			pos.x *= canvas.width;
			pos.y *= canvas.height;
		}
		if (this.center) {
			var dims = this.dims();
			pos.x -= dims.width / 2;
			pos.y -= dims.height / 2;
		}
		return pos;
	}

	dims() {
		var h, w;
		if (this.height) {
			h = canvas.height * this.height;
			w = this.width ? canvas.width * this.width : h * this.img.ratio;
		} else {
			w = canvas.width * this.width;
			h = this.height ? canvas.height * this.height : w / this.img.ratio;
		}
		return {width: w, height: h};
	}

	buttonDims() {
		var pos = this.pos();
		var dims = this.dims();
	
		var minX = canvas.width * pos.x;
		var minY = canvas.height * pos.y;
		var maxX = minX + dims.width;
		var maxY = minY + dims.height;

		return {
			left: minX,
			right: maxX,
			top: minY,
			bot: maxY,
			width: dims.width,
			height: dims.height,
		}
	}

	draw() {
		var pos = this.pos();
		var dims = this.dims();

		var x = pos.x;
		var y = pos.y;

		// console.log(`DRAWING ${this.img.img.src} ${x} ${y} ${dims.width} ${dims.height}`);
		ctx.drawImage(this.img.img, x, y, dims.width, dims.height);
	}
}

class ImageButton {
	constructor(position, width, height, center, absolute, on_img, callback, off_img, uncallback) {
		this.position = position;
		this.width = width;
		this.height = height;
		this.center = center
		this.absolute = absolute;
		this.callback = callback;
		this.uncallback = uncallback;
		this.clicked = false;
		this.sticky = false;
		this.enabled = true;
		this.visible = true;
		this.on = false;
		// On image
		this.on_img = on_img;
		if (uncallback) {
			this.off_img = off_img;
		}

		this.img = this.uncallback && !this.on ? this.off_img : this.on_img;
	}

	checkHold() {}

	toggle() {
		if (!this.enabled) {
			return;
		}
		if (this.uncallback && this.on) {
			this.uncallback();
		} else {
			this.callback();
		}
		this.on = !this.on;
		this.img = this.uncallback && !this.on ? this.off_img : this.on_img;
	}

	click() {
		if (!this.enabled) {
			return;
		}
		if (!this.clicked) {
			if (this.uncallback || this.sticky) {
				this.clicked = true;
			}
			this.callback();
		}
	}

	unclick() {
		if (!this.enabled) {
			return;
		}
		if (this.clicked && this.uncallback && this.undoEnabled) {
			this.clicked = false;
			this.uncallback();
		}
	}

	enable() {
		this.visible = true;
		this.enabled = true;
	}

	disable() {
		this.visible = false;
		this.enabled = false;
	}

	show() {
		this.visible = true;
	}
	
	pos() {
		var pos = {x: this.position.x, y: this.position.y};
		if (!this.absolute) {
			pos.x *= canvas.width;
			pos.y *= canvas.height;
		}
		if (this.center) {
			var dims = this.dims();
			pos.x -= dims.width / 2;
			pos.y -= dims.height / 2;
		}
		return pos;
	}

	dims() {
		var h, w;
		if (this.height) {
			h = canvas.height * this.height;
			w = this.width ? canvas.width * this.width : h * this.img.ratio;
		} else {
			w = canvas.width * this.width;
			h = this.height ? canvas.height * this.height : w / this.img.ratio;
		}
		return {width: w, height: h};
	}

	buttonDims() {
		var pos = this.pos();
		var dims = this.dims();
	
		var minX = pos.x;
		var minY = pos.y;
		var maxX = minX + dims.width;
		var maxY = minY + dims.height;
	
		return {
			left: minX,
			right: maxX,
			top: minY,
			bot: maxY,
			width: dims.width,
			height: dims.height,
		}
	}

	draw() {
		// console.log(`TRYING TO DRAW ${this.img.img.src} : ${this.visible}`);
		if (!this.visible) { return; }

		var pos = this.pos();
		var dims = this.dims();

		var x = pos.x;
		var y = pos.y;

		ctx.drawImage(this.img.img, x, y, dims.width, dims.height);
	}
}

class Checkbox {
	constructor(position, size, callback) {
		this.position = position;
		this.size = size;
		this.callback = callback;
		this.down = false;
		this.enabled = false;
		this.visible = true;
		this.clicked = false;
	}

	checkHold() {}

	toggle() {
		if (!this.enabled) {
			return;
		}
		this.clicked = !this.clicked;
		if (this.callback) {
			this.callback();
		}
	}

	enable() {
		this.enabled = true;
	}

	disable() {
		this.enabled = false;
	}

	dims() {
		return {
			width: canvas.width * this.size,
			height: canvas.width * this.size,
		}
	}

	buttonDims() {
		var dims = this.dims();
	
		// Top left corner.
		var minX = canvas.width * this.position.x - dims.width * 0.5;
		var minY = canvas.height * this.position.y - dims.height * 0.5;
		var maxX = minX + dims.width;
		var maxY = minY + dims.height;
		
		return {
			left: minX,
			right: maxX,
			top: minY,
			bot: maxY,
			width: dims.width,
			height: dims.height,
		}
	}

	draw() {
		if (!this.visible) { return; }

		if (this.enabled) {
			ctx.strokeStyle = "black";
			ctx.fillStyle = "black";
		} else {
			ctx.strokeStyle = "gray";
			ctx.fillStyle = "gray";
		}
	
		var buttonDims = this.buttonDims();
		ctx.lineWidth = 1 * r;
		ctx.lineJoin = "round";
		
		if (this.clicked) {
			ctx.fillRect(buttonDims.left, buttonDims.top, buttonDims.width, buttonDims.height);
		} else {
			ctx.strokeRect(buttonDims.left, buttonDims.top, buttonDims.width, buttonDims.height);
		}
	}
}

class DrawGroup {
	constructor(draws) {
		this.draws = draws;
	}

	show() {
		for (var d of this.draws) {
			d.show();
		}
	}

	draw() {
		for (var d of this.draws) {
			d.draw();
		}
	}
	
	enable() {
		for (var d of this.draws) {
			d.enable();
		}
	}

	disable() {
		for (var d of this.draws) {
			d.disable();
		}
	}
}