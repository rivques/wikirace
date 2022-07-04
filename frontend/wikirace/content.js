console.log("iframe url is " + window.location.href);
if(inIframe()) {
chrome.runtime.sendMessage({loaded: window.location.href});
} else {
    console.log("not in iframe");
}

function inIframe () {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}