#!/usr/bin/env node

/**
 * This application is to enable auto wipe schedules and gracefully restart and wipe the server.
 * 
 * It waits (running in the background) until it's time to wipe the server.
 */

const fs = require('fs');
const WebSocket = require('ws');
const glob = require('glob');
const WipeScheduler = require('./lib/WipeScheduler');
const moment = require('moment-timezone');
const waitPromise = ms => new Promise(resolve => setTimeout(resolve, ms));
const getCurrentTime = () => { return moment().tz("Europe/Copenhagen"); }

const serverHostname = 'localhost';
const serverPort = process.env.RUST_RCON_PORT || 28018;
const serverPassword = process.env.RUST_RCON_PASSWORD || '1234';
const serverIdentity =
	process.env.RUST_SERVER_IDENTITY || 'TestServer';
const wipe_buffer = 1000*60*60; // 1 hour before, notify players
const rustFileLocation = process.env.RUST_SERVER_LOCATION;
const map_wipe_period = process.env.MAP_WIPE_PERIOD;
const map_wipes_until_full_wipe = process.env.MAP_WIPES_UNTIL_FULL_WIPE;
const wipe_hour = process.env.WIPE_HOUR;
const wipe_minute = process.env.WIPE_MINUTE;
const exclude_force_week = process.env.EXCLUDE_FORCE_WEEK;
const wipe_day = process.env.WIPE_DAY;

/**
 * Warn the players about how long time until we are doing a specific wipe
 */
async function warnPlayers(fullWipe, timeout){
  let minutesToWipe = Math.round(timeout/1000/60);
  console.log(`AutoWipeApp::${minutesToWipe} min till wipe, warning players`);
  if (fullWipe) {
    await webSocketCommand(
      `say "<color=red>NOTICE</color>: The server is full wiping in <color=orange>${minutesToWipe} Minute(s)</color>!"`
    );
  } else {
    await webSocketCommand(
      `say "<color=red>NOTICE</color>: The server is map wiping in <color=orange>${minutesToWipe} Minute(s)</color>!"`
    );
  }
}

/**
 * Notify to all the players that we are wiping.
 */
function gracefulWipe(fullWipe, timeoutToNotify){
	/**
	 * MUST BE RUN $timeoutToNotify ms BEFORE WIPING
	 */
	const notify = async (timeout) => {
		if(timeout <= 1000*60){
			// Do the last timeout
			await waitPromise(timeout);
			if (fullWipe) {
				await webSocketCommand(
					'global.kickall "" "<color=orange>Server is full wiping</color> It will be back shortly!"'
				);
			} else {
				await webSocketCommand(
					'global.kickall "" "<color=orange>Server is map wiping</color> It will be back shortly!"'
				);
			}
			console.log('AutoWipeApp:: RCON sending "quit" command');
			await webSocketCommand('quit');
			wipe(rustFileLocation, serverIdentity);
		} else {
      await warnPlayers(fullWipe, timeout);
			let newTimeout = timeout/2;
			setTimeout(() => {
				notify(newTimeout);
			}, newTimeout);
		}
	}
	notify(timeoutToNotify);
}

/**
 * Perform a WebRcon command
 */
function webSocketCommand(rconCommand){
  /**
   * Create a WebRcon package based on some command to run on the game server
   */
  const createPacket = (command) => {
    let packet = {
      Identifier: -1,
      Message: command,
      Name: 'WebRcon',
    };
    return JSON.stringify(packet);
  }
	return new Promise((resolve, reject) =>{
		let connectionString =
			'ws://' + serverHostname + ':' + serverPort + '/' + serverPassword;
		console.log('AutoWipeApp:: RCON connecting to server ' + connectionString);
		console.log(`AutoWipeApp:: RCON giving command ${rconCommand}`);
		let ws = new WebSocket(connectionString);
		let hasResolved = false;
		ws.on('open', function open() {
			console.log('AutoWipeApp:: RCON connection opened, transmitting command');
			ws.send(
				createPacket(rconCommand),
				(err) => {
					ws.close(); 
					if(!hasResolved){
						hasResolved = true;
						resolve();
					}
				}
			);
		});
	
		ws.on('close', function close() {
			console.log('AutoWipeApp:: RCON connection closed');
		});
		ws.on('error', function (err) {
			console.log('AutoWipeApp:: RCON - ', err);
			if(!hasResolved){
				hasResolved = true;
				resolve();
			}
		});
	});
}

