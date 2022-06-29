> DOCKER IMAGE BASED ON https://github.com/didstopia/rust-server WITH A WIDE RANGE OF MODIFICATIONS.

This docker image is the core of the game server. It is pre-packaged with all the necessary plugins and extensions to work with GamingAPI, however this can also be turned off in case you want to use this image in other contexts.

# Usages

## Docker

```
docker run -d
	-e RUST_RCON_PASSWORD='1234' \
	-e GAMINGAPI_SERVER_ID='101' \
	-e GAMINGAPI_NATS_NKEY_USER='UCI2NCSIEV3DXLYYR5KQXYCZ7CIW4KYXHLSGXJOZ7TSRRKHP2BM5IVMU' \
	-e GAMINGAPI_NATS_NKEY_SEED='SUAHZGQCK3PKMY5JBY2PBJUK2SA2IAGNX7VXYQJ75MLIU2IWQE235OBLJM' \
	-p 28016:28016 \
	-p 28015:28015 \
  -v ./rust:/steamcmd/rust \
	ghcr.io/gamingapi/rust-docker-image:latest
```

## Compose

```yml
version: '3.8'
services:
  rust:
    image: ghcr.io/gamingapi/rust-docker-image:latest
    environment:
      RUST_RCON_PASSWORD: '1234'
      GAMINGAPI_SERVER_ID: 101
      GAMINGAPI_NATS_NKEY_USER: 'UCI2NCSIEV3DXLYYR5KQXYCZ7CIW4KYXHLSGXJOZ7TSRRKHP2BM5IVMU'
      GAMINGAPI_NATS_NKEY_SEED: 'SUAHZGQCK3PKMY5JBY2PBJUK2SA2IAGNX7VXYQJ75MLIU2IWQE235OBLJM'
    volumes:
      - './rust:/steamcmd/rust'
    ports:
      - 28016:28016
      - 28015:28015
```

# Rust server that runs inside a Docker container

---

**NOTE**: This image will install/update on startup. The path `/steamcmd/rust` can be mounted on the host for data persistence.
Also note that this image provides the new web-based RCON, so you should set `RUST_RCON_PASSWORD` to a more secure password.
This image also supports having a modded server (using Oxide), check the `RUST_OXIDE_ENABLED` variable below.

# How to run the server

1. Set the environment variables you wish to modify from below (note the RCON password!)
2. Optionally mount `/steamcmd/rust` somewhere on the host or inside another container to keep your data safe
3. Enjoy!

The following environment variables are available:

```
RUST_SERVER_STARTUP_ARGUMENTS (DEFAULT: "-batchmode -load -nographics +server.secure 1")
RUST_SERVER_IDENTITY (DEFAULT: "docker" - Mainly used for the name of the save directory)
RUST_SERVER_SEED (DEFAULT: "12345" - The server map seed, must be an integer)
RUST_SERVER_WORLDSIZE (DEFAULT: "4000" - The map size, must be an integer)
RUST_SERVER_NAME (DEFAULT: "Rust Server [DOCKER]" - The publicly visible server name)
RUST_SERVER_MAXPLAYERS (DEFAULT: "500" - Maximum players on the server, must be an integer)
RUST_SERVER_DESCRIPTION (DEFAULT: "This is a Rust server running inside a Docker container!" - The publicly visible server description)
RUST_SERVER_URL (The publicly visible server website)
RUST_SERVER_BANNER_URL (DEFAULT: "" - The publicly visible server banner image URL)
RUST_SERVER_SAVE_INTERVAL (DEFAULT: "600" - Amount of seconds between automatic saves)
RUST_RCON_PORT (DEFAULT: "28016" - RCON server port)
RUST_RCON_PASSWORD (DEFAULT: "docker" - RCON server password, please change this!)
RUST_BRANCH (DEFAULT: Not set - Sets the branch argument to use, eg. set to "-beta prerelease" for the prerelease branch)
RUST_UPDATE_CHECKING (DEFAULT: "0" - Set to 1 to enable fully automatic update checking, notifying players and restarting to install updates)
RUST_UPDATE_BRANCH (DEFAULT: "public" - Set to match the branch that you want to use for updating, ie. "prerelease" or "public", but do not specify arguments like "-beta")
RUST_START_MODE (DEFAULT: "0" - Determines if the server should update and then start (0), only update (1) or only start (2))
RUST_OXIDE_ENABLED (DEFAULT: "1" - Set to 1 to automatically install the latest version of Oxide)
RUST_OXIDE_UPDATE_ON_BOOT (DEFAULT: "1" - Set to 0 to disable automatic update of Oxide on boot)
INSTALL_GAMINGAPI (DEFAULT: "1" - Set to 1 to automatically install the latest version of Oxide)
GAMINGAPI_NATS_SERVER_HOST
GAMINGAPI_SERVER_ID (The server id of the rust server, you can find this value in the )
GAMINGAPI_NATS_NKEY_USER (The user nkey the GamingAPI NATS broker)
GAMINGAPI_NATS_NKEY_SEED (The seed nkey the GamingAPI NATS broker)
RUST_AUTO_WIPING (DEFAULT: "1" - Set to 1 to enable auto wipe functionality)
MAP_WIPE_PERIOD (DEFAULT: "7" - How many days are a map wipe?)
MAP_WIPES_UNTIL_FULL_WIPE (DEFAULT: "2" - How many times should we do map wipe before doing a full wipe?)
WIPE_HOUR (DEFAULT: "17" - What hour of the day should we do wipe?)
WIPE_MINUTE (DEFAULT: "0" - What minute of the hour of the day should we do wipe?)
EXCLUDE_FORCE_WEEK (DEFAULT: "0" - Should we exclude wiping in force week?)
WIPE_DAY (DEFAULT: "0" - What day of the week do we want to wipe the server? 0 = monday, 6 = sunday)
```

# Logging and rotating logs

The image now supports log rotation, and all you need to do to enable it is to remove any `-logfile` arguments from your startup arguments.
Log files will be created under `logs/` with the server identity and the current date and time.
When the server starts up or restarts, it will move old logs to `logs/archive/`.
