#!/usr/bin/env node
var request = require('request');
var isRestarting = false;
const lastUpdatedDate = Math.floor(new Date() / 1000);
var updateCheckInterval = 1000 * 60 * 5; // Check each 15 min
const RUST_OXIDE_ENABLED = process.env.RUST_OXIDE_ENABLED | true;
var WebSocket = require('ws');

/**
 * server update -> wait for client update -> wait max 60 min for oxide update -> update
 */
async function Scenario1(){
	await waitForServerAndClientUpdate();
	if (!RUST_OXIDE_ENABLED) {
		triggerRestart(); 
	} else {
		//If more then 60min passes force the update anyway.
		const catchTimeout = setTimeout(async () => {
			triggerRestart();
		}, 1000*60*60);
		await waitForOxideUpdate();
		clearTimeout(catchTimeout);
		triggerRestart(); 
	}
}

/**
 * oxide update -> update
 */
async function Scenario2(){
	if (RUST_OXIDE_ENABLED) {
		await waitForOxideUpdate();
		triggerRestart();
	}
}
Scenario1();
Scenario2();

async function waitForOxideUpdate(){
	return new Promise((resolve, reject) => {
		setTimeout(async () => {
			try{
				const oxideUpdateIsOut = await checkForOxideUpdate();
				if(!oxideUpdateIsOut){
					await waitForOxideUpdate();
				}
				resolve();
			}catch(e){}
		}, updateCheckInterval);
	});
}

function checkForOxideUpdate() {
	return new Promise((resolve, reject) => {
		console.log('UpdateApp:: Checking if an oxide update is available..');
		request(
			{
				url: 'https://api.github.com/repos/theumod/uMod.Rust/releases/latest',
				headers: { Referer: 'rust-docker-server', 'User-Agent': 'Blackhawk' },
				timeout: 10000
			},
			function(error, response, body) {
				if (!error && response.statusCode === 200) {
					var info = JSON.parse(body);
					var published_at = Math.floor(new Date('' + info.published_at) / 1000);
					if (published_at !== undefined) {
						if (published_at >= lastUpdatedDate) {
							console.log('UpdateApp:: Oxide update is out');
							resolve(true);
							return;
						}
					}
					resolve(false);
					return;
				}
				if (error != null) {
					console.log('UpdateApp:: Error for checkForOxideUpdate: ' + error);
					reject(error);
				} else {
					console.log(
						'UpdateApp:: Response error for checkForOxideUpdate: ' +
							response.statusCode
					);
					reject(response);
				}
			}
		);
	});
}

async function waitForServerAndClientUpdate(){
	return new Promise((resolve, reject) => {
		setTimeout(async () => {
			try{
				const {server} = await checkForRustUpdate();
				if(!server && !client){
					await waitForServerAndClientUpdate();
				}
			}catch(e){
				await waitForServerAndClientUpdate();
			}
			resolve();
		}, updateCheckInterval);
	});
}

function checkForRustUpdate(){
	const checkForServerUpdate = (info) => {
		var serverUpdates = info.serverUpdates;
		//Assure asc timestamp order
		serverUpdates = serverUpdates.sort(function(a, b) {
			return a.timestamp - b.timestamp;
		});
		const lastServerUpdate = serverUpdates[serverUpdates.length - 1];
	
		if (lastServerUpdate !== undefined) {
			if (lastServerUpdate >= lastUpdatedDate) {
				return true;
			}
		}
		return false;
	}
	const checkForClientUpdate = (info) => {
		var latest = info.latest;
		if (latest !== undefined) {
			if (latest >= lastUpdatedDate) {
				return true;
			}
		}
		return false;
	}
	return new Promise((resolve, reject) => {
		request(
			{
				url: 'https://whenisupdate.com/api.json',
				headers: { Referer: 'rust-docker-server' },
				timeout: 10000
			},
			function(error, response, body) {
				if (!error && response.statusCode === 200) {
					var info = JSON.parse(body);
					const newServerUpdate = checkForServerUpdate(info);
					const newClientUpdate = checkForClientUpdate(info);
					resolve({client: newClientUpdate, server: newServerUpdate});
					return;
				} 
				if (error != null) {
					console.log('UpdateApp:: Error for checkForRustUpdate: ' + error);
					reject(error);
				} else {
					console.log(
						'UpdateApp:: Response error for checkForRustUpdate: ' +
							response.statusCode
					);
					reject(response);
				}
			}
		);
	});
}



function webSocketCommand(rconCommand){
	let connectionString =
		'ws://' + serverHostname + ':' + serverPort + '/' + serverPassword;
	console.log('AutoWipeApp:: RCON connecting to server ' + connectionString);
	console.log(`AutoWipeApp:: RCON giving command ${rconCommand}`);
	var ws = new WebSocket(connectionString);
	ws.on('open', function open() {
		console.log('AutoWipeApp:: RCON connection opened, transmitting players');
		ws.send(
			createPacket(rconCommand),
			(err) => {
				ws.close(); 
			}
		);
	});

	ws.on('close', function close() {
		console.log('AutoWipeApp:: RCON connection closed');
	});
	ws.on('error', function (err) {
		console.log('AutoWipeApp:: RCON - ', err);
	});
}

function triggerRestart() {
	if(isRestarting){
		return;
	}
	isRestarting = true;
	console.log('UpdateApp:: Restarting..');
	var serverHostname = 'localhost';
	var serverPort = process.env.RUST_RCON_PORT;
	var serverPassword = process.env.RUST_RCON_PASSWORD;

	var ws = new WebSocket(
		'ws://' + serverHostname + ':' + serverPort + '/' + serverPassword
	);
	ws.on('open', function open() {
		setTimeout(function() {
			webSocketCommand(
				'say "<color=red>NOTICE</color>: New update is out, we are therefore updating the server in <color=orange>5 minutes</color>, so get to a safe spot!"'
			);
			setTimeout(function() {
				webSocketCommand(
					'say "<color=red>NOTICE</color>: Updating the server in <color=orange>4 minutes</color>, so get to a safe spot!"'
				);
				setTimeout(function() {
					webSocketCommand(
						'say "<color=red>NOTICE</color>: Updating the server in <color=orange>3 minutes</color>, so get to a safe spot!"'
					);
					setTimeout(function() {
						webSocketCommand(
							'say "<color=red>NOTICE</color>: Updating the server in <color=orange>2 minutes</color>, so get to a safe spot!"'
						);
						setTimeout(function() {
							webSocketCommand(
								'say "<color=red>NOTICE</color>: Updating the server in <color=orange>1 minutes</color>, so get to a safe spot!"'
							);
							setTimeout(function() {
								webSocketCommand(
									'global.kickall "" "<color=orange>Updating server, cya in a few!</color>"'
								);
								setTimeout(function() {
									webSocketCommand('quit');
									// ws.send(createPacket("restart 60")); // NOTE: Don't use restart, because that doesn't actually restart the container!
									setTimeout(function() {
										// After 2 minutes, if the server's still running, forcibly shut it down
										setTimeout(function() {
											var childProcess = require('child_process');
											childProcess.execSync('kill -s 2 $(pidof bash)');
										}, 1000 * 60 * 2);
									}, 1000);
								}, 1000);
							}, 1000 * 60);
						}, 1000 * 60);
					}, 1000 * 60);
				}, 1000 * 60);
			}, 1000 * 60);
		}, 1000);
	});
}

function createPacket(command) {
	var packet = {
		Identifier: -1,
		Message: command,
		Name: 'WebRcon'
	};
	return JSON.stringify(packet);
}
