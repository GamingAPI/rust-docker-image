#!/usr/bin/env bash

# Enable debugging
# set -x

# Define the exit handler
exit_handler()
{
	echo "Shutdown signal received"

	# Execute the RCON shutdown command
	node /shutdown_app/app.js
	#sleep 5

	# Stop the web server
	pkill -f nginx

	# Forcefully terminate Rust
	#kill -TERM "$child"

	echo "Exiting.."
	exit
}

wait_pid () 
{
	wait "$1"
} 

# Trap specific signals and forward to the exit handler
#trap 'exit_handler' SIGHUP SIGINT SIGQUIT SIGTERM
trap 'exit_handler' SIGINT SIGTERM

# Define the install/update function
install_or_update()
{
	# Install Rust from install.txt
	echo "Installing or updating Rust.. (this might take a while, be patient)"
	bash /steamcmd/steamcmd.sh +runscript /install.txt

	# Terminate if exit code wasn't zero
	if [ $? -ne 0 ]; then
		echo "Exiting, steamcmd install or update failed!"
		exit 1
	fi
}

# Create the necessary folder structure
if [ ! -d "/steamcmd/rust" ]; then
	echo "Missing /steamcmd/rust, creating.."
	mkdir -p /steamcmd/rust
fi
if [ ! -d "/steamcmd/rust/server/${RUST_SERVER_IDENTITY}" ]; then
	echo "Missing /steamcmd/rust/server/${RUST_SERVER_IDENTITY}, creating.."
	mkdir -p "/steamcmd/rust/server/${RUST_SERVER_IDENTITY}"
	mkdir -p "/steamcmd/rust/server/${RUST_SERVER_IDENTITY}/cfg"
fi
if [ ! -d "/steamcmd/rust/server/${RUST_SERVER_IDENTITY}/cfg" ]; then
	echo "Missing /steamcmd/rust/server/${RUST_SERVER_IDENTITY}/cfg, creating.."
	mkdir -p "/steamcmd/rust/server/${RUST_SERVER_IDENTITY}/cfg"
fi

# Fix ownership
chown -R $(whoami):$(whoami) /steamcmd/rust


# Install/update steamcmd
echo "Installing/updating steamcmd.."
curl -s http://media.steampowered.com/installer/steamcmd_linux.tar.gz | tar -v -C /steamcmd -zx

# Check which branch to use
if [ ! -z ${RUST_BRANCH+x} ]; then
	echo "Using branch arguments: $RUST_BRANCH"

	# Add "-beta" if necessary
	INSTALL_BRANCH="${RUST_BRANCH}"
	if [ ! "$RUST_BRANCH" == "public" ]; then
	    INSTALL_BRANCH="-beta ${RUST_BRANCH}"
	fi
	sed -i "s/app_update 258550.*validate/app_update 258550 $INSTALL_BRANCH validate/g" /install.txt
else
	sed -i "s/app_update 258550.*validate/app_update 258550 validate/g" /install.txt
fi

# Disable auto-update if start mode is 2
if [ "$RUST_START_MODE" = "2" ]; then
	# Check that Rust exists in the first place
	if [ ! -f "/steamcmd/rust/RustDedicated" ]; then
		install_or_update
	else
		echo "Rust seems to be installed, skipping automatic update.."
	fi
else
	install_or_update
fi

# Rust includes a 64-bit version of steamclient.so, so we need to tell the OS where it exists
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/steamcmd/rust/RustDedicated_Data/Plugins/x86_64

