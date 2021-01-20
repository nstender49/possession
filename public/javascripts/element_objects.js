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

class Element {
	constructor(x, y) {
		this.xx = x;
		this.yy = y;

		this.absolute = false;
		this.center = false;

		this.visible = true;
		this.opacity = 1;

		this.enabled = false;
		this.down = false;
		this.focus = false;
		this.clicked = false;

		this.sticky = false;
		this.isOverlay = false;
	}

	setPosition(x, y) {
		this.xx = x;
		this.yy = y;
	}

	setAbsolute(val) {
		if (val !== undefined) this.absolute = val;
		return this;
	}

	setCenter(val) {
		if (val !== undefined) this.center = val;
		return this;
	}

	x() {
		var x = this.xx;
		if (!this.absolute) x *= cvW;
		if (this.center) x -= this.dims().width / 2;
		return x;
	}

	y() {
		var y = this.yy;
		if (!this.absolute) y *= cvH;
		if (this.center) y -= this.dims().height / 2;
		return y;
	}

	enable() {
		this.visible = true;
		this.enabled = true;
		this.clicked = false;
	}

	disable() {
		this.visible = false;
		this.enabled = false;
	}

	show() {
		this.visible = true;
	}
}

class TextElement extends Element {
	constructor(x, y, text, size) {
		super(x, y);

		this.text = text;
		this.data = "{}";

		this.size = size;
		this.maxSize = size;

		this.font = LABEL_FONT;
		this.color = "white";
		this.align = "center";
	}

	setAlign(val) {
		if (val) this.align = val;
		return this;
	}

	setFont(val) {
		if (val) this.font = val;
		return this;
	}

	setColor(val) {
		if (val) this.color = val;
		return this;
	}

	setData(val) {
		if (val !== undefined) {
			this.text = this.text.replace(this.data, val);
			this.data = val;
		}
		return this;
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
		var minX = this.x() - margin * 0.5;
		if (this.align === "center") {
			minX -= dims.width / 2;
		} else if (this.align === "right") {
			minX -= dims.width;
		}
		var minY = this.y() - dims.height - margin * 0.5;
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
}

class Label extends TextElement {
	constructor(x, y, text, size) {
		super(x, y, text, size);
	}

	draw() {
		if (!this.visible) { return; }
		if (this.opacity < 1) {
			ctx.save();
			ctx.globalAlpha = this.opacity;
		}

		ctx.fillStyle = this.color;
		ctx.font = (this.size * r) + "px " + this.font;	
		ctx.textBaseline = "center";
		ctx.textAlign = this.align;

		ctx.fillText(this.text, this.x(), this.y());

		if (this.opacity < 1) ctx.restore();
	}
}

let ButtonMixin = (superclass) => class extends superclass {
	setOverlay() {
		this.isOverlay = true;
		return this;
	}

	setSticky(val) {
		if (val !== undefined) this.sticky = val;
		return this;
	}

	isEnabled() {
		return this.enabled && (!overlay || this.isOverlay);
	}

	under(x, y) {
		if (!this.isEnabled()) return false;
		var bDims = this.buttonDims();
		return x >= bDims.left && x <= bDims.right && y <= bDims.bot && y >= bDims.top;
	}
	
	checkHold(x, y) {
		if (!(this.holdable && this.down && this.isEnabled())) return

		if (this.under(x, y)) {
			this.holdTicks += 1;
			if (this.holdTicks === 15) {
				this.click();
				this.holdTicks = 0;
			} 
		}
	}

	toggle() {
		if (!this.isEnabled()) return;

		if (this.clicked) {
			this.unclick();
		} else {
			this.click();
		}
	}

	click() {
		if (!this.isEnabled()) return;

		if (!this.clicked) {
			if (this.uncallback || this.sticky) this.clicked = true;
			this.callback();
		}
	}

	unclick() {
		if (!this.isEnabled()) return;

		if (this.clicked && this.uncallback) {
			this.clicked = false;
			this.uncallback();
		}
	}
};

class Button extends ButtonMixin(TextElement) {
	constructor(x, y, text, size, callback, uncallback, sticky, holdable, border, margin) {
		super(x, y, text, size);

		this.callback = callback;
		this.uncallback = uncallback;
		

		this.margin = margin || 20;
		this.border = border === undefined ? true : border;
		this.holdable = holdable;
		this.holdTicks = 0;
	}

	draw() {
		if (!this.visible) { return; }

		if (this.focus || this.clicked) {
			ctx.strokeStyle = RED;
			ctx.fillStyle = RED;
		} else if (this.isEnabled()) {
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

		ctx.fillText(this.text, this.x(), this.y());
	}
}

class ImageElement extends Element {
	constructor(x, y, w, h) {
		super(x, y);
		this.width = w;
		this.height = h;
	}

	dims() {
		var h, w;
		if (this.height) {
			h = cvH * this.height;
			w = this.width ? cvW * this.width : h * this.img.ratio;
		} else {
			w = cvW * this.width;
			h = this.height ? cvH * this.height : w / this.img.ratio;
		}
		return {width: w, height: h};
	}

	buttonDims() {
		var dims = this.dims();
	
		var minX = this.x();
		var minY = this.y();
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
}

class ImageLabel extends ImageElement {
	constructor(position, width, height, img) {
		super(position.x, position.y, width, height);
		this.img = img;
	}

	draw() {
		if (!this.visible) return;

		var dims = this.dims();
	
		ctx.drawImage(this.img.img, this.x(), this.y(), dims.width, dims.height);
	}
}

class ImageButton extends ButtonMixin(ImageElement) {
	constructor(position, width, height, center, absolute, on_img, callback, off_img, uncallback) {
		super(position.x, position.y, width, height);

		this.center = center
		this.absolute = absolute;

		this.callback = callback;
		this.uncallback = uncallback;

		// On image
		this.on_img = on_img;
		this.img = on_img;
		if (uncallback) this.off_img = off_img;
	}

	draw() {
		if (!this.visible) { return; }

		var dims = this.dims();

		var img = this.uncallback && this.clicked ? this.off_img : this.on_img;
		ctx.drawImage(img.img, this.x(), this.y(), dims.width, dims.height);
	}
}

class ShapeButton extends ButtonMixin(ImageElement) {
	constructor(position, width, height, center, absolute, color, callback) {
		super(position.x, position.y, width, height);

		this.center = center
		this.absolute = absolute;
		this.callback = callback;
		this.color = color;
	}

	dims() {
		return {width: this.width * cvW, height: this.height * cvH};
	}

	draw() {
		if (!this.visible) { return; }

		var dims = this.dims();

		ctx.fillStyle = this.color;
		ctx.fillRect(this.x(), this.y(), dims.width, dims.height);
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