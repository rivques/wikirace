const MasterState = {
    HOME: "HOME",
    LOBBY: "LOBBY",
    PRERACE: "PRERACE",
    RACEACTIVE: "RACEACTIVE",
    POSTRACE: "POSTRACE"
}

const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/w/api.php';

let masterState = MasterState.HOME;
let isHosting = null; // null: not active, false: joined but not hosting, true: hosting
let hostPeer = undefined
let isJoining = false;
let clientPeer = undefined;
let clientConn = undefined;
let isReady = false;
let clientLeft = false;
let timeOffset = 0;
let startTime = 0;
let startUrl = "";
let endUrl = "";
let startName = "";
let endName = "";
let timerInterval = undefined;
let playerResults = [];

let players = [];

isWaitingOnStartSuggestions = false;
isWaitingOnEndSuggestions = false;

function setMasterState(newState) {
    masterState = newState;
    console.log("masterState: " + masterState);
    for (let state of Object.values(MasterState)) {
        if (state === newState) {
            document.getElementById(state.toLowerCase()).style.display = "block";
        } else {
            document.getElementById(state.toLowerCase()).style.display = "none";
        }
    }
    if(newState == MasterState.LOBBY){
        isReady = false;
        document.getElementById("ready-button").textContent = "Ready";
    } else if(newState == MasterState.PRERACE){
        document.getElementById("start-page").value = "";
        document.getElementById("end-page").value = "";
    }
}

document.getElementById("lobby-address").addEventListener("keyup", function(event) {
    addr = document.getElementById("lobby-address").value;
    if(addr === "") {
        document.getElementById("addr-show").textContent = ""
        document.getElementById("join-button").disabled = true;
    } else {
        document.getElementById("join-button").disabled = false;
        document.getElementById("addr-show").textContent = " at " + addr
    }
});

function generateId(){
    // concatenate 4 random choices from wordlist
    let id = "";
    for(let i = 0; i < 4; i++){
        id += wordList[Math.floor(Math.random() * wordList.length)];
        if(i != 3){
            id += "-";
        }
    }
    return id;
}

