let allowButton = document.getElementById("allow");
let blockButton = document.getElementById("block");

allowButton.addEventListener("click", async () => {
    console.log("allowing")
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1]
    });
});
blockButton.addEventListener("click", async () => {
    console.log("blocking");
    chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [{
            id: 1,
            action: {type: "redirect", redirect: {url: "http://google.com/gen_204"}},
            condition: {domains: ["wikipedia.org"], urlFilter: "(disambiguation)", "resourceTypes": ["main_frame"]}
        }]
    });
});