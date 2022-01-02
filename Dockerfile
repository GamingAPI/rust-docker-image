FROM didstopia/base:nodejs-12-steamcmd-ubuntu-18.04

LABEL Maintainer="Didstopia <support@didstopia.com>"

# Fix apt-get warnings
ARG DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    nginx \
    git-core \
    expect \
    tcl \
    cron \
    dos2unix \
    libsdl2-2.0-0:i386 \
    libgdiplus && \
    rm -rf /var/lib/apt/lists/*

# Set timezone 
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install tzdata

ENV TZ=Europe/Copenhagen
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Remove default nginx stuff
RUN rm -fr /usr/share/nginx/html/* && \
    rm -fr /etc/nginx/sites-available/* && \
    rm -fr /etc/nginx/sites-enabled/*

# Install webrcon (specific commit)
COPY nginx_rcon.conf /etc/nginx/nginx.conf
RUN curl -sL https://github.com/Facepunch/webrcon/archive/24b0898d86706723d52bb4db8559d90f7c9e069b.zip | bsdtar -xvf- -C /tmp && \
    mv /tmp/webrcon-24b0898d86706723d52bb4db8559d90f7c9e069b/* /usr/share/nginx/html/ && \
    rm -fr /tmp/webrcon-24b0898d86706723d52bb4db8559d90f7c9e069b

# Customize the webrcon package to fit our needs
ADD fix_conn.sh /tmp/fix_conn.sh

# Create and set the steamcmd folder as a volume
RUN mkdir -p /steamcmd/rust
VOLUME ["/steamcmd/rust"]

# Setup proper shutdown support
ADD shutdown_app/ /shutdown_app/
WORKDIR /shutdown_app
RUN npm install

# Setup proper auto wipe support
ADD autowipe_app/ /autowipe_app/
WORKDIR /autowipe_app
RUN npm install

# Setup update checker
ADD update_app/ /update_app/
WORKDIR /update_app
RUN npm install

# Setup rcon command relay app
ADD rcon_app/ /rcon_app/
WORKDIR /rcon_app
RUN npm install
RUN ln -s /rcon_app/app.js /usr/bin/rcon

# Add the steamcmd installation script
ADD install.txt /install.txt

# Copy the Rust startup script
ADD start_rust.sh /start.sh

# Copy extra files
COPY README.md LICENSE.md /

# Set the current working directory
WORKDIR /

# Ensure all script files has unix extensions
RUN find . -name "*.sh" -type f -exec dos2unix {} \;

# Setup default environment variables for the server
ENV RUST_SERVER_STARTUP_ARGUMENTS "-batchmode -load -nographics +server.secure 1"
ENV RUST_SERVER_IDENTITY "Test"
ENV RUST_SERVER_PORT "28015"
ENV RUST_SERVER_IP "0.0.0.0"
ENV RUST_SERVER_TAGS "vanilla"
# ENV RUST_SERVER_SEED "12345"
# ENV RUST_SERVER_NAME "Test"
# ENV RUST_SERVER_DESCRIPTION "Test"
# ENV RUST_SERVER_URL "https://www.test.com/"
# ENV RUST_SERVER_BANNER_URL "https://example.com/test.png"
ENV RUST_RCON_WEB "1"
ENV RUST_RCON_PORT "28016"
ENV RUST_RCON_PASSWORD "12345"
ENV RUST_UPDATE_CHECKING "1"
ENV RUST_UPDATE_BRANCH "public"
ENV RUST_START_MODE "0"
ENV RUST_OXIDE_ENABLED "1"
ENV RUST_APP_PORT "28082"
ENV RUST_OXIDE_UPDATE_ON_BOOT "1"
ENV RUST_SERVER_WORLDSIZE "4000"
ENV RUST_SERVER_MAXPLAYERS "50"
ENV RUST_SERVER_SAVE_INTERVAL "600"
ENV RUST_SERVER_LOCATION "/steamcmd/rust"
ENV SERVER_API_BASE_PATH "http://api:8524/api"
ENV RUST_SERVER_BAN_ENDPOINT "$SERVER_API_BASE_PATH"

# Auto wipe standard enabled
ENV RUST_AUTO_WIPING "1"
# How many days are a map wipe?
ENV MAP_WIPE_PERIOD "7"
# How many times should we do map wipe to do a full wipe?
ENV MAP_WIPES_UNTIL_FULL_WIPE "2"
# What hour of the day should we do wipe?
ENV WIPE_HOUR "17"
# What minute of the hour of the day should we do wipe?
ENV WIPE_MINUTE "0"
# Should we exclude wiping in force week?
ENV EXCLUDE_FORCE_WEEK "0"
# What day of the week do we want to wipe the server? 0 = monday, 6 = sunday 
ENV WIPE_DAY "0"

# Start the server
ENTRYPOINT ["./start.sh"]