function joinGame(username, addr) {
    console.log("Joining game at " + addr + " with username " + username);
    isHosting = false;
    clientLeft = false;
    clientPeer = new Peer(generateId(), options={secure: true, debug: 2});
    document.getElementById("host-button").disabled = true;
    document.getElementById("join-button").disabled = true;
    document.getElementById("join-button").textContent = "Joining...";
    clientPeer.on("open", function(id) {
        console.log("Client peer id: " + id);
        clientConn = clientPeer.connect(addr);
        clientConn.on("open", function() {
            console.log("Connected to host");
            clientConn.send({
                type: "join",
                username: username
            });
            isJoining = true;
            // join request, etc
        });
        clientConn.on("data", function(data) {
            console.log("Received data from host: " + JSON.stringify(data));
            if(isJoining){
                if(data.type === "join-accept"){
                    console.log("Join accepted");
                    isJoining = false;
                    setMasterState(MasterState.LOBBY);
                    document.getElementById("lobbyID").textContent = addr
                }
                else if(data.type === "join-deny"){
                    console.log("Join denied");
                    isJoining = false;
                    document.getElementById("join-button").textContent = "Join Game";
                    document.getElementById("join-button").disabled = false;
                    document.getElementById("host-button").disabled = false;
                    document.getElementById("host-button").textContent = "Host Game (no address neeeded)";
                    document.getElementById("error").textContent = "Join error: " + data.reason;
                    document.getElementById("error").style.display = "block";
                }
            } else {
                switch(data.type){
                    case "player-update":
                        console.log("Player update");
                        document.getElementById("player-list").innerHTML = "";
                        document.getElementById("player-info").innerHTML = "";
                        data.players.forEach(element => {
                            // add each player, along with host and ready status, to #player-list
                            let player = document.createElement("li");
                            player.textContent = element.username;
                            if(element.isHost){
                                player.textContent += " (host)";
                            }
                            if(element.isReady){
                                player.style.color = "green";
                            } else {
                                player.style.color = "red";
                            }
                            document.getElementById("player-list").appendChild(player.cloneNode(true));              
                            document.getElementById("player-info").appendChild(player.cloneNode(true));
                        });
                        break;
                    case "state-change":
                        console.log("State change");
                        setMasterState(data.newState);
                        break;
                    case "page-update":
                        console.log("Page update");
                        if(!isHosting){
                            document.getElementById((data.isStart ? "start" : "end") + "-page").value = data.newPage;
                        }
                        break;
                    case "race-start":
                        console.log("race starting");
                        timeOffset = data.timeNow - Date.now();
                        startTime = Date.now()
                        setMasterState(MasterState.RACEACTIVE);
                        document.getElementById("game-frame").src = data.start;
                        document.getElementById("target-page").textContent = data.endName;
                        timerInterval = setInterval(function(){
                            let secondsElapsed = Math.floor((Date.now() - startTime + timeOffset) / 1000);
                            // go from seconds elapsed to hours, minutes, seconds
                            let hours = Math.floor(secondsElapsed / 3600);
                            let minutes = Math.floor((secondsElapsed % 3600) / 60);
                            let seconds = secondsElapsed % 60;
                            document.getElementById("timer").textContent = hours + ":" + (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
                        }, 1000);
                        break;
                    case "race-end":
                        console.log("client: race over");
                        setMasterState(MasterState.POSTRACE);
                        playerResults = data.players.sort((a, b) => a.time - b.time);
                        document.getElementById("winner-name").textContent = playerResults[0].username;
                        document.getElementById("end-player-list").innerHTML = "";
                        for (const playerResult of playerResults){
                            let player = document.createElement("li");
                            // go from milliseconds to hours, minutes, seconds
                            let hours = Math.floor(playerResult.time / 3600000);
                            let minutes = Math.floor((playerResult.time % 3600000) / 60000);
                            let seconds = Math.floor((playerResult.time % 60000) / 1000);
                            player.textContent = playerResult.username + ": " + hours + ":" + (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;

                            document.getElementById("end-player-list").appendChild(player);
                        }
                }
            }
        });
        clientConn.on("close", function() {
            console.log("Connection closed");
            clientConn = undefined;
            leaveGame();
            if(!clientLeft){
                document.getElementById("error").style.display = "block";
                document.getElementById("error").textContent = "Game ended by host.";
            }
        });
        clientConn.on("error", function(err) {
            console.log("Client connection error: " + err);
        });
    });
    clientPeer.on("error", function(err) {
        console.log("Client peer error: " + err);
        document.getElementById("error").textContent = "Client peer error: " + err;
        document.getElementById("error").style.display = "block";
    });
    Array.from(document.getElementsByClassName("host-only-inline")).forEach(element => {
        element.style.display = "none";
    });
    Array.from(document.getElementsByClassName("host-only-enabled")).forEach(element => {
        element.disabled = true;
    });
}

function hostGame(username) {
    console.log("Hosting game with username " + username);
    isHosting = true;
    hostPeer = new Peer(generateId(), options={secure: true, debug: 2});
    document.getElementById("host-button").disabled = true;
    document.getElementById("join-button").disabled = true;
    document.getElementById("host-button").textContent = "Hosting...";
    hostPeer.on("open", function(id) {
        console.log("Host peer ID: " + id);
        hostPeer.on("connection", function(conn) {
            console.log("Host peer connected");
            conn.on("open", function() {
                console.log("Host peer connection open");
                // packet sstuff here
            });
            conn.on("data", function(data) {
                console.log("Host peer received data: " + JSON.stringify(data));
                switch(data.type){
                    case "join":
                        console.log("Host peer received join request");
                        if(masterState != MasterState.LOBBY && masterState != MasterState.HOME){
                            conn.send({
                                type: "join-deny",
                                reason: "Game is already in progress."
                            });
                            return;
                        }
                        if (players.map(p => p.username).includes(data.username)) {
                            console.log("Join request from " + data.username + " denied: username already in use");
                            conn.send({
                                type: "join-deny",
                                reason: "Username taken, try another"
                            });
                        } else {
                            console.log("Join request from " + data.username + " accepted");
                            players.push({conn: conn, username: data.username, pageVisits: [], finished: false});
                            conn.send({
                                type: "join-accept"
                            });
                            players.forEach(p => {
                                p.conn.send({
                                    type: "player-update",
                                    players: players.map(p => {return {username: p.username, isHost: p.conn.peer === clientPeer.id, isReady: p.isReady}})
                                });
                            });
                        }
                        break;
                    case "ready-status":
                        console.log("Host peer received ready status");
                        players.forEach(p => {
                            if(p.conn.peer === conn.peer){
                                p.isReady = data.isReady;
                            }
                        });
                        players.forEach(p => {
                            p.conn.send({
                                type: "player-update",
                                players: players.map(p => {return {username: p.username, isHost: p.conn.peer === clientPeer.id, isReady: p.isReady}})
                            });
                        });
                        if(players.filter(p => p.isReady).length === players.length){
                            console.log("All players ready");
                            players.forEach(p => {
                                p.conn.send({
                                    type: "state-change",
                                    newState: "PRERACE"
                                });
                            });
                        }
                        break;
                    case "request-state-change":
                        console.log("host peer recieved request state change");
                        players.forEach(p => {
                            if(p.conn.peer === conn.peer){
                                console.log(`found player ${p.username}, is host: ${p.conn.peer === clientPeer.id}`);
                                if (p.conn.peer === clientPeer.id){
                                    p.conn.send({
                                        "type": "state-change-response",
                                        "success": true
                                    });
                                    for (const player of players){
                                        player.isReady = false;
                                        player.conn.send({
                                            type: "state-change",
                                            newState: data.newState.toString()
                                        });
                                    }
                                    for(const player of players){
                                        player.conn.send({
                                            type: "player-update",
                                            players: players.map(p => {return {username: p.username, isHost: p.conn.peer === clientPeer.id, isReady: p.isReady}})
                                        });
                                    }
                                } else {
                                    p.conn.send({
                                        "type": "state-change-response",
                                        "success": false
                                    });
                                }
                            }
                        });
                        break;
                    case "page-update-request":
                        console.log("Host peer received page update");
                        if(playerIsHost(conn)){
                            console.log("Host peer is host, sending page update");
                            for(const player of players){
                                player.conn.send({
                                    type: "page-update",
                                    newPage: data.newPage,
                                    isStart: data.isStart
                                });
                            }
                        }
                        break;
                    case "request-race-start":
                        if(playerIsHost(conn)){
                            if(data.start.startsWith("https://en.wikipedia.org/wiki/") && data.end.startsWith("https://en.wikipedia.org/wiki/")){
                            for(const player of players){
                                player.pageVisits = [];
                                player.finished = false;
                                player.conn.send({
                                    type: "race-start",
                                    start: data.start,
                                    startName: data.startName,
                                    endName: data.endName,
                                    end: data.end,
                                    "allow-disambigs": data["allow-disambigs"],
                                    timeNow: Date.now()
                                })
                                player.conn.send({
                                    type: "player-update",
                                    players: players.map(p => {return {username: p.username, isHost: p.conn.peer === clientPeer.id, isReady: false}})
                                });
                            }
                        } else {
                            console.log(`Invalid start (${data.start}) or end (${data.end}) URL`);
                        }
                        }
                        break;
                    case "new-page-visit":
                        console.log("Host peer received new page visit");
                        for(const player of players){
                            if(player.conn.peer == conn.peer){
                                player.pageVisits.push({url: data.newUrl, timestamp: Date.now(), name: data.newName});
                                if(data.newUrl == endUrl){
                                    console.log(`${player.username} has reached the end`);
                                    player.finished = true;
                                    players.forEach(pToUpdate => {
                                        pToUpdate.conn.send({
                                            type: "player-update",
                                            players: players.map(p => {return {username: p.username, isHost: p.conn.peer === clientPeer.id, isReady: p.finished}})
                                        });
                                    });
                                    if(players.filter(p => p.finished).length === players.length){
                                        console.log("All players finished");
                                        players.forEach(p => {
                                            p.conn.send({
                                                type: "race-end",
                                                players: players.map(p => {return {
                                                    username: p.username,
                                                    time: p.pageVisits[p.pageVisits.length - 1].timestamp - p.pageVisits[0].timestamp,
                                                    path: p.pageVisits.map(p => p.name)}})
                                            });
                                        });
                                    }
                                }
                            }
                        }
                        break;
                }
                        
            });
            conn.on("close", function() {
                console.log("Host peer connection closed");
                players.forEach(p => {
                    if(p.conn.peer === conn.peer){
                        players.splice(players.indexOf(p), 1);
                    }
                });
                players.forEach(p => {
                    p.conn.send({
                        type: "player-update",
                        players: players.map(p => {return {username: p.username, isHost: p.conn.peer === clientPeer.id, isReady: p.isReady}})
                    });
                });
            });
            conn.on("error", function(err) {
                console.log("Host peer connection error: " + err);
            });
        });
        joinGame(username, hostPeer.id);
        Array.from(document.getElementsByClassName("host-only-inline")).forEach(element => {
            element.style.display = "inline";
        });
        Array.from(document.getElementsByClassName("host-only-enabled")).forEach(element => {
            element.disabled = false;
        });
        isHosting = true;
    });
    hostPeer.on("error", function(err) {
        console.log("Host peer error: " + err);
        document.getElementById("error").textContent = "Host peer error: " + err;
        document.getElementById("error").style.display = "block";
        document.getElementById("host-button").textContent = "Host Game (no address needed)"
        document.getElementById("host-button").disabled = false;
        document.getElementById("join-button").disabled = false;
        document.getElementById("join-button").textContent = "Join Game";
    });
}

document.getElementById("host-button").addEventListener("click", function(event) {
    if(document.getElementById("username").value === ""){
        document.getElementById("error").textContent = "Username cannot be blank";
        document.getElementById("error").style.display = "block";
        return;
    }
    hostGame(document.getElementById("username").value.trim());
});

document.getElementById("join-button").addEventListener("click", function(event) {
    if(document.getElementById("username").value === ""){
        document.getElementById("error").textContent = "Username cannot be blank";
        document.getElementById("error").style.display = "block";
        return;
    }
    joinGame(document.getElementById("username").value.trim(), document.getElementById("lobby-address").value.trim());
});

document.getElementById("ready-button").addEventListener("click", function(event) {
    if(isReady){
        document.getElementById("ready-button").textContent = "Ready";
        isReady = false;
    } else {
        document.getElementById("ready-button").textContent = "Not Ready";
        isReady = true;
    }
    clientConn.send({
        type: "ready-status",
        isReady: isReady
    });
});

document.getElementById("back-to-lobby-button").addEventListener("click", (e) => {
    clientConn.send({
        type: "request-state-change",
        newState: "LOBBY"
    })
});

document.getElementById("postgame-to-lobby").addEventListener("click", (e) => {
    clientConn.send({
        type: "request-state-change",
        newState: "LOBBY"
    })
});

document.getElementById("new-round").addEventListener("click", (e) => {
    clientConn.send({
        type: "request-state-change",
        newState: "PRERACE"
    })
});

document.getElementById("start-button").addEventListener("click", (e) => {
    if(isWaitingOnEndSuggestions || isWaitingOnStartSuggestions){
        return;
    }
    clientConn.send({
        type: "request-race-start",
        start: startUrl,
        startName: startName,
        end: endUrl,
        endName: endName,
        "allow-disambigs": document.getElementById("allow-disambigs").checked
    })
});

document.getElementById("start-page").addEventListener("input", (e) => {
    loadSuggestions(e.currentTarget.value, true);
    isWaitingOnStartSuggestions = true;
    clientConn.send({
        type: "page-update-request",
        isStart: true,
        newPage: e.currentTarget.value
    })
});

document.getElementById("end-page").addEventListener("input", (e) => {
    isWaitingOnEndSuggestions = true;
    loadSuggestions(e.currentTarget.value, false);
    clientConn.send({
        type: "page-update-request",
        isStart: false,
        newPage: e.currentTarget.value
    })
})

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
    if(request.loaded && request.name && masterState == MasterState.RACEACTIVE){
        // If you used a pattern, do extra checks here:
        // if(request.loaded == "https://website.com/index.php")
        console.log(`Loaded from page ${request.loaded}, title ${request.name}`);
        clientConn.send({
            type: "new-page-visit",
            newUrl: request.loaded,
            newName: request.name
        });
    }
});

