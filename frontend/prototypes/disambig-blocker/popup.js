let allowButton = document.getElementById("allow");
let blockButton = document.getElementById("block");

allowButton.addEventListener("click", async () => {
    console.log("allowing")
    chrome.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: ["block_disambig"]
    });
});
blockButton.addEventListener("click", async () => {
    console.log("blocking");
    chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: ["block_disambig"]
    });
});