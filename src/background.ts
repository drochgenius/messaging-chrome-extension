/**
 * Background worker for the Chrome Extension
 */
import { IContentActionMessage } from './model';

// Inkling Habitat
const HABITAT_URL_PATTERN: string = 'https://habitat.inkling.com/project';
const HABITAT_PORT_NAME: string = 'habitat';

// Application
const APP_URL: string = 'https://s3.amazonaws.com/static.tribalnova.com/habitat/poc/metadata-app';
const APP_PORT_NAME: string = 'app';

let habitatPort: chrome.runtime.Port;
let appPort: chrome.runtime.Port;

function establishHabitatCommunicationChannel(port: chrome.runtime.Port): void {
    console.log('*** Establishing Habitat Channel');
    habitatPort = port;
    port.onMessage.addListener((msg: {}): void => {
        // Create the Application Tab if not already created
        chrome.tabs.query({ url: `${APP_URL}/*` }, (results: chrome.tabs.Tab[]) => {
            for (const tab of results) {
                if (!appPort) {
                    chrome.tabs.reload(tab.id);

                    return;
                }
            }

            if (appPort) {
                console.log('Habitat -----> Application', msg);
                appPort.postMessage(msg);
            } else {
                console.warn('application port disconnected');
            }
        });
    });
}

function establishAppCommunicationChannel(port: chrome.runtime.Port): void {
    console.log('*** Establishing App Channel');

    appPort = port;
    port.onMessage.addListener((msg: {}): void => {
        chrome.tabs.query({ url: `${HABITAT_URL_PATTERN}/*` }, (results: chrome.tabs.Tab[]) => {
            for (const tab of results) {
                if (!habitatPort) {
                    chrome.tabs.reload(tab.id);

                    return;
                }
            }

            if (habitatPort) {
                console.log('Application -----> Habitat', msg);
                habitatPort.postMessage(msg);
            } else {
                console.warn('habitat port disconnected');
            }
        });
    });
}

// Update the declarative rules on install or upgrade.
chrome.runtime.onInstalled.addListener(() => {
    chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
        console.log('Connection request recieved for channel:', port.name);

        if (port.name === HABITAT_PORT_NAME) {
            establishHabitatCommunicationChannel(port);
        }

        if (port.name === APP_PORT_NAME) {
            establishAppCommunicationChannel(port);
        }
    });

    chrome.runtime.onMessage.addListener((message: IContentActionMessage) => {
        console.log('Messsage recieved from popup', message);
        if (message.action === 'open') {
            chrome.tabs.query({ url: `${APP_URL}/*` }, (results: chrome.tabs.Tab[]) => {
                if (results.length < 1) {
                    chrome.tabs.create({ url: `${APP_URL}/index.html` });
                } else {
                    const tabs = [];
                    let windowId;
                    for (const tab of results) {
                        tabs.push(tab.index);
                        windowId = tab.windowId;
                    }
                    chrome.tabs.highlight({ windowId, tabs }, null);
                }
            });
        }
    });
});
