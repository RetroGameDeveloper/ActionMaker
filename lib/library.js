import { Decoder } from './coder.js';

export const ACT_KINDS = {
	NORMAL: 0, BEGIN_GROUP: 1, END_GROUP: 2, ELSE: 3,
	EXIT: 4, REPEAT: 5, VARIABLE: 6, CODE: 7,
	PLACEHOLDER: 8, SEPARATOR: 9, LABEL: 10
};

export const ACT_EXEC_TYPES = {
	NONE: 0, FUNCTION: 1, CODE: 2
};

export const ACT_IFACE_KINDS = {
	NORMAL: 0, NONE: 1, ARROWS: 2, CODE: 5, TEXT: 6
};

export const ARG_KINDS = {
	EXPRESSION: 0, STRING: 1, BOTH: 2, BOOLEAN: 3,
	MENU: 4, SPRITE: 5, SOUND: 6, BACKGROUND: 7,
	PATH: 8, SCRIPT: 9, OBJECT: 10, ROOM: 11,
	FONT: 12, COLOR: 13, TIMELINE: 14, FONT_STRING: 15
};

export const OAEpoch = new Date(1899,11,29,23,59,59).getTime();
export const msInDay = 24 * 60 * 60 * 1000;

export default {
	MAX_ARGS: 6,

	randomId() {
		return Math.floor(Math.random() * 999000) + 1000;
	},

	fromOADate(date) {
		return new Date((date * msInDay) + OAEpoch);
	},

	toOADate(date) {
		return (date - OAEpoch) / msInDay;
	},

	OADateNow() {
		return this.toOADate(Date.now());
	},

	newLibrary() {
		var library = {
			caption: 'New Library',
			id: this.randomId(),
			advanced: false,
			author: '',
			version: 100,
			changed: this.OADateNow(),
			info: 'Here you can enter basic information about your library and what it does.\n',
			init: [
				'/**',
				' * This code will be executed when your library is loaded.',
				' */',
				'{',
				'\t// say something',
				'\tshow_message("Hello, World!");',
				'}',
				''
			].join('\n'),
			actions: [],
		};
		return library;
	},

	padArgumentList(args) {
		for (var i = args.length; i < this.MAX_ARGS; ++i) {
			args.push({
				caption: "Argument " + i + ":",
				kind: ARG_KINDS.EXPRESSION,
				default: "0",
				options: "item 1|item 2"
			});
		}
	},

	newAction(library) {
		var action = {
			parent: library,
			name: "Action " + library.actions.length,
			id: library.actions.length,
			image: 'icons/blank-tile.png',
			hidden: false,
			advanced: false,
			registered: false,
			description: '',
			list: '',
			hint: '',
			kind: ACT_KINDS.NORMAL,
			ifaceKind: ACT_IFACE_KINDS.NORMAL,
			question: false,
			apply: false,
			relative: false,

			argnum: 0,
			args: [],

			execType: ACT_EXEC_TYPES.FUNCTION,
			execInfo: ''
		};
		this.padArgumentList(action.args);
		return action;
	},

	deserializeLIB(data, version) {
		var ver = data[3];
		if (ver) {
			throw "Expected 0 @ 3 got " + ver;
		}
		var lib = { };
		var decoder = new Decoder(data, 4);

		lib.caption = decoder.readStr();
		lib.id = decoder.read4();
		lib.author = decoder.readStr();
		lib.version = decoder.read4();
		lib.changed = decoder.readD();
		lib.info = decoder.readStr();
		lib.init = decoder.readStr();
		lib.advanced = decoder.readBool();
		decoder.skip(4); // skip no of actions/official lib identifier thingy
		var acts = decoder.read4();
		lib.actions = [];
		for (var i = 0; i < acts; i++) {
			var ver = decoder.read4();
			if (ver != 500 && ver != 520) {
				throw "Action #" + i + " failed to have 500 or 520 got " + ver;
			}
			var act = { parent: lib };
			lib.actions.push(act);

			act.name = decoder.readStr();
			act.id = decoder.read4();
			act.image = "data:image/image;base64," + btoa(decoder.readStr());
			act.hidden = decoder.readBool();
			act.advanced = decoder.readBool();
			if (ver == 520) act.registered = decoder.readBool();
			act.description = decoder.readStr();
			act.list = decoder.readStr();
			act.hint = decoder.readStr();
			act.kind = decoder.read4();
			act.ifaceKind = decoder.read4();
			act.question = decoder.readBool();
			act.apply = decoder.readBool();
			act.relative = decoder.readBool();

			act.argnum = decoder.read4();
			var argnum = decoder.read4();
			act.args = [];
			for (var k = 0; k < argnum; k++) {
				if (k < this.MAX_ARGS) {
					act.args.push({
						caption: decoder.readStr(),
						kind: decoder.read4(),
						default: decoder.readStr(),
						options: decoder.readStr()
					});
				} else {
					decoder.skip(decoder.read4());
					decoder.skip(4);
					decoder.skip(decoder.read4());
					decoder.skip(decoder.read4());
				}
			}

			act.execType = decoder.read4();
			if (act.execType === 'FUNCTION')
				act.execInfo = decoder.readStr();
			else
				decoder.skip(decoder.read4());
			if (act.execType === 'CODE')
				act.execInfo = decoder.readStr();
			else
				decoder.skip(decoder.read4());
		}

		return lib;
	},

	loadLGLIcons(lib, decoder) {
		var base64 = "data:image/image;base64," + btoa(decoder.readStrEnd());

		var img = new Image();
		img.crossOrigin = "Anonymous";
		img.onload = function() {
			var canvas = document.createElement("canvas");
			canvas.width = 24;
			canvas.height = 24;
			var ctx = canvas.getContext("2d");
			ctx.globalCompositeOperation = "copy";

			var i = 0;
			var columns = img.width / 24;
			for (action of lib.actions) {
				var kind = action.kind;
				if (kind != ACT_KINDS.PLACEHOLDER &&
					kind != ACT_KINDS.SEPARATOR &&
					kind != ACT_KINDS.LABEL) {
					ctx.drawImage(img, 24 * (i % columns), 24 * ((i / columns)|0), 24, 24, 0, 0, 24, 24);
					action.image = canvas.toDataURL();
					++i;
				} else {
					action.image = "icons/blank-tile.png";
				}
			}
		};
		img.src = base64;

		return lib;
	},

	deserializeLGL(data) {
		var ver = (data[3] | data[4] << 8);
		if (ver != 160) {
			throw "Expected 160 @ 3 got " + ver;
		}
		var lib = { };
		var decoder = new Decoder(data, 5);

		lib.id = decoder.read3();
		lib.caption = decoder.readStr1();
		lib.author = decoder.readStr1();
		lib.version = decoder.read4();
		lib.changed = decoder.readD();
		lib.info = decoder.readStr();
		lib.init = decoder.readStr();
		var acts = decoder.read1();
		lib.advanced = !!(acts & 128);
		acts &= 127;
		lib.actions = [];
		for (var i = 0; i < acts; i++) {
			var ver = decoder.read2();
			if (ver != 160) {
				throw "Action #" + i + " failed to have 160 got " + ver;
			}
			var act = { parent: lib, image: undefined };
			lib.actions.push(act);

			act.id = decoder.read2();
			act.name = decoder.readStr1();
			act.description = decoder.readStr1();
			act.list = decoder.readStr1();
			act.hint = decoder.readStr1();

			var tags = decoder.read1();
			act.hidden = !!(tags & 128);
			act.advanced = !!(tags & 64);
			act.registered = !!(tags & 32);
			act.question = !!(tags & 16);
			act.apply = !!(tags & 8);
			act.relative = !!(tags & 4);
			act.execType = tags & 3;
			act.execInfo = decoder.readStr();
			tags = decoder.read1();
			act.kind = tags >> 4;
			act.ifaceKind = tags & 15;

			var argnum = decoder.read1();
			act.argnum = argnum;
			act.args = [];
			for (var k = 0; k < argnum; k++) {
				act.args.push({
					caption: decoder.readStr1(),
					kind: decoder.read1(),
					default: decoder.readStr1(),
					options: decoder.readStr1()
				});
			}
			this.padArgumentList(act.args);
		}

		return this.loadLGLIcons(lib, decoder);
	},

	deserialize(file, onload) {
		if (!file) return;

		var reader = new FileReader();
		var ext = file.name.split('.').pop().toLowerCase();

		reader.onload = (e) => {
			var data = new Uint8Array(reader.result);
			var header = data[0] | data[1] << 8 | data[2] << 16;
			if (header == 500 || header == 520) {
				onload(this.deserializeLIB(data, header));
			} else if (header == 4998988) {
				onload(this.deserializeLGL(data));
			} else {
				throw "Unknown header: " + header;
			}
		}

		reader.readAsArrayBuffer(file);
	}
}