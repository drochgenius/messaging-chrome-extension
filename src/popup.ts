/**
 * Request the background script to open the external application in a new browser tab
 */
document.getElementById('open').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'open' });
});
