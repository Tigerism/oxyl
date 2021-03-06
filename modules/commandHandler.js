const validator = require("../modules/commandArgs.js");
const prefixes = exports.prefixes = {};
const musicchannels = exports.musicchannels = {};
const blacklist = exports.blacklist = [];
const cleverchannels = exports.clever = [];
const ignored = exports.ignored = [];
// wait for connection
exports.updateThings = async () => {
	let prefixArray = await framework.dbQuery("SELECT * FROM `Settings` WHERE `NAME` = 'prefix'");
	prefixArray.forEach(data => {
		prefixes[data.ID] = data.VALUE;
	});

	let blacklistedUsers = await framework.dbQuery("SELECT * FROM `Blacklist`");
	blacklistedUsers.forEach(data => {
		blacklist.push(data.USER);
	});

	let cleverChannels = await framework.dbQuery("SELECT * FROM `Settings` WHERE `NAME` = 'cleverbot'");
	cleverChannels.forEach(data => {
		cleverchannels.push(data.VALUE);
	});

	let musicChannels = await framework.dbQuery("SELECT * FROM `Settings` WHERE `NAME` = 'musicchannel'");
	musicChannels.filter(data => bot.guilds.has(data.ID) && bot.guilds.get(data.ID).channels.has(data.VALUE))
	.forEach(data => {
		musicchannels[data.ID] = bot.guilds.get(data.ID).channels.get(data.VALUE);
	});

	let ignoredChannels = await framework.dbQuery("SELECT `CHANNEL` FROM `Ignored`");
	ignoredChannels.forEach(data => {
		ignored.push(data.CHANNEL);
	});
};

const bot = Oxyl.bot,
	commands = Oxyl.commands;

bot.on("messageCreate", async (message) => {
	Oxyl.siteScripts.website.messageCreate(message);
	if(message.author.bot || blacklist.indexOf(message.author.id) !== -1) return;
	let guild = message.channel.guild;
	let msg = message.content.toLowerCase();

	let prefix = "^(oxyl|<@!?255832257519026178>),?(?:\\s+)?([\\s\\S]+)";
	if(guild && prefixes[guild.id]) prefix = `^(oxyl|<@!?255832257519026178>|${framework.escapeRegex(prefixes[guild.id])}),?(?:\\s+)?([\\s\\S]+)`;
	prefix = new RegExp(prefix, "i");

	let match = message.content.match(prefix);
	if(match && match[2]) {
		let type = match[1];
		message.content = match[2];

		let cmdInfo = framework.getCmd(message.content);
		var command = cmdInfo.cmd;
		if(command) {
			message.contentPreserved = cmdInfo.newContent;
			msg = message.contentPreserved.toLowerCase();
			message.content = msg;
		} else {
			if(!type.match(/<@!?255832257519026178>/)) return;
			message.channel.sendTyping();
			let clever = await framework.cleverResponse(msg);
			console.log(`CleverBot in ${guild ? guild.name : "DM"} by ${framework.unmention(message.author)}: ${message.content}`);
			message.channel.createMessage(clever).catch(err => err);
			return;
		}
	} else if(guild && cleverchannels.indexOf(message.channel.id) !== -1) {
		message.channel.sendTyping();
		let clever = await framework.cleverResponse(msg);
		console.log(`CleverBot in ${guild.name} by ${framework.unmention(message.author)}: ${message.content}`);
		message.channel.createMessage(clever).catch(err => err);
		return;
	} else {
		return;
	}

	if(command.onCooldown(message.author)) {
		message.channel.createMessage(`This command is on cooldown for you.`);
		return;
	} else if((command.guildOnly || command.perm || command.type === "admin" || command.type === "music") && !guild) {
		message.channel.createMessage(`This command can only be use in guilds (servers).`);
		return;
	} else if(command.type === "creator" && !framework.config.creators.includes(message.author.id)) {
		message.channel.createMessage(`Only creators of Oxyl can use this command.`);
		return;
	} else if(ignored.indexOf(message.channel.id) !== -1 && framework.guildLevel(message.member) < 3) {
		return;
	} else if(command.type === "admin" && framework.guildLevel(message.member) < 3) {
		message.channel.createMessage(`Only the guld owner, or users with the ADMINISTRATOR permission can use this command.`);
		return;
	} else if(command.type === "music" && musicchannels[guild.id] && musicchannels[guild.id].id !== message.channel.id) {
		message.channel.createMessage("You cannot use music commands in this channel.");
		return;
	} else if(command.perm && !message.member.permission.has(command.perm)) {
		message.channel.createMessage(`You do not have valid permissions for this command (Requires ${command.perm}).`);
		return;
	}

	let arguments = message.contentPreserved.split(" ", command.args.length);
	let spaceCount = message.contentPreserved.match(/ /g);
	if(spaceCount && arguments && arguments.length <= spaceCount.length) {
		let i = framework.nthIndex(message.contentPreserved, " ", arguments.length);
		arguments[arguments.length - 1] += message.contentPreserved.substring(i);
	}
	message.argsUnparsed = arguments;
	message.argsPreserved = [];

	try {
		var validated = await validateArgs(message, command);

		message = validated;
		message.args = message.argsPreserved.map(ele => {
			if(typeof ele === "string") return ele.toLowerCase();
			else return ele;
		});

		try {
			console.log(`${command.name} in ${guild ? guild.name : "DM"} by ${framework.unmention(message.author)}: ${message.contentPreserved || "no args"}`);
			var result = await command.run(message);

			msg = { content: "" };
			let file;

			if(Array.isArray(result)) {
				msg.content = result[0];
				file = result[1];
			} else if(typeof result === "object") {
				msg = result;
			} else if(result) {
				msg.content = result;
			} else {
				msg = false;
			}

			if(msg) {
				if(msg.content) msg.content = msg.content.substring(0, 2000);
				try {
					var resultmsg = await message.channel.createMessage(msg, file || null);
				} catch(err) {
					message.channel.createMessage("Error sending message");
				}
			}
		} catch(error) {
			framework.consoleLog(`Failed command ${command.name} (${command.type})\n` +
				`**Error:** ${framework.codeBlock(error.stack || error)}`, "debug");
			message.channel.createMessage("Bot error when executing command, error sent to Support Server");
		}
	} catch(err) {
		message.channel.createMessage(err.toString());
	}
});

async function checkArg(input, arg, message) {
	if(!input && arg.optional) {
		return input;
	} else if(!input && arg.type !== "custom") {
		throw new Error(`No value given for ${arg.label} (type: ${arg.type})`);
	} else {
		return await validator.test(input, arg, message);
	}
}

async function validateArgs(message, command, index = 0) {
	if(index >= command.args.length) return message;
	try {
		var newArg = await checkArg(message.argsUnparsed[index], command.args[index], message);
		message.argsPreserved[index] = newArg;
		return await validateArgs(message, command, index + 1);
	} catch(err) {
		throw new Error(err.toString().replace("Error:", ""));
	}
}
