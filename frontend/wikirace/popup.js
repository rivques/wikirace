const MasterState = {
    HOME: "HOME",
    LOBBY: "LOBBY",
    PRERACE: "PRERACE",
    RACEACTIVE: "RACEACTIVE",
    POSTRACE: "POSTRACE"
}

let masterState = MasterState.HOME;

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