document.getElementById("leave-button").addEventListener("click", (e) => {clientLeft = true; clientConn.close()});
document.getElementById("prerace-leave").addEventListener("click", (e) => {clientLeft = true; clientConn.close()});
document.getElementById("ingame-leave").addEventListener("click", (e) => {clientLeft = true; clientConn.close()});
document.getElementById("postgame-leave").addEventListener("click", (e) => {clientLeft = true; clientConn.close()});


function leaveGame(){
    if(isHosting){
        if(players.length <= 1 || confirm("Are you sure you want to leave the game? All players will be disconnected.")){
            players.forEach(p => {
                p.conn.close();
            });
            hostPeer.destroy();
            players = [];
        } else {
            return;
        }
    }
    isHosting = null;
    document.getElementById("host-button").textContent = "Host Game (no address needed)";
    document.getElementById("host-button").disabled = false;
    document.getElementById("join-button").disabled = false;
    document.getElementById("join-button").textContent = "Join Game";
    document.getElementById("username").value = "";
    document.getElementById("lobby-address").value = "";
    document.getElementById("error").style.display = "none";
    document.getElementById("error").textContent = "";
    setMasterState(MasterState.HOME);
}

window.onbeforeunload = function(e) {
    if(isHosting){
        isHosting = false;
        players.forEach(p => {
            p.conn.close();
        });
    }
    return;
}

function playerIsHost(conn){
    return conn.peer == clientPeer.id
}

function loadSuggestions(value, isStart) {
    const queryParams = {
      action: 'query',
      format: 'json',
      gpssearch: value,
      generator: 'prefixsearch',
      prop: 'pageprops|pageimages|pageterms|info',
      redirects: 'false', // Automatically resolve redirects
      ppprop: 'displaytitle',
      piprop: 'thumbnail',
      pithumbsize: '160',
      pilimit: '30',
      inprop: 'url',
      wbptterms: 'description',
      gpsnamespace: 0, // Only return results in Wikipedia's main namespace
      gpslimit: 1, // Return at most one result
      origin: '*',
    };

    // TODO: add helper for making API requests to WikiMedia API
    let fetch_url = new URL(WIKIPEDIA_API_URL);
    let searchString = "?";
    for (let key in queryParams) {
        searchString += key + "=" + queryParams[key] + "&";
    }
    searchString = searchString.substring(0, searchString.length - 1);
    fetch_url.search = searchString;
    console.log(fetch_url.href);
    fetch(fetch_url, {
      method: 'GET',
      headers: {
        'Api-User-Agent':
          'WikiRace/0.2 (https://github.com/rivques/wikirace)',
      },
    })
    .then(response => response.text())
    .then((jsonStr) => {
        const suggestions = [];
        console.log(jsonStr);
        const responseData = JSON.parse(jsonStr);
        console.log(responseData);
        if(!responseData.query){
            document.getElementById((isStart ? "start" : "end") + "-page").style.color = "red";
            document.getElementById("start-button").disabled = true;
            if(isStart){
                isWaitingOnStartSuggestions = false;
            } else {
                isWaitingOnEndSuggestions = false;
            }
            return false;
        }
        const pageResults = responseData.query.pages;
        let pageResult;
        for(let prk in pageResults){
            // Due to https://phabricator.wikimedia.org/T189139, results will not always be limited
            // to the main namespace (0), so ignore all results which have a different namespace.
            pageResult = pageResults[prk];
            if (pageResult.ns === 0) {
            let description = pageResult.terms
            if(description){
                description = description[0];
            }
            if (description) {
                description = description.charAt(0).toUpperCase() + description.slice(1);
            }

            let thumbnail = pageResult.thumbnail;
            if (thumbnail) {
                thumbnail = thumbnail.source;
            }
            suggestions[pageResult.index - 1] = {
                title: pageResult.title,
                description,
                thumbnailUrl: thumbnail
            };
            if(isStart){
                startUrl = pageResult.canonicalurl;
            } else {
                endUrl = pageResult.canonicalurl;
            }
            if(pageResult.title.toLowerCase() == value.toLowerCase()){
                document.getElementById((isStart ? "start" : "end") + "-page").style.color = "green";
                if(document.getElementById((isStart ? "end" : "start") + "-page").style.color == "green"){
                    document.getElementById("start-button").disabled = false;
                }
                if(isStart){
                    startUrl = pageResult.canonicalurl;
                    isWaitingOnStartSuggestions = false;
                    startName = pageResult.title;
                } else {
                    endUrl = pageResult.canonicalurl;
                    isWaitingOnEndSuggestions = false;
                    endName = pageResult.title;
                }
                return true;
            }
            }
        };
        const redirects = responseData.query.redirects;
        if(redirects){
            for(const redirect of redirects){
                if(redirect.from.toLowerCase() == value.toLowerCase()){
                    console.log((isStart ? "start" : "end") + "-page")
                    document.getElementById((isStart ? "start" : "end") + "-page").style.color = "green";
                    if(document.getElementById((isStart ? "end" : "start") + "-page").style.color == "green"){
                        document.getElementById("start-button").disabled = false;
                    }
                    if(isStart){
                        isWaitingOnStartSuggestions = false;
                        startUrl = pageResult.canonicalurl;
                        startName = redirect.to;
                    } else {
                        isWaitingOnEndSuggestions = false
                        endUrl = pageResult.canonicalurl;
                        endName = redirect.to;
                    }
                    return true;
                }
            }
        }
        console.log(suggestions);
        document.getElementById((isStart ? "start" : "end") + "-page").style.color = "red";
        document.getElementById("start-button").disabled = true;
        if(isStart){
            isWaitingOnStartSuggestions = false;
        } else {
            isWaitingOnEndSuggestions = false;
        }
        return false
    });
}