# Check if Oxide is enabled
if [ "$RUST_OXIDE_ENABLED" = "1" ]; then
	# Next check if Oxide doesn't' exist, or if we want to always update it
	INSTALL_OXIDE="0"
	if [ ! -f "/steamcmd/rust/CSharpCompiler.x86_x64" ]; then
		INSTALL_OXIDE="1"
	fi
	if [ "$RUST_OXIDE_UPDATE_ON_BOOT" = "1" ]; then
		INSTALL_OXIDE="1"
	fi

	# If necessary, download and install latest Oxide
	if [ "$INSTALL_OXIDE" = "1" ]; then
		echo "Downloading and installing latest Oxide.."
		OXIDE_URL=$(curl -sL https://api.github.com/repos/theumod/uMod.Rust/releases/latest | grep browser_download_url | cut -d '"' -f 4)
		curl -sL $OXIDE_URL | bsdtar -xvf- -C /steamcmd/rust/
		chmod 755 /steamcmd/rust/CSharpCompiler.x86_x64 2>&1 /dev/null

		## NOTE: Disabled until I have time to properly fix this
		#chown -R $PUID:$PGID /steamcmd/rust
	fi
fi


# Start mode 1 means we only want to update
if [ "$RUST_START_MODE" = "1" ]; then
	echo "Exiting, start mode is 1.."
	exit
fi

# Add RCON support if necessary
RUST_STARTUP_COMMAND=$RUST_SERVER_STARTUP_ARGUMENTS
if [ ! -z ${RUST_RCON_PORT+x} ]; then
	RUST_STARTUP_COMMAND="$RUST_STARTUP_COMMAND +rcon.port $RUST_RCON_PORT"
fi
if [ ! -z ${RUST_RCON_PASSWORD+x} ]; then
	RUST_STARTUP_COMMAND="$RUST_STARTUP_COMMAND +rcon.password $RUST_RCON_PASSWORD"
fi

if [ ! -z ${RUST_RCON_WEB+x} ]; then
	RUST_STARTUP_COMMAND="$RUST_STARTUP_COMMAND +rcon.web $RUST_RCON_WEB"
	if [ "$RUST_RCON_WEB" = "1" ]; then
		# Fix the webrcon (customizes a few elements)
		bash /tmp/fix_conn.sh

		# Start nginx (in the background)
		echo "Starting web server.."
		nginx
		NGINX=$!
		sleep 5
		#nginx -g "daemon off;" && sleep 5 ## Used for debugging nginx
	fi
fi

## Disable logrotate if "-logfile" is set in $RUST_STARTUP_COMMAND
LOGROTATE_ENABLED=1
RUST_STARTUP_COMMAND_LOWERCASE=`echo "$RUST_STARTUP_COMMAND" | sed 's/./\L&/g'`
if [[ $RUST_STARTUP_COMMAND_LOWERCASE == *" -logfile "* ]]; then
	LOGROTATE_ENABLED=0
fi

if [ "$LOGROTATE_ENABLED" = "1" ]; then
	echo "Log rotation enabled!"

	# Log to stdout by default
	RUST_STARTUP_COMMAND="$RUST_STARTUP_COMMAND -logfile /dev/stdout"
	echo "Using startup arguments: $RUST_SERVER_STARTUP_ARGUMENTS"

	# Create the logging directory structure
	if [ ! -d "/steamcmd/rust/logs/archive" ]; then
		mkdir -p /steamcmd/rust/logs/archive
	fi

	# Set the logfile filename/path
	DATE=`date '+%Y-%m-%d_%H-%M-%S'`
	RUST_SERVER_LOG_FILE="/steamcmd/rust/logs/$RUST_SERVER_IDENTITY"_"$DATE.txt"

	# Archive old logs
	echo "Cleaning up old logs.."
	mv /steamcmd/rust/logs/*.txt /steamcmd/rust/logs/archive | true
else
	echo "Log rotation disabled!"
fi

# Start the scheduler (only if update checking is enabled)
if [ "$RUST_UPDATE_CHECKING" = "1" ]; then
	echo "Starting update app.."
	node /update_app/app.js &
fi


# Set the working directory
cd /steamcmd/rust

# Start the auto wipe if enabled
if [ "$RUST_AUTO_WIPING" = "1" ]; then
	# #write out current crontab
	# crontab -l > mycron
	# # Write the cronjob to the file
	# echo "$RUST_MAP_AUTO_WIPING node /autowipe_app/app.js MapWipe" > mycron

	# # Check if we should do full wiping at some point
	# if [ ! -z ${RUST_FULL_AUTO_WIPING+x} ]; then
	# 	echo "$RUST_FULL_AUTO_WIPING node /autowipe_app/app.js PlayerWipe" >> mycron
	# fi
	# #install new cron file
	# crontab mycron
	# rm mycron
	# service cron reload
	
	if [ "$DEBUG_AUTO_WIPING" = "1" ]; then
		node --inspect-brk=0.0.0.0:29229 /autowipe_app/app.js &
		autowipe_app_pid=$!
	else
		node /autowipe_app/app.js &
		autowipe_app_pid=$!
	fi
fi

if [ ! -z ${RUST_SERVER_SEED+x} ]; then
	RUST_STARTUP_COMMAND="$RUST_STARTUP_COMMAND +server.seed \"$RUST_SERVER_SEED\""
else 
	if [ -f "/steamcmd/rust/server.seed" ]; then
		OLD_SEED="$(cat /steamcmd/rust/server.seed)"
		RUST_STARTUP_COMMAND="$RUST_STARTUP_COMMAND +server.seed \"$OLD_SEED\""
	else 
		echo "No specific seed sat, and nothing saved, generating new one"
		generatedSeed="$(shuf -i 1-4294967294 -n 1)"
		echo "Using $generatedSeed as seed"
		echo $generatedSeed > /steamcmd/rust/server.seed
		RUST_STARTUP_COMMAND="$RUST_STARTUP_COMMAND +server.seed \"$generatedSeed\""
	fi
fi

# Run the server
echo "Starting Rust.."
if [ "$LOGROTATE_ENABLED" = "1" ]; then
	eval "unbuffer /steamcmd/rust/RustDedicated $RUST_STARTUP_COMMAND +server.ip \"$RUST_SERVER_IP\" +server.tags \"$RUST_SERVER_TAGS\" +server.port \"$RUST_SERVER_PORT\" +server.identity \"$RUST_SERVER_IDENTITY\"  +server.hostname \"$RUST_SERVER_NAME\" +server.url \"$RUST_SERVER_URL\" +server.headerimage \"$RUST_SERVER_BANNER_URL\" +server.description \"$RUST_SERVER_DESCRIPTION\" +server.worldsize \"$RUST_SERVER_WORLDSIZE\" +server.maxplayers \"$RUST_SERVER_MAXPLAYERS\" +server.saveinterval \"$RUST_SERVER_SAVE_INTERVAL\" +server.bansServerEndpoint \"$RUST_SERVER_BAN_ENDPOINT\" +app.port "$RUST_APP_PORT" 2>&1 | grep --line-buffered -Ev '^\s*$|Filename' | tee $RUST_SERVER_LOG_FILE &" 
else
	eval "/steamcmd/rust/RustDedicated $RUST_STARTUP_COMMAND +server.ip \"$RUST_SERVER_IP\" +server.tags \"$RUST_SERVER_TAGS\" +server.port \"$RUST_SERVER_PORT\" +server.identity \"$RUST_SERVER_IDENTITY\"  +server.hostname \"$RUST_SERVER_NAME\" +server.url \"$RUST_SERVER_URL\" +server.headerimage \"$RUST_SERVER_BANNER_URL\" +server.description \"$RUST_SERVER_DESCRIPTION\" +server.worldsize \"$RUST_SERVER_WORLDSIZE\" +server.maxplayers \"$RUST_SERVER_MAXPLAYERS\" +server.saveinterval \"$RUST_SERVER_SAVE_INTERVAL\" +server.bansServerEndpoint \"$RUST_SERVER_BAN_ENDPOINT\" +app.port "$RUST_APP_PORT" 2>&1 &"
fi

rust_server_pid=$!
echo "Waiting for rust to quit"
wait_pid "$rust_server_pid"
echo "Waiting for autowipe app to quit"
timeout -k 10s 10s cat <( wait_pid "$autowipe_app_pid")
timeout_pid=$!
wait_pid "$timeout_pid"

# Kill nginx if we are quitting.
pkill -f nginx

echo "Exiting.."
exit