#!/usr/bin/env node

var serverHostname = 'localhost'
var serverPort = process.env.RUST_RCON_PORT
var serverPassword = process.env.RUST_RCON_PASSWORD

console.log('ShutdownApp::RCON connecting to server')

var WebSocket = require('ws')
var ws = new WebSocket('ws://' + serverHostname + ':' + serverPort + '/' + serverPassword)
ws.on('open', function open () {
  console.log('ShutdownApp::RCON connection opened')
  setTimeout(function () {
    console.log('ShutdownApp::RCON sending out warning about shutdown in 5 minutes');
    ws.send(createPacket('say "<color=red>NOTICE</color>: We are updating our rust servers in 5 minutes, so get to a safe area! Sorry for the inconvenience."'));
    setTimeout(function () {
      console.log('ShutdownApp::RCON sending out warning about shutdown in 30 seconds');
      ws.send(createPacket('say "<color=red>NOTICE</color>: We are updating our rust server in 30 seconds, so get to a safe area! Sorry for the inconvenience. We will be right back."'));
      setTimeout(function () {
        ws.send(createPacket('say "<color=red>NOTICE</color>: Updating, cya in a bit!"'));
          setTimeout(function () {
          console.log('ShutdownApp::RCON sending "save" command');
          ws.send(createPacket('kickall "" "The rust server is updating, we are right back!"'));
          ws.send(createPacket('save'));
          setTimeout(function () {
            console.log('ShutdownApp::RCON sending "quit" command')
            ws.send(createPacket('quit'));
            setTimeout(function () {
              console.log('ShutdownApp::RCON terminating')
              ws.close(1000)
            }, 1000)
          }, 1000)
        }, 5000)
      }, 30000)
    }, (1000*60*5-30000))
  }, 1000)
})
ws.on('close', function close () {
  console.log('ShutdownApp::RCON connection closed')
  process.exit(0)
})
ws.on('error', function (err) {
  console.log('ShutdownApp::RCON error:', err)
  process.exit(1)
})

function createPacket (command) {
  var packet =
  {
    Identifier: -1,
    Message: command,
    Name: 'WebRcon'
  }
  return JSON.stringify(packet)
}
