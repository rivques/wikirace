if(inIframe()) {
chrome.runtime.sendMessage({loaded: window.location.href, name: document.getElementById("firstHeading").textContent});
}

function inIframe () {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}