// --------------------------------------------------------------
const wordList = [
    "a",
    "ability",
    "able",
    "about",
    "above",
    "abroad",
    "absence",
    "absent",
    "absolute",
    "accept",
    "accident",
    "accord",
    "account",
    "accuse",
    "accustom",
    "ache",
    "across",
    "act",
    "action",
    "active",
    "actor",
    "actress",
    "actual",
    "add",
    "address",
    "admire",
    "admission",
    "admit",
    "adopt",
    "adoption",
    "advance",
    "advantage",
    "adventure",
    "advertise",
    "advice",
    "advise",
    "affair",
    "afford",
    "afraid",
    "after",
    "afternoon",
    "again",
    "against",
    "age",
    "agency",
    "agent",
    "ago",
    "agree",
    "agriculture",
    "ahead",
    "aim",
    "air",
    "airplane",
    "alike",
    "alive",
    "all",
    "allow",
    "allowance",
    "almost",
    "alone",
    "along",
    "aloud",
    "already",
    "also",
    "although",
    "altogether",
    "always",
    "ambition",
    "ambitious",
    "among",
    "amongst",
    "amount",
    "amuse",
    "ancient",
    "and",
    "anger",
    "angle",
    "angry",
    "animal",
    "annoy",
    "annoyance",
    "another",
    "answer",
    "anxiety",
    "anxious",
    "any",
    "anybody",
    "anyhow",
    "anyone",
    "anything",
    "anyway",
    "anywhere",
    "apart",
    "apology",
    "appear",
    "appearance",
    "applaud",
    "applause",
    "apple",
    "application",
    "apply",
    "appoint",
    "approve",
    "arch",
    "argue",
    "arise",
    "arm",
    "army",
    "around",
    "arrange",
    "arrest",
    "arrive",
    "arrow",
    "art",
    "article",
    "artificial",
    "as",
    "ash",
    "ashamed",
    "aside",
    "ask",
    "asleep",
    "association",
    "astonish",
    "at",
    "attack",
    "attempt",
    "attend",
    "attention",
    "attentive",
    "attract",
    "attraction",
    "attractive",
    "audience",
    "aunt",
    "autumn",
    "avenue",
    "average",
    "avoid",
    "avoidance",
    "awake",
    "away",
    "awkward",
    "axe",
    "baby",
    "back",
    "backward",
    "bad",
    "bag",
    "baggage",
    "bake",
    "balance",
    "ball",
    "band",
    "bank",
    "bar",
    "barber",
    "bare",
    "bargain",
    "barrel",
    "base",
    "basic",
    "basin",
    "basis",
    "basket",
    "bath",
    "bathe",
    "battery",
    "battle",
    "bay",
    "be",
    "beak",
    "beam",
    "bean",
    "bear",
    "beard",
    "beast",
    "beat",
    "beauty",
    "because",
    "become",
    "bed",
    "bedroom",
    "before",
    "beg",
    "begin",
    "behave",
    "behavior",
    "behind",
    "being",
    "belief",
    "believe",
    "bell",
    "belong",
    "below",
    "belt",
    "bend",
    "beneath",
    "berry",
    "beside",
    "besides",
    "best",
    "better",
    "between",
    "beyond",
    "bicycle",
    "big",
    "bill",
    "bind",
    "bird",
    "birth",
    "bit",
    "bite",
    "bitter",
    "black",
    "blade",
    "blame",
    "bleed",
    "bless",
    "blind",
    "block",
    "blood",
    "blow",
    "blue",
    "board",
    "boast",
    "boat",
    "body",
    "boil",
    "bold",
    "bone",
    "book",
    "border",
    "borrow",
    "both",
    "bottle",
    "bottom",
    "bound",
    "boundary",
    "bow",
    "bowl",
    "box",
    "boy",
    "brain",
    "branch",
    "brass",
    "brave",
    "bravery",
    "bread",
    "breadth",
    "break",
    "breakfast",
    "breath",
    "breathe",
    "bribe",
    "bribery",
    "brick",
    "bridge",
    "bright",
    "brighten",
    "bring",
    "broad",
    "broadcast",
    "brother",
    "brown",
    "brush",
    "bucket",
    "build",
    "bunch",
    "bundle",
    "burn",
    "burst",
    "bury",
    "bus",
    "bush",
    "business",
    "businesslike",
    "businessman",
    "busy",
    "but",
    "butter",
    "button",
    "buy",
    "by",
    "cage",
    "cake",
    "calculate",
    "calculation",
    "calculator",
    "call",
    "calm",
    "camera",
    "camp",
    "can",
    "canal",
    "cap",
    "cape",
    "capital",
    "captain",
    "car",
    "card",
    "care",
    "carriage",
    "carry",
    "cart",
    "case",
    "castle",
    "cat",
    "catch",
    "cattle",
    "cause",
    "caution",
    "cautious",
    "cave",
    "cent",
    "center",
    "century",
    "ceremony",
    "certain",
    "certainty",
    "chain",
    "chair",
    "chairman",
    "chalk",
    "chance",
    "change",
    "character",
    "charge",
    "charm",
    "cheap",
    "cheat",
    "check",
    "cheer",
    "cheese",
    "chest",
    "chicken",
    "chief",
    "child",
    "childhood",
    "chimney",
    "choice",
    "choose",
    "christmas",
    "church",
    "circle",
    "circular",
    "citizen",
    "city",
    "civilize",
    "claim",
    "class",
    "classification",
    "classify",
    "clay",
    "clean",
    "clear",
    "clerk",
    "clever",
    "cliff",
    "climb",
    "clock",
    "close",
    "cloth",
    "clothe",
    "cloud",
    "club",
    "coal",
    "coarse",
    "coast",
    "coat",
    "coffee",
    "coin",
    "cold",
    "collar",
    "collect",
    "collection",
    "collector",
    "college",
    "colony",
    "color",
    "comb",
    "combine",
    "come",
    "comfort",
    "command",
    "commerce",
    "commercial",
    "committee",
    "common",
    "companion",
    "companionship",
    "company",
    "compare",
    "comparison",
    "compete",
    "competition",
    "competitor",
    "complain",
    "complaint",
    "complete",
    "completion",
    "complicate",
    "complication",
    "compose",
    "composition",
    "concern",
    "condition",
    "confess",
    "confession",
    "confidence",
    "confident",
    "confidential",
    "confuse",
    "confusion",
    "congratulate",
    "congratulation",
    "connect",
    "connection",
    "conquer",
    "conqueror",
    "conquest",
    "conscience",
    "conscious",
    "consider",
    "contain",
    "content",
    "continue",
    "control",
    "convenience",
    "convenient",
    "conversation",
    "cook",
    "cool",
    "copper",
    "copy",
    "cork",
    "corn",
    "corner",
    "correct",
    "correction",
    "cost",
    "cottage",
    "cotton",
    "cough",
    "could",
    "council",
    "count",
    "country",
    "courage",
    "course",
    "court",
    "cousin",
    "cover",
    "cow",
    "coward",
    "cowardice",
    "crack",
    "crash",
    "cream",
    "creature",
    "creep",
    "crime",
    "criminal",
    "critic",
    "crop",
    "cross",
    "crowd",
    "crown",
    "cruel",
    "crush",
    "cry",
    "cultivate",
    "cultivation",
    "cultivator",
    "cup",
    "cupboard",
    "cure",
    "curious",
    "curl",
    "current",
    "curse",
    "curtain",
    "curve",
    "cushion",
    "custom",
    "customary",
    "customer",
    "cut",
    "daily",
    "damage",
    "damp",
    "dance",
    "danger",
    "dare",
    "dark",
    "darken",
    "date",
    "daughter",
    "day",
    "daylight",
    "dead",
    "deaf",
    "deafen",
    "deal",
    "dear",
    "death",
    "debt",
    "decay",
    "deceit",
    "deceive",
    "decide",
    "decision",
    "decisive",
    "declare",
    "decrease",
    "deed",
    "deep",
    "deepen",
    "deer",
    "defeat",
    "defend",
    "defendant",
    "defense",
    "degree",
    "delay",
    "delicate",
    "delight",
    "deliver",
    "delivery",
    "demand",
    "department",
    "depend",
    "dependence",
    "dependent",
    "depth",
    "descend",
    "descendant",
    "descent",
    "describe",
    "description",
    "desert",
    "deserve",
    "desire",
    "desk",
    "despair",
    "destroy",
    "destruction",
    "destructive",
    "detail",
    "determine",
    "develop",
    "devil",
    "diamond",
    "dictionary",
    "die",
    "difference",
    "different",
    "difficult",
    "difficulty",
    "dig",
    "dine",
    "dinner",
    "dip",
    "direct",
    "direction",
    "director",
    "dirt",
    "disagree",
    "disappear",
    "disappearance",
    "disappoint",
    "disapprove",
    "discipline",
    "discomfort",
    "discontent",
    "discover",
    "discovery",
    "discuss",
    "discussion",
    "disease",
    "disgust",
    "dish",
    "dismiss",
    "disregard",
    "disrespect",
    "dissatisfaction",
    "dissatisfy",
    "distance",
    "distant",
    "distinguish",
    "district",
    "disturb",
    "ditch",
    "dive",
    "divide",
    "division",
    "do",
    "doctor",
    "dog",
    "dollar",
    "donkey",
    "door",
    "dot",
    "double",
    "doubt",
    "down",
    "dozen",
    "drag",
    "draw",
    "drawer",
    "dream",
    "dress",
    "drink",
    "drive",
    "drop",
    "drown",
    "drum",
    "dry",
    "duck",
    "due",
    "dull",
    "during",
    "dust",
    "duty",
    "each",
    "eager",
    "ear",
    "early",
    "earn",
    "earnest",
    "earth",
    "ease",
    "east",
    "eastern",
    "easy",
    "eat",
    "edge",
    "educate",
    "education",
    "educator",
    "effect",
    "effective",
    "efficiency",
    "efficient",
    "effort",
    "egg",
    "either",
    "elastic",
    "elder",
    "elect",
    "election",
    "electric",
    "electrician",
    "elephant",
    "else",
    "elsewhere",
    "empire",
    "employ",
    "employee",
    "empty",
    "enclose",
    "enclosure",
    "encourage",
    "end",
    "enemy",
    "engine",
    "engineer",
    "english",
    "enjoy",
    "enough",
    "enter",
    "entertain",
    "entire",
    "entrance",
    "envelope",
    "envy",
    "equal",
    "escape",
    "especially",
    "essence",
    "essential",
    "even",
    "evening",
    "event",
    "ever",
    "everlasting",
    "every",
    "everybody",
    "everyday",
    "everyone",
    "everything",
    "everywhere",
    "evil",
    "exact",
    "examine",
    "example",
    "excellence",
    "excellent",
    "except",
    "exception",
    "excess",
    "excessive",
    "exchange",
    "excite",
    "excuse",
    "exercise",
    "exist",
    "existence",
    "expect",
    "expense",
    "expensive",
    "experience",
    "experiment",
    "explain",
    "explode",
    "explore",
    "explosion",
    "explosive",
    "express",
    "expression",
    "extend",
    "extension",
    "extensive",
    "extent",
    "extra",
    "extraordinary",
    "extreme",
    "eye",
    "face",
    "fact",
    "factory",
    "fade",
    "fail",
    "failure",
    "faint",
    "fair",
    "faith",
    "fall",
    "FALSE",
    "fame",
    "familiar",
    "family",
    "fan",
    "fancy",
    "far",
    "farm",
    "fashion",
    "fast",
    "fasten",
    "fat",
    "fate",
    "father",
    "fatten",
    "fault",
    "favor",
    "favorite",
    "fear",
    "feast",
    "feather",
    "feed",
    "feel",
    "fellow",
    "fellowship",
    "female",
    "fence",
    "fever",
    "few",
    "field",
    "fierce",
    "fight",
    "figure",
    "fill",
    "film",
    "find",
    "fine",
    "finger",
    "finish",
    "fire",
    "firm",
    "first",
    "fish",
    "fit",
    "fix",
    "flag",
    "flame",
    "flash",
    "flat",
    "flatten",
    "flavor",
    "flesh",
    "float",
    "flood",
    "floor",
    "flour",
    "flow",
    "flower",
    "fly",
    "fold",
    "follow",
    "fond",
    "food",
    "fool",
    "foot",
    "for",
    "forbid",
    "force",
    "foreign",
    "forest",
    "forget",
    "forgive",
    "fork",
    "form",
    "formal",
    "former",
    "forth",
    "fortunate",
    "fortune",
    "forward",
    "frame",
    "framework",
    "free",
    "freedom",
    "freeze",
    "frequency",
    "frequent",
    "fresh",
    "friend",
    "friendly",
    "friendship",
    "fright",
    "frighten",
    "from",
    "front",
    "fruit",
    "fry",
    "full",
    "fun",
    "funeral",
    "funny",
    "fur",
    "furnish",
    "furniture",
    "further",
    "future",
    "gaiety",
    "gain",
    "gallon",
    "game",
    "gap",
    "garage",
    "garden",
    "gas",
    "gate",
    "gather",
    "gay",
    "general",
    "generous",
    "gentle",
    "gentleman",
    "get",
    "gift",
    "girl",
    "give",
    "glad",
    "glass",
    "glory",
    "go",
    "goat",
    "god",
    "gold",
    "golden",
    "good",
    "govern",
    "governor",
    "grace",
    "gradual",
    "grain",
    "grammar",
    "grammatical",
    "grand",
    "grass",
    "grateful",
    "grave",
    "gray",
    "grease",
    "great",
    "greed",
    "green",
    "greet",
    "grind",
    "ground",
    "group",
    "grow",
    "growth",
    "guard",
    "guess",
    "guest",
    "guide",
    "guilt",
    "gun",
    "habit",
    "hair",
    "half",
    "hall",
    "hammer",
    "hand",
    "handkerchief",
    "handle",
    "handshake",
    "handwriting",
    "hang",
    "happen",
    "happy",
    "harbor",
    "hard",
    "harden",
    "hardly",
    "harm",
    "harvest",
    "haste",
    "hasten",
    "hat",
    "hate",
    "hatred",
    "have",
    "hay",
    "he",
    "head",
    "headache",
    "headdress",
    "heal",
    "health",
    "heap",
    "hear",
    "heart",
    "heat",
    "heaven",
    "heavenly",
    "heavy",
    "height",
    "heighten",
    "hello",
    "help",
    "here",
    "hesitate",
    "hesitation",
    "hide",
    "high",
    "highway",
    "hill",
    "hinder",
    "hindrance",
    "hire",
    "history",
    "hit",
    "hold",
    "hole",
    "holiday",
    "hollow",
    "holy",
    "home",
    "homecoming",
    "homemade",
    "homework",
    "honest",
    "honesty",
    "honor",
    "hook",
    "hope",
    "horizon",
    "horizontal",
    "horse",
    "hospital",
    "host",
    "hot",
    "hotel",
    "hour",
    "house",
    "how",
    "however",
    "human",
    "humble",
    "hunger",
    "hunt",
    "hurrah",
    "hurry",
    "hurt",
    "husband",
    "hut",
    "I",
    "ice",
    "idea",
    "ideal",
    "idle",
    "if",
    "ill",
    "imaginary",
    "imaginative",
    "imagine",
    "imitate",
    "imitation",
    "immediate",
    "immense",
    "importance",
    "important",
    "impossible",
    "improve",
    "in",
    "inch",
    "include",
    "inclusive",
    "increase",
    "indeed",
    "indoor",
    "industry",
    "influence",
    "influential",
    "inform",
    "ink",
    "inn",
    "inquire",
    "inquiry",
    "insect",
    "inside",
    "instant",
    "instead",
    "instrument",
    "insult",
    "insurance",
    "insure",
    "intend",
    "intention",
    "interest",
    "interfere",
    "interference",
    "international",
    "interrupt",
    "interruption",
    "into",
    "introduce",
    "introduction",
    "invent",
    "invention",
    "inventor",
    "invite",
    "inward",
    "iron",
    "island",
    "it",
    "jaw",
    "jealous",
    "jealousy",
    "jewel",
    "join",
    "joint",
    "joke",
    "journey",
    "joy",
    "judge",
    "juice",
    "jump",
    "just",
    "justice",
    "keep",
    "key",
    "kick",
    "kill",
    "kind",
    "king",
    "kingdom",
    "kiss",
    "kitchen",
    "knee",
    "kneel",
    "knife",
    "knock",
    "knot",
    "know",
    "knowledge",
    "lack",
    "ladder",
    "lady",
    "lake",
    "lamp",
    "land",
    "landlord",
    "language",
    "large",
    "last",
    "late",
    "lately",
    "latter",
    "laugh",
    "laughter",
    "law",
    "lawyer",
    "lay",
    "lazy",
    "lead",
    "leadership",
    "leaf",
    "lean",
    "learn",
    "least",
    "leather",
    "leave",
    "left",
    "leg",
    "lend",
    "length",
    "lengthen",
    "less",
    "lessen",
    "lesson",
    "let",
    "letter",
    "level",
    "liar",
    "liberty",
    "librarian",
    "library",
    "lid",
    "lie",
    "life",
    "lift",
    "light",
    "lighten",
    "like",
    "likely",
    "limb",
    "limit",
    "line",
    "lip",
    "lipstick",
    "liquid",
    "list",
    "listen",
    "literary",
    "literature",
    "little",
    "live",
    "load",
    "loaf",
    "loan",
    "local",
    "lock",
    "lodge",
    "log",
    "lonely",
    "long",
    "look",
    "loose",
    "loosen",
    "lord",
    "lose",
    "loss",
    "lot",
    "loud",
    "love",
    "lovely",
    "low",
    "loyal",
    "loyalty",
    "luck",
    "lump",
    "lunch",
    "lung",
    "machine",
    "machinery",
    "mad",
    "madden",
    "mail",
    "main",
    "make",
    "male",
    "man",
    "manage",
    "mankind",
    "manner",
    "manufacture",
    "many",
    "map",
    "march",
    "mark",
    "market",
    "marriage",
    "marry",
    "mass",
    "master",
    "mat",
    "match",
    "material",
    "matter",
    "may",
    "maybe",
    "meal",
    "mean",
    "meantime",
    "meanwhile",
    "measure",
    "meat",
    "mechanic",
    "mechanism",
    "medical",
    "medicine",
    "meet",
    "melt",
    "member",
    "membership",
    "memory",
    "mend",
    "mention",
    "merchant",
    "mercy",
    "mere",
    "merry",
    "message",
    "messenger",
    "metal",
    "middle",
    "might",
    "mild",
    "mile",
    "milk",
    "mill",
    "mind",
    "mine",
    "mineral",
    "minister",
    "minute",
    "miserable",
    "misery",
    "miss",
    "mistake",
    "mix",
    "mixture",
    "model",
    "moderate",
    "moderation",
    "modern",
    "modest",
    "modesty",
    "moment",
    "momentary",
    "money",
    "monkey",
    "month",
    "moon",
    "moonlight",
    "moral",
    "more",
    "moreover",
    "morning",
    "most",
    "mother",
    "motherhood",
    "motherly",
    "motion",
    "motor",
    "mountain",
    "mouse",
    "mouth",
    "move",
    "much",
    "mud",
    "multiplication",
    "multiply",
    "murder",
    "music",
    "musician",
    "must",
    "mystery",
    "nail",
    "name",
    "narrow",
    "nation",
    "native",
    "nature",
    "near",
    "neat",
    "necessary",
    "necessity",
    "neck",
    "need",
    "needle",
    "neglect",
    "neighbor",
    "neighborhood",
    "neither",
    "nephew",
    "nest",
    "net",
    "network",
    "never",
    "new",
    "news",
    "newspaper",
    "next",
    "nice",
    "niece",
    "night",
    "no",
    "noble",
    "nobody",
    "noise",
    "none",
    "noon",
    "nor",
    "north",
    "northern",
    "nose",
    "not",
    "note",
    "notebook",
    "nothing",
    "notice",
    "noun",
    "now",
    "nowadays",
    "nowhere",
    "nuisance",
    "number",
    "numerous",
    "nurse",
    "nursery",
    "nut",
    "oar",
    "obedience",
    "obedient",
    "obey",
    "object",
    "objection",
    "observe",
    "occasion",
    "ocean",
    "of",
    "off",
    "offend",
    "offense",
    "offer",
    "office",
    "officer",
    "official",
    "often",
    "oil",
    "old",
    "old-fashioned",
    "omission",
    "omit",
    "on",
    "once",
    "one",
    "only",
    "onto",
    "open",
    "operate",
    "operation",
    "operator",
    "opinion",
    "opportunity",
    "oppose",
    "opposite",
    "opposition",
    "or",
    "orange",
    "order",
    "ordinary",
    "organ",
    "organize",
    "origin",
    "ornament",
    "other",
    "otherwise",
    "ought",
    "ounce",
    "out",
    "outline",
    "outside",
    "outward",
    "over",
    "overcome",
    "overflow",
    "owe",
    "own",
    "ownership",
    "pack",
    "package",
    "pad",
    "page",
    "pain",
    "paint",
    "pair",
    "pale",
    "pan",
    "paper",
    "parcel",
    "pardon",
    "parent",
    "park",
    "part",
    "particle",
    "particular",
    "partner",
    "party",
    "pass",
    "passage",
    "passenger",
    "past",
    "paste",
    "pastry",
    "path",
    "patience",
    "patient",
    "patriotic",
    "pattern",
    "pause",
    "paw",
    "pay",
    "peace",
    "pearl",
    "peculiar",
    "pen",
    "pencil",
    "penny",
    "people",
    "per",
    "perfect",
    "perfection",
    "perform",
    "performance",
    "perhaps",
    "permanent",
    "permission",
    "permit",
    "person",
    "persuade",
    "persuasion",
    "pet",
    "photograph",
    "photography",
    "pick",
    "picture",
    "piece",
    "pig",
    "pigeon",
    "pile",
    "pin",
    "pinch",
    "pink",
    "pint",
    "pipe",
    "pity",
    "place",
    "plain",
    "plan",
    "plant",
    "plaster",
    "plate",
    "play",
    "pleasant",
    "please",
    "pleasure",
    "plenty",
    "plow",
    "plural",
    "pocket",
    "poem",
    "poet",
    "point",
    "poison",
    "police",
    "polish",
    "polite",
    "political",
    "politician",
    "politics",
    "pool",
    "poor",
    "popular",
    "population",
    "position",
    "possess",
    "possession",
    "possessor",
    "possible",
    "post",
    "postpone",
    "pot",
    "pound",
    "pour",
    "poverty",
    "powder",
    "power",
    "practical",
    "practice",
    "praise",
    "pray",
    "preach",
    "precious",
    "prefer",
    "preference",
    "prejudice",
    "prepare",
    "presence",
    "present",
    "preserve",
    "president",
    "press",
    "pressure",
    "pretend",
    "pretense",
    "pretty",
    "prevent",
    "prevention",
    "price",
    "pride",
    "priest",
    "print",
    "prison",
    "private",
    "prize",
    "probable",
    "problem",
    "procession",
    "produce",
    "product",
    "production",
    "profession",
    "profit",
    "program",
    "progress",
    "promise",
    "prompt",
    "pronounce",
    "pronunciation",
    "proof",
    "proper",
    "property",
    "proposal",
    "propose",
    "protect",
    "protection",
    "proud",
    "prove",
    "provide",
    "public",
    "pull",
    "pump",
    "punctual",
    "punish",
    "pupil",
    "pure",
    "purple",
    "purpose",
    "push",
    "put",
    "puzzle",
    "qualification",
    "qualify",
    "quality",
    "quantity",
    "quarrel",
    "quart",
    "quarter",
    "queen",
    "question",
    "quick",
    "quiet",
    "quite",
    "rabbit",
    "race",
    "radio",
    "rail",
    "railroad",
    "rain",
    "raise",
    "rake",
    "rank",
    "rapid",
    "rare",
    "rate",
    "rather",
    "raw",
    "ray",
    "razor",
    "reach",
    "read",
    "ready",
    "real",
    "realize",
    "reason",
    "reasonable",
    "receipt",
    "receive",
    "recent",
    "recognition",
    "recognize",
    "recommend",
    "record",
    "red",
    "redden",
    "reduce",
    "reduction",
    "refer",
    "reference",
    "reflect",
    "reflection",
    "refresh",
    "refuse",
    "regard",
    "regret",
    "regular",
    "rejoice",
    "relate",
    "relation",
    "relative",
    "relief",
    "relieve",
    "religion",
    "remain",
    "remark",
    "remedy",
    "remember",
    "remind",
    "rent",
    "repair",
    "repeat",
    "repetition",
    "replace",
    "reply",
    "report",
    "represent",
    "representative",
    "reproduce",
    "reproduction",
    "republic",
    "reputation",
    "request",
    "rescue",
    "reserve",
    "resign",
    "resist",
    "resistance",
    "respect",
    "responsible",
    "rest",
    "restaurant",
    "result",
    "retire",
    "return",
    "revenge",
    "review",
    "reward",
    "ribbon",
    "rice",
    "rich",
    "rid",
    "ride",
    "right",
    "ring",
    "ripe",
    "ripen",
    "rise",
    "risk",
    "rival",
    "rivalry",
    "river",
    "road",
    "roar",
    "roast",
    "rob",
    "robbery",
    "rock",
    "rod",
    "roll",
    "roof",
    "room",
    "root",
    "rope",
    "rot",
    "rotten",
    "rough",
    "round",
    "row",
    "royal",
    "royalty",
    "rub",
    "rubber",
    "rubbish",
    "rude",
    "rug",
    "ruin",
    "rule",
    "run",
    "rush",
    "rust",
    "sacred",
    "sacrifice",
    "sad",
    "sadden",
    "saddle",
    "safe",
    "safety",
    "sail",
    "sailor",
    "sake",
    "salary",
    "sale",
    "salesman",
    "salt",
    "same",
    "sample",
    "sand",
    "satisfaction",
    "satisfactory",
    "satisfy",
    "sauce",
    "saucer",
    "save",
    "saw",
    "say",
    "scale",
    "scarce",
    "scatter",
    "scene",
    "scenery",
    "scent",
    "school",
    "science",
    "scientific",
    "scientist",
    "scissors",
    "scold",
    "scorn",
    "scrape",
    "scratch",
    "screen",
    "screw",
    "sea",
    "search",
    "season",
    "seat",
    "second",
    "secrecy",
    "secret",
    "secretary",
    "see",
    "seed",
    "seem",
    "seize",
    "seldom",
    "self",
    "selfish",
    "sell",
    "send",
    "sense",
    "sensitive",
    "sentence",
    "separate",
    "separation",
    "serious",
    "servant",
    "serve",
    "service",
    "set",
    "settle",
    "several",
    "severe",
    "sew",
    "shade",
    "shadow",
    "shake",
    "shall",
    "shallow",
    "shame",
    "shape",
    "share",
    "sharp",
    "sharpen",
    "shave",
    "she",
    "sheep",
    "sheet",
    "shelf",
    "shell",
    "shelter",
    "shield",
    "shilling",
    "shine",
    "ship",
    "shirt",
    "shock",
    "shoe",
    "shoot",
    "shop",
    "shore",
    "short",
    "shorten",
    "should",
    "shoulder",
    "shout",
    "show",
    "shower",
    "shut",
    "sick",
    "side",
    "sight",
    "sign",
    "signal",
    "signature",
    "silence",
    "silent",
    "silk",
    "silver",
    "simple",
    "simplicity",
    "since",
    "sincere",
    "sing",
    "single",
    "sink",
    "sir",
    "sister",
    "sit",
    "situation",
    "size",
    "skill",
    "skin",
    "skirt",
    "sky",
    "slave",
    "slavery",
    "sleep",
    "slide",
    "slight",
    "slip",
    "slippery",
    "slope",
    "slow",
    "small",
    "smell",
    "smile",
    "smoke",
    "smooth",
    "snake",
    "snow",
    "so",
    "soap",
    "social",
    "society",
    "sock",
    "soft",
    "soften",
    "soil",
    "soldier",
    "solemn",
    "solid",
    "solution",
    "solve",
    "some",
    "somebody",
    "somehow",
    "someone",
    "something",
    "sometime",
    "sometimes",
    "somewhere",
    "son",
    "song",
    "soon",
    "sore",
    "sorrow",
    "sorry",
    "sort",
    "soul",
    "sound",
    "soup",
    "sour",
    "south",
    "sow",
    "space",
    "spade",
    "spare",
    "speak",
    "special",
    "speech",
    "speed",
    "spell",
    "spend",
    "spill",
    "spin",
    "spirit",
    "spit",
    "spite",
    "splendid",
    "split",
    "spoil",
    "spoon",
    "sport",
    "spot",
    "spread",
    "spring",
    "square",
    "staff",
    "stage",
    "stain",
    "stair",
    "stamp",
    "stand",
    "standard",
    "staple",
    "star",
    "start",
    "state",
    "station",
    "stay",
    "steady",
    "steam",
    "steel",
    "steep",
    "steer",
    "stem",
    "step",
    "stick",
    "stiff",
    "stiffen",
    "still",
    "sting",
    "stir",
    "stock",
    "stocking",
    "stomach",
    "stone",
    "stop",
    "store",
    "storm",
    "story",
    "stove",
    "straight",
    "straighten",
    "strange",
    "strap",
    "straw",
    "stream",
    "street",
    "strength",
    "strengthen",
    "stretch",
    "strict",
    "strike",
    "string",
    "strip",
    "stripe",
    "stroke",
    "strong",
    "struggle",
    "student",
    "study",
    "stuff",
    "stupid",
    "subject",
    "substance",
    "succeed",
    "success",
    "such",
    "suck",
    "sudden",
    "suffer",
    "sugar",
    "suggest",
    "suggestion",
    "suit",
    "summer",
    "sun",
    "supper",
    "supply",
    "support",
    "suppose",
    "sure",
    "surface",
    "surprise",
    "surround",
    "suspect",
    "suspicion",
    "suspicious",
    "swallow",
    "swear",
    "sweat",
    "sweep",
    "sweet",
    "sweeten",
    "swell",
    "swim",
    "swing",
    "sword",
    "sympathetic",
    "sympathy",
    "system",
    "table",
    "tail",
    "tailor",
    "take",
    "talk",
    "tall",
    "tame",
    "tap",
    "taste",
    "tax",
    "taxi",
    "tea",
    "teach",
    "tear",
    "telegraph",
    "telephone",
    "tell",
    "temper",
    "temperature",
    "temple",
    "tempt",
    "tend",
    "tender",
    "tent",
    "term",
    "terrible",
    "test",
    "than",
    "thank",
    "that",
    "the",
    "theater",
    "theatrical",
    "then",
    "there",
    "therefore",
    "these",
    "they",
    "thick",
    "thicken",
    "thief",
    "thin",
    "thing",
    "think",
    "thirst",
    "this",
    "thorn",
    "thorough",
    "those",
    "though",
    "thread",
    "threat",
    "threaten",
    "throat",
    "through",
    "throw",
    "thumb",
    "thunder",
    "thus",
    "ticket",
    "tide",
    "tidy",
    "tie",
    "tight",
    "tighten",
    "till",
    "time",
    "tin",
    "tip",
    "tire",
    "title",
    "to",
    "tobacco",
    "today",
    "toe",
    "together",
    "tomorrow",
    "ton",
    "tongue",
    "tonight",
    "too",
    "tool",
    "tooth",
    "top",
    "total",
    "touch",
    "tough",
    "tour",
    "toward",
    "towel",
    "tower",
    "town",
    "toy",
    "track",
    "trade",
    "train",
    "translate",
    "translation",
    "translator",
    "trap",
    "travel",
    "tray",
    "treasure",
    "treasury",
    "treat",
    "tree",
    "tremble",
    "trial",
    "tribe",
    "trick",
    "trip",
    "trouble",
    "true",
    "trunk",
    "trust",
    "truth",
    "try",
    "tube",
    "tune",
    "turn",
    "twist",
    "type",
    "ugly",
    "umbrella",
    "uncle",
    "under",
    "underneath",
    "understand",
    "union",
    "unit",
    "unite",
    "unity",
    "universal",
    "universe",
    "university",
    "unless",
    "until",
    "up",
    "upon",
    "upper",
    "uppermost",
    "upright",
    "upset",
    "urge",
    "urgent",
    "use",
    "usual",
    "vain",
    "valley",
    "valuable",
    "value",
    "variety",
    "various",
    "veil",
    "verb",
    "verse",
    "very",
    "vessel",
    "victory",
    "view",
    "village",
    "violence",
    "violent",
    "virtue",
    "visit",
    "visitor",
    "voice",
    "vote",
    "vowel",
    "voyage",
    "wage",
    "waist",
    "wait",
    "waiter",
    "wake",
    "walk",
    "wall",
    "wander",
    "want",
    "war",
    "warm",
    "warmth",
    "warn",
    "wash",
    "waste",
    "watch",
    "water",
    "wave",
    "wax",
    "way",
    "we",
    "weak",
    "weaken",
    "wealth",
    "weapon",
    "wear",
    "weather",
    "weave",
    "weed",
    "week",
    "weekday",
    "weekend",
    "weigh",
    "weight",
    "welcome",
    "well",
    "west",
    "western",
    "wet",
    "what",
    "whatever",
    "wheat",
    "wheel",
    "when",
    "whenever",
    "where",
    "wherever",
    "whether",
    "which",
    "whichever",
    "while",
    "whip",
    "whisper",
    "whistle",
    "white",
    "whiten",
    "who",
    "whoever",
    "whole",
    "whom",
    "whose",
    "why",
    "wicked",
    "wide",
    "widen",
    "widow",
    "widower",
    "width",
    "wife",
    "wild",
    "will",
    "win",
    "wind",
    "window",
    "wine",
    "wing",
    "winter",
    "wipe",
    "wire",
    "wisdom",
    "wise",
    "wish",
    "with",
    "within",
    "without",
    "witness",
    "woman",
    "wonder",
    "wood",
    "wooden",
    "wool",
    "woolen",
    "word",
    "work",
    "world",
    "worm",
    "worry",
    "worse",
    "worship",
    "worth",
    "would",
    "wound",
    "wrap",
    "wreck",
    "wrist",
    "write",
    "wrong",
    "yard",
    "year",
    "yellow",
    "yes",
    "yesterday",
    "yet",
    "yield",
    "you",
    "young",
    "youth",
    "zero"
  ]