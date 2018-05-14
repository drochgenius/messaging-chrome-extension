import { IActionMessageEvent } from './model';
/**
 * Content Script that gets injected in the HMH point of use metadata web application
 *
 * NOTE: Content scripts do not support ES6 modules
 */

// Open the 'app<-->ext' communication channel between App and Chrome extension
const port: chrome.runtime.Port = chrome.runtime.connect({ name: 'app' });

// Listen to messages coming over the 'app' channel
// Relay chrome extension messages to appplication
port.onMessage.addListener((msg: {}): void => {
    console.log('got a message from Habitat', msg);
    window.postMessage(msg, '*');
});

// Relay application messages to chrome extension
self.addEventListener('message', (evt: IActionMessageEvent): void => {
    const action: string = evt.data.action;
    if (action === 'select') {
        console.log('Selecting item', evt.data);
        port.postMessage(evt.data);
    }
});

// Say hello to the chrome extension
self.addEventListener('load', (): void => {
    port.postMessage({ hello: 'I am the hmh app' });
    port.postMessage({ action: 'initialize' });
});
