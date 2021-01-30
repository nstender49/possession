class PreLoadedImage {
	constructor(src) {
		this.img = new Image;
		this.ratio = 1;
		this.loaded = false;
		var self = this;
		this.img.onload = function() {
			self.ratio = self.img.width / self.img.height;
			self.loaded = true;
		};
		this.img.src = src;
	}
}

class Element {
	constructor() {
		this.xx = 0;
		this.yy = 0;

		this.width = 0;
		this.height = 0;

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
		return this;
	}

	setDims(w, h) {
		this.width = w;
		this.height = h;
		return this;
	}

	setAbsolute(val) {
		if (val !== undefined) this.absolute = val;
		return this;
	}

	setCenter(val) {
		if (val !== undefined) this.center = val;
		return this;
	}

	setBackground(color, textColor) {
		if (color) this.bColor = color;
		if (textColor) this.tColor = textColor;
		return this;
	}

	bgndColor() {
		return this.bColor || BUTTON_BACKGROUND;
	}

	textColor() {
		return this.tColor || BUTTON_TEXT;
	}

	borderColor() {
		return this.isEnabled() ? BUTTON_BORDER : "grey";
	}

	setMargin(val) {
		if (val !== undefined) this.margin = val;
		return this;
	}

	x() {
		var x = this.xx;
		if (!this.absolute) x = x * cvW + wOff;
		if (this.center) x -= this.dims().width / 2;
		return x;
	}

	y() {
		var y = this.yy;
		if (!this.absolute) y = y * cvH + hOff;
		if (this.center) y -= this.dims().height / 2;
		return y;
	}

	enable() {
		this.visible = true;
		this.enabled = true;
		this.clicked = false;
		return this;
	}

	disable() {
		this.visible = false;
		this.enabled = false;
		return this;
	}

	show() {
		this.visible = true;
		return this;
	}

	
	dims() {
		var w = this.width * (this.absolute ? 1 : cvW);
		var h = this.height * (this.absolute ? 1 : cvH);
		if (!this.width) w = h;
		if (!this.height) h = w;
		return {width: w, height: h};
	}

	buttonDims() {
		var dims = this.dims();
		var x = this.x();
		var y = this.y();

		return {
			left: x,
			right: x + dims.width,
			top: y,
			bot: y + dims.height,
			width: dims.width,
			height: dims.height,
		}
	}
}

class TextElement extends Element {
	constructor(text, size) {
		super();

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

	textDims() {
		ctx.font = (this.size * r) + "px " + this.font;
		var metrics = ctx.measureText(this.text)
		return {
			width: metrics.width,
			height: metrics.actualBoundingBoxAscent,
		}
	}
	dims() {
		if (this.width || this.height) return super.dims();
		return this.textDims();
	}

	buttonDims() {
		if (this.width || this.height) return super.buttonDims();

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
	constructor(text, size) {
		super(text, size);
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

	setHoldable(val) {
		if (val !== undefined) this.holdable = val; this.holdTicks = 0;
		return this;
	}

	isEnabled() {
		return this.enabled && (!overlay || this.isOverlay);
	}

	bgndColor() {
		return (this.focus || this.clicked) ? super.textColor() : super.bgndColor();
	}

	textColor() {
		return this.isEnabled() ? ((this.focus || this.clicked) ? super.bgndColor() : super.textColor()) : BUTTON_DISABLED;
	}

	under(x, y) {
		if (!this.isEnabled()) return false;
		var bDims = this.buttonDims();
		return x >= bDims.left && x <= bDims.right && y <= bDims.bot && y >= bDims.top;
	}
	
	checkHold(x, y) {
		this.focus = this.under(x, y);
		if (!this.focus) this.down = false;
		if (!(this.holdable && this.down && this.isEnabled())) return

		if (this.focus) {
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

function drawBorderedRect(x, y, w, h, fillColor, borderColor) {
	ctx.fillStyle = fillColor;
	ctx.strokeStyle = borderColor;

	ctx.lineJoin = "round";
	var cornerRadius = Math.min(w, h) * 0.1;
	ctx.lineWidth = cornerRadius;

	ctx.strokeRect(x+(cornerRadius/2), y+(cornerRadius/2), w-cornerRadius, h-cornerRadius);
	ctx.fillRect(x+(cornerRadius/2), y+(cornerRadius/2), w-cornerRadius, h-cornerRadius);	
}

class Button extends ButtonMixin(TextElement) {
	constructor(text, size, callback, uncallback) {
		super(text, size);

		this.callback = callback;
		this.uncallback = uncallback;

		this.center = true;
		this.margin = 20;
		this.border = true;
		this.holdable = false;
		this.holdTicks = 0;
	}

	setBorder(val) {
		if (val !== undefined) this.border = val;
		return this;
	}

	setMargin(val) {
		if (val !== undefined) this.margin = val;
		return this;
	}

	draw() {
		if (!this.visible) { return; }

		var dims = this.buttonDims();
		
		drawBorderedRect(dims.left, dims.top, dims.width, dims.height, this.bgndColor(), this.borderColor());
 
		ctx.strokeStyle = this.textColor();
		ctx.fillStyle = this.textColor();
		ctx.font = (this.size * r) + "px " + this.font;
		ctx.textBaseline = "center";
		ctx.textAlign = this.align;

		var offW = dims.width / 2;
		var offH = dims.height * 0.5 + this.textDims().height / 2; 
		ctx.fillText(this.text, dims.left + offW, dims.top + offH);
	}
}

class ImageElement extends Element {
	constructor() {
		super();
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
	constructor(img) {
		super();
		this.img = img;
	}

	draw() {
		if (!this.visible) return;

		var dims = this.dims();
	
		ctx.drawImage(this.img.img, this.x(), this.y(), dims.width, dims.height);
	}
}

class ImageButton extends ButtonMixin(ImageElement) {
	constructor(on_img, callback, off_img, uncallback) {
		super();

		this.callback = callback;
		this.uncallback = uncallback;

		this.background = undefined;
		this.margin = 0;
		this.text = undefined;
		this.size = 20;

		// On image
		this.on_img = on_img;
		this.img = on_img;
		if (uncallback) this.off_img = off_img;
	}

	draw() {
		if (!this.visible) { return; }

		var img = this.uncallback && this.clicked ? this.off_img : this.on_img;
		var dims = this.buttonDims();

		if (this.bColor) drawBorderedRect(dims.left, dims.top, dims.width, dims.height, this.bgndColor(), this.borderColor());

		ctx.drawImage(img.img, dims.left + this.margin, dims.top + this.margin, dims.width - this.margin * 2, dims.height - this.margin * 2);
	}
}

class ShapeButton extends ButtonMixin(ImageElement) {
	constructor(color, callback) {
		super();

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
	constructor(draws = []) {
		this.draws = draws;
	}

	add(item) {
		this.draws.push(item);
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