chrome.action.onClicked.addListener(function(tab) {
    // open a new popup window with popup.html
    chrome.tabs.create({
        url: "popup.html"
    });
});