/**
 * Wipe the game server, which automatically figure out whether to do a full or map wipe
 */
function wipe(rustFileLocation, serverIdentity) {
	console.log('AutoWipeApp:: Wiping map data');
	let map_wipe_status = wipeMap(rustFileLocation, serverIdentity);
	let should_full_wipe = wipeScheduler.shouldFullWipe(moment());
	if(map_wipe_status){
		if (should_full_wipe) {
			console.log('AutoWipeApp:: Wiping player data');
			wipePlayers(rustFileLocation, serverIdentity);
		}
	}else{
		console.log('AutoWipeApp:: Could not wipe map data');
	}
}
/**
 * Wipe the player data (full wipe)
 */
function wipePlayers(rustFileLocation, serverIdentity) {
	let files = glob.sync(`${rustFileLocation}/server/${serverIdentity}/*.db`);

	if (!files || files.length == 0) {
		console.log(
			'AutoWipeApp:: Could not wipe player data, files was not found.'
		);
		return;
	}
	deleteFiles(files);
}

/**
 * Figure out when the last wipe date was based on the saved game files
 */
function getLastWipeDate(rustFileLocation, serverIdentity) {
	let files = glob.sync(
		`${rustFileLocation}/server/${serverIdentity}/*.+(sav|map)?(.*)`
	);
	let lastWipeMonth = 12;
	let lastWipeDay = 12;
	for(let file in files){
		let stats = fs.statSync(file);
		let mTime = stats.mtime;
		let month = new Date(mTime).getUTCMonth();
		// 3 > 5
		if(lastWipeMonth < month){
			lastWipeMonth = month;
		}
		let day = new Date(mTime).getUTCDay();
		if(lastWipeDay < day){
			lastWipeDay = day;
		}
	}
	return `${lastWipeDay}/${lastWipeMonth}`;
}
/**
 * Do a map wipe (NOT FULL)
 */
function wipeMap(rustFileLocation, serverIdentity) {
	let files = glob.sync(
		`${rustFileLocation}/server/${serverIdentity}/*.+(sav|map)?(.*)`
	);

	// let stats = fs.statSync(files[0]);
	// let mTime = stats.mtime;
	// let currentTime = new Date().getCurrentTime();
	// if (currentTime - mTime < wipe_buffer) {
	// 	console.log(
	// 		`AutoWipeApp:: Could not wipe since last wipe was not older than ${
	// 			wipe_buffer / 1000
	// 		} min ago.`
	// 	);
	// 	return false;
	// }
	
	files.push("/steamcmd/rust/server.seed");
	deleteFiles(files);
	return true;
}
/**
 * Delete all relevant files 
 */
function deleteFiles(files) {
	for (const file of files) {
		console.log(`AutoWipeApp:: Deleting file : ${JSON.stringify(file)}`);
		try{
			fs.unlinkSync(file);
			if(fs.existsSync(file)){
				console.error(`AutoWipeApp:: File not deleted, trying again: ${JSON.stringify(file)}`);
				deleteFiles([file]);
			}
			console.log(`AutoWipeApp:: Done deleting file : ${JSON.stringify(file)}`);
		}catch(e){
			console.log(`AutoWipeApp:: Could not delete file : ${file}`);
			console.log(e);
		}
	}
}

process.env.LAST_WIPE_DATE = getLastWipeDate();

const wipeScheduler = new WipeScheduler(
	map_wipe_period,
	map_wipes_until_full_wipe,
	wipe_hour,
	wipe_minute,
	exclude_force_week,
	wipe_day
);
let current_time = getCurrentTime();
console.log(`AutoWipeApp:: Current time ${current_time.toString()}`);

let time_to_wipe = wipeScheduler.getTimeToNextWipe(current_time);
//If under 1 hour start notifying players
if(time_to_wipe < wipe_buffer){
	console.log(`AutoWipeApp:: Notifying players immediately ${time_to_wipe} ms until wipe`);
	gracefulWipe(wipeScheduler.shouldFullWipe(current_time), time_to_wipe);
} else {
	console.log(`AutoWipeApp:: Waiting ${time_to_wipe} ms until wipe`);
	setTimeout(() => {
		current_time = getCurrentTime();
		console.log(`AutoWipeApp:: Beginning wipe preparations`);
		gracefulWipe(wipeScheduler.shouldFullWipe(current_time), wipe_buffer);
	}, time_to_wipe-wipe_buffer);
}
