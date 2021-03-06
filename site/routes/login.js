const express = require("express"),
	request = require("request"),
	main = require("../website.js");
const router = express.Router(); // eslint-disable-line new-cap
const tokens = main.tokens;

router.get("/", async (req, res) => {
	let data = {
		client_id: framework.config.botid, // eslint-disable-line camelcase
		client_secret: framework.config.private.secret, // eslint-disable-line camelcase
		code: req.query.code,
		redirect_uri: "https://minemidnight.work/login", // eslint-disable-line camelcase
		grant_type: "authorization_code" // eslint-disable-line camelcase
	};

	request.post({
		url: "https://discordapp.com/api/oauth2/token",
		form: data
	}, (err, httpResponse, body) => {
		if(err) {
			req.redirect("https://discordapp.com/oauth2/authorize?response_type=code&redirect_uri=" +
									"https://minemidnight.work/login&scope=identify+guilds&client_id=255832257519026178");
		} else {
			body = JSON.parse(body);
			tokens[req.sessionID] = {
				token: body.access_token,
				session: req.sessionID,
				time: Date.now(),
				refresh: body.refresh_token
			};
		}
		res.redirect(`http://minemidnight.work/select`);
	});
});

module.exports = router;
