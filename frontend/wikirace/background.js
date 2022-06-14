chrome.action.onClicked.addListener(function(tab) {
    // open a new popup window with popup.html
    chrome.windows.create({
        url: "popup.html",
        type: "popup",
        width: 400,
        height: 600
    });
});