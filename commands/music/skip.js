const music = require("../../modules/music.js");

exports.cmd = new Oxyl.Command("skip", async message => {
	let manager = music.getManager(message.channel.guild);
	if(!manager) {
		return "There is currently no music playing";
	} else if(!manager.voiceCheck(message.member)) {
		return "You must be in the music channel to run this command";
	} else {
		let next = manager.data.queue[0];

		if(next) {
			manager.connection.stopPlaying();
			return `Now playing __${next.title}__ :arrow_forward:`;
		} else {
			manager.end();
			return "Song skipped, no songs in queue. Music ended.";
		}
	}
}, {
	guildOnly: true,
	type: "music",
	description: "Skip a song in your channel"
});
