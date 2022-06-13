let dAllowButton = document.getElementById("d-allow");
let dBlockButton = document.getElementById("d-block");

dAllowButton.addEventListener("click", async () => {
    console.log("allowing")
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1]
    });
});
dBlockButton.addEventListener("click", async () => {
    console.log("blocking");
    chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [{
            id: 1,
            priority: 4,
            action: {type: "redirect", redirect: {url: "http://google.com/gen_204"}},
            condition: {domains: ["wikipedia.org"], urlFilter: "(disambiguation)", "resourceTypes": ["main_frame"]}
        }]
    });
});

let eAllowButton = document.getElementById("e-allow");
let eBlockButton = document.getElementById("e-block");

eAllowButton.addEventListener("click", async () => {
    console.log("allowing")
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [2, 3]
    });
});
eBlockButton.addEventListener("click", async () => {
    console.log("blocking");
    chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [{
            "id": 2,
            "priority": 3,
            "action": {"type": "allow"},
            "condition": {"urlFilter": "*wikipedia.org*", "resourceTypes": ["main_frame"]}
        },
        {
            "id": 3,
            "priority": 2,
            "action": {"type": "redirect", "redirect": {"url": "http://google.com/gen_204"}},
            "condition": {"initiatorDomains": ["wikipedia.org"], "resourceTypes": ["main_frame"]}
        }] 
    